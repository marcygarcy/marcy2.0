"""
v3.0 – Módulo RMA: monitorização de reembolsos e alertas de Nota de Crédito.

- Deteta reembolsos (banco ou marketplace) e cria/atualiza rma_claims.
- Alerta se passarem 7 dias sem Nota de Crédito do fornecedor na conta corrente.
- Sinaliza perda financeira quando o lucro real fica negativo após devolução.
"""
from __future__ import annotations

import logging
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional

from app.config.database import get_db_connection

logger = logging.getLogger(__name__)


def _next_id(conn, table: str) -> int:
    r = conn.execute(f"SELECT COALESCE(MAX(id), 0) + 1 FROM {table}").fetchone()
    return int(r[0]) if r else 1


class RefundMonitoringService:
    """Monitor de reembolsos e RMA: cria RMA claims e alertas de perda."""

    def __init__(self):
        self.conn = get_db_connection()

    def close(self):
        if self.conn:
            try:
                self.conn.close()
            except Exception:
                pass

    def register_refund(
        self,
        empresa_id: int,
        sales_order_id: Optional[int] = None,
        sales_order_item_id: Optional[int] = None,
        supplier_id: Optional[int] = None,
        refund_customer_value: float = 0,
        reason: Optional[str] = None,
        external_order_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Regista um reembolso e cria um RMA claim (Pending).
        Chamado quando um movimento de reembolso é detetado (banco ou marketplace).
        """
        cid = _next_id(self.conn, "rma_claims")
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self.conn.execute(
            """
            INSERT INTO rma_claims
                (id, empresa_id, sales_order_id, sales_order_item_id, supplier_id,
                 status, refund_customer_value, credit_note_supplier_value, reason, created_at, updated_at, external_order_id)
            VALUES (?, ?, ?, ?, ?, 'Pending', ?, 0, ?, ?, ?, ?)
            """,
            [
                cid,
                empresa_id,
                sales_order_id,
                sales_order_item_id,
                supplier_id,
                refund_customer_value,
                reason,
                now,
                now,
                external_order_id,
            ],
        )
        self.conn.commit()
        return {"id": cid, "status": "Pending", "message": "RMA claim criado"}

    def check_credit_note_in_ledger(self, rma_id: int) -> bool:
        """Verifica se já existe Nota de Crédito na conta corrente para este RMA (por PO ligada à venda)."""
        row = self.conn.execute(
            """
            SELECT rc.sales_order_id, rc.supplier_id, rc.empresa_id
            FROM rma_claims rc WHERE rc.id = ?
            """,
            [rma_id],
        ).fetchone()
        if not row:
            return False
        so_id, sup_id, eid = row
        if not sup_id or not eid:
            return False
        # Verificar se existe lançamento tipo "Nota de Crédito" no ledger para este supplier/empresa
        # ligado à mesma venda (via purchase_orders -> sales)
        r = self.conn.execute(
            """
            SELECT 1 FROM supplier_ledger sl
            WHERE sl.empresa_id = ? AND sl.supplier_id = ?
              AND sl.tipo = 'Nota de Crédito'
              AND (
                  sl.purchase_order_id IN (
                      SELECT poi.purchase_order_id FROM purchase_order_items poi
                      JOIN sales_order_items soi ON soi.id = poi.sales_order_item_id
                      WHERE soi.sales_order_id = ?
                  )
                  OR sl.notas LIKE ?
              )
            LIMIT 1
            """,
            [eid, sup_id, so_id or 0, f"%{so_id}%" if so_id else "%"],
        ).fetchone()
        return r is not None

    def mark_credit_note_received(self, rma_id: int, credit_note_value: float = 0) -> None:
        """Marca o RMA como tendo recebido Nota de Crédito do fornecedor."""
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self.conn.execute(
            """
            UPDATE rma_claims
            SET status = 'Claimed_from_Supplier', credit_note_supplier_value = ?,
                ledger_credit_note_at = ?, updated_at = ?
            WHERE id = ?
            """,
            [credit_note_value, now, now, rma_id],
        )
        self.conn.commit()

    def get_alerts(
        self,
        empresa_id: Optional[int] = None,
        days_without_credit_note: int = 7,
    ) -> List[Dict[str, Any]]:
        """
        Lista alertas RMA:
        - Reembolsos pendentes há mais de N dias sem Nota de Crédito no fornecedor.
        - Opcional: sinalizar quando lucro real da venda fica negativo (perda financeira).
        """
        cutoff = (date.today() - timedelta(days=days_without_credit_note)).strftime("%Y-%m-%d")
        conds = ["rc.status = 'Pending'", "rc.created_at < ?"]
        params: List[Any] = [cutoff]
        if empresa_id is not None:
            conds.append("rc.empresa_id = ?")
            params.append(empresa_id)
        where = " AND ".join(conds)
        rows = self.conn.execute(
            f"""
            SELECT rc.id, rc.empresa_id, rc.sales_order_id, rc.supplier_id,
                   rc.refund_customer_value, rc.credit_note_supplier_value,
                   rc.reason, rc.created_at, rc.external_order_id,
                   s.nome AS supplier_nome, e.nome AS empresa_nome
            FROM rma_claims rc
            LEFT JOIN suppliers s ON s.id = rc.supplier_id
            LEFT JOIN empresas e ON e.id = rc.empresa_id
            WHERE {where}
            ORDER BY rc.created_at ASC
            """,
            params,
        ).fetchall()
        alerts = []
        for r in rows:
            rma_id, eid, so_id, sup_id, ref_val, cn_val, reason, created, ext_id, sup_nome, emp_nome = r
            # Verificar se entretanto já foi abatido no ledger
            if self.check_credit_note_in_ledger(rma_id):
                self.mark_credit_note_received(rma_id, float(cn_val or 0))
                continue
            alerts.append({
                "id": rma_id,
                "empresa_id": eid,
                "sales_order_id": so_id,
                "supplier_id": sup_id,
                "supplier_nome": sup_nome or "—",
                "empresa_nome": emp_nome or "—",
                "refund_customer_value": float(ref_val or 0),
                "credit_note_supplier_value": float(cn_val or 0),
                "reason": reason,
                "created_at": str(created) if created else None,
                "external_order_id": ext_id,
                "alert_type": "pending_credit_note",
                "message": f"Reembolso pendente de Nota de Crédito no Fornecedor {sup_nome or 'N/A'} (Order: {ext_id or so_id or '—'})",
            })
        return alerts

    def get_all_pending_rma(self, empresa_id: Optional[int] = None) -> List[Dict[str, Any]]:
        """Lista todos os RMA em estado Pending (para dashboard)."""
        conds = ["rc.status = 'Pending'"]
        params: List[Any] = []
        if empresa_id is not None:
            conds.append("rc.empresa_id = ?")
            params.append(empresa_id)
        where = " AND ".join(conds)
        rows = self.conn.execute(
            f"""
            SELECT rc.id, rc.empresa_id, rc.sales_order_id, rc.supplier_id,
                   rc.refund_customer_value, rc.created_at, rc.external_order_id,
                   s.nome AS supplier_nome
            FROM rma_claims rc
            LEFT JOIN suppliers s ON s.id = rc.supplier_id
            WHERE {where}
            ORDER BY rc.created_at DESC
            """,
            params,
        ).fetchall()
        return [
            {
                "id": r[0],
                "empresa_id": r[1],
                "sales_order_id": r[2],
                "supplier_id": r[3],
                "refund_customer_value": float(r[4] or 0),
                "created_at": str(r[5]) if r[5] else None,
                "external_order_id": r[6],
                "supplier_nome": r[7],
            }
            for r in rows
        ]
