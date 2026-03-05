"""
Módulo Incidências: fluxo Compras → Logística → Contabilidade.

- Tab Intervenção de Compras: cancelamento solicitado ao fornecedor (Fornecedor Aceitou/Recusou).
- Tab Reembolsos Pendentes: registar Nota de Crédito (Transferência ou Crédito em Conta).
- Tab Logística/Interceção: interceção sucesso ou perda assumida (imparidade).

Garante rastreabilidade contabilística e bloqueio de pagamentos quando aplicável.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from app.config.database import get_db_connection


def _next_id(conn, table: str) -> int:
    r = conn.execute(f"SELECT COALESCE(MAX(id), 0) + 1 FROM {table}").fetchone()
    return int(r[0] if r and r[0] else 1)


# Fases do workflow (igual ao frontend)
PHASE_INTERVENCAO = "intervencao_compras"
PHASE_REEMBOLSOS = "reembolsos_pendentes"
PHASE_LOGISTICA = "logistica_intercecao"
PHASE_AUTO_RESOLVIDA = "auto_resolvida"
PHASE_PERDA_ASSUMIDA = "perda_assumida"

NC_TIPO_TRANSFERENCIA = "transferencia"
NC_TIPO_CREDITO_CONTA = "credito_conta"


class IncidentService:
    """Serviço do fluxo de Incidências (cancelamentos → reembolsos → logística)."""

    def __init__(self):
        self.conn = get_db_connection()

    def close(self):
        try:
            if self.conn:
                self.conn.close()
        except Exception:
            pass

    def list_by_phase(
        self,
        phase: str,
        empresa_id: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        """Lista incidências (rma_claims) por fase do workflow."""
        conds = ["COALESCE(rc.workflow_phase, 'intervencao_compras') = ?"]
        params: List[Any] = [phase]
        if empresa_id is not None:
            conds.append("rc.empresa_id = ?")
            params.append(empresa_id)
        where = " AND ".join(conds)
        rows = self.conn.execute(
            f"""
            SELECT rc.id, rc.empresa_id, rc.sales_order_id, rc.supplier_id, rc.purchase_order_id,
                   rc.refund_customer_value, rc.credit_note_supplier_value, rc.reason,
                   rc.created_at, rc.external_order_id, rc.payment_was_made, rc.payment_blocked_at,
                   rc.workflow_phase, rc.credit_note_numero, rc.credit_note_tipo,
                   s.nome AS supplier_nome,
                   e.nome AS empresa_nome,
                   po.status AS po_status,
                   COALESCE(po.total_final, 0) AS po_total
            FROM rma_claims rc
            LEFT JOIN suppliers s ON s.id = rc.supplier_id
            LEFT JOIN empresas e ON e.id = rc.empresa_id
            LEFT JOIN purchase_orders po ON po.id = rc.purchase_order_id
            WHERE {where}
            ORDER BY rc.created_at DESC
            """,
            params,
        ).fetchall()
        cols = [
            "id", "empresa_id", "sales_order_id", "supplier_id", "purchase_order_id",
            "refund_customer_value", "credit_note_supplier_value", "reason",
            "created_at", "external_order_id", "payment_was_made", "payment_blocked_at",
            "workflow_phase", "credit_note_numero", "credit_note_tipo",
            "supplier_nome", "empresa_nome", "po_status", "po_total",
        ]
        return [dict(zip(cols, r)) for r in rows]

    def _get_incident(self, incident_id: int) -> Optional[Dict[str, Any]]:
        row = self.conn.execute(
            """
            SELECT id, empresa_id, sales_order_id, supplier_id, purchase_order_id,
                   workflow_phase, payment_was_made, payment_blocked_at
            FROM rma_claims WHERE id = ?
            """,
            [incident_id],
        ).fetchone()
        if not row:
            return None
        return {
            "id": row[0],
            "empresa_id": row[1],
            "sales_order_id": row[2],
            "supplier_id": row[3],
            "purchase_order_id": row[4],
            "workflow_phase": row[5],
            "payment_was_made": bool(row[6]),
            "payment_blocked_at": row[7],
        }

    def fornecedor_aceitou(self, incident_id: int, payment_was_made: bool) -> Dict[str, Any]:
        """
        Operador clicou "Fornecedor Aceitou".
        Se pagamento NÃO foi feito → bloqueia a PO (cadeado financeiro) e marca auto_resolvida.
        Se pagamento JÁ foi feito → move para reembolsos_pendentes.
        """
        inc = self._get_incident(incident_id)
        if not inc:
            return {"success": False, "error": "Incidência não encontrada"}
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        po_id = inc.get("purchase_order_id")
        if not payment_was_made and po_id:
            self.conn.execute(
                "UPDATE purchase_orders SET payment_blocked = 1 WHERE id = ?",
                [po_id],
            )
            self.conn.execute(
                "UPDATE rma_claims SET workflow_phase = ?, payment_was_made = 0, payment_blocked_at = ?, resolved_at = ?, updated_at = ? WHERE id = ?",
                [PHASE_AUTO_RESOLVIDA, now, now, now, incident_id],
            )
        else:
            self.conn.execute(
                "UPDATE rma_claims SET workflow_phase = ?, payment_was_made = 1, updated_at = ? WHERE id = ?",
                [PHASE_REEMBOLSOS, now, incident_id],
            )
        self.conn.commit()
        return {"success": True, "workflow_phase": PHASE_REEMBOLSOS if payment_was_made else PHASE_AUTO_RESOLVIDA}

    def fornecedor_recusou(self, incident_id: int) -> Dict[str, Any]:
        """Operador clicou "Fornecedor Recusou" → move para Logística (Interceção)."""
        inc = self._get_incident(incident_id)
        if not inc:
            return {"success": False, "error": "Incidência não encontrada"}
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self.conn.execute(
            "UPDATE rma_claims SET workflow_phase = ?, updated_at = ? WHERE id = ?",
            [PHASE_LOGISTICA, now, incident_id],
        )
        self.conn.commit()
        return {"success": True, "workflow_phase": PHASE_LOGISTICA}

    def registar_nc(
        self,
        incident_id: int,
        numero_nc: str,
        valor: float,
        tipo: str,
    ) -> Dict[str, Any]:
        """
        Regista Nota de Crédito do fornecedor.
        tipo: 'transferencia' ou 'credito_conta'.
        Se credito_conta → insere em supplier_ledger (valor_credito) para abater no próximo lote.
        """
        inc = self._get_incident(incident_id)
        if not inc:
            return {"success": False, "error": "Incidência não encontrada"}
        if not numero_nc or valor <= 0:
            return {"success": False, "error": "Número da NC e valor (€) são obrigatórios."}
        if tipo not in (NC_TIPO_TRANSFERENCIA, NC_TIPO_CREDITO_CONTA):
            return {"success": False, "error": "Tipo de reembolso inválido."}
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        today = datetime.now().strftime("%Y-%m-%d")
        empresa_id = inc["empresa_id"]
        supplier_id = inc["supplier_id"]
        if not supplier_id:
            return {"success": False, "error": "Incidência sem fornecedor associado."}
        if tipo == NC_TIPO_CREDITO_CONTA:
            lid = _next_id(self.conn, "supplier_ledger")
            self.conn.execute(
                """
                INSERT INTO supplier_ledger (id, empresa_id, supplier_id, data_movimento, tipo, documento_ref, purchase_order_id, valor_credito, valor_debito, notas, created_at)
                VALUES (?, ?, ?, ?, 'Nota de Crédito', ?, ?, ?, 0, ?, ?)
                """,
                [lid, empresa_id, supplier_id, today, numero_nc, inc.get("purchase_order_id"), valor, f"RMA incident #{incident_id}", now],
            )
        self.conn.execute(
            """
            UPDATE rma_claims SET status = 'Claimed_from_Supplier', credit_note_supplier_value = ?,
                credit_note_numero = ?, credit_note_tipo = ?, workflow_phase = ?, resolved_at = ?, updated_at = ?, ledger_credit_note_at = ?
            WHERE id = ?
            """,
            [valor, numero_nc, tipo, PHASE_AUTO_RESOLVIDA, now, now, now, incident_id],
        )
        self.conn.commit()
        return {"success": True, "workflow_phase": PHASE_AUTO_RESOLVIDA}

    def intercecao_sucesso(self, incident_id: int) -> Dict[str, Any]:
        """Interceção com sucesso – mercadoria a voltar ao armazém. Marca como auto-resolvida."""
        inc = self._get_incident(incident_id)
        if not inc:
            return {"success": False, "error": "Incidência não encontrada"}
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self.conn.execute(
            "UPDATE rma_claims SET workflow_phase = ?, resolved_at = ?, updated_at = ? WHERE id = ?",
            [PHASE_AUTO_RESOLVIDA, now, now, incident_id],
        )
        self.conn.commit()
        return {"success": True, "workflow_phase": PHASE_AUTO_RESOLVIDA}

    def perda_assumida(self, incident_id: int, valor_imparidade: Optional[float] = None) -> Dict[str, Any]:
        """
        Perda assumida (cliente recebeu / entrega efetuada).
        Marca fase perda_assumida e regista evento para Finance (imparidade).
        """
        inc = self._get_incident(incident_id)
        if not inc:
            return {"success": False, "error": "Incidência não encontrada"}
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        po_id = inc.get("purchase_order_id")
        if valor_imparidade is None and po_id:
            row = self.conn.execute("SELECT COALESCE(total_final, 0) FROM purchase_orders WHERE id = ?", [po_id]).fetchone()
            valor_imparidade = float(row[0] or 0) if row else 0
        elif valor_imparidade is None:
            valor_imparidade = 0
        self.conn.execute(
            "UPDATE rma_claims SET workflow_phase = ?, resolved_at = ?, updated_at = ? WHERE id = ?",
            [PHASE_PERDA_ASSUMIDA, now, now, incident_id],
        )
        # Evento para contabilidade: pode ser guardado numa tabela impairment_events ou como nota no supplier_ledger
        if valor_imparidade > 0 and inc.get("supplier_id") and inc.get("empresa_id"):
            lid = _next_id(self.conn, "supplier_ledger")
            today = datetime.now().strftime("%Y-%m-%d")
            self.conn.execute(
                """
                INSERT INTO supplier_ledger (id, empresa_id, supplier_id, data_movimento, tipo, documento_ref, purchase_order_id, valor_credito, valor_debito, notas, created_at)
                VALUES (?, ?, ?, ?, 'Imparidade/Perda', ?, ?, 0, ?, ?, ?)
                """,
                [lid, inc["empresa_id"], inc["supplier_id"], today, f"Perda RMA #{incident_id}", po_id, valor_imparidade, f"Perda assumida incidência #{incident_id}", now],
            )
        self.conn.commit()
        return {"success": True, "workflow_phase": PHASE_PERDA_ASSUMIDA, "valor_imparidade": valor_imparidade}
