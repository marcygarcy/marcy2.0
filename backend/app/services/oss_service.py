"""
Módulo OSS (One-Stop Shop) – Fiscalidade: segregação IVA nacional vs destino (UE).
- calculate_oss_tax(sales_order_id): classifica e grava vat_type e vat_amount por linha.
- get_oss_report(): resumo por trimestre/país para GET /api/v1/finance/oss-report.
"""
from __future__ import annotations

import calendar
from typing import Any, Dict, List, Optional

from app.config.database import get_db_connection

# Países UE para OSS (destino); PT = nacional
EU_COUNTRIES = {"PT", "ES", "FR", "DE", "IT", "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "GR", "HU", "IE", "LV", "LT", "LU", "MT", "NL", "PL", "RO", "SK", "SI", "SE"}


def _vat_rate_from_country(country: Optional[str]) -> float:
    """Taxa IVA por país (exemplo simplificado)."""
    if not country:
        return 0.0
    c = (country or "").strip().upper()[:2]
    rates = {"PT": 23.0, "ES": 21.0, "FR": 20.0, "IT": 22.0, "DE": 19.0}
    return rates.get(c, 0.0)


def calculate_oss_tax(conn, sales_order_id: int) -> None:
    """
    Para um sales_order: obtém customer_country; para cada sales_order_item calcula
    vat_amount e classifica vat_type (national se PT, destination se outro UE).
    Atualiza sales_order_items com vat_type e vat_amount.
    """
    row = conn.execute(
        "SELECT customer_country FROM sales_orders WHERE id = ?",
        [sales_order_id],
    ).fetchone()
    if not row:
        return
    customer_country = (row[0] or "").strip().upper()[:2] if row[0] else ""
    vat_type = "national" if customer_country == "PT" else ("destination" if customer_country in EU_COUNTRIES else "")

    items = conn.execute(
        """
        SELECT id, quantity, unit_price, vat_rate
        FROM sales_order_items
        WHERE sales_order_id = ?
        """,
        [sales_order_id],
    ).fetchall()

    for (item_id, qty, unit_price, vat_rate) in items:
        qty = float(qty or 0)
        unit_price = float(unit_price or 0)
        rate = float(vat_rate or 0)
        if rate == 0 and customer_country:
            rate = _vat_rate_from_country(customer_country)
        vat_amount = (unit_price * qty) * (rate / 100.0) if rate else 0.0
        conn.execute(
            "UPDATE sales_order_items SET vat_type = ?, vat_amount = ? WHERE id = ?",
            [vat_type, vat_amount, item_id],
        )


def get_oss_report(
    conn,
    year: int,
    quarter: int,
    country: Optional[str] = None,
    empresa_id: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Agrega sales_order_items (com vat_type, vat_amount) e sales_orders.order_date
    para o trimestre/ano. Retorna by_country e totals.
    """
    # Trimestre -> intervalo de meses (Q1=Jan-Mar, Q2=Abr-Jun, etc.)
    start_month = (quarter - 1) * 3 + 1
    end_month = quarter * 3
    start_date = f"{year}-{start_month:02d}-01"
    _, last_day = calendar.monthrange(year, end_month)
    end_date = f"{year}-{end_month:02d}-{last_day:02d}"
    conditions = [
        "CAST(so.order_date AS DATE) >= CAST(? AS DATE)",
        "CAST(so.order_date AS DATE) <= CAST(? AS DATE)",
    ]
    params: List[Any] = [start_date, end_date]
    if empresa_id is not None:
        conditions.append("so.empresa_id = ?")
        params.append(empresa_id)
    if country:
        conditions.append("so.customer_country = ?")
        params.append(str(country).strip().upper()[:2])
    where = " AND ".join(conditions)

    rows = conn.execute(
        f"""
        SELECT so.customer_country, soi.vat_type, SUM(COALESCE(soi.vat_amount, 0)) AS total
        FROM sales_order_items soi
        JOIN sales_orders so ON so.id = soi.sales_order_id
        WHERE {where}
        GROUP BY so.customer_country, soi.vat_type
        """,
        params,
    ).fetchall()

    by_country: Dict[str, Dict[str, float]] = {}
    totals = {"national_vat": 0.0, "destination_vat": 0.0}
    for (cust_country, vtype, total) in rows:
        total = float(total or 0)
        cc = (cust_country or "").strip().upper()[:2] or "XX"
        if cc not in by_country:
            by_country[cc] = {"national_vat": 0.0, "destination_vat": 0.0}
        if vtype == "national":
            by_country[cc]["national_vat"] += total
            totals["national_vat"] += total
        elif vtype == "destination":
            by_country[cc]["destination_vat"] += total
            totals["destination_vat"] += total

    return {
        "quarter": f"{year}-Q{quarter}",
        "by_country": by_country,
        "totals": totals,
    }
