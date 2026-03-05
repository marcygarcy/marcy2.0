"""
Módulo de Vendas (Sales/Orders): Universal Ingestor, Comissões, Gatilho Compras, Rentabilidade.

- import_orders: normaliza ficheiro (Excel/CSV) para sales_orders + sales_order_items, calcula comissões,
  cria registos em orders para itens com SKU mapeado (trigger compras).
- calculate_commissions: obtém comissão (fixed + percent) de marketplaces_config.
- list_sales: lista sales_orders com filtros (empresa, marketplace, país, status).
- get_stats: GMV, taxas médias, lucro líquido previsto.
- get_rentabilidade: view v_sales_rentabilidade (lucro real por linha).
"""
from __future__ import annotations

import calendar
import pandas as pd
from pathlib import Path
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime

from app.config.database import get_db_connection
from app.etl.orders_normalizer import load_and_normalize_orders
from app.services.oss_service import calculate_oss_tax
from app.services.purchase_auto_draft_service import PurchaseAutoDraftService


# Estados da encomenda (workflow)
SALES_STATUS_PENDING = "Pending"
SALES_STATUS_PURCHASED = "Purchased"
SALES_STATUS_SHIPPED = "Shipped"
SALES_STATUS_PAID = "Paid"
SALES_STATUS_CANCELLED = "Cancelled"


def _next_id(conn, table: str) -> int:
    r = conn.execute(f"SELECT COALESCE(MAX(id), 0) + 1 FROM {table}").fetchone()
    return int(r[0]) if r and r[0] else 1


def _get_commission_config(conn, empresa_id: int, marketplace_id: Optional[int]) -> Tuple[float, float]:
    """Obtém commission_percent e fixed_fee_per_order de marketplaces_config."""
    if marketplace_id is not None:
        row = conn.execute(
            """
            SELECT commission_percent, fixed_fee_per_order
            FROM marketplaces_config
            WHERE empresa_id = ? AND (marketplace_id = ? OR marketplace_id IS NULL) AND COALESCE(ativo, TRUE) = TRUE
            ORDER BY marketplace_id DESC NULLS LAST
            LIMIT 1
            """
            , [empresa_id, marketplace_id]
        ).fetchone()
    else:
        row = conn.execute(
            """
            SELECT commission_percent, fixed_fee_per_order
            FROM marketplaces_config
            WHERE empresa_id = ? AND marketplace_id IS NULL AND COALESCE(ativo, TRUE) = TRUE
            LIMIT 1
            """,
            [empresa_id],
        ).fetchone()
    if not row:
        return 0.0, 0.0
    return float(row[0] or 0), float(row[1] or 0)


def _vat_rate_from_country(country: Optional[str]) -> float:
    """IVA OSS: taxa por país (exemplo simplificado)."""
    if not country:
        return 0.0
    c = (country or "").strip().upper()[:2]
    rates = {"PT": 23.0, "ES": 21.0, "FR": 20.0, "IT": 22.0, "DE": 19.0}
    return rates.get(c, 0.0)


class SalesModuleService:
    """Serviço do Módulo de Vendas: importação, comissões, listagem e estatísticas."""

    def __init__(self):
        self.conn = get_db_connection()

    def calculate_commissions(
        self,
        empresa_id: int,
        marketplace_id: Optional[int],
        total_gross: float,
    ) -> Dict[str, float]:
        """
        Calcula comissão fixa e percentual com base em marketplaces_config.
        Retorna total_commission_fixed (valor fixo), total_commission_percent (valor da percentagem), total_net_value.
        """
        pct, fixed = _get_commission_config(self.conn, empresa_id, marketplace_id)
        total_commission_percent_val = total_gross * (pct / 100.0) if pct else 0.0
        total_net = total_gross - fixed - total_commission_percent_val
        return {
            "total_commission_fixed": fixed,
            "total_commission_percent": total_commission_percent_val,
            "commission_percent_rate": pct,
            "fixed_fee_per_order": fixed,
            "total_net_value": max(0.0, total_net),
        }

    def import_orders(
        self,
        file_path: Path,
        empresa_id: int,
        marketplace_id: Optional[int] = None,
        marketplace_code: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Universal Ingestor: normaliza ficheiro para sales_orders + sales_order_items.
        Aplica comissões (marketplaces_config), IVA OSS por país.
        Gatilho Compras: para cada item com SKU mapeado em sku_mapping, insere em orders e pending_purchase_items.
        """
        df = load_and_normalize_orders(file_path, marketplace_code=marketplace_code)
        if df is None or df.empty:
            return {"success": False, "error": "Ficheiro vazio ou sem dados válidos", "sales_orders_created": 0}
        return self._ingest_dataframe(df, empresa_id, marketplace_id)

    def import_orders_from_dataframe(
        self,
        df: pd.DataFrame,
        empresa_id: int,
        marketplace_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Ingere vendas a partir de DataFrame já com colunas canónicas (ex.: payload API normalizado)."""
        if df is None or df.empty:
            return {"success": False, "error": "DataFrame vazio", "sales_orders_created": 0}
        return self._ingest_dataframe(df, empresa_id, marketplace_id)

    def _ingest_dataframe(
        self,
        df: pd.DataFrame,
        empresa_id: int,
        marketplace_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Lógica comum: agrupa por pedido, insere sales_orders + items + trigger (orders + pending_purchase_items)."""
        # Colunas canónicas esperadas (normalizer já mapeou ou DataFrame veio da API)
        id_col = "numero_pedido" if "numero_pedido" in df.columns else df.columns[0]
        date_col = "data_criacao" if "data_criacao" in df.columns else "data_venda" if "data_venda" in df.columns else None
        sku_col = "sku_oferta" if "sku_oferta" in df.columns else "sku"
        qty_col = "quantidade" if "quantidade" in df.columns else "qty"
        price_col = "preco_unitario" if "preco_unitario" in df.columns else "valor_bruto"
        gross_col = "valor_total_com_iva" if "valor_total_com_iva" in df.columns else "valor_bruto"
        country_col = "pais_faturamento" if "pais_faturamento" in df.columns else None
        name_col = next((c for c in ["customer_name", "nome_cliente", "cliente"] if c in df.columns), None)
        address_col = next((c for c in ["customer_address", "morada_faturacao", "morada_cliente"] if c in df.columns), None)
        nif_col = next((c for c in ["customer_nif", "nif_cliente", "nif"] if c in df.columns), None)

        # Agrupar por pedido (external_order_id)
        if id_col not in df.columns:
            df[id_col] = df.index.astype(str)
        df[id_col] = df[id_col].astype(str).fillna("")

        created_orders = 0
        created_items = 0
        created_trigger_orders = 0

        next_so_id = _next_id(self.conn, "sales_orders")
        next_soi_id = _next_id(self.conn, "sales_order_items")
        next_order_id = _next_id(self.conn, "orders")

        for external_id, group in df.groupby(id_col, sort=False):
            if not str(external_id).strip():
                continue

            # Totais do pedido (soma das linhas)
            if gross_col in group.columns:
                total_gross = float(group[gross_col].sum())
            elif qty_col in group.columns and price_col in group.columns:
                total_gross = float((group[qty_col].astype(float, errors="ignore").fillna(0) * group[price_col].astype(float, errors="ignore").fillna(0)).sum())
            else:
                total_gross = 0.0
            order_date = None
            if date_col and date_col in group.columns:
                first_date = group[date_col].dropna().iloc[0] if len(group[date_col].dropna()) else None
                if first_date is not None:
                    order_date = pd.Timestamp(first_date).to_pydatetime() if hasattr(first_date, "to_pydatetime") else first_date

            customer_country = None
            if country_col and country_col in group.columns:
                v = group[country_col].dropna().iloc[0] if len(group[country_col].dropna()) else None
                if v is not None:
                    customer_country = str(v).strip()[:2].upper() or None

            customer_name = None
            if name_col and name_col in group.columns:
                v = group[name_col].dropna().iloc[0] if len(group[name_col].dropna()) else None
                if v is not None:
                    customer_name = str(v).strip() or None
            customer_address = None
            if address_col and address_col in group.columns:
                v = group[address_col].dropna().iloc[0] if len(group[address_col].dropna()) else None
                if v is not None:
                    customer_address = str(v).strip() or None
            customer_nif = None
            if nif_col and nif_col in group.columns:
                v = group[nif_col].dropna().iloc[0] if len(group[nif_col].dropna()) else None
                if v is not None:
                    customer_nif = str(v).strip() or None

            comm = self.calculate_commissions(empresa_id, marketplace_id, total_gross)
            total_net = comm["total_net_value"]
            total_fixed = comm["total_commission_fixed"]
            total_pct_val = comm["total_commission_percent"]

            # Inserir sales_order (customer_name, customer_address, customer_nif se colunas existirem)
            try:
                self.conn.execute(
                    """
                    INSERT INTO sales_orders (
                        id, empresa_id, external_order_id, marketplace_id, order_date, import_date,
                        status, customer_country, currency, total_gross,
                        total_commission_fixed, total_commission_percent, total_net_value,
                        customer_name, customer_address, customer_nif
                    )
                    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, 'EUR', ?, ?, ?, ?, ?, ?, ?)
                    """,
                    [
                        next_so_id,
                        empresa_id,
                        str(external_id).strip(),
                        marketplace_id,
                        order_date,
                        SALES_STATUS_PENDING,
                        customer_country,
                        total_gross,
                        total_fixed,
                        total_pct_val,
                        total_net,
                        customer_name,
                        customer_address,
                        customer_nif,
                    ],
                )
            except Exception:
                self.conn.execute(
                    """
                    INSERT INTO sales_orders (
                        id, empresa_id, external_order_id, marketplace_id, order_date, import_date,
                        status, customer_country, currency, total_gross,
                        total_commission_fixed, total_commission_percent, total_net_value
                    )
                    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, 'EUR', ?, ?, ?, ?)
                    """,
                    [
                        next_so_id,
                        empresa_id,
                        str(external_id).strip(),
                        marketplace_id,
                        order_date,
                        SALES_STATUS_PENDING,
                        customer_country,
                        total_gross,
                        total_fixed,
                        total_pct_val,
                        total_net,
                    ],
                )
            created_orders += 1

            # Itens
            for _, row in group.iterrows():
                sku = str(row.get(sku_col, "") or "").strip() if sku_col in row.index else ""
                qty = float(row.get(qty_col, 1) or 1)
                unit_price = float(row.get(price_col, 0) or 0)
                if unit_price == 0 and gross_col in row.index:
                    unit_price = float(row.get(gross_col, 0) or 0) / qty if qty else 0
                country_val = row.get(country_col) if country_col and country_col in row.index else None
                vat_rate = _vat_rate_from_country(country_val)

                self.conn.execute(
                    """
                    INSERT INTO sales_order_items (id, sales_order_id, sku_marketplace, internal_sku, quantity, unit_price, vat_rate)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    [next_soi_id, next_so_id, sku or None, sku or None, qty, unit_price, vat_rate],
                )
                created_items += 1

                # Gatilho Compras: se existe custo em sku_mapping, criar ordem para compras pendentes
                if sku:
                    mapping = self.conn.execute(
                        """
                        SELECT id, custo_fornecedor, sku_fornecedor, nome_produto
                        FROM sku_mapping
                        WHERE empresa_id = ? AND sku_marketplace = ? AND COALESCE(ativo, TRUE) = TRUE
                        AND (marketplace_id IS NULL OR marketplace_id = ?)
                        ORDER BY marketplace_id DESC NULLS LAST
                        LIMIT 1
                        """,
                        [empresa_id, sku, marketplace_id or 0],
                    ).fetchone()
                    if mapping:
                        custo = float(mapping[1] or 0)
                        numero_pedido = str(external_id).strip()
                        valor_linha = unit_price * qty
                        comissao_linha = (total_fixed + total_pct_val) * (valor_linha / total_gross) if total_gross else 0
                        valor_liq = valor_linha - comissao_linha
                        self.conn.execute(
                            """
                            INSERT INTO orders (
                                id, numero_pedido, data_criacao, empresa_id, marketplace_id,
                                sku_oferta, nome_produto, quantidade, valor_total_sem_impostos,
                                valor_total_com_iva, comissao_sem_impostos, valor_transferido_loja,
                                custo_fornecedor, sales_order_id, sales_order_item_id, canal_vendas, status
                            )
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Import', 'Pending')
                            """,
                            [
                                next_order_id,
                                numero_pedido,
                                order_date,
                                empresa_id,
                                marketplace_id,
                                sku,
                                mapping[3],
                                qty,
                                valor_linha,
                                valor_linha,
                                comissao_linha,
                                valor_liq,
                                custo,
                                next_so_id,
                                next_soi_id,
                            ],
                        )
                        next_order_id += 1
                        created_trigger_orders += 1
                        # Fase 2: pending_purchase_items (draft automático com custo e fornecedor)
                        try:
                            draft_svc = PurchaseAutoDraftService()
                            draft_svc.add_pending_from_sale_item(
                                empresa_id=empresa_id,
                                sales_order_id=next_so_id,
                                sales_order_item_id=next_soi_id,
                                sku_marketplace=sku,
                                quantity=qty,
                                unit_price=unit_price,
                                total_commission_fixed=total_fixed,
                                total_commission_percent=total_pct_val,
                                total_gross=total_gross,
                                marketplace_id=marketplace_id,
                            )
                            draft_svc.close()
                        except Exception:
                            pass

                next_soi_id += 1

            # OSS: segregar IVA nacional vs destino e gravar vat_type/vat_amount
            try:
                calculate_oss_tax(self.conn, next_so_id)
            except Exception:
                pass

            next_so_id += 1

        self.conn.commit()
        return {
            "success": True,
            "sales_orders_created": created_orders,
            "sales_order_items_created": created_items,
            "orders_trigger_created": created_trigger_orders,
        }

    def list_sales(
        self,
        empresa_id: Optional[int] = None,
        marketplace_id: Optional[int] = None,
        customer_country: Optional[str] = None,
        status: Optional[str] = None,
        data_inicio: Optional[str] = None,
        data_fim: Optional[str] = None,
        only_without_proforma: bool = False,
        limit: int = 100,
        offset: int = 0,
    ) -> Tuple[List[Dict[str, Any]], int]:
        """Lista sales_orders com filtros. only_without_proforma=True exclui vendas que já têm proforma emitida."""
        conditions = []
        params = []
        if empresa_id is not None:
            conditions.append("so.empresa_id = ?")
            params.append(empresa_id)
        if marketplace_id is not None:
            conditions.append("so.marketplace_id = ?")
            params.append(marketplace_id)
        if customer_country:
            conditions.append("so.customer_country = ?")
            params.append(str(customer_country).strip().upper()[:2])
        if status:
            conditions.append("so.status = ?")
            params.append(status)
        if data_inicio:
            conditions.append("CAST(so.order_date AS DATE) >= ?")
            params.append(data_inicio)
        if data_fim:
            conditions.append("CAST(so.order_date AS DATE) <= ?")
            params.append(data_fim)
        where = " AND " + " AND ".join(conditions) if conditions else ""

        from_clause = "FROM sales_orders so"
        join_proforma = ""
        if only_without_proforma:
            join_proforma = "LEFT JOIN billing_documents bd ON bd.sales_order_id = so.id AND bd.doc_type = 'Proforma' AND bd.status = 'issued'"
            where += " AND bd.id IS NULL"

        count_sql = f"SELECT COUNT(*) {from_clause} {join_proforma} WHERE 1=1 {where}"
        total = self.conn.execute(count_sql, params).fetchone()[0]

        q = f"""
            SELECT so.id, so.empresa_id, so.external_order_id, so.marketplace_id, so.order_date, so.import_date,
                   so.status, so.customer_country, so.currency, so.total_gross,
                   so.total_commission_fixed, so.total_commission_percent, so.total_net_value,
                   m.nome AS marketplace_nome,
                   so.shipping_status, so.carrier_name, so.tracking_number, so.carrier_status, so.shipped_at,
                   po_link.purchase_order_id, po.status AS po_status, sup.nome AS supplier_nome,
                   marg.lucro_previsto, marg.margem_pct
            FROM sales_orders so
            LEFT JOIN marketplaces m ON m.id = so.marketplace_id
            LEFT JOIN (
                SELECT soi.sales_order_id, MIN(poi.purchase_order_id) AS purchase_order_id
                FROM sales_order_items soi
                JOIN purchase_order_items poi ON poi.sales_order_item_id = soi.id
                GROUP BY soi.sales_order_id
            ) po_link ON po_link.sales_order_id = so.id
            LEFT JOIN purchase_orders po ON po.id = po_link.purchase_order_id
            LEFT JOIN suppliers sup ON sup.id = po.supplier_id
            LEFT JOIN (
                SELECT sales_order_id,
                       SUM(lucro_previsto_linha) AS lucro_previsto,
                       CASE WHEN SUM(linha_gross) > 0
                            THEN ROUND(SUM(lucro_previsto_linha) / SUM(linha_gross) * 100, 1)
                            ELSE NULL END AS margem_pct
                FROM v_rentabilidade_prevista
                GROUP BY sales_order_id
            ) marg ON marg.sales_order_id = so.id
            {join_proforma}
            WHERE 1=1 {where}
            ORDER BY so.order_date DESC NULLS LAST, so.id DESC
            LIMIT ? OFFSET ?
        """
        params.extend([limit, offset])
        rows = self.conn.execute(q, params).fetchall()
        cols = [
            "id", "empresa_id", "external_order_id", "marketplace_id", "order_date", "import_date",
            "status", "customer_country", "currency", "total_gross",
            "total_commission_fixed", "total_commission_percent", "total_net_value", "marketplace_nome",
            "shipping_status", "carrier_name", "tracking_number", "carrier_status", "shipped_at",
            "purchase_order_id", "po_status", "supplier_nome", "lucro_previsto", "margem_pct",
        ]
        return [dict(zip(cols, row)) for row in rows], int(total)

    def get_order_detail(self, sales_order_id: int) -> Optional[Dict[str, Any]]:
        """Detalhe completo de uma sales_order: header, linhas, POs associadas e margem."""
        row = self.conn.execute(
            """
            SELECT so.id, so.empresa_id, so.external_order_id, so.marketplace_id, so.order_date,
                   so.status, so.customer_country, so.currency, so.total_gross,
                   so.total_commission_fixed, so.total_commission_percent, so.total_net_value,
                   so.shipping_status, so.carrier_name, so.tracking_number, so.carrier_status, so.shipped_at,
                   so.customer_name, so.customer_address, so.customer_nif,
                   m.nome AS marketplace_nome, e.nome AS empresa_nome
            FROM sales_orders so
            LEFT JOIN marketplaces m ON m.id = so.marketplace_id
            LEFT JOIN empresas e ON e.id = so.empresa_id
            WHERE so.id = ?
            """,
            [sales_order_id],
        ).fetchone()
        if not row:
            return None

        cols = [
            "id", "empresa_id", "external_order_id", "marketplace_id", "order_date",
            "status", "customer_country", "currency", "total_gross",
            "total_commission_fixed", "total_commission_percent", "total_net_value",
            "shipping_status", "carrier_name", "tracking_number", "carrier_status", "shipped_at",
            "customer_name", "customer_address", "customer_nif",
            "marketplace_nome", "empresa_nome",
        ]
        result: Dict[str, Any] = dict(zip(cols, row))
        result["order_date"] = str(result["order_date"])[:10] if result.get("order_date") else None

        # Linhas da venda
        item_rows = self.conn.execute(
            """
            SELECT soi.id, soi.sku_marketplace, soi.internal_sku, soi.quantity, soi.unit_price, soi.vat_rate,
                   COALESCE(soi.quantity * soi.unit_price, 0) AS linha_gross,
                   sm.nome_produto, sm.custo_fornecedor
            FROM sales_order_items soi
            LEFT JOIN sku_mapping sm ON sm.empresa_id = ? AND sm.sku_marketplace = soi.sku_marketplace
                                    AND COALESCE(sm.ativo, TRUE) = TRUE
            WHERE soi.sales_order_id = ?
            ORDER BY soi.id
            """,
            [result.get("empresa_id"), sales_order_id],
        ).fetchall()
        item_cols = ["id", "sku_marketplace", "internal_sku", "quantity", "unit_price", "vat_rate",
                     "linha_gross", "nome_produto", "custo_fornecedor"]
        result["items"] = [dict(zip(item_cols, r)) for r in item_rows]

        # POs associadas
        po_rows = self.conn.execute(
            """
            SELECT DISTINCT po.id, po.status, po.invoice_ref, COALESCE(po.total_final, 0) AS total_final,
                   s.nome AS supplier_nome, s.id AS supplier_id,
                   po.data_criacao, po.due_date
            FROM sales_order_items soi
            JOIN purchase_order_items poi ON poi.sales_order_item_id = soi.id
            JOIN purchase_orders po ON po.id = poi.purchase_order_id
            LEFT JOIN suppliers s ON s.id = po.supplier_id
            WHERE soi.sales_order_id = ?
            ORDER BY po.id
            """,
            [sales_order_id],
        ).fetchall()
        po_cols = ["id", "status", "invoice_ref", "total_final", "supplier_nome", "supplier_id", "data_criacao", "due_date"]
        result["purchase_orders"] = [dict(zip(po_cols, r)) for r in po_rows]

        # Margem
        try:
            marg = self.conn.execute(
                """
                SELECT SUM(lucro_previsto_linha), SUM(custo_previsto_linha),
                       SUM(CASE WHEN mapping_em_falta = 1 THEN 1 ELSE 0 END)
                FROM v_rentabilidade_prevista WHERE sales_order_id = ?
                """,
                [sales_order_id],
            ).fetchone()
            if marg:
                tg = float(result.get("total_gross") or 0)
                result["lucro_previsto"] = float(marg[0] or 0)
                result["custo_previsto"] = float(marg[1] or 0)
                result["items_sem_mapping"] = int(marg[2] or 0)
                result["margem_pct"] = round(result["lucro_previsto"] / tg * 100, 1) if tg > 0 else None
            else:
                result["lucro_previsto"] = None
                result["custo_previsto"] = None
                result["items_sem_mapping"] = 0
                result["margem_pct"] = None
        except Exception:
            result["lucro_previsto"] = None
            result["custo_previsto"] = None
            result["items_sem_mapping"] = 0
            result["margem_pct"] = None

        return result

    def get_stats(
        self,
        empresa_id: Optional[int] = None,
        marketplace_id: Optional[int] = None,
        data_inicio: Optional[str] = None,
        data_fim: Optional[str] = None,
    ) -> Dict[str, Any]:
        """KPIs: GMV, taxas de comissão médias, lucro líquido previsto."""
        conditions = []
        params = []
        if empresa_id is not None:
            conditions.append("empresa_id = ?")
            params.append(empresa_id)
        if marketplace_id is not None:
            conditions.append("marketplace_id = ?")
            params.append(marketplace_id)
        if data_inicio:
            conditions.append("CAST(order_date AS DATE) >= ?")
            params.append(data_inicio)
        if data_fim:
            conditions.append("CAST(order_date AS DATE) <= ?")
            params.append(data_fim)
        where = " AND " + " AND ".join(conditions) if conditions else ""

        q = f"""
            SELECT
                COUNT(*) AS num_orders,
                COALESCE(SUM(total_gross), 0) AS gmv,
                COALESCE(SUM(total_commission_fixed), 0) AS total_commission_fixed,
                COALESCE(SUM(total_commission_percent), 0) AS total_commission_percent,
                COALESCE(SUM(total_net_value), 0) AS total_net_value
            FROM sales_orders
            WHERE 1=1 {where}
        """
        row = self.conn.execute(q, params).fetchone()
        if not row:
            return {
                "num_orders": 0,
                "gmv": 0.0,
                "total_commission_fixed": 0.0,
                "total_commission_percent": 0.0,
                "avg_commission_rate_pct": 0.0,
                "total_net_value": 0.0,
                "lucro_previsto": 0.0,
            }
        num, gmv, fix, pct_val, net = row
        gmv_f = float(gmv or 0)
        avg_pct = (float(pct_val or 0) / gmv_f * 100) if gmv_f else 0.0
        # Lucro previsto acumulado (v_rentabilidade_prevista: venda - comissão - custo mapeado)
        try:
            q2 = f"SELECT COALESCE(SUM(lucro_previsto_linha), 0) FROM v_rentabilidade_prevista WHERE 1=1 {where}"
            lucro_row = self.conn.execute(q2, params).fetchone()
            lucro_previsto = float(lucro_row[0] or 0) if lucro_row else 0.0
        except Exception:
            lucro_previsto = 0.0
        return {
            "num_orders": int(num or 0),
            "gmv": gmv_f,
            "total_commission_fixed": float(fix or 0),
            "total_commission_percent": float(pct_val or 0),
            "avg_commission_rate_pct": round(avg_pct, 2),
            "total_net_value": float(net or 0),
            "lucro_previsto": round(lucro_previsto, 2),
        }

    def get_recent_with_margin(
        self,
        empresa_id: Optional[int] = None,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        """Lista vendas recentes com Lucro Previsto e indicador Mapping em falta (v_rentabilidade_prevista)."""
        conditions = []
        params = []
        if empresa_id is not None:
            conditions.append("empresa_id = ?")
            params.append(empresa_id)
        where = " AND " + " AND ".join(conditions) if conditions else ""
        params.append(limit)
        try:
            q = f"""
                SELECT sales_order_id, external_order_id, empresa_id, marketplace_id, order_date,
                       total_gross, total_net_value, sales_order_item_id, sku_marketplace, internal_sku,
                       qty, unit_price, linha_gross, cost_price_base, custo_previsto_linha,
                       lucro_previsto_linha, mapping_em_falta
                FROM v_rentabilidade_prevista
                WHERE 1=1 {where}
                ORDER BY order_date DESC NULLS LAST, sales_order_id DESC, sales_order_item_id DESC
                LIMIT ?
            """
            rows = self.conn.execute(q, params).fetchall()
            cols = [
                "sales_order_id", "external_order_id", "empresa_id", "marketplace_id", "order_date",
                "total_gross", "total_net_value", "sales_order_item_id", "sku_marketplace", "internal_sku",
                "qty", "unit_price", "linha_gross", "cost_price_base", "custo_previsto_linha",
                "lucro_previsto_linha", "mapping_em_falta",
            ]
            return [dict(zip(cols, row)) for row in rows]
        except Exception:
            return []

    def get_rentabilidade(
        self,
        empresa_id: Optional[int] = None,
        sales_order_id: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        """Lucro real por linha (view v_sales_rentabilidade)."""
        conditions = []
        params = []
        if empresa_id is not None:
            conditions.append("so.empresa_id = ?")
            params.append(empresa_id)
        if sales_order_id is not None:
            conditions.append("so.id = ?")
            params.append(sales_order_id)
        where = " AND " + " AND ".join(conditions) if conditions else ""

        q = f"""
            SELECT sales_order_id, external_order_id, empresa_id, marketplace_id, order_date, sales_status,
                   total_gross, total_net_value, sales_order_item_id, sku_marketplace, internal_sku,
                   qty_venda, unit_price, linha_gross, order_id, purchase_order_id,
                   custo_unitario, qty_compra, custo_total_linha, portes_rateados, impostos_rateados,
                   custo_real_compra, lucro_real_unitario
            FROM v_sales_rentabilidade
            WHERE 1=1 {where}
        """
        rows = self.conn.execute(q, params).fetchall()
        cols = [
            "sales_order_id", "external_order_id", "empresa_id", "marketplace_id", "order_date", "sales_status",
            "total_gross", "total_net_value", "sales_order_item_id", "sku_marketplace", "internal_sku",
            "qty_venda", "unit_price", "linha_gross", "order_id", "purchase_order_id",
            "custo_unitario", "qty_compra", "custo_total_linha", "portes_rateados", "impostos_rateados",
            "custo_real_compra", "lucro_real_unitario",
        ]
        return [dict(zip(cols, r)) for r in rows]

    def get_sales_kpis(
        self,
        ano: int,
        mes: int,
        empresa_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        KPIs de vendas por ano/mês (sales_orders):
        vendas_acumuladas, vendas_mes, orders por estado, top 10 produtos, marketplace maior volume, mais orders.
        """
        data_inicio_ano = f"{ano}-01-01"
        last_day = calendar.monthrange(ano, mes)[1]
        data_fim_mes = f"{ano}-{mes:02d}-{last_day}"
        data_inicio_mes = f"{ano}-{mes:02d}-01"
        conds = []
        params: List[Any] = []
        if empresa_id is not None:
            conds.append("so.empresa_id = ?")
            params.append(empresa_id)
        where = " AND " + " AND ".join(conds) if conds else ""

        # Vendas acumuladas (1 jan até fim do mês)
        row_acum = self.conn.execute(
            f"""
            SELECT COALESCE(SUM(total_gross), 0), COUNT(*)
            FROM sales_orders so
            WHERE CAST(so.order_date AS DATE) >= ? AND CAST(so.order_date AS DATE) <= ? {where}
            """.replace(" {where}", where),
            [data_inicio_ano, data_fim_mes] + params,
        ).fetchone()
        vendas_acumuladas = float(row_acum[0] or 0)
        total_orders_ano = int(row_acum[1] or 0)

        # Vendas do mês
        row_mes = self.conn.execute(
            f"""
            SELECT COALESCE(SUM(total_gross), 0), COUNT(*)
            FROM sales_orders so
            WHERE CAST(so.order_date AS DATE) >= ? AND CAST(so.order_date AS DATE) <= ? {where}
            """.replace(" {where}", where),
            [data_inicio_mes, data_fim_mes] + params,
        ).fetchone()
        vendas_mes = float(row_mes[0] or 0)
        total_orders_mes = int(row_mes[1] or 0)

        # Contagens por status (no mês)
        status_counts: Dict[str, int] = {}
        for status in ("Pending", "Shipped", "Paid", "Purchased", "Cancelled"):
            r = self.conn.execute(
                f"""
                SELECT COUNT(*) FROM sales_orders so
                WHERE CAST(so.order_date AS DATE) >= ? AND CAST(so.order_date AS DATE) <= ?
                AND COALESCE(so.status, '') = ? {where}
                """.replace(" {where}", where),
                [data_inicio_mes, data_fim_mes, status] + params,
            ).fetchone()
            status_counts[status] = int(r[0] or 0)
        orders_pendentes = status_counts.get("Pending", 0)
        orders_concluidas = (
            status_counts.get("Shipped", 0)
            + status_counts.get("Paid", 0)
            + status_counts.get("Purchased", 0)
        )
        orders_canceladas = status_counts.get("Cancelled", 0)
        orders_reembolsadas = 0  # sem coluna específica
        orders_ativas = total_orders_mes - orders_canceladas

        # Top 10 produtos (do mês, por quantidade vendida)
        params_top = [data_inicio_mes, data_fim_mes] + params + [10]
        try:
            rows_top = self.conn.execute(
                f"""
                SELECT COALESCE(soi.sku_marketplace, soi.internal_sku, '—') AS sku,
                       COALESCE(soi.sku_marketplace, soi.internal_sku, '—') AS nome_produto,
                       COALESCE(SUM(soi.quantity), 0) AS quantidade_vendida,
                       COALESCE(SUM(soi.quantity * COALESCE(soi.unit_price, 0)), 0) AS gmv_produto
                FROM sales_order_items soi
                JOIN sales_orders so ON so.id = soi.sales_order_id
                WHERE CAST(so.order_date AS DATE) >= ? AND CAST(so.order_date AS DATE) <= ? {where}
                GROUP BY COALESCE(soi.sku_marketplace, soi.internal_sku, '—')
                ORDER BY quantidade_vendida DESC
                LIMIT ?
                """.replace(" {where}", where),
                params_top,
            ).fetchall()
            top_10_produtos = [
                {
                    "sku": r[0],
                    "nome_produto": r[1] or r[0],
                    "quantidade_vendida": float(r[2] or 0),
                    "gmv_produto": float(r[3] or 0),
                }
                for r in rows_top
            ]
        except Exception:
            top_10_produtos = []

        # Marketplace com maior volume (€) no mês
        try:
            row_mv = self.conn.execute(
                f"""
                SELECT so.marketplace_id, COALESCE(SUM(so.total_gross), 0) AS vol
                FROM sales_orders so
                WHERE CAST(so.order_date AS DATE) >= ? AND CAST(so.order_date AS DATE) <= ? {where}
                GROUP BY so.marketplace_id
                ORDER BY vol DESC
                LIMIT 1
                """.replace(" {where}", where),
                [data_inicio_mes, data_fim_mes] + params,
            ).fetchone()
            if row_mv and row_mv[0] is not None:
                nome_m = self.conn.execute(
                    "SELECT nome FROM marketplaces WHERE id = ?", [row_mv[0]]
                ).fetchone()
                marketplace_maior_volume = {
                    "marketplace_id": row_mv[0],
                    "nome": (nome_m[0] if nome_m else f"Marketplace #{row_mv[0]}"),
                    "volume": float(row_mv[1] or 0),
                    "num_orders": None,
                }
            else:
                marketplace_maior_volume = {"marketplace_id": None, "nome": "—", "volume": 0.0, "num_orders": None}
        except Exception:
            marketplace_maior_volume = {"marketplace_id": None, "nome": "—", "volume": 0.0, "num_orders": None}

        # Marketplace com mais orders no mês
        try:
            row_mo = self.conn.execute(
                f"""
                SELECT so.marketplace_id, COUNT(*) AS cnt
                FROM sales_orders so
                WHERE CAST(so.order_date AS DATE) >= ? AND CAST(so.order_date AS DATE) <= ? {where}
                GROUP BY so.marketplace_id
                ORDER BY cnt DESC
                LIMIT 1
                """.replace(" {where}", where),
                [data_inicio_mes, data_fim_mes] + params,
            ).fetchone()
            if row_mo and row_mo[0] is not None:
                nome_m = self.conn.execute(
                    "SELECT nome FROM marketplaces WHERE id = ?", [row_mo[0]]
                ).fetchone()
                marketplace_mais_orders = {
                    "marketplace_id": row_mo[0],
                    "nome": (nome_m[0] if nome_m else f"Marketplace #{row_mo[0]}"),
                    "volume": None,
                    "num_orders": int(row_mo[1] or 0),
                }
            else:
                marketplace_mais_orders = {"marketplace_id": None, "nome": "—", "volume": None, "num_orders": 0}
        except Exception:
            marketplace_mais_orders = {"marketplace_id": None, "nome": "—", "volume": None, "num_orders": 0}

        return {
            "ano": ano,
            "mes": mes,
            "vendas_acumuladas": round(vendas_acumuladas, 2),
            "vendas_mes": round(vendas_mes, 2),
            "total_orders_ativas": orders_ativas,
            "orders_concluidas": orders_concluidas,
            "orders_pendentes": orders_pendentes,
            "orders_canceladas": orders_canceladas,
            "orders_reembolsadas": orders_reembolsadas,
            "top_10_produtos": top_10_produtos,
            "marketplace_maior_volume": marketplace_maior_volume,
            "marketplace_mais_orders": marketplace_mais_orders,
        }

    def close(self):
        try:
            if self.conn:
                self.conn.close()
        except Exception:
            pass
