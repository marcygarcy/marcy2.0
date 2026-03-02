"""
Serviço de Vendas (Sales & Orders) para Dropshipping.

Fornece:
- Cálculo de margem real: (Preço Venda - IVA) - Comissão - Custo Fornecedor - Portes
- GMV (Volume Bruto), Margem de Contribuição Total
- Ranking de produtos por rentabilidade
- Filtros multi-tenant (empresa_id, marketplace_id, período)
"""
from __future__ import annotations

import duckdb
from datetime import date, datetime
from typing import Optional, List, Dict, Any
from app.config.database import get_db_connection


class SalesService:
    """Serviço de métricas de vendas e rentabilidade."""

    def __init__(self):
        self.conn = get_db_connection()

    def _where_filters(
        self,
        empresa_id: Optional[int] = None,
        marketplace_id: Optional[int] = None,
        data_inicio: Optional[date | str] = None,
        data_fim: Optional[date | str] = None,
        status_operacional: Optional[str] = None,
    ) -> tuple[str, list]:
        conditions = []
        params = []
        if empresa_id is not None:
            conditions.append("o.empresa_id = ?")
            params.append(empresa_id)
        if marketplace_id is not None:
            conditions.append("o.marketplace_id = ?")
            params.append(marketplace_id)
        if data_inicio is not None:
            conditions.append("CAST(o.data_criacao AS DATE) >= ?")
            params.append(str(data_inicio) if isinstance(data_inicio, date) else data_inicio)
        if data_fim is not None:
            conditions.append("CAST(o.data_criacao AS DATE) <= ?")
            params.append(str(data_fim) if isinstance(data_fim, date) else data_fim)
        if status_operacional:
            conditions.append("COALESCE(o.status_operacional, '') = ?")
            params.append(status_operacional)
        where = " AND " + " AND ".join(conditions) if conditions else ""
        return where, params

    def get_orders_with_margin(
        self,
        empresa_id: Optional[int] = None,
        marketplace_id: Optional[int] = None,
        data_inicio: Optional[str] = None,
        data_fim: Optional[str] = None,
        limit: int = 500,
        offset: int = 0,
    ) -> tuple[List[Dict[str, Any]], int]:
        """
        Lista orders com margem calculada por linha.
        Margem Real Unitária = (Venda sem IVA)/qty - Comissão/qty - Custo Fornecedor - Portes/qty - Outras/qty
        """
        where, params = self._where_filters(empresa_id, marketplace_id, data_inicio, data_fim)
        count_sql = f"SELECT COUNT(*) FROM orders o WHERE 1=1 {where}"
        total = self.conn.execute(count_sql, params).fetchone()[0]

        q = f"""
            SELECT
                o.id,
                o.numero_pedido,
                o.data_criacao,
                o.empresa_id,
                o.marketplace_id,
                o.sku_oferta,
                o.nome_produto,
                o.quantidade,
                o.valor_total_com_iva,
                (COALESCE(o.total_impostos_pedido, 0) + COALESCE(o.total_impostos_envio, 0)) AS iva_total,
                o.comissao_sem_impostos,
                o.valor_transferido_loja,
                COALESCE(o.custo_fornecedor, m.custo_fornecedor, 0) AS custo_fornecedor,
                COALESCE(o.gastos_envio, 0) AS gastos_envio,
                COALESCE(o.outras_taxas, 0) AS outras_taxas,
                o.status_operacional,
                o.status,
                o.canal_vendas,
                (COALESCE(o.valor_total_sem_impostos, 0) - COALESCE(o.comissao_sem_impostos, 0)
                 - (COALESCE(o.custo_fornecedor, m.custo_fornecedor, 0) * COALESCE(o.quantidade, 1))
                 - COALESCE(o.gastos_envio, 0) - COALESCE(o.outras_taxas, 0)) AS margem_total_linha
            FROM orders o
            LEFT JOIN sku_mapping m ON m.empresa_id = o.empresa_id AND m.sku_marketplace = o.sku_oferta
                AND (m.marketplace_id = o.marketplace_id OR (m.marketplace_id IS NULL AND o.marketplace_id IS NULL))
                AND COALESCE(m.ativo, TRUE) = TRUE
            WHERE 1=1 {where}
            ORDER BY o.data_criacao DESC NULLS LAST, o.id DESC
            LIMIT ? OFFSET ?
        """
        params.extend([limit, offset])
        rows = self.conn.execute(q, params).fetchall()
        cols = [
            "id", "numero_pedido", "data_criacao", "empresa_id", "marketplace_id",
            "sku_oferta", "nome_produto", "quantidade", "valor_total_com_iva", "iva_total",
            "comissao_sem_impostos", "valor_transferido_loja", "custo_fornecedor",
            "gastos_envio", "outras_taxas", "status_operacional", "status", "canal_vendas",
            "margem_total_linha",
        ]
        result = [dict(zip(cols, row)) for row in rows]
        return result, int(total)

    def get_sales_metrics(
        self,
        empresa_id: Optional[int] = None,
        marketplace_id: Optional[int] = None,
        data_inicio: Optional[str] = None,
        data_fim: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        GMV (Volume Bruto), Margem de Contribuição Total, número de linhas e valor médio.
        Exclui cancelados/devolvidos se quiser; aqui contamos tudo.
        """
        where, params = self._where_filters(empresa_id, marketplace_id, data_inicio, data_fim)
        sql = f"""
            SELECT
                COALESCE(SUM(o.valor_total_com_iva), 0) AS gmv,
                COALESCE(SUM(o.valor_total_sem_impostos), 0) AS vendas_sem_iva,
                COALESCE(SUM(o.comissao_sem_impostos), 0) AS total_comissao,
                COUNT(*) AS num_linhas,
                COALESCE(SUM(
                    o.valor_total_sem_impostos - o.comissao_sem_impostos
                    - (COALESCE(o.custo_fornecedor, m.custo_fornecedor, 0) * COALESCE(o.quantidade, 1))
                    - COALESCE(o.gastos_envio, 0) - COALESCE(o.outras_taxas, 0)
                ), 0) AS margem_contribuicao_total
            FROM orders o
            LEFT JOIN sku_mapping m ON m.empresa_id = o.empresa_id AND m.sku_marketplace = o.sku_oferta
                AND (m.marketplace_id = o.marketplace_id OR (m.marketplace_id IS NULL AND o.marketplace_id IS NULL))
                AND COALESCE(m.ativo, TRUE) = TRUE
            WHERE 1=1 {where}
        """
        row = self.conn.execute(sql, params).fetchone()
        if not row:
            return {
                "gmv": 0.0,
                "vendas_sem_iva": 0.0,
                "total_comissao": 0.0,
                "num_linhas": 0,
                "margem_contribuicao_total": 0.0,
                "margem_pct": 0.0,
            }
        gmv, vendas_sem_iva, total_comissao, num_linhas, margem_tot = row
        margem_pct = (margem_tot / vendas_sem_iva * 100) if vendas_sem_iva else 0.0
        return {
            "gmv": float(gmv or 0),
            "vendas_sem_iva": float(vendas_sem_iva or 0),
            "total_comissao": float(total_comissao or 0),
            "num_linhas": int(num_linhas or 0),
            "margem_contribuicao_total": float(margem_tot or 0),
            "margem_pct": round(margem_pct, 2),
        }

    def get_top_products(
        self,
        empresa_id: Optional[int] = None,
        marketplace_id: Optional[int] = None,
        data_inicio: Optional[str] = None,
        data_fim: Optional[str] = None,
        limit: int = 20,
    ) -> List[Dict[str, Any]]:
        """Ranking de produtos (SKU) por margem total (mais rentáveis primeiro)."""
        where, params = self._where_filters(empresa_id, marketplace_id, data_inicio, data_fim)
        params.append(limit)
        sql = f"""
            SELECT
                COALESCE(o.sku_oferta, '') AS sku,
                COALESCE(o.nome_produto, '') AS nome_produto,
                SUM(COALESCE(o.quantidade, 1)) AS quantidade_vendida,
                SUM(o.valor_total_com_iva) AS gmv_produto,
                SUM(
                    o.valor_total_sem_impostos - o.comissao_sem_impostos
                    - (COALESCE(o.custo_fornecedor, m.custo_fornecedor, 0) * COALESCE(o.quantidade, 1))
                    - COALESCE(o.gastos_envio, 0) - COALESCE(o.outras_taxas, 0)
                ) AS margem_total
            FROM orders o
            LEFT JOIN sku_mapping m ON m.empresa_id = o.empresa_id AND m.sku_marketplace = o.sku_oferta
                AND (m.marketplace_id = o.marketplace_id OR (m.marketplace_id IS NULL AND o.marketplace_id IS NULL))
                AND COALESCE(m.ativo, TRUE) = TRUE
            WHERE 1=1 {where}
            GROUP BY o.sku_oferta, o.nome_produto
            HAVING SUM(o.valor_total_sem_impostos) > 0
            ORDER BY margem_total DESC NULLS LAST
            LIMIT ?
        """
        rows = self.conn.execute(sql, params).fetchall()
        return [
            {
                "sku": r[0],
                "nome_produto": r[1] or "",
                "quantidade_vendida": float(r[2] or 0),
                "gmv_produto": float(r[3] or 0),
                "margem_total": float(r[4] or 0),
            }
            for r in rows
        ]

    def close(self):
        if self.conn:
            try:
                self.conn.close()
            except Exception:
                pass
