"""
Fase 2: Serviço de drafts automáticos de compra.
Sempre que uma venda é inserida e o SKU está em sku_mapping, insere um registo
em pending_purchase_items com custo base e fornecedor identificado.
Lucro previsto = Preço venda - Comissão - Custo fornecedor.
"""
from __future__ import annotations

from typing import Optional, Dict, Any
from app.config.database import get_db_connection


def _next_id(conn, table: str) -> int:
    r = conn.execute(f"SELECT COALESCE(MAX(id), 0) + 1 FROM {table}").fetchone()
    return int(r[0]) if r and r[0] else 1


class PurchaseAutoDraftService:
    """
    Cria necessidades de compra (pending_purchase_items) a partir de itens de venda
    quando existe mapeamento SKU -> fornecedor em sku_mapping.
    """

    def __init__(self):
        self.conn = get_db_connection()

    def add_pending_from_sale_item(
        self,
        empresa_id: int,
        sales_order_id: int,
        sales_order_item_id: int,
        sku_marketplace: str,
        quantity: float,
        unit_price: float,
        total_commission_fixed: float,
        total_commission_percent: float,
        total_gross: float,
        marketplace_id: Optional[int] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Se sku_marketplace existir em sku_mapping (empresa_id + marketplace), insere
        em pending_purchase_items e devolve o registo. Caso contrário devolve None.
        """
        if not sku_marketplace or not sku_marketplace.strip():
            return None
        row = self.conn.execute(
            """
            SELECT id, supplier_id, sku_fornecedor, custo_fornecedor
            FROM sku_mapping
            WHERE empresa_id = ? AND sku_marketplace = ? AND COALESCE(ativo, TRUE) = TRUE
            AND (marketplace_id IS NULL OR marketplace_id = ?)
            ORDER BY marketplace_id DESC NULLS LAST
            LIMIT 1
            """,
            [empresa_id, sku_marketplace.strip(), marketplace_id or 0],
        ).fetchone()
        if not row:
            return None
        mapping_id, supplier_id, sku_supplier, cost_base = row
        cost_base = float(cost_base or 0)
        linha_gross = quantity * unit_price
        commission_share = (total_commission_fixed + total_commission_percent) * (
            linha_gross / total_gross
        ) if total_gross else 0
        custo_linha = cost_base * quantity
        expected_profit = linha_gross - commission_share - custo_linha

        next_id = _next_id(self.conn, "pending_purchase_items")
        self.conn.execute(
            """
            INSERT INTO pending_purchase_items (
                id, empresa_id, sales_order_id, sales_order_item_id,
                sku_marketplace, sku_supplier, supplier_id, quantity,
                cost_price_base, unit_price_sale, commission_share, expected_profit, status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
            """,
            [
                next_id,
                empresa_id,
                sales_order_id,
                sales_order_item_id,
                sku_marketplace.strip(),
                sku_supplier,
                supplier_id,
                quantity,
                cost_base,
                unit_price,
                commission_share,
                expected_profit,
            ],
        )
        return {
            "id": next_id,
            "supplier_id": supplier_id,
            "cost_price_base": cost_base,
            "expected_profit": expected_profit,
        }

    def close(self):
        try:
            if self.conn:
                self.conn.close()
        except Exception:
            pass
