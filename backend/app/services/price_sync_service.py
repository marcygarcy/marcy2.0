"""
Atualização de custos em sku_mapping a partir da tabela de preços do fornecedor.
Comparação antigo vs novo (opcional com Pandas) e atualização em lote.
"""
from __future__ import annotations

from typing import List, Dict, Any
import logging
from app.config.database import get_db_connection

logger = logging.getLogger(__name__)


def update_sku_costs(supplier_id: int, new_prices: List[Dict[str, Any]]) -> int:
    """
    Atualiza custo_fornecedor em sku_mapping para o supplier_id dado.
    new_prices: [ {"sku": "REF123", "price": 10.50}, ... ]
    SKU pode ser sku_fornecedor ou sku_marketplace conforme o portal.
    Devolve número de linhas atualizadas.
    """
    if not new_prices:
        return 0
    conn = get_db_connection()
    updated = 0
    try:
        for item in new_prices:
            sku = item.get("sku") or item.get("sku_fornecedor") or item.get("sku_marketplace")
            price = item.get("price") or item.get("custo") or item.get("custo_fornecedor")
            if sku is None or price is None:
                continue
            try:
                price_val = float(price)
            except (TypeError, ValueError):
                continue
            conn.execute(
                """
                UPDATE sku_mapping
                SET custo_fornecedor = ?, data_atualizacao = CURRENT_TIMESTAMP
                WHERE supplier_id = ? AND (sku_fornecedor = ? OR sku_marketplace = ?)
                """,
                [price_val, supplier_id, str(sku).strip(), str(sku).strip()],
            )
            updated += 1
        conn.commit()
    except Exception as e:
        logger.exception("update_sku_costs failed: %s", e)
        conn.rollback()
    finally:
        conn.close()
    return updated
