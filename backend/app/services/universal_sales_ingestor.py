"""
Fase 2: Ingestor universal de vendas (API ou ficheiro).
Normaliza colunas de diferentes fontes (OrderNo/Order ID na Amazon vs Worten, etc.)
para o schema único sales_orders / sales_order_items.
"""
from __future__ import annotations

import pandas as pd
from pathlib import Path
from typing import List, Dict, Any, Optional

from app.services.sales_module_service import SalesModuleService

# Mapeamento de nomes de colunas de API/CSV externos para schema canónico
COLUMN_ALIASES = {
    "numero_pedido": ["numero_pedido", "external_order_id", "order_id", "orderno", "order no", "order_no", "pedido", "id pedido"],
    "data_criacao": ["data_criacao", "data_venda", "order_date", "date", "data", "data pedido"],
    "sku_oferta": ["sku_oferta", "sku_marketplace", "sku", "skus", "product_sku", "codigo", "referencia"],
    "quantidade": ["quantidade", "quantity", "qty", "qtd", "quant"],
    "preco_unitario": ["preco_unitario", "unit_price", "price", "preco", "preço", "valor_unitario"],
    "valor_total_com_iva": ["valor_total_com_iva", "valor_bruto", "total_gross", "total", "valor", "gross", "linha_total"],
    "pais_faturamento": ["pais_faturamento", "customer_country", "country", "pais", "destino", "ship_country"],
}


def _normalize_key(key: str) -> str:
    if not key or not isinstance(key, str):
        return ""
    return key.strip().lower().replace(" ", "_").replace("-", "_")


def _map_row_to_canonical(row: Dict[str, Any]) -> Dict[str, Any]:
    """Converte um dicionário com chaves arbitrárias para schema canónico."""
    out = {}
    row_lower = {_normalize_key(k): v for k, v in row.items()}
    for canon, aliases in COLUMN_ALIASES.items():
        for alias in aliases:
            n = _normalize_key(alias)
            if n in row_lower and row_lower[n] is not None:
                out[canon] = row_lower[n]
                break
    return out


def payload_to_dataframe(payload: List[Dict[str, Any]]) -> Optional[pd.DataFrame]:
    """
    Converte payload de API (lista de dicts, um por linha de item) para DataFrame
    com colunas canónicas (numero_pedido, sku_oferta, quantidade, preco_unitario, etc.).
    """
    if not payload or not isinstance(payload, list):
        return None
    rows = [_map_row_to_canonical(r) for r in payload]
    df = pd.DataFrame(rows)
    if df.empty:
        return None
    # Garantir colunas numéricas
    for col in ("quantidade", "preco_unitario", "valor_total_com_iva"):
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)
    if "data_criacao" in df.columns:
        df["data_criacao"] = pd.to_datetime(df["data_criacao"], errors="coerce")
    return df


class UniversalSalesIngestor:
    """
    Processa vendas a partir de ficheiro (CSV/Excel) ou JSON de API.
    Delega a normalização e inserção ao SalesModuleService.
    """

    def __init__(self):
        self._service = SalesModuleService()

    def ingest_from_file(
        self,
        file_path: Path,
        empresa_id: int,
        marketplace_id: Optional[int] = None,
        marketplace_code: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Importa a partir de ficheiro (Excel/CSV). Normalização via orders_normalizer + config YAML."""
        try:
            return self._service.import_orders(
                file_path,
                empresa_id=empresa_id,
                marketplace_id=marketplace_id,
                marketplace_code=marketplace_code,
            )
        finally:
            self._service.close()

    def ingest_from_payload(
        self,
        payload: List[Dict[str, Any]],
        empresa_id: int,
        marketplace_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Importa a partir de JSON (ex.: resposta de API Worten/Amazon).
        payload: lista de objetos com chaves tipo order_id, sku, quantity, unit_price, etc.
        """
        df = payload_to_dataframe(payload)
        if df is None or df.empty:
            return {"success": False, "error": "Payload vazio ou sem dados válidos", "sales_orders_created": 0}
        try:
            return self._service.import_orders_from_dataframe(
                df,
                empresa_id=empresa_id,
                marketplace_id=marketplace_id,
            )
        finally:
            self._service.close()
