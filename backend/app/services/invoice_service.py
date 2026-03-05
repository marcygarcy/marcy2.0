"""
InvoiceService v1.0 — Registo de faturas de fornecedores (ERP-grade, multi-PO).

Uma fatura pode cobrir múltiplas POs do mesmo fornecedor.
- Tabela supplier_invoices: cabeçalho da fatura
- Tabela supplier_invoice_pos: junção fatura <-> PO (N:M)
- Ao registar: cria lançamento único na supplier_ledger via AccountingMatchService
"""
from __future__ import annotations

import logging
from datetime import date
from typing import Any, Dict, List, Optional

from app.config.database import get_db_connection
from app.services.accounting_match_service import AccountingMatchService

logger = logging.getLogger(__name__)


def _next_id(conn, table: str) -> int:
    row = conn.execute(f"SELECT COALESCE(MAX(id), 0) + 1 FROM {table}").fetchone()
    return int(row[0]) if row else 1


class InvoiceService:
    def __init__(self):
        self.conn = get_db_connection()

    def close(self):
        try:
            if self.conn:
                self.conn.close()
        except Exception:
            pass

    def get_open_pos_for_supplier(
        self,
        supplier_id: int,
        empresa_id: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        """
        Lista todas as POs do fornecedor (Draft/Ordered/Paid) para mostrar no modal de seleção.
        Inclui invoice_ref existente (para mostrar aviso se já tem fatura).
        """
        conds = [
            "po.supplier_id = ?",
            "po.status IN ('Draft','Ordered','Paid')",
            "(po.invoice_ref IS NULL OR po.invoice_ref = '')",
            "NOT EXISTS (SELECT 1 FROM supplier_invoices si WHERE si.purchase_order_id = po.id)",
            "NOT EXISTS (SELECT 1 FROM supplier_invoice_pos sip WHERE sip.purchase_order_id = po.id)",
        ]
        params: list = [supplier_id]
        if empresa_id is not None:
            conds.append("po.empresa_id = ?")
            params.append(empresa_id)
        where = " AND ".join(conds)

        rows = self.conn.execute(
            f"""
            SELECT po.id, po.status, COALESCE(po.total_final, 0) AS total_final,
                   po.data_criacao, po.supplier_order_id, po.invoice_ref,
                   po.empresa_id, e.nome AS empresa_nome
            FROM purchase_orders po
            LEFT JOIN empresas e ON e.id = po.empresa_id
            WHERE {where}
            ORDER BY po.data_criacao DESC
            """,
            params,
        ).fetchall()

        cols = ["id", "status", "total_final", "data_criacao", "supplier_order_id",
                "invoice_ref", "empresa_id", "empresa_nome"]
        result = []
        for r in rows:
            d = dict(zip(cols, r))
            d["total_final"] = float(d["total_final"] or 0)
            d["data_criacao"] = str(d["data_criacao"])[:10] if d["data_criacao"] else None
            result.append(d)
        return result

    def create_invoice(
        self,
        empresa_id: int,
        supplier_id: int,
        invoice_ref: str,
        invoice_amount: float,
        invoice_date: Optional[str],
        po_ids: List[int],
        notas: Optional[str] = None,
        post_to_ledger: bool = True,
    ) -> Dict[str, Any]:
        """
        1. Cria registo em supplier_invoices
        2. Cria ligações em supplier_invoice_pos
        3. Atualiza invoice_ref + invoice_amount nas POs (retrocompatibilidade)
        4. Se post_to_ledger: cria lançamento "Fatura" na supplier_ledger
        5. Atualiza status para 'in_ledger' se lançamento criado
        """
        inv_id = _next_id(self.conn, "supplier_invoices")
        inv_date = invoice_date or str(date.today())

        self.conn.execute(
            """
            INSERT INTO supplier_invoices
                (id, empresa_id, supplier_id, invoice_ref, invoice_date,
                 invoice_amount, status, notas)
            VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
            """,
            [inv_id, empresa_id, supplier_id, invoice_ref.strip(),
             inv_date, round(float(invoice_amount), 2), notas],
        )

        for po_id in po_ids:
            sip_id = _next_id(self.conn, "supplier_invoice_pos")
            self.conn.execute(
                "INSERT INTO supplier_invoice_pos (id, invoice_id, purchase_order_id) VALUES (?, ?, ?)",
                [sip_id, inv_id, po_id],
            )
            # Retrocompatibilidade: gravar invoice_ref e invoice_amount em cada PO
            self.conn.execute(
                "UPDATE purchase_orders SET invoice_ref = ?, invoice_amount = ? WHERE id = ?",
                [invoice_ref.strip(), round(float(invoice_amount), 2), po_id],
            )

        self.conn.commit()

        ledger_created = False
        if post_to_ledger:
            try:
                acct = AccountingMatchService()
                po_link = po_ids[0] if len(po_ids) == 1 else None
                n_pos = len(po_ids)
                po_label = (
                    f"PO #{po_ids[0]}"
                    if n_pos == 1
                    else f"{n_pos} POs ({', '.join(f'#{p}' for p in po_ids)})"
                )
                acct.create_ledger_entry(
                    empresa_id=empresa_id,
                    supplier_id=supplier_id,
                    tipo="Fatura",
                    valor_credito=round(float(invoice_amount), 2),
                    documento_ref=invoice_ref.strip(),
                    purchase_order_id=po_link,
                    notas=f"Fatura {invoice_ref} — {po_label}",
                    data_movimento=date.fromisoformat(inv_date) if inv_date else None,
                )
                acct.close()
                ledger_created = True
                self.conn.execute(
                    "UPDATE supplier_invoices SET status = 'in_ledger' WHERE id = ?", [inv_id]
                )
                self.conn.commit()
            except Exception as e:
                logger.warning(f"Erro ao criar lançamento ledger para fatura {inv_id}: {e}")

        return {
            "invoice_id": inv_id,
            "invoice_ref": invoice_ref,
            "invoice_amount": round(float(invoice_amount), 2),
            "po_count": len(po_ids),
            "ledger_created": ledger_created,
        }

    def list_invoices(
        self,
        empresa_id: Optional[int] = None,
        supplier_id: Optional[int] = None,
        status: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[List[Dict[str, Any]], int]:
        conds = ["1=1"]
        params: list = []
        if empresa_id is not None:
            conds.append("si.empresa_id = ?")
            params.append(empresa_id)
        if supplier_id is not None:
            conds.append("si.supplier_id = ?")
            params.append(supplier_id)
        if status:
            conds.append("si.status = ?")
            params.append(status)
        where = " AND ".join(conds)

        total = self.conn.execute(
            f"SELECT COUNT(*) FROM supplier_invoices si WHERE {where}", params
        ).fetchone()[0]

        rows = self.conn.execute(
            f"""
            SELECT si.id, si.empresa_id, si.supplier_id, si.invoice_ref, si.invoice_date,
                   si.invoice_amount, si.status, si.notas, si.data_criacao,
                   s.nome AS supplier_nome, e.nome AS empresa_nome,
                   (SELECT COUNT(*) FROM supplier_invoice_pos sip
                    WHERE sip.invoice_id = si.id) AS po_count,
                   EXISTS(
                       SELECT 1 FROM supplier_ledger sl
                       WHERE sl.documento_ref = si.invoice_ref
                         AND sl.supplier_id = si.supplier_id
                         AND sl.tipo = 'Fatura'
                   ) AS has_ledger_entry
            FROM supplier_invoices si
            LEFT JOIN suppliers s ON s.id = si.supplier_id
            LEFT JOIN empresas  e ON e.id = si.empresa_id
            WHERE {where}
            ORDER BY si.data_criacao DESC
            LIMIT ? OFFSET ?
            """,
            params + [limit, offset],
        ).fetchall()

        cols = ["id", "empresa_id", "supplier_id", "invoice_ref", "invoice_date",
                "invoice_amount", "status", "notas", "data_criacao",
                "supplier_nome", "empresa_nome", "po_count", "has_ledger_entry"]
        result = []
        for r in rows:
            d = dict(zip(cols, r))
            d["invoice_amount"] = float(d["invoice_amount"] or 0)
            d["data_criacao"] = str(d["data_criacao"])[:10] if d["data_criacao"] else None
            d["invoice_date"] = str(d["invoice_date"])[:10] if d["invoice_date"] else None
            d["has_ledger_entry"] = bool(d["has_ledger_entry"])
            d["po_ids"] = self._get_po_ids_for_invoice(d["id"])
            result.append(d)
        return result, int(total)

    def get_invoice(self, invoice_id: int) -> Optional[Dict[str, Any]]:
        row = self.conn.execute(
            """
            SELECT si.id, si.empresa_id, si.supplier_id, si.invoice_ref, si.invoice_date,
                   si.invoice_amount, si.status, si.notas, si.data_criacao,
                   s.nome AS supplier_nome, e.nome AS empresa_nome
            FROM supplier_invoices si
            LEFT JOIN suppliers s ON s.id = si.supplier_id
            LEFT JOIN empresas  e ON e.id = si.empresa_id
            WHERE si.id = ?
            """,
            [invoice_id],
        ).fetchone()
        if not row:
            return None
        cols = ["id", "empresa_id", "supplier_id", "invoice_ref", "invoice_date",
                "invoice_amount", "status", "notas", "data_criacao",
                "supplier_nome", "empresa_nome"]
        d = dict(zip(cols, row))
        d["invoice_amount"] = float(d["invoice_amount"] or 0)
        d["data_criacao"] = str(d["data_criacao"])[:10] if d["data_criacao"] else None
        d["invoice_date"] = str(d["invoice_date"])[:10] if d["invoice_date"] else None
        d["po_ids"] = self._get_po_ids_for_invoice(invoice_id)
        d["pos"] = self._get_pos_for_invoice(invoice_id)
        return d

    def _get_po_ids_for_invoice(self, invoice_id: int) -> List[int]:
        rows = self.conn.execute(
            "SELECT purchase_order_id FROM supplier_invoice_pos WHERE invoice_id = ? ORDER BY id",
            [invoice_id],
        ).fetchall()
        return [int(r[0]) for r in rows]

    def _get_pos_for_invoice(self, invoice_id: int) -> List[Dict]:
        rows = self.conn.execute(
            """
            SELECT po.id, po.status, COALESCE(po.total_final, 0), po.data_criacao,
                   po.supplier_order_id, e.nome AS empresa_nome
            FROM supplier_invoice_pos sip
            JOIN purchase_orders po ON po.id = sip.purchase_order_id
            LEFT JOIN empresas e ON e.id = po.empresa_id
            WHERE sip.invoice_id = ?
            ORDER BY po.id
            """,
            [invoice_id],
        ).fetchall()
        result = []
        for r in rows:
            result.append({
                "id": r[0], "status": r[1], "total_final": float(r[2] or 0),
                "data_criacao": str(r[3])[:10] if r[3] else None,
                "supplier_order_id": r[4], "empresa_nome": r[5],
            })
        return result
