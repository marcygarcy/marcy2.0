"""
v3.0 – Supplier Health Score: ranking de confiança por fornecedor.

- Lead Time real: dias entre criação da PO e data de tracking (ou data_ordered como proxy).
- Taxa de devoluções (RMA) por fornecedor.
- Estabilidade de preços: alertas de margem (subidas inesperadas detetadas pelo robô).
- Score 0–100 para ordenar no Dashboard de Compras.
"""
from __future__ import annotations

import logging
from datetime import date, timedelta
from typing import Any, Dict, List, Optional

from app.config.database import get_db_connection

logger = logging.getLogger(__name__)


class SupplierHealthService:
    """Calcula lead time, taxa de devoluções e estabilidade de preços → score 0–100."""

    def __init__(self):
        self.conn = get_db_connection()

    def close(self):
        if self.conn:
            try:
                self.conn.close()
            except Exception:
                pass

    def get_lead_time_days(self, supplier_id: int) -> Optional[float]:
        """
        Lead time médio em dias: desde data_criacao da PO até data_ordered
        (proxy para "quando o fornecedor confirmou"). POs com data_ordered preenchida.
        """
        row = self.conn.execute(
            """
            SELECT AVG(
                CAST(po.data_ordered AS DATE) - CAST(po.data_criacao AS DATE)
            ) AS avg_days
            FROM purchase_orders po
            WHERE po.supplier_id = ? AND po.data_ordered IS NOT NULL AND po.data_criacao IS NOT NULL
            """,
            [supplier_id],
        ).fetchone()
        if not row or row[0] is None:
            return None
        try:
            return float(row[0])
        except (TypeError, ValueError):
            return None

    def get_return_rate(self, supplier_id: int) -> float:
        """Taxa de devoluções: nº RMA completados ou pendentes / nº vendas (itens) desse fornecedor."""
        rma = self.conn.execute(
            "SELECT COUNT(*) FROM rma_claims WHERE supplier_id = ?",
            [supplier_id],
        ).fetchone()[0] or 0
        # Itens de venda ligados a este fornecedor via sku_mapping / purchase
        sold = self.conn.execute(
            """
            SELECT COUNT(DISTINCT soi.id)
            FROM sales_order_items soi
            JOIN sku_mapping sm ON sm.sku_marketplace = soi.sku_marketplace OR sm.sku_marketplace = soi.internal_sku
            WHERE sm.supplier_id = ?
            """,
            [supplier_id],
        ).fetchone()[0] or 0
        if sold == 0:
            return 0.0
        return round(min(1.0, (rma / sold) * 100), 2)

    def get_price_stability_penalty(self, supplier_id: int) -> int:
        """
        Penalização por subidas inesperadas: nº de pending_purchase_items com margin_alert
        para este fornecedor (detetadas pelo robô).
        """
        row = self.conn.execute(
            """
            SELECT COUNT(*) FROM pending_purchase_items
            WHERE supplier_id = ? AND margin_alert = TRUE
            """,
            [supplier_id],
        ).fetchone()
        return int(row[0]) if row else 0

    def get_supplier_health_score(
        self,
        supplier_id: int,
        lead_time_weight: float = 0.4,
        return_rate_weight: float = 0.35,
        price_stability_weight: float = 0.25,
    ) -> Dict[str, Any]:
        """
        Score 0–100:
        - Rapidez: menor lead time = melhor (normalizado até 7 dias = 100, >21 = 0).
        - Devoluções: menor taxa = melhor (0% = 100, >20% = 0).
        - Preços: menos alertas = melhor (0 alertas = 100, 5+ = 0).
        """
        lead_days = self.get_lead_time_days(supplier_id)
        return_pct = self.get_return_rate(supplier_id)
        penalty = self.get_price_stability_penalty(supplier_id)

        # Componente rapidez (0–100): 0 dias = 100, 7+ dias = decay, 21+ = 0
        if lead_days is None:
            speed_score = 70  # neutro se não houver dados
        else:
            if lead_days <= 0:
                speed_score = 100
            elif lead_days <= 7:
                speed_score = 100 - (lead_days / 7) * 30  # 7 dias = 70
            elif lead_days <= 21:
                speed_score = 70 - ((lead_days - 7) / 14) * 70  # 21 dias = 0
            else:
                speed_score = 0
            speed_score = max(0, min(100, round(speed_score, 1)))

        # Componente devoluções: 0% = 100, 20% = 0
        return_score = max(0, min(100, 100 - return_pct * 5))

        # Componente preços: 0 alertas = 100, 5+ = 0
        price_score = max(0, min(100, 100 - penalty * 20))

        total = (
            speed_score * lead_time_weight
            + return_score * return_rate_weight
            + price_score * price_stability_weight
        )
        score = round(total, 1)

        return {
            "supplier_id": supplier_id,
            "health_score": score,
            "lead_time_days": lead_days,
            "return_rate_pct": return_pct,
            "margin_alert_count": penalty,
            "speed_score": speed_score,
            "return_score": round(return_score, 1),
            "price_stability_score": price_score,
        }

    def get_all_suppliers_ranked(
        self,
        empresa_id: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        """
        Lista todos os fornecedores com health score e margem média, ordenados por score.
        Para o Dashboard de Compras.
        """
        conds = ["1=1"]
        params: List[Any] = []
        if empresa_id is not None:
            conds.append("s.empresa_id = ?")
            params.append(empresa_id)
        where = " AND ".join(conds)
        rows = self.conn.execute(
            f"SELECT s.id, s.nome FROM suppliers s WHERE {where}",
            params,
        ).fetchall()
        result = []
        for sid, nome in rows:
            health = self.get_supplier_health_score(sid)
            # Margem média: via vendas/POs (simplificado – margem real por item)
            margin_row = self.conn.execute(
                """
                SELECT AVG(
                    (soi.unit_price - COALESCE(poi.custo_unitario, 0)) / NULLIF(soi.unit_price, 0) * 100
                )
                FROM sales_order_items soi
                JOIN purchase_order_items poi ON poi.sales_order_item_id = soi.id
                JOIN purchase_orders po ON po.id = poi.purchase_order_id
                WHERE po.supplier_id = ?
                """,
                [sid],
            ).fetchone()
            avg_margin_pct = round(float(margin_row[0] or 0), 2) if margin_row and margin_row[0] else None
            result.append({
                "supplier_id": sid,
                "supplier_nome": nome or "—",
                "health_score": health["health_score"],
                "lead_time_days": health["lead_time_days"],
                "return_rate_pct": health["return_rate_pct"],
                "margin_alert_count": health["margin_alert_count"],
                "avg_margin_pct": avg_margin_pct,
            })
        result.sort(key=lambda x: (-(x["health_score"] or 0), -(x["avg_margin_pct"] or 0)))
        return result
