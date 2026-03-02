"""
Serviço de cancelamento de vendas: atualiza venda, emite NC ao cliente, regista RMA e cria stock em escritório
quando o fornecedor não aceita devolução (mercadoria fica no escritório para reutilização futura).
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from app.config.database import get_db_connection
from app.services.billing_service import BillingService
from app.services.refund_monitoring_service import RefundMonitoringService


def _next_id(conn, table: str) -> int:
    r = conn.execute(f"SELECT COALESCE(MAX(id), 0) + 1 FROM {table}").fetchone()
    return int(r[0]) if r and r[0] else 1


class CancellationService:
    """
    Orquestra: cancelar venda -> NC cliente -> RMA (disposition) -> office_stock quando ficamos com a mercadoria.
    """

    def __init__(self):
        self.conn = get_db_connection()

    def close(self):
        if self.conn:
            try:
                self.conn.close()
            except Exception:
                pass

    def cancel_sale(
        self,
        sales_order_id: int,
        reason: str,
        supplier_accepts_return: bool = False,
        create_credit_note: bool = True,
        refund_customer_value: Optional[float] = None,
    ) -> Dict[str, Any]:
        """
        Cancela uma venda: atualiza status, opcionalmente emite NC ao cliente, cria RMA e,
        se o fornecedor não aceitar devolução, cria linhas em office_stock para itens no escritório não expedidos.
        """
        so = self.conn.execute(
            "SELECT id, empresa_id, status, total_net_value FROM sales_orders WHERE id = ?",
            [sales_order_id],
        ).fetchone()
        if not so:
            return {"success": False, "error": "Venda não encontrada", "sales_order_id": sales_order_id}
        if str(so[2]).lower() == "cancelled":
            return {"success": False, "error": "Venda já está cancelada", "sales_order_id": sales_order_id}

        empresa_id = int(so[1])
        total_net = float(so[3] or 0)
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        # 1) Marcar venda como cancelada
        self.conn.execute(
            "UPDATE sales_orders SET status = 'Cancelled', cancelled_at = ?, cancelled_reason = ? WHERE id = ?",
            [now, reason or "Cliente cancelou", sales_order_id],
        )

        credit_note_info = None
        if create_credit_note:
            billing = BillingService()
            try:
                cn = billing.create_customer_credit_note(sales_order_id)
                if cn:
                    credit_note_info = {"document_number": cn.get("document_number"), "already_issued": cn.get("already_issued")}
            finally:
                billing.close()

        # 2) Criar RMA claim (reembolso ao cliente)
        disposition = "stock_we_keep" if not supplier_accepts_return else "return_to_supplier"
        rma_svc = RefundMonitoringService()
        try:
            rma_result = rma_svc.register_refund(
                empresa_id=empresa_id,
                sales_order_id=sales_order_id,
                refund_customer_value=refund_customer_value if refund_customer_value is not None else total_net,
                reason=reason,
            )
        finally:
            rma_svc.close()

        rma_id = rma_result.get("id")
        if rma_id is not None:
            self.conn.execute(
                "UPDATE rma_claims SET disposition = ?, supplier_accepts_return = ? WHERE id = ?",
                [disposition, 0 if not supplier_accepts_return else 1, rma_id],
            )
            self.conn.commit()

        # 3) Se ficamos com a mercadoria: criar office_stock para itens no escritório não expedidos
        office_stock_created: List[Dict[str, Any]] = []
        if not supplier_accepts_return and rma_id is not None:
            rows = self.conn.execute(
                """
                SELECT poi.id, poi.purchase_order_id, poi.sales_order_item_id, poi.sku_marketplace, poi.sku_fornecedor,
                       poi.quantidade, poi.quantidade_recebida, poi.logistics_status, po.office_id
                FROM purchase_order_items poi
                JOIN purchase_orders po ON po.id = poi.purchase_order_id
                JOIN sales_order_items soi ON soi.id = poi.sales_order_item_id
                WHERE soi.sales_order_id = ?
                  AND COALESCE(poi.logistics_status, 'pending_receipt') = 'received_at_office'
                """,
                [sales_order_id],
            ).fetchall()
            for r in rows:
                poi_id, po_id, soi_id, sku_mkt, sku_frn, qty, qty_rcv, log_status, office_id = r
                qty_val = float(qty_rcv or qty or 1)
                if qty_val <= 0:
                    continue
                os_id = _next_id(self.conn, "office_stock")
                self.conn.execute(
                    """
                    INSERT INTO office_stock
                    (id, empresa_id, office_id, sku_marketplace, sku_fornecedor, quantity, source_type,
                     source_sales_order_id, source_sales_order_item_id, source_purchase_order_id, source_purchase_order_item_id,
                     status, condition, rma_claim_id)
                    VALUES (?, ?, ?, ?, ?, ?, 'cancelled_order', ?, ?, ?, ?, 'available', 'new', ?)
                    """,
                    [os_id, empresa_id, office_id, sku_mkt or "", sku_frn, qty_val, sales_order_id, soi_id, po_id, poi_id, rma_id],
                )
                office_stock_created.append({
                    "office_stock_id": os_id,
                    "sku_marketplace": sku_mkt,
                    "quantity": qty_val,
                    "source_purchase_order_id": po_id,
                })
            self.conn.commit()

        return {
            "success": True,
            "sales_order_id": sales_order_id,
            "status": "Cancelled",
            "credit_note": credit_note_info,
            "rma_claim_id": rma_id,
            "disposition": disposition,
            "office_stock_created": office_stock_created,
        }
