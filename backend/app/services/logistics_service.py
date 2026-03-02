"""
Physical Hub – Gestão de receção e expedição no escritório.
- receive_items: entrada de artigos de uma PO; valida quantidades; regista eventos e quantidade_recebida.
- dispatch_item: saída para o cliente; cria logistics_event; placeholder para atualizar tracking no marketplace.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from app.config.database import get_db_connection

EVENT_RECEIVED = "received"
EVENT_DISPATCHED = "dispatched"
STATUS_PENDING_RECEIPT = "pending_receipt"
STATUS_RECEIVED_AT_OFFICE = "received_at_office"
STATUS_DISPATCHED_TO_CUSTOMER = "dispatched_to_customer"


def _next_id(conn, table: str) -> int:
    r = conn.execute(f"SELECT COALESCE(MAX(id), 0) + 1 FROM {table}").fetchone()
    return int(r[0]) if r and r[0] else 1


def update_marketplace_tracking_placeholder(sales_order_item_id: Optional[int], tracking_number: Optional[str]) -> str:
    """
    Placeholder: quando o item é expedido do escritório, atualizar status/tracking na marketplace.
    Sem implementação real da API do marketplace; apenas log/retorno fixo.
    """
    # TODO: integrar com API do marketplace (ex.: Mirakl, etc.)
    return "placeholder_called"


def _propagate_shipping_to_sales_orders(
    conn: Any,
    purchase_order_id: int,
    tracking_number: Optional[str],
    carrier_name: Optional[str],
    carrier_status: Optional[str],
) -> None:
    """
    Propaga shipping_status, tracking_number, carrier_name, carrier_status e shipped_at
    para os sales_orders ligados a esta PO (via purchase_order_items.sales_order_item_id -> sales_order_items.sales_order_id).
    """
    rows = conn.execute(
        """
        SELECT DISTINCT soi.sales_order_id
        FROM purchase_order_items poi
        JOIN sales_order_items soi ON soi.id = poi.sales_order_item_id
        WHERE poi.purchase_order_id = ? AND poi.sales_order_item_id IS NOT NULL
        """,
        [purchase_order_id],
    ).fetchall()
    tracking_val = (tracking_number or "").strip() or None
    carrier_name_val = (carrier_name or "").strip() or None
    carrier_status_val = (carrier_status or "").strip() or None
    for (sales_order_id,) in rows:
        conn.execute(
            """
            UPDATE sales_orders
            SET shipping_status = 'shipped', tracking_number = ?, carrier_name = ?, carrier_status = ?, shipped_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            [tracking_val, carrier_name_val, carrier_status_val, sales_order_id],
        )


class LogisticsManager:
    """Serviço de receção e expedição no escritório (Physical Hub)."""

    def __init__(self):
        self.conn = get_db_connection()

    def close(self) -> None:
        try:
            self.conn.close()
        except Exception:
            pass

    def receive_items(
        self,
        purchase_order_id: int,
        office_id: int,
        items: List[Dict[str, Any]],
        created_by: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Regista receção de artigos de uma PO consolidada.
        items: lista de { purchase_order_item_id, quantity_received, serial_number?, imei? }.
        Valida que quantity_received <= quantidade pedida e que total recebido não excede.
        Atualiza quantidade_recebida e logistics_status; insere logistics_events.
        """
        errors: List[str] = []
        events_created: List[Dict[str, Any]] = []

        for it in items:
            poi_id = it.get("purchase_order_item_id")
            qty_received = float(it.get("quantity_received") or 0)
            serial = (it.get("serial_number") or "").strip() or None
            imei = (it.get("imei") or "").strip() or None
            if poi_id is None or qty_received <= 0:
                continue
            row = self.conn.execute(
                """
                SELECT poi.id, poi.quantidade, COALESCE(poi.quantidade_recebida, 0), po.id
                FROM purchase_order_items poi
                JOIN purchase_orders po ON po.id = poi.purchase_order_id
                WHERE poi.id = ? AND poi.purchase_order_id = ?
                """,
                [poi_id, purchase_order_id],
            ).fetchone()
            if not row:
                errors.append(f"Item {poi_id} não encontrado ou não pertence à PO {purchase_order_id}")
                continue
            _, quantidade, qty_already, _ = row
            quantidade = float(quantidade or 0)
            qty_already = float(qty_already or 0)
            if qty_received + qty_already > quantidade:
                errors.append(f"Item {poi_id}: recebido {qty_received} excede pendente {quantidade - qty_already}")
                continue
            new_total = qty_already + qty_received
            self.conn.execute(
                "UPDATE purchase_order_items SET quantidade_recebida = ?, logistics_status = ? WHERE id = ?",
                [new_total, STATUS_RECEIVED_AT_OFFICE if new_total >= quantidade else STATUS_PENDING_RECEIPT, poi_id],
            )
            event_id = _next_id(self.conn, "logistics_events")
            self.conn.execute(
                """
                INSERT INTO logistics_events (id, purchase_order_id, purchase_order_item_id, office_id, event_type, quantity, serial_number, imei, created_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [event_id, purchase_order_id, poi_id, office_id, EVENT_RECEIVED, qty_received, serial, imei, created_by],
            )
            events_created.append({"id": event_id, "purchase_order_item_id": poi_id, "quantity": qty_received})

        self.conn.commit()
        return {"success": True, "events_created": events_created, "errors": errors}

    def dispatch_item(
        self,
        purchase_order_item_id: int,
        office_id: int,
        quantity: float,
        tracking_number: Optional[str] = None,
        carrier_name: Optional[str] = None,
        carrier_status: Optional[str] = None,
        created_by: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Regista expedição do item para o cliente. Cria logistics_event; atualiza logistics_status.
        Chama placeholder para atualizar tracking no marketplace.
        """
        row = self.conn.execute(
            """
            SELECT poi.id, poi.quantidade_recebida, poi.quantidade, poi.logistics_status, poi.sales_order_item_id
            FROM purchase_order_items poi
            WHERE poi.id = ?
            """,
            [purchase_order_item_id],
        ).fetchone()
        if not row:
            return {"success": False, "error": "Item não encontrado", "event_id": None, "marketplace_update": None}
        _, qty_received, quantidade, status, sales_order_item_id = row
        qty_received = float(qty_received or 0)
        quantidade = float(quantidade or 0)
        qty = float(quantity or 0)
        if qty <= 0 or qty > qty_received:
            return {"success": False, "error": f"Quantidade a expedir inválida (recebido: {qty_received})", "event_id": None, "marketplace_update": None}
        if status != STATUS_RECEIVED_AT_OFFICE:
            return {"success": False, "error": "Item deve estar em received_at_office para expedir", "event_id": None, "marketplace_update": None}

        event_id = _next_id(self.conn, "logistics_events")
        po_id_row = self.conn.execute(
            "SELECT purchase_order_id FROM purchase_order_items WHERE id = ?",
            [purchase_order_item_id],
        ).fetchone()
        po_id = po_id_row[0] if po_id_row else None
        self.conn.execute(
            """
            INSERT INTO logistics_events (id, purchase_order_id, purchase_order_item_id, office_id, event_type, quantity, tracking_number, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [event_id, po_id, purchase_order_item_id, office_id, EVENT_DISPATCHED, qty, (tracking_number or "").strip() or None, created_by],
        )
        self.conn.execute(
            "UPDATE purchase_order_items SET logistics_status = ? WHERE id = ?",
            [STATUS_DISPATCHED_TO_CUSTOMER, purchase_order_item_id],
        )
        if po_id:
            tracking_val = (tracking_number or "").strip() or None
            carrier_name_val = (carrier_name or "").strip() or None
            carrier_status_val = (carrier_status or "").strip() or None
            self.conn.execute(
                "UPDATE purchase_orders SET tracking_number = ?, carrier_name = ?, carrier_status = ? WHERE id = ?",
                [tracking_val, carrier_name_val, carrier_status_val, po_id],
            )
            _propagate_shipping_to_sales_orders(
                self.conn, po_id, tracking_number, carrier_name, carrier_status
            )
        self.conn.commit()

        marketplace_result = update_marketplace_tracking_placeholder(sales_order_item_id, tracking_number)
        return {"success": True, "event_id": event_id, "marketplace_update": marketplace_result}

    def get_events(self, purchase_order_id: Optional[int] = None, office_id: Optional[int] = None, limit: int = 100) -> List[Dict[str, Any]]:
        """Lista eventos de logística por PO ou escritório."""
        conditions = []
        params: List[Any] = []
        if purchase_order_id is not None:
            conditions.append("le.purchase_order_id = ?")
            params.append(purchase_order_id)
        if office_id is not None:
            conditions.append("le.office_id = ?")
            params.append(office_id)
        where = " AND ".join(conditions) if conditions else "1=1"
        params.append(limit)
        rows = self.conn.execute(
            f"""
            SELECT le.id, le.purchase_order_id, le.purchase_order_item_id, le.office_id, le.event_type, le.quantity,
                   le.serial_number, le.imei, le.tracking_number, le.notes, le.created_at
            FROM logistics_events le
            WHERE {where}
            ORDER BY le.created_at DESC
            LIMIT ?
            """,
            params,
        ).fetchall()
        cols = ["id", "purchase_order_id", "purchase_order_item_id", "office_id", "event_type", "quantity", "serial_number", "imei", "tracking_number", "notes", "created_at"]
        out = []
        for r in rows:
            row_dict = dict(zip(cols, r))
            if row_dict.get("created_at") and hasattr(row_dict["created_at"], "isoformat"):
                row_dict["created_at"] = row_dict["created_at"].isoformat()
            out.append(row_dict)
        return out

    def get_po_items_for_office(self, office_id: int, empresa_id: Optional[int] = None, status_filter: Optional[str] = None) -> List[Dict[str, Any]]:
        """Lista itens de POs com tipo_envio=Escritorio e office_id para o escritório (para UI de conferência)."""
        conditions = ["po.tipo_envio = 'Escritorio'", "po.office_id = ?"]
        params: List[Any] = [office_id]
        if empresa_id is not None:
            conditions.append("po.empresa_id = ?")
            params.append(empresa_id)
        if status_filter:
            conditions.append("COALESCE(poi.logistics_status, 'pending_receipt') = ?")
            params.append(status_filter)
        where = " AND ".join(conditions)
        rows = self.conn.execute(
            f"""
            SELECT poi.id, poi.purchase_order_id, poi.order_id, poi.sales_order_item_id, poi.sku_marketplace, poi.sku_fornecedor,
                   poi.quantidade, COALESCE(poi.quantidade_recebida, 0), COALESCE(poi.logistics_status, 'pending_receipt'),
                   po.supplier_order_id
            FROM purchase_order_items poi
            JOIN purchase_orders po ON po.id = poi.purchase_order_id
            WHERE {where}
            ORDER BY poi.purchase_order_id, poi.id
            LIMIT 500
            """,
            params,
        ).fetchall()
        cols = ["id", "purchase_order_id", "order_id", "sales_order_item_id", "sku_marketplace", "sku_fornecedor", "quantidade", "quantidade_recebida", "logistics_status", "supplier_order_id"]
        return [dict(zip(cols, r)) for r in rows]
