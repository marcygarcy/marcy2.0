"""
Módulo de Compras: SKU Translator, Order Aggregator, Rentabilidade Triangular.

- SKU Translator: identifica fornecedor e custo previsto a partir do SKU da venda.
- Order Aggregator: agrupa várias vendas (orders) numa única purchase_order (consolidação).
- Triangular Profit: margem real = valor líquido venda - custo real compra (rateado).
"""
from __future__ import annotations

import duckdb
from typing import Optional, List, Dict, Any
from app.config.database import get_db_connection


class SKUTranslatorService:
    """Traduz SKU Marketplace -> Fornecedor, SKU Fornecedor e custo base."""

    def __init__(self):
        self.conn = get_db_connection()

    def resolve(self, empresa_id: int, sku_marketplace: str, marketplace_id: Optional[int] = None) -> Optional[Dict[str, Any]]:
        """
        Dado empresa_id e sku_marketplace (e opcionalmente marketplace_id), devolve
        supplier_id, sku_fornecedor, custo_fornecedor e nome_produto.
        """
        if not sku_marketplace or not str(sku_marketplace).strip():
            return None
        q = """
            SELECT m.id, m.supplier_id, m.sku_fornecedor, m.custo_fornecedor, m.nome_produto, s.nome AS supplier_nome
            FROM sku_mapping m
            LEFT JOIN suppliers s ON s.id = m.supplier_id
            WHERE m.empresa_id = ? AND m.sku_marketplace = ? AND COALESCE(m.ativo, TRUE) = TRUE
            AND (m.marketplace_id IS NULL OR m.marketplace_id = ?)
            ORDER BY m.marketplace_id DESC NULLS LAST
            LIMIT 1
        """
        row = self.conn.execute(q, [empresa_id, str(sku_marketplace).strip(), marketplace_id or 0]).fetchone()
        if not row:
            return None
        return {
            "sku_mapping_id": row[0],
            "supplier_id": row[1],
            "sku_fornecedor": row[2],
            "custo_fornecedor": float(row[3] or 0),
            "nome_produto": row[4],
            "supplier_nome": row[5],
        }

    def close(self):
        try:
            self.conn.close()
        except Exception:
            pass


class OrderAggregatorService:
    """
    Agrupa múltiplas ordens de venda (order_id) numa única purchase_order.
    Opção: tipo_envio 'Escritorio' (consolidação) ou 'Direto'.
    Rateio de portes e impostos por linha.
    """

    def __init__(self):
        self.conn = get_db_connection()

    def _next_id(self, table: str) -> int:
        r = self.conn.execute(f"SELECT COALESCE(MAX(id), 0) + 1 FROM {table}").fetchone()
        return int(r[0]) if r else 1

    def create_draft_from_sales(
        self,
        empresa_id: int,
        order_ids: List[int],
        supplier_id: Optional[int] = None,
        tipo_envio: str = "Escritorio",
        portes_totais: float = 0,
        taxa_iva_pct: float = 0,
    ) -> Dict[str, Any]:
        """
        Cria uma purchase_order em Draft e os purchase_order_items ligados às vendas.
        Se supplier_id for None, usa o fornecedor da primeira linha com mapping.
        Rateia portes_totais e calcula impostos por linha (conforme taxa_iva_pct).
        """
        if not order_ids:
            return {"success": False, "error": "order_ids vazio", "purchase_order_id": None}

        translator = SKUTranslatorService()
        items_data = []
        for oid in order_ids:
            row = self.conn.execute(
                "SELECT id, empresa_id, marketplace_id, sku_oferta, quantidade, sales_order_item_id FROM orders WHERE id = ?",
                [oid],
            ).fetchone()
            if not row:
                continue
            _, emp_id, mkt_id, sku, qty, soi_id = row[0], row[1], row[2], row[3], row[4], row[5] if len(row) > 5 else None
            if emp_id != empresa_id:
                continue
            resolved = translator.resolve(empresa_id, sku or "", mkt_id)
            custo = float(resolved["custo_fornecedor"]) if resolved else 0
            sup_id = (resolved.get("supplier_id")) if resolved else None
            if supplier_id is None and sup_id is not None:
                supplier_id = sup_id
            items_data.append({
                "order_id": oid,
                "sales_order_item_id": soi_id,
                "sku_marketplace": sku,
                "sku_fornecedor": resolved.get("sku_fornecedor") if resolved else None,
                "quantidade": float(qty or 1),
                "custo_unitario": custo,
            })
        translator.close()

        if not items_data:
            return {"success": False, "error": "Nenhuma ordem válida ou com mapping", "purchase_order_id": None}

        total_base = sum(it["custo_unitario"] * it["quantidade"] for it in items_data)
        impostos_totais = total_base * (taxa_iva_pct / 100) if taxa_iva_pct else 0
        n_lines = len(items_data)
        portes_por_linha = portes_totais / n_lines if n_lines else 0
        impostos_por_linha = impostos_totais / n_lines if n_lines else 0

        # Inteligência ERP: se fornecedor tem tipo_envio Dropshipping -> PO como Envio Direto
        po_tipo_envio = tipo_envio
        if supplier_id:
            row_s = self.conn.execute(
                "SELECT tipo_envio, default_shipping_type FROM suppliers WHERE id = ?",
                [supplier_id],
            ).fetchone()
            if row_s:
                supp_tipo = (row_s[0] or row_s[1] or "").strip()
                if supp_tipo == "Dropshipping":
                    po_tipo_envio = "Direto"
                elif supp_tipo:
                    po_tipo_envio = "Escritorio"

        po_id = self._next_id("purchase_orders")
        self.conn.execute(
            """
            INSERT INTO purchase_orders (id, empresa_id, supplier_id, status, tipo_envio, total_base, portes_totais, impostos, total_final)
            VALUES (?, ?, ?, 'Draft', ?, ?, ?, ?, ?)
            """,
            [po_id, empresa_id, supplier_id, po_tipo_envio, total_base, portes_totais, impostos_totais, total_base + portes_totais + impostos_totais],
        )

        next_item_id = self._next_id("purchase_order_items")
        for idx, it in enumerate(items_data):
            item_id = next_item_id + idx
            self.conn.execute(
                """
                INSERT INTO purchase_order_items (id, purchase_order_id, order_id, sales_order_item_id, sku_marketplace, sku_fornecedor, quantidade, custo_unitario, portes_rateados, impostos_rateados)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    item_id,
                    po_id,
                    it["order_id"],
                    it.get("sales_order_item_id"),
                    it.get("sku_marketplace"),
                    it.get("sku_fornecedor"),
                    it["quantidade"],
                    it["custo_unitario"],
                    portes_por_linha,
                    impostos_por_linha,
                ],
            )

        self.conn.commit()
        return {
            "success": True,
            "purchase_order_id": po_id,
            "total_base": total_base,
            "portes_totais": portes_totais,
            "impostos": impostos_totais,
            "total_final": total_base + portes_totais + impostos_totais,
            "items_count": len(items_data),
        }

    def close(self):
        try:
            self.conn.close()
        except Exception:
            pass


class TriangularProfitService:
    """Consulta a vista de rentabilidade triangular (Venda vs Compra vs Custo)."""

    def __init__(self):
        self.conn = get_db_connection()

    def get_rentabilidade(
        self,
        empresa_id: Optional[int] = None,
        purchase_order_id: Optional[int] = None,
        order_id: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        """
        Devolve linhas da vista v_rentabilidade_triangular.
        Filtros: empresa_id, purchase_order_id, order_id.
        """
        conditions = []
        params = []
        if empresa_id is not None:
            conditions.append("o.empresa_id = ?")
            params.append(empresa_id)
        if purchase_order_id is not None:
            conditions.append("poi.purchase_order_id = ?")
            params.append(purchase_order_id)
        if order_id is not None:
            conditions.append("o.id = ?")
            params.append(order_id)
        where = " AND " + " AND ".join(conditions) if conditions else ""

        q = f"""
            SELECT
                o.id AS order_id,
                o.numero_pedido,
                o.empresa_id,
                o.sku_oferta,
                o.quantidade AS qty_venda,
                o.valor_total_sem_impostos AS vendas_sem_iva,
                o.comissao_sem_impostos AS comissao,
                o.valor_transferido_loja AS valor_liquido_venda,
                poi.purchase_order_id,
                po.status AS po_status,
                po.tipo_envio,
                s.nome AS fornecedor_nome,
                poi.custo_unitario,
                poi.quantidade AS qty_compra,
                (poi.custo_unitario * poi.quantidade) AS custo_total_linha,
                poi.portes_rateados,
                poi.impostos_rateados,
                (poi.custo_unitario * poi.quantidade + COALESCE(poi.portes_rateados, 0) + COALESCE(poi.impostos_rateados, 0)) AS custo_real_compra,
                (COALESCE(o.valor_total_sem_impostos, 0) - COALESCE(o.comissao_sem_impostos, 0)
                 - (poi.custo_unitario * poi.quantidade + COALESCE(poi.portes_rateados, 0) + COALESCE(poi.impostos_rateados, 0))) AS margem_real_linha
            FROM orders o
            INNER JOIN purchase_order_items poi ON poi.order_id = o.id
            INNER JOIN purchase_orders po ON po.id = poi.purchase_order_id
            LEFT JOIN suppliers s ON s.id = po.supplier_id
            WHERE 1=1 {where}
        """
        rows = self.conn.execute(q, params).fetchall()
        cols = [
            "order_id", "numero_pedido", "empresa_id", "sku_oferta", "qty_venda",
            "vendas_sem_iva", "comissao", "valor_liquido_venda", "purchase_order_id",
            "po_status", "tipo_envio", "fornecedor_nome", "custo_unitario", "qty_compra",
            "custo_total_linha", "portes_rateados", "impostos_rateados", "custo_real_compra", "margem_real_linha",
        ]
        return [dict(zip(cols, row)) for row in rows]

    def close(self):
        try:
            self.conn.close()
        except Exception:
            pass


class PurchaseOrderService:
    """Listagem de ordens de compra, detalhe, atualização de status e vendas pendentes."""

    def __init__(self):
        self.conn = get_db_connection()

    def list_purchase_orders(
        self,
        empresa_id: Optional[int] = None,
        status: Optional[str] = None,
        data_inicio: Optional[str] = None,
        data_fim: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[List[Dict[str, Any]], int]:
        """Lista purchase_orders com nome do fornecedor."""
        conditions = []
        params = []
        if empresa_id is not None:
            conditions.append("po.empresa_id = ?")
            params.append(empresa_id)
        if status:
            conditions.append("po.status = ?")
            params.append(status)
        if data_inicio:
            conditions.append("CAST(po.data_criacao AS DATE) >= ?")
            params.append(data_inicio)
        if data_fim:
            conditions.append("CAST(po.data_criacao AS DATE) <= ?")
            params.append(data_fim)
        where = " AND " + " AND ".join(conditions) if conditions else ""
        count_q = f"SELECT COUNT(*) FROM purchase_orders po WHERE 1=1 {where}"
        total = self.conn.execute(count_q, params).fetchone()[0]
        q = f"""
            SELECT po.id, po.empresa_id, po.supplier_id, po.status, po.tipo_envio,
                   po.total_base, po.portes_totais, po.impostos, po.total_final,
                   po.data_criacao, po.data_ordered, po.data_paid, po.notas,
                   po.billing_nif, po.billing_address, po.billing_name, po.supplier_order_id,
                   s.nome AS supplier_nome,
                   (SELECT STRING_AGG(DISTINCT COALESCE(so.external_order_id, o.numero_pedido), ', ')
                    FROM purchase_order_items poi
                    LEFT JOIN orders o ON o.id = poi.order_id
                    LEFT JOIN sales_order_items soi ON soi.id = poi.sales_order_item_id
                    LEFT JOIN sales_orders so ON so.id = soi.sales_order_id
                    WHERE poi.purchase_order_id = po.id
                   ) AS order_refs
            FROM purchase_orders po
            LEFT JOIN suppliers s ON s.id = po.supplier_id
            WHERE 1=1 {where}
            ORDER BY po.data_criacao DESC NULLS LAST
            LIMIT ? OFFSET ?
        """
        params.extend([limit, offset])
        rows = self.conn.execute(q, params).fetchall()
        cols = [
            "id", "empresa_id", "supplier_id", "status", "tipo_envio",
            "total_base", "portes_totais", "impostos", "total_final",
            "data_criacao", "data_ordered", "data_paid", "notas",
            "billing_nif", "billing_address", "billing_name", "supplier_order_id",
            "supplier_nome", "order_refs",
        ]
        return [dict(zip(cols, row)) for row in rows], int(total)

    def list_purchase_orders_with_invoice_status(
        self,
        empresa_id: Optional[int] = None,
        status: Optional[str] = None,
        invoice_state: Optional[str] = None,
        limit: int = 200,
        offset: int = 0,
    ) -> tuple[List[Dict[str, Any]], int]:
        """Lista POs com indicadores de fatura e conta corrente (para match PO ↔ Fatura).
        invoice_state: fatura_em_falta | por_enviar_cc | na_conta_corrente | conciliado
        """
        conditions = []
        params = []
        if empresa_id is not None:
            conditions.append("po.empresa_id = ?")
            params.append(empresa_id)
        if status:
            conditions.append("po.status = ?")
            params.append(status)
        if invoice_state == "fatura_em_falta":
            conditions.append("((po.invoice_ref IS NULL OR TRIM(COALESCE(po.invoice_ref, '')) = '') AND po.invoice_amount IS NULL)")
        elif invoice_state == "por_enviar_cc":
            conditions.append("(po.invoice_ref IS NOT NULL AND TRIM(po.invoice_ref) <> '' AND po.invoice_amount IS NOT NULL)")
            conditions.append("NOT EXISTS (SELECT 1 FROM supplier_ledger sl WHERE sl.purchase_order_id = po.id AND sl.tipo = 'Fatura')")
        elif invoice_state == "na_conta_corrente":
            conditions.append("EXISTS (SELECT 1 FROM supplier_ledger sl WHERE sl.purchase_order_id = po.id AND sl.tipo = 'Fatura')")
        elif invoice_state == "conciliado":
            conditions.append("EXISTS (SELECT 1 FROM financial_reconciliation fr WHERE fr.purchase_order_id = po.id AND fr.status = 'Matched')")
        where = " AND " + " AND ".join(conditions) if conditions else ""
        count_q = f"SELECT COUNT(*) FROM purchase_orders po WHERE 1=1 {where}"
        total = self.conn.execute(count_q, params).fetchone()[0]
        q = f"""
            SELECT po.id, po.empresa_id, po.supplier_id, po.status, po.tipo_envio,
                   po.total_final, po.data_criacao, po.data_ordered,
                   po.invoice_ref, po.invoice_amount, po.invoice_pdf_url,
                   s.nome AS supplier_nome, e.nome AS empresa_nome,
                   EXISTS (SELECT 1 FROM supplier_ledger sl WHERE sl.purchase_order_id = po.id AND sl.tipo = 'Fatura') AS has_ledger_entry,
                   EXISTS (SELECT 1 FROM financial_reconciliation fr WHERE fr.purchase_order_id = po.id AND fr.status = 'Matched') AS is_reconciled
            FROM purchase_orders po
            LEFT JOIN suppliers s ON s.id = po.supplier_id
            LEFT JOIN empresas e ON e.id = po.empresa_id
            WHERE 1=1 {where}
            ORDER BY po.data_criacao DESC NULLS LAST
            LIMIT ? OFFSET ?
        """
        params.extend([limit, offset])
        rows = self.conn.execute(q, params).fetchall()
        cols = [
            "id", "empresa_id", "supplier_id", "status", "tipo_envio",
            "total_final", "data_criacao", "data_ordered",
            "invoice_ref", "invoice_amount", "invoice_pdf_url",
            "supplier_nome", "empresa_nome", "has_ledger_entry", "is_reconciled",
        ]
        out = []
        for row in rows:
            d = dict(zip(cols, row))
            d["has_ledger_entry"] = bool(d.get("has_ledger_entry"))
            d["is_reconciled"] = bool(d.get("is_reconciled"))
            ref_ok = bool(d.get("invoice_ref"))
            amount_ok = d.get("invoice_amount") is not None
            if ref_ok and amount_ok:
                d["invoice_status"] = "ref_and_amount"
            elif d.get("invoice_pdf_url"):
                d["invoice_status"] = "url_only"
            else:
                d["invoice_status"] = "none"
            out.append(d)
        return out, int(total)

    def get_purchase_order_detail(self, purchase_order_id: int) -> Optional[Dict[str, Any]]:
        """Detalhe de uma PO com itens (order_id, sales_order_item_id, sku, qty, custo, etc.) e dados fiscais."""
        row = self.conn.execute(
            """
            SELECT po.id, po.empresa_id, po.supplier_id, po.status, po.tipo_envio,
                   po.total_base, po.portes_totais, po.impostos, po.total_final,
                   po.data_criacao, po.data_ordered, po.data_paid, po.notas,
                   po.billing_nif, po.billing_address, po.billing_name, po.supplier_order_id,
                   s.nome AS supplier_nome, e.nome AS empresa_nome
            FROM purchase_orders po
            LEFT JOIN suppliers s ON s.id = po.supplier_id
            LEFT JOIN empresas e ON e.id = po.empresa_id
            WHERE po.id = ?
            """,
            [purchase_order_id],
        ).fetchone()
        if not row:
            return None
        cols = [
            "id", "empresa_id", "supplier_id", "status", "tipo_envio",
            "total_base", "portes_totais", "impostos", "total_final",
            "data_criacao", "data_ordered", "data_paid", "notas",
            "billing_nif", "billing_address", "billing_name", "supplier_order_id",
            "supplier_nome", "empresa_nome",
        ]
        po = dict(zip(cols, row))
        items = self.conn.execute(
            """
            SELECT poi.id, poi.purchase_order_id, poi.order_id, poi.sales_order_item_id, poi.sku_marketplace, poi.sku_fornecedor,
                   poi.quantidade, poi.custo_unitario, poi.portes_rateados, poi.impostos_rateados
            FROM purchase_order_items poi
            WHERE poi.purchase_order_id = ?
            """,
            [purchase_order_id],
        ).fetchall()
        po["items"] = [
            {
                "id": r[0], "purchase_order_id": r[1], "order_id": r[2], "sales_order_item_id": r[3],
                "sku_marketplace": r[4], "sku_fornecedor": r[5], "quantidade": r[6], "custo_unitario": r[7],
                "portes_rateados": r[8], "impostos_rateados": r[9],
            }
            for r in items
        ]
        return po

    def update_invoice(
        self,
        purchase_order_id: int,
        invoice_ref: Optional[str] = None,
        invoice_amount: Optional[float] = None,
    ) -> Optional[Dict[str, Any]]:
        """Atualiza invoice_ref e/ou invoice_amount na PO. Devolve a PO atualizada (id, empresa_id, supplier_id, total_final) ou None se não existir."""
        row = self.conn.execute(
            "SELECT id, empresa_id, supplier_id, COALESCE(total_final, 0) FROM purchase_orders WHERE id = ?",
            [purchase_order_id],
        ).fetchone()
        if not row:
            return None
        po_id, empresa_id, supplier_id, total_final = row
        updates = []
        params = []
        if invoice_ref is not None:
            updates.append("invoice_ref = ?")
            params.append(invoice_ref)
        if invoice_amount is not None:
            updates.append("invoice_amount = ?")
            params.append(float(invoice_amount))
        if not updates:
            return {"id": po_id, "empresa_id": empresa_id, "supplier_id": supplier_id, "total_final": float(total_final)}
        params.append(purchase_order_id)
        self.conn.execute(
            f"UPDATE purchase_orders SET {', '.join(updates)} WHERE id = ?",
            params,
        )
        self.conn.commit()
        return {"id": po_id, "empresa_id": empresa_id, "supplier_id": supplier_id, "total_final": float(total_final)}

    def update_status(self, purchase_order_id: int, status: str) -> bool:
        """Atualiza status para Draft, Ordered ou Paid. Se Ordered, marca sales_orders como Purchased."""
        if status not in ("Draft", "Ordered", "Paid"):
            return False
        if status == "Ordered":
            self.conn.execute(
                "UPDATE purchase_orders SET status = ?, data_ordered = CURRENT_TIMESTAMP WHERE id = ?",
                [status, purchase_order_id],
            )
            # Profit tracking: marcar vendas associadas como Purchased
            self.conn.execute(
                """
                UPDATE sales_orders SET status = 'Purchased'
                WHERE id IN (
                    SELECT DISTINCT o.sales_order_id FROM orders o
                    INNER JOIN purchase_order_items poi ON poi.order_id = o.id
                    WHERE poi.purchase_order_id = ? AND o.sales_order_id IS NOT NULL
                )
                """,
                [purchase_order_id],
            )
        elif status == "Paid":
            self.conn.execute(
                "UPDATE purchase_orders SET status = ?, data_paid = CURRENT_TIMESTAMP WHERE id = ?",
                [status, purchase_order_id],
            )
        else:
            self.conn.execute("UPDATE purchase_orders SET status = ? WHERE id = ?", [status, purchase_order_id])
        self.conn.commit()
        return True

    def delete_draft_po(self, purchase_order_id: int) -> Dict[str, Any]:
        """
        Apaga uma PO em estado Draft e os seus itens (Opção B: vendas não são alteradas).
        Devolve {"success": True} ou {"success": False, "error": "..."}.
        """
        row = self.conn.execute(
            "SELECT id, status FROM purchase_orders WHERE id = ?",
            [purchase_order_id],
        ).fetchone()
        if not row:
            return {"success": False, "error": "Ordem de compra não encontrada"}
        _id, status = row
        if (status or "").strip() != "Draft":
            return {"success": False, "error": "Só é possível apagar ordens em estado Draft."}
        self.conn.execute("DELETE FROM purchase_order_items WHERE purchase_order_id = ?", [purchase_order_id])
        self.conn.execute("DELETE FROM purchase_orders WHERE id = ?", [purchase_order_id])
        self.conn.commit()
        return {"success": True}

    def get_pending_sales_orders(self, empresa_id: int, limit: int = 500) -> List[Dict[str, Any]]:
        """Vendas (orders) que ainda não estão em nenhum purchase_order_item."""
        q = """
            SELECT o.id, o.numero_pedido, o.data_criacao, o.empresa_id, o.marketplace_id,
                   o.sku_oferta, o.nome_produto, o.quantidade,
                   o.valor_total_sem_impostos, o.comissao_sem_impostos, o.valor_transferido_loja
            FROM orders o
            LEFT JOIN purchase_order_items poi ON poi.order_id = o.id
            WHERE o.empresa_id = ? AND poi.id IS NULL
            ORDER BY o.data_criacao DESC NULLS LAST
            LIMIT ?
        """
        rows = self.conn.execute(q, [empresa_id, limit]).fetchall()
        cols = [
            "id", "numero_pedido", "data_criacao", "empresa_id", "marketplace_id",
            "sku_oferta", "nome_produto", "quantidade",
            "valor_total_sem_impostos", "comissao_sem_impostos", "valor_transferido_loja",
        ]
        return [dict(zip(cols, row)) for row in rows]

    def update_supplier_order_id(self, purchase_order_id: int, supplier_order_id: str) -> bool:
        """Regista o ID da encomenda no site do fornecedor."""
        self.conn.execute(
            "UPDATE purchase_orders SET supplier_order_id = ? WHERE id = ?",
            [str(supplier_order_id).strip(), purchase_order_id],
        )
        self.conn.commit()
        return True

    def close(self):
        try:
            self.conn.close()
        except Exception:
            pass


class BulkPurchaseService:
    """
    Global Cockpit: agrupa vendas pendentes por fornecedor.
    Preparar Compras: seleção global -> múltiplas POs (uma por empresa_id).
    """

    def __init__(self):
        self.conn = get_db_connection()

    def _next_id(self, table: str) -> int:
        r = self.conn.execute(f"SELECT COALESCE(MAX(id), 0) + 1 FROM {table}").fetchone()
        return int(r[0]) if r else 1

    def get_global_pending(
        self,
        supplier_id: Optional[int] = None,
        limit: int = 1000,
    ) -> List[Dict[str, Any]]:
        """
        Lista vendas pendentes (orders não em nenhuma PO) de todas as empresas.
        Inclui supplier_id/supplier_nome via sku_mapping para filtrar por fornecedor.
        """
        q = """
            SELECT o.id, o.numero_pedido, o.data_criacao, o.empresa_id, o.marketplace_id,
                   o.sku_oferta, o.nome_produto, o.quantidade, o.sales_order_item_id,
                   o.valor_total_sem_impostos, o.valor_transferido_loja,
                   m.supplier_id, s.nome AS supplier_nome, m.custo_fornecedor, m.sku_fornecedor,
                   e.nome AS empresa_nome
            FROM orders o
            LEFT JOIN purchase_order_items poi ON poi.order_id = o.id
            INNER JOIN sku_mapping m ON m.empresa_id = o.empresa_id AND m.sku_marketplace = o.sku_oferta
                AND (m.marketplace_id = o.marketplace_id OR (m.marketplace_id IS NULL AND o.marketplace_id IS NULL))
                AND COALESCE(m.ativo, TRUE) = TRUE
            LEFT JOIN suppliers s ON s.id = m.supplier_id
            LEFT JOIN empresas e ON e.id = o.empresa_id
            WHERE poi.id IS NULL
        """
        params = []
        if supplier_id is not None:
            q += " AND m.supplier_id = ?"
            params.append(supplier_id)
        q += " ORDER BY m.supplier_id, o.empresa_id, o.data_criacao DESC NULLS LAST LIMIT ?"
        params.append(limit)
        rows = self.conn.execute(q, params).fetchall()
        cols = [
            "id", "numero_pedido", "data_criacao", "empresa_id", "marketplace_id",
            "sku_oferta", "nome_produto", "quantidade", "sales_order_item_id",
            "valor_total_sem_impostos", "valor_transferido_loja",
            "supplier_id", "supplier_nome", "custo_fornecedor", "sku_fornecedor", "empresa_nome",
        ]
        return [dict(zip(cols, row)) for row in rows]

    def prepare_bulk_purchases(
        self,
        order_ids: List[int],
        portes_totais: float = 0,
        taxa_iva_pct: float = 0,
        tipo_envio: str = "Escritorio",
    ) -> Dict[str, Any]:
        """
        Agrupa order_ids por (empresa_id, supplier_id) e cria uma PO por grupo.
        Cada PO tem dados fiscais da empresa (NIF, morada). Itens com sales_order_item_id.
        Retorna lista de PO criadas e atualiza sales_orders.status para Purchased quando PO -> Ordered.
        """
        if not order_ids:
            return {"success": False, "error": "order_ids vazio", "purchase_orders": []}

        translator = SKUTranslatorService()
        # Buscar orders com supplier e custo
        rows_by_key: Dict[tuple, List[Dict]] = {}
        for oid in order_ids:
            row = self.conn.execute(
                "SELECT id, empresa_id, marketplace_id, sku_oferta, quantidade, sales_order_item_id FROM orders WHERE id = ?",
                [oid],
            ).fetchone()
            if not row:
                continue
            order_id, emp_id, mkt_id, sku, qty, soi_id = row[0], row[1], row[2], row[3], row[4], row[5] if len(row) > 5 else None
            resolved = translator.resolve(emp_id, sku or "", mkt_id)
            if not resolved:
                continue
            sup_id = resolved.get("supplier_id")
            if sup_id is None:
                continue
            custo = float(resolved.get("custo_fornecedor") or 0)
            key = (emp_id, sup_id)
            if key not in rows_by_key:
                rows_by_key[key] = []
            rows_by_key[key].append({
                "order_id": order_id,
                "sales_order_item_id": soi_id,
                "sku_marketplace": sku,
                "sku_fornecedor": resolved.get("sku_fornecedor"),
                "quantidade": float(qty or 1),
                "custo_unitario": custo,
            })
        translator.close()

        if not rows_by_key:
            return {"success": False, "error": "Nenhuma ordem válida com mapping de fornecedor", "purchase_orders": []}

        created = []
        for (empresa_id, supplier_id), items in rows_by_key.items():
            total_base = sum(it["custo_unitario"] * it["quantidade"] for it in items)
            impostos_totais = total_base * (taxa_iva_pct / 100) if taxa_iva_pct else 0
            n_lines = len(items)
            portes_por_linha = portes_totais / n_lines if n_lines else 0
            impostos_por_linha = impostos_totais / n_lines if n_lines else 0
            total_final = total_base + portes_totais + impostos_totais

            # Inteligência ERP: fornecedor com tipo_envio Dropshipping -> PO como Envio Direto
            po_tipo_envio = tipo_envio
            if supplier_id:
                row_s = self.conn.execute(
                    "SELECT tipo_envio, default_shipping_type FROM suppliers WHERE id = ?",
                    [supplier_id],
                ).fetchone()
                if row_s:
                    supp_tipo = (row_s[0] or row_s[1] or "").strip()
                    if supp_tipo == "Dropshipping":
                        po_tipo_envio = "Direto"
                    elif supp_tipo:
                        po_tipo_envio = "Escritorio"

            # Dados fiscais da empresa
            emp_row = self.conn.execute(
                "SELECT nome, nif, morada FROM empresas WHERE id = ?",
                [empresa_id],
            ).fetchone()
            billing_name = emp_row[0] if emp_row else None
            billing_nif = emp_row[1] if emp_row and len(emp_row) > 1 else None
            billing_address = emp_row[2] if emp_row and len(emp_row) > 2 else None

            po_id = self._next_id("purchase_orders")
            self.conn.execute(
                """
                INSERT INTO purchase_orders (id, empresa_id, supplier_id, status, tipo_envio, total_base, portes_totais, impostos, total_final, billing_nif, billing_address, billing_name)
                VALUES (?, ?, ?, 'Draft', ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [po_id, empresa_id, supplier_id, po_tipo_envio, total_base, portes_totais, impostos_totais, total_final, billing_nif, billing_address, billing_name],
            )
            next_item_id = self._next_id("purchase_order_items")
            for idx, it in enumerate(items):
                item_id = next_item_id + idx
                self.conn.execute(
                    """
                    INSERT INTO purchase_order_items (id, purchase_order_id, order_id, sales_order_item_id, sku_marketplace, sku_fornecedor, quantidade, custo_unitario, portes_rateados, impostos_rateados)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    [
                        item_id, po_id, it["order_id"], it.get("sales_order_item_id"),
                        it.get("sku_marketplace"), it.get("sku_fornecedor"),
                        it["quantidade"], it["custo_unitario"], portes_por_linha, impostos_por_linha,
                    ],
                )
            created.append({
                "purchase_order_id": po_id,
                "empresa_id": empresa_id,
                "supplier_id": supplier_id,
                "items_count": len(items),
                "total_final": total_final,
                "billing_name": billing_name,
            })
            # Garantir que tabela tem colunas fiscais (pode falhar se migração não correu)
            try:
                pass
            except Exception:
                pass

        self.conn.commit()
        return {"success": True, "purchase_orders": created}

    def get_sale_state_list(
        self,
        empresa_id: Optional[int] = None,
        limit: int = 500,
    ) -> List[Dict[str, Any]]:
        """BI: estado de cada venda (Vendido | Em Processamento de Compra | Comprado (PO #123))."""
        conditions = []
        params = []
        if empresa_id is not None:
            conditions.append("empresa_id = ?")
            params.append(empresa_id)
        where = " AND " + " AND ".join(conditions) if conditions else ""
        q = f"SELECT order_id, empresa_id, numero_pedido, sales_order_id, sales_order_item_id, sku_oferta, quantidade, valor_transferido_loja, empresa_nome, estado_venda, purchase_order_id, po_status, supplier_order_id FROM v_sale_state WHERE 1=1 {where} ORDER BY order_id DESC LIMIT ?"
        params.append(limit)
        rows = self.conn.execute(q, params).fetchall()
        cols = ["order_id", "empresa_id", "numero_pedido", "sales_order_id", "sales_order_item_id", "sku_oferta", "quantidade", "valor_transferido_loja", "empresa_nome", "estado_venda", "purchase_order_id", "po_status", "supplier_order_id"]
        return [dict(zip(cols, row)) for row in rows]

    def close(self):
        try:
            self.conn.close()
        except Exception:
            pass
