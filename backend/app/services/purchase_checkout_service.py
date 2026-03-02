"""
v3.5 – Checkout Inteligente: estrutura de custos, IVA por regime fiscal e margem de contribuição.

- Consulta regime_iva do fornecedor: Intracomunitário/VIES -> IVA 0%; Nacional -> taxa do país da empresa.
- Calcula margem: total líquido das vendas associadas menos custo total da PO (base + taxas + portes + IVA).
- Atualiza e finaliza PO com portes e taxas definitivas.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from app.config.database import get_db_connection

logger = logging.getLogger(__name__)

# Taxas IVA padrão por país (empresa)
DEFAULT_VAT_BY_COUNTRY: Dict[str, float] = {
    "PT": 23.0,
    "ES": 21.0,
    "FR": 20.0,
    "DE": 19.0,
    "IT": 22.0,
}

REGIME_AUTOLIQUIDACAO = ("intracomunitario", "vies", "intra-comunitário", "extracomunitário", "extra-comunitário")


def _next_id(conn, table: str) -> int:
    r = conn.execute(f"SELECT COALESCE(MAX(id), 0) + 1 FROM {table}").fetchone()
    return int(r[0]) if r else 1


class PurchaseCheckoutService:
    """Cálculo fiscal (IVA por regime), margem de contribuição e finalização de PO."""

    def __init__(self):
        self.conn = get_db_connection()

    def close(self):
        try:
            if self.conn:
                self.conn.close()
        except Exception:
            pass

    def _get_supplier_regime_and_vat(self, supplier_id: int, empresa_id: int) -> tuple[str, float]:
        """Regime IVA do fornecedor e taxa a aplicar (0 se autoliquidação)."""
        row = self.conn.execute(
            "SELECT regime_iva, taxa_iva_padrao FROM suppliers WHERE id = ?",
            [supplier_id],
        ).fetchone()
        regime = (row[0] or "").strip().upper() if row and row[0] else ""
        supplier_vat = float(row[1] or 0) if row and len(row) > 1 and row[1] is not None else 0

        regime_lower = regime.lower()
        # Só aplica autoliquidação se o regime estiver explicitamente definido
        if regime_lower:
            for r in REGIME_AUTOLIQUIDACAO:
                if r in regime_lower:
                    return regime, 0.0

        if supplier_vat > 0:
            return regime, supplier_vat

        emp_row = self.conn.execute(
            "SELECT pais FROM empresas WHERE id = ?",
            [empresa_id],
        ).fetchone()
        country = (emp_row[0] or "PT").strip().upper()[:2] if emp_row and emp_row[0] else "PT"
        return regime, DEFAULT_VAT_BY_COUNTRY.get(country, 23.0)

    def get_iva_for_po(self, supplier_id: int, empresa_id: int, total_base: float) -> Dict[str, Any]:
        """
        Calcula IVA para uma PO: 0% se regime Intracomunitário/VIES, senão taxa do país da empresa.
        Devolve taxa_pct e valor iva_total.
        """
        regime, taxa_pct = self._get_supplier_regime_and_vat(supplier_id, empresa_id)
        iva_total = round(total_base * (taxa_pct / 100), 2)
        return {"regime_iva": regime, "taxa_iva_pct": taxa_pct, "iva_total": iva_total}

    def get_linked_sales_total(self, purchase_order_id: int) -> float:
        """Soma do total líquido das vendas (sales_orders) associadas a esta PO via sales_order_items."""
        row = self.conn.execute(
            """
            SELECT COALESCE(SUM(so.total_net_value), 0)
            FROM sales_orders so
            WHERE so.id IN (
                SELECT DISTINCT soi.sales_order_id
                FROM purchase_order_items poi
                JOIN sales_order_items soi ON soi.id = poi.sales_order_item_id
                WHERE poi.purchase_order_id = ?
            )
            """,
            [purchase_order_id],
        ).fetchone()
        return float(row[0] or 0)

    def get_checkout_detail(
        self,
        purchase_order_id: int,
        portes_override: Optional[float] = None,
        taxas_pagamento_override: Optional[float] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Detalhe completo para o Cockpit de Decisão: PO, itens, fornecedor, empresa, morada envio,
        estrutura de custos (valor_base, taxas, IVA, portes), total e margem (vendas associadas - custo PO).
        """
        po_row = self.conn.execute(
            """
            SELECT po.id, po.empresa_id, po.supplier_id, po.status, po.tipo_envio, po.office_id,
                   po.total_base, po.portes_totais, po.impostos, po.total_final,
                   COALESCE(po.taxas_pagamento, 0), COALESCE(po.valor_base_artigos, po.total_base), COALESCE(po.iva_total, po.impostos), COALESCE(po.custo_portes_fornecedor, po.portes_totais),
                   po.billing_nif, po.billing_address, po.billing_name, po.supplier_order_id, po.notas,
                   s.nome AS supplier_nome, s.designacao_social, s.nif_cif, s.morada AS supplier_morada,
                   s.codigo_postal AS supplier_cp, s.localidade AS supplier_localidade, s.pais AS supplier_pais,
                   s.regime_iva,
                   e.nome AS empresa_nome, e.nif AS empresa_nif, e.morada AS empresa_morada, e.pais AS empresa_pais
            FROM purchase_orders po
            LEFT JOIN suppliers s ON s.id = po.supplier_id
            LEFT JOIN empresas e ON e.id = po.empresa_id
            WHERE po.id = ?
            """,
            [purchase_order_id],
        ).fetchone()
        if not po_row:
            return None

        cols = [
            "id", "empresa_id", "supplier_id", "status", "tipo_envio", "office_id",
            "total_base", "portes_totais", "impostos", "total_final", "taxas_pagamento",
            "valor_base_artigos", "iva_total", "custo_portes_fornecedor",
            "billing_nif", "billing_address", "billing_name", "supplier_order_id", "notas",
            "supplier_nome", "supplier_designacao", "supplier_nif", "supplier_morada",
            "supplier_cp", "supplier_localidade", "supplier_pais", "regime_iva",
            "empresa_nome", "empresa_nif", "empresa_morada", "empresa_pais",
        ]
        po = dict(zip(cols, po_row))

        # Itens
        items_rows = self.conn.execute(
            """
            SELECT poi.id, poi.purchase_order_id, poi.sales_order_item_id, poi.sku_marketplace, poi.sku_fornecedor,
                   poi.quantidade, poi.custo_unitario, poi.portes_rateados, poi.impostos_rateados
            FROM purchase_order_items poi
            WHERE poi.purchase_order_id = ?
            ORDER BY poi.id
            """,
            [purchase_order_id],
        ).fetchall()
        po["items"] = [
            {
                "id": r[0], "purchase_order_id": r[1], "sales_order_item_id": r[2],
                "sku_marketplace": r[3], "sku_fornecedor": r[4],
                "quantidade": r[5], "custo_unitario": float(r[6] or 0),
                "portes_rateados": float(r[7] or 0), "impostos_rateados": float(r[8] or 0),
            }
            for r in items_rows
        ]

        # Valores numéricos
        total_base = float(po.get("total_base") or 0)
        portes = portes_override if portes_override is not None else float(po.get("portes_totais") or 0)
        taxas = taxas_pagamento_override if taxas_pagamento_override is not None else float(po.get("taxas_pagamento") or 0)

        # IVA conforme regime
        supplier_id = po.get("supplier_id")
        empresa_id = po.get("empresa_id")
        if supplier_id and empresa_id:
            iva_info = self.get_iva_for_po(supplier_id, empresa_id, total_base)
            po["regime_iva"] = iva_info["regime_iva"]
            po["taxa_iva_pct"] = iva_info["taxa_iva_pct"]
            iva_total = iva_info["iva_total"]
        else:
            iva_total = float(po.get("impostos") or po.get("iva_total") or 0)
            po["taxa_iva_pct"] = round(iva_total / total_base * 100, 2) if total_base else 0

        total_final = total_base + taxas + portes + iva_total
        po["valor_base_artigos"] = total_base
        po["taxas_pagamento"] = taxas
        po["iva_total"] = iva_total
        po["custo_portes_fornecedor"] = portes
        po["portes_totais"] = portes
        po["impostos"] = iva_total
        po["total_final"] = round(total_final, 2)

        # Morada de envio: escritório ou "Dropshipping - ver dados do cliente"
        office_id = po.get("office_id")
        if po.get("tipo_envio") == "Escritorio" and office_id:
            off = self.conn.execute(
                "SELECT designacao, morada, codigo_postal, localidade, pais FROM office_locations WHERE id = ?",
                [office_id],
            ).fetchone()
            if off:
                po["shipping_address"] = {
                    "tipo": "Escritório",
                    "designacao": off[0],
                    "morada": off[1],
                    "codigo_postal": off[2],
                    "localidade": off[3],
                    "pais": off[4],
                }
            else:
                po["shipping_address"] = {"tipo": "Escritório", "designacao": "—", "morada": "—"}
        else:
            po["shipping_address"] = {"tipo": "Dropshipping", "designacao": "Envio ao cliente final", "morada": "Ver dados da encomenda de venda"}

        # Margem: vendas associadas - custo PO
        linked_sales = self.get_linked_sales_total(purchase_order_id)
        po["linked_sales_total"] = round(linked_sales, 2)
        margin_eur = linked_sales - total_final
        po["margin_eur"] = round(margin_eur, 2)
        po["margin_pct"] = round(margin_eur / linked_sales * 100, 2) if linked_sales else 0.0

        return po

    def update_po_totals(
        self,
        purchase_order_id: int,
        portes_totais: float,
        taxas_pagamento: float,
        total_final_override: Optional[float] = None,
        valor_base_override: Optional[float] = None,
        iva_total_override: Optional[float] = None,
    ) -> Dict[str, Any]:
        """
        Atualiza totais da PO. Se valor_base_override e/ou iva_total_override forem dados (ex.: fornecedor alterado),
        usa esses valores; caso contrário usa os calculados. total_final_override sobrescreve o total se dado.
        """
        po = self.get_checkout_detail(purchase_order_id, portes_override=portes_totais, taxas_pagamento_override=taxas_pagamento)
        if not po:
            return {"success": False, "error": "PO não encontrada"}

        total_base = valor_base_override if valor_base_override is not None else po["valor_base_artigos"]
        iva_total = iva_total_override if iva_total_override is not None else po["iva_total"]
        total_final = total_final_override if total_final_override is not None else round(total_base + iva_total + portes_totais + taxas_pagamento, 2)

        self.conn.execute(
            """
            UPDATE purchase_orders
            SET portes_totais = ?, taxas_pagamento = ?, impostos = ?, total_final = ?,
                valor_base_artigos = ?, iva_total = ?, custo_portes_fornecedor = ?
            WHERE id = ?
            """,
            [portes_totais, taxas_pagamento, iva_total, total_final, total_base, iva_total, portes_totais, purchase_order_id],
        )
        self.conn.commit()
        linked = po.get("linked_sales_total") or 0
        margin_eur = round(linked - total_final, 2)
        margin_pct = round(margin_eur / linked * 100, 2) if linked else 0.0
        return {"success": True, "total_final": total_final, "margin_eur": margin_eur, "margin_pct": margin_pct}

    def finalize_po(
        self,
        purchase_order_id: int,
        supplier_order_id: Optional[str] = None,
        portes_totais: Optional[float] = None,
        taxas_pagamento: Optional[float] = None,
        total_final: Optional[float] = None,
        valor_base_artigos: Optional[float] = None,
        iva_total: Optional[float] = None,
    ) -> Dict[str, Any]:
        """
        Grava totais (base, IVA, portes, taxas, total) se fornecidos, regista supplier_order_id se fornecido,
        e move PO para Ordered. Quando o fornecedor foi alterado, frontend envia valor_base_artigos e iva_total.
        """
        if portes_totais is not None or taxas_pagamento is not None or total_final is not None or valor_base_artigos is not None or iva_total is not None:
            po_row = self.conn.execute(
                "SELECT portes_totais, taxas_pagamento FROM purchase_orders WHERE id = ?",
                [purchase_order_id],
            ).fetchone()
            if po_row:
                portes = portes_totais if portes_totais is not None else float(po_row[0] or 0)
                taxas = taxas_pagamento if taxas_pagamento is not None else float(po_row[1] or 0)
                self.update_po_totals(
                    purchase_order_id,
                    portes,
                    taxas,
                    total_final_override=total_final,
                    valor_base_override=valor_base_artigos,
                    iva_total_override=iva_total,
                )

        if supplier_order_id is not None and str(supplier_order_id).strip():
            self.conn.execute(
                "UPDATE purchase_orders SET supplier_order_id = ? WHERE id = ?",
                [str(supplier_order_id).strip(), purchase_order_id],
            )
            self.conn.commit()

        self.conn.execute(
            "UPDATE purchase_orders SET status = 'Ordered', data_ordered = CURRENT_TIMESTAMP WHERE id = ?",
            [purchase_order_id],
        )
        self.conn.execute(
            """
            UPDATE pending_purchase_items SET status = 'ordered'
            WHERE id IN (
                SELECT p.id FROM pending_purchase_items p
                JOIN purchase_order_items poi ON poi.sales_order_item_id = p.sales_order_item_id
                WHERE poi.purchase_order_id = ?
            )
            """,
            [purchase_order_id],
        )
        self.conn.execute(
            """
            UPDATE sales_orders SET status = 'Purchased'
            WHERE id IN (
                SELECT DISTINCT soi.sales_order_id FROM purchase_order_items poi
                JOIN sales_order_items soi ON soi.id = poi.sales_order_item_id
                WHERE poi.purchase_order_id = ?
            )
            """,
            [purchase_order_id],
        )
        self.conn.commit()
        return {"success": True, "status": "Ordered"}

    def set_po_supplier(self, purchase_order_id: int, supplier_id: int) -> Dict[str, Any]:
        """Altera o fornecedor da PO. O fornecedor deve pertencer à mesma empresa da PO."""
        po_row = self.conn.execute(
            "SELECT empresa_id FROM purchase_orders WHERE id = ?",
            [purchase_order_id],
        ).fetchone()
        if not po_row:
            return {"success": False, "error": "PO não encontrada"}
        empresa_id = po_row[0]
        sup_row = self.conn.execute(
            "SELECT id FROM suppliers WHERE id = ? AND empresa_id = ?",
            [supplier_id, empresa_id],
        ).fetchone()
        if not sup_row:
            return {"success": False, "error": "Fornecedor não encontrado ou não pertence à empresa desta PO"}
        self.conn.execute(
            "UPDATE purchase_orders SET supplier_id = ? WHERE id = ?",
            [supplier_id, purchase_order_id],
        )
        self.conn.commit()
        return {"success": True, "supplier_id": supplier_id}
