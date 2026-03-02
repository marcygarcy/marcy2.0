"""
Normalização de ficheiros de vendas (Orders) por marketplace.

Cada marketplace (Worten, Amazon, Pixmania, etc.) exporta Excel/CSV com
colunas diferentes. Este módulo:
1. Carrega o ficheiro (XLSX, XLS, CSV)
2. Aplica o mapeamento de colunas conforme config (orders_columns_mapping.yaml)
3. Normaliza tipos (datas, numéricos) e devolve DataFrame com schema canónico.
"""
import pandas as pd
from pathlib import Path
from typing import Optional, Dict, Any
import yaml

from app.config.settings import BASE_DIR

CONFIG_PATH = BASE_DIR / "config" / "orders_columns_mapping.yaml"


def _load_mapping_config() -> Dict[str, Any]:
    """Carrega configuração de mapeamento por marketplace."""
    if not CONFIG_PATH.exists():
        return {"marketplaces": {"default": {"columns": {}, "date_format": None, "encoding": "utf-8-sig"}}}
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def _normalize_column_name(name: str) -> str:
    """Remove espaços extras e normaliza para comparação."""
    if not name or not isinstance(name, str):
        return ""
    return name.strip().lower()


def _map_columns(df: pd.DataFrame, column_map: Dict[str, str]) -> pd.DataFrame:
    """
    Mapeia colunas do DataFrame para nomes canónicos.
    column_map: { nome_no_ficheiro: nome_canonico }
    """
    df_cols_lower = {_normalize_column_name(c): c for c in df.columns}
    result = pd.DataFrame(index=df.index)
    used_canonical = set()

    for file_col_pattern, canonical in column_map.items():
        key = _normalize_column_name(file_col_pattern)
        if key in df_cols_lower and canonical not in used_canonical:
            original_col = df_cols_lower[key]
            result[canonical] = df[original_col]
            used_canonical.add(canonical)

    return result


def load_orders_file(file_path: Path, encoding: Optional[str] = None) -> pd.DataFrame:
    """Carrega ficheiro de orders (CSV ou Excel) para DataFrame."""
    ext = file_path.suffix.lower()
    enc = encoding or "utf-8-sig"
    if ext == ".csv":
        try:
            df = pd.read_csv(file_path, encoding=enc, low_memory=False)
        except UnicodeDecodeError:
            df = pd.read_csv(file_path, encoding="latin-1", low_memory=False)
    elif ext in (".xlsx", ".xls"):
        df = pd.read_excel(file_path, engine="openpyxl")
    else:
        raise ValueError(f"Formato não suportado: {ext}. Use XLSX, XLS ou CSV.")
    df = df.loc[:, ~df.columns.astype(str).str.contains("^Unnamed", case=False, na=False)]
    return df


def normalize_orders(
    df: pd.DataFrame,
    marketplace_code: Optional[str] = None,
) -> pd.DataFrame:
    """
    Normaliza DataFrame de orders para schema canónico.

    Args:
        df: DataFrame com colunas do ficheiro original.
        marketplace_code: Código do marketplace (ex: 'pixmania', 'worten', 'amazon_pt').
                         Se None, usa mapeamento 'default'.

    Returns:
        DataFrame com colunas canónicas (podem faltar colunas se não houver mapeamento).
    """
    config = _load_mapping_config()
    marketplaces = config.get("marketplaces", {})
    mapping = marketplaces.get(marketplace_code or "default") or marketplaces.get("default", {})
    column_map = mapping.get("columns", {})
    date_fmt = mapping.get("date_format")
    if not column_map:
        column_map = marketplaces.get("default", {}).get("columns", {})

    out = _map_columns(df, column_map)

    # Garantir colunas numéricas
    numeric_cols = [
        "quantidade", "valor_bruto", "valor_total_sem_impostos", "valor_total_com_iva",
        "total_impostos_pedido", "total_impostos_envio", "comissao_sem_impostos",
        "valor_comissao_com_impostos", "valor_transferido_loja", "valor_liquido_venda",
        "custo_fornecedor", "gastos_envio", "outras_taxas", "preco_unitario",
    ]
    for col in numeric_cols:
        if col in out.columns:
            out[col] = pd.to_numeric(out[col], errors="coerce").fillna(0.0)

    # Datas
    for date_col in ("data_criacao", "data_venda"):
        if date_col not in out.columns:
            continue
        if out[date_col].dtype == object or out[date_col].dtype.name == "string":
            out[date_col] = out[date_col].astype(str).str.split(" - ").str[0]
        out[date_col] = pd.to_datetime(out[date_col], errors="coerce", dayfirst=True)

    # Derivações: valor_liquido_venda = valor_transferido_loja se não existir
    if "valor_liquido_venda" not in out.columns and "valor_transferido_loja" in out.columns:
        out["valor_liquido_venda"] = out["valor_transferido_loja"]
    if "valor_bruto" not in out.columns and "valor_total_com_iva" in out.columns:
        out["valor_bruto"] = out["valor_total_com_iva"]
    if "status_operacional" not in out.columns and "status" in out.columns:
        out["status_operacional"] = out["status"].fillna("").str.strip()
    else:
        if "status_operacional" not in out.columns:
            out["status_operacional"] = "Pendente"

    return out


def load_and_normalize_orders(
    file_path: Path,
    marketplace_code: Optional[str] = None,
    encoding: Optional[str] = None,
) -> pd.DataFrame:
    """
    Carrega ficheiro de vendas e normaliza para schema canónico.

    Único ponto de entrada para o pipeline de ingest: usar em conjunto com
    insert_orders do ingest.py (que espera colunas compatíveis com a tabela orders).
    """
    df = load_orders_file(file_path, encoding=encoding)
    config = _load_mapping_config()
    enc = None
    if marketplace_code:
        m = config.get("marketplaces", {}).get(marketplace_code, {})
        enc = m.get("encoding")
    return normalize_orders(df, marketplace_code=marketplace_code)
