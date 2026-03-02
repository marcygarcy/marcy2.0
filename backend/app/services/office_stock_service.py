"""
Stock em escritório: origem em cancelamentos (cliente cancelou, fornecedor não aceita devolução).
Listagem e consumo para reutilização em novos pedidos.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from app.config.database import get_db_connection


def _next_id(conn, table: str) -> int:
    r = conn.execute(f"SELECT COALESCE(MAX(id), 0) + 1 FROM {table}").fetchone()
    return int(r[0]) if r and r[0] else 1


class OfficeStockService:
    def __init__(self):
        self.conn = get_db_connection()

    def close(self):
        if self.conn:
            try:
                self.conn.close()
            except Exception:
                pass

    def list_stock(
        self,
        empresa_id: Optional[int] = None,
        office_id: Optional[int] = None,
        sku: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 200,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        """Lista office_stock com filtros. status: available, reserved, consumed."""
        conditions = ["1=1"]
        params: List[Any] = []
        if empresa_id is not None:
            conditions.append("os.empresa_id = ?")
            params.append(empresa_id)
        if office_id is not None:
            conditions.append("(os.office_id IS NULL OR os.office_id = ?)")
            params.append(office_id)
        if sku:
            conditions.append("(os.sku_marketplace LIKE ? OR os.sku_fornecedor LIKE ?)")
            params.extend([f"%{sku}%", f"%{sku}%"])
        if status:
            conditions.append("os.status = ?")
            params.append(status)
        where = " AND ".join(conditions)
        params.extend([limit, offset])
        rows = self.conn.execute(
            f"""
            SELECT os.id, os.empresa_id, os.office_id, os.sku_marketplace, os.sku_fornecedor,
                   os.quantity, os.source_type, os.source_sales_order_id, os.source_sales_order_item_id,
                   os.source_purchase_order_id, os.source_purchase_order_item_id,
                   os.status, os."condition", os.received_at, os.rma_claim_id, os.created_at,
                   os.consumed_by_sales_order_id, os.consumed_by_sales_order_item_id, os.consumed_at,
                   ol.designacao AS office_nome, e.nome AS empresa_nome
            FROM office_stock os
            LEFT JOIN office_locations ol ON ol.id = os.office_id
            LEFT JOIN empresas e ON e.id = os.empresa_id
            WHERE {where}
            ORDER BY os.created_at DESC, os.id DESC
            LIMIT ? OFFSET ?
            """,
            params,
        ).fetchall()
        cols = [
            "id", "empresa_id", "office_id", "sku_marketplace", "sku_fornecedor",
            "quantity", "source_type", "source_sales_order_id", "source_sales_order_item_id",
            "source_purchase_order_id", "source_purchase_order_item_id",
            "status", "condition", "received_at", "rma_claim_id", "created_at",
            "consumed_by_sales_order_id", "consumed_by_sales_order_item_id", "consumed_at",
            "office_nome", "empresa_nome",
        ]
        return [dict(zip(cols, r)) for r in rows]

    def consume_stock(
        self,
        office_stock_id: int,
        quantity: float,
        sales_order_id: int,
        sales_order_item_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Consome quantidade de uma linha de office_stock e associa ao novo pedido (reutilização).
        Atualiza status para 'consumed' e regista consumed_by_* e consumed_at.
        """
        row = self.conn.execute(
            "SELECT id, quantity, status FROM office_stock WHERE id = ?",
            [office_stock_id],
        ).fetchone()
        if not row:
            return {"success": False, "error": "Linha de stock não encontrada", "office_stock_id": office_stock_id}
        available = float(row[1] or 0)
        if str(row[2] or "") != "available":
            return {"success": False, "error": "Stock já não está disponível", "office_stock_id": office_stock_id}
        if quantity <= 0 or quantity > available:
            return {"success": False, "error": f"Quantidade inválida (disponível: {available})", "office_stock_id": office_stock_id}

        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        if quantity >= available:
            self.conn.execute(
                """
                UPDATE office_stock SET status = 'consumed', quantity = ?,
                    consumed_by_sales_order_id = ?, consumed_by_sales_order_item_id = ?, consumed_at = ?
                WHERE id = ?
                """,
                [quantity, sales_order_id, sales_order_item_id, now, office_stock_id],
            )
        else:
            # Parcial: criar nova linha "consumed" com quantity consumida e reduzir a atual
            new_id = _next_id(self.conn, "office_stock")
            self.conn.execute(
                """
                INSERT INTO office_stock
                (id, empresa_id, office_id, sku_marketplace, sku_fornecedor, quantity, source_type,
                 source_sales_order_id, source_sales_order_item_id, source_purchase_order_id, source_purchase_order_item_id,
                 status, "condition", received_at, rma_claim_id, created_at, consumed_by_sales_order_id, consumed_by_sales_order_item_id, consumed_at)
                SELECT ?, os.empresa_id, os.office_id, os.sku_marketplace, os.sku_fornecedor, ?, os.source_type,
                       os.source_sales_order_id, os.source_sales_order_item_id, os.source_purchase_order_id, os.source_purchase_order_item_id,
                       'consumed', os."condition", os.received_at, os.rma_claim_id, os.created_at, ?, ?, ?
                FROM office_stock os WHERE os.id = ?
                """,
                [new_id, quantity, sales_order_id, sales_order_item_id, now, office_stock_id],
            )
            self.conn.execute(
                "UPDATE office_stock SET quantity = quantity - ? WHERE id = ?",
                [quantity, office_stock_id],
            )
        self.conn.commit()
        return {
            "success": True,
            "office_stock_id": office_stock_id,
            "quantity_consumed": quantity,
            "sales_order_id": sales_order_id,
            "sales_order_item_id": sales_order_item_id,
        }

    def get_available_by_sku(
        self,
        empresa_id: int,
        sku_marketplace: str,
        office_id: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        """Devolve linhas de office_stock disponíveis para um SKU (para sugerir uso em novo pedido)."""
        params: List[Any] = [empresa_id, sku_marketplace]
        office_cond = ""
        if office_id is not None:
            office_cond = " AND (os.office_id IS NULL OR os.office_id = ?)"
            params.append(office_id)
        rows = self.conn.execute(
            f"""
            SELECT os.id, os.quantity, os.sku_fornecedor, os.source_sales_order_id, os.office_id, ol.designacao AS office_nome
            FROM office_stock os
            LEFT JOIN office_locations ol ON ol.id = os.office_id
            WHERE os.empresa_id = ? AND os.sku_marketplace = ? AND os.status = 'available' {office_cond}
            ORDER BY os.received_at ASC
            """,
            params,
        ).fetchall()
        return [
            {
                "id": r[0],
                "quantity": float(r[1] or 0),
                "sku_fornecedor": r[2],
                "source_sales_order_id": r[3],
                "office_id": r[4],
                "office_nome": r[5],
            }
            for r in rows
        ]
