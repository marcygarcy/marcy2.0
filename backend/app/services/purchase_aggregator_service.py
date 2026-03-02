"""
Fase 3: Agregação de compras a partir de pending_purchase_items (Bulk-Split fiscal).
Agrupa por (empresa_id, supplier_id) e cria uma purchase_order por grupo.
Atualiza status dos pending_purchase_items para 'ordered'.
"""
from __future__ import annotations

from typing import List, Dict, Any, Optional
from collections import defaultdict
from app.config.database import get_db_connection


def _next_id(conn, table: str) -> int:
    r = conn.execute(f"SELECT COALESCE(MAX(id), 0) + 1 FROM {table}").fetchone()
    return int(r[0]) if r and r[0] else 1


class PurchaseAggregatorService:
    """
    Recebe IDs de pending_purchase_items (várias empresas), agrupa por (empresa_id, supplier_id)
    e gera uma purchase_order por grupo com os respetivos purchase_order_items.
    """

    def __init__(self):
        self.conn = get_db_connection()

    def create_pos_from_pending(
        self,
        pending_item_ids: List[int],
        portes_totais: float = 0,
        taxa_iva_pct: float = 0,
    ) -> Dict[str, Any]:
        """
        Cria POs a partir de pending_purchase_items.
        Agrupa por (empresa_id, supplier_id). Para cada grupo: uma PO (Draft) e itens.
        Atualiza pending_purchase_items.status para 'ordered'.
        """
        if not pending_item_ids:
            return {"success": False, "error": "pending_item_ids vazio", "purchase_orders": [], "num_pos": 0}

        placeholders = ",".join("?" * len(pending_item_ids))
        rows = self.conn.execute(
            f"""
            SELECT id, empresa_id, sales_order_id, sales_order_item_id, sku_marketplace, sku_supplier,
                   supplier_id, quantity, cost_price_base, status
            FROM pending_purchase_items
            WHERE id IN ({placeholders}) AND COALESCE(status, 'pending') = 'pending'
            """,
            list(pending_item_ids),
        ).fetchall()

        if not rows:
            return {"success": False, "error": "Nenhum item pendente válido encontrado", "purchase_orders": [], "num_pos": 0}

        # Agrupar por (empresa_id, supplier_id)
        groups: Dict[tuple, List[Dict[str, Any]]] = defaultdict(list)
        for row in rows:
            pid, emp_id, so_id, soi_id, sku_mkt, sku_sup, sup_id, qty, cost, _ = row
            if sup_id is None:
                continue
            key = (emp_id, sup_id)
            groups[key].append({
                "pending_id": pid,
                "empresa_id": emp_id,
                "sales_order_id": so_id,
                "sales_order_item_id": soi_id,
                "sku_marketplace": sku_mkt,
                "sku_supplier": sku_sup,
                "supplier_id": sup_id,
                "quantity": float(qty or 1),
                "cost_price_base": float(cost or 0),
            })

        if not groups:
            return {"success": False, "error": "Nenhum item com fornecedor válido", "purchase_orders": [], "num_pos": 0}

        created = []
        all_pending_ids_updated = []

        for (empresa_id, supplier_id), items in groups.items():
            total_base = sum(it["cost_price_base"] * it["quantity"] for it in items)
            n_lines = len(items)
            impostos_totais = total_base * (taxa_iva_pct / 100) if taxa_iva_pct else 0
            portes_por_linha = portes_totais / n_lines if n_lines else 0
            impostos_por_linha = impostos_totais / n_lines if n_lines else 0
            total_final = total_base + portes_totais + impostos_totais

            # Tipo envio: verificar fornecedor
            tipo_envio = "Escritorio"
            row_s = self.conn.execute(
                "SELECT tipo_envio, default_shipping_type FROM suppliers WHERE id = ?",
                [supplier_id],
            ).fetchone()
            if row_s:
                supp_tipo = (row_s[0] or row_s[1] or "").strip()
                if supp_tipo == "Dropshipping":
                    tipo_envio = "Direto"
                elif supp_tipo:
                    tipo_envio = "Escritorio"

            # Dados fiscais da empresa
            emp_row = self.conn.execute(
                "SELECT nome, nif, morada FROM empresas WHERE id = ?",
                [empresa_id],
            ).fetchone()
            billing_name = emp_row[0] if emp_row else None
            billing_nif = emp_row[1] if emp_row and len(emp_row) > 1 else None
            billing_address = emp_row[2] if emp_row and len(emp_row) > 2 else None

            po_id = _next_id(self.conn, "purchase_orders")
            self.conn.execute(
                """
                INSERT INTO purchase_orders (
                    id, empresa_id, supplier_id, status, tipo_envio,
                    total_base, portes_totais, impostos, total_final,
                    billing_nif, billing_address, billing_name
                )
                VALUES (?, ?, ?, 'Draft', ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    po_id, empresa_id, supplier_id, tipo_envio,
                    total_base, portes_totais, impostos_totais, total_final,
                    billing_nif, billing_address, billing_name,
                ],
            )

            next_item_id = _next_id(self.conn, "purchase_order_items")
            for idx, it in enumerate(items):
                item_id = next_item_id + idx
                # order_id: 0 quando origem é pending_purchase_items (não orders)
                self.conn.execute(
                    """
                    INSERT INTO purchase_order_items (
                        id, purchase_order_id, order_id, sales_order_item_id,
                        sku_marketplace, sku_fornecedor, quantidade, custo_unitario,
                        portes_rateados, impostos_rateados
                    )
                    VALUES (?, ?, 0, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    [
                        item_id, po_id, it["sales_order_item_id"],
                        it.get("sku_marketplace"), it.get("sku_supplier"),
                        it["quantity"], it["cost_price_base"],
                        portes_por_linha, impostos_por_linha,
                    ],
                )
                all_pending_ids_updated.append(it["pending_id"])

            created.append({
                "purchase_order_id": po_id,
                "empresa_id": empresa_id,
                "supplier_id": supplier_id,
                "items_count": len(items),
                "total_base": total_base,
                "total_final": total_final,
                "billing_name": billing_name,
            })

        # Marcar pending_purchase_items como 'ordered'
        for pid in all_pending_ids_updated:
            self.conn.execute(
                "UPDATE pending_purchase_items SET status = 'ordered' WHERE id = ?",
                [pid],
            )

        self.conn.commit()
        return {
            "success": True,
            "purchase_orders": created,
            "num_pos": len(created),
            "num_items_processed": len(all_pending_ids_updated),
        }

    def list_pending_for_cockpit(
        self,
        supplier_id: Optional[int] = None,
        limit: int = 2000,
    ) -> List[Dict[str, Any]]:
        """
        Lista pending_purchase_items (status = 'pending') com mapping OK.
        Todas as empresas, agrupáveis por fornecedor no frontend.
        """
        conditions = " AND p.status = 'pending' AND p.supplier_id IS NOT NULL"
        params: List[Any] = []
        if supplier_id is not None:
            conditions += " AND p.supplier_id = ?"
            params.append(supplier_id)
        params.append(limit)
        q = f"""
            SELECT p.id, p.empresa_id, p.sales_order_id, p.sales_order_item_id,
                   p.sku_marketplace, p.sku_supplier, p.supplier_id, p.quantity,
                   p.cost_price_base, p.expected_profit, p.data_criacao,
                   s.nome AS supplier_nome, e.nome AS empresa_nome
            FROM pending_purchase_items p
            LEFT JOIN suppliers s ON s.id = p.supplier_id
            LEFT JOIN empresas e ON e.id = p.empresa_id
            WHERE 1=1 {conditions}
            ORDER BY p.supplier_id, p.empresa_id, p.data_criacao DESC NULLS LAST
            LIMIT ?
        """
        rows = self.conn.execute(q, params).fetchall()
        cols = [
            "id", "empresa_id", "sales_order_id", "sales_order_item_id",
            "sku_marketplace", "sku_supplier", "supplier_id", "quantity",
            "cost_price_base", "expected_profit", "data_criacao",
            "supplier_nome", "empresa_nome",
        ]
        return [dict(zip(cols, row)) for row in rows]

    def list_drafts(
        self,
        empresa_id: Optional[int] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[List[Dict[str, Any]], int]:
        """Lista purchase_orders em estado Draft (para Wizard de Checkout)."""
        conditions = " WHERE po.status = 'Draft'"
        params: List[Any] = []
        if empresa_id is not None:
            conditions += " AND po.empresa_id = ?"
            params.append(empresa_id)
        count_q = f"SELECT COUNT(*) FROM purchase_orders po {conditions}"
        total = self.conn.execute(count_q, params).fetchone()[0]
        params.extend([limit, offset])
        q = f"""
            SELECT po.id, po.empresa_id, po.supplier_id, po.status, po.tipo_envio,
                   po.total_base, po.portes_totais, po.impostos, po.total_final,
                   po.billing_nif, po.billing_address, po.billing_name, po.supplier_order_id,
                   po.data_criacao, s.nome AS supplier_nome, e.nome AS empresa_nome
            FROM purchase_orders po
            LEFT JOIN suppliers s ON s.id = po.supplier_id
            LEFT JOIN empresas e ON e.id = po.empresa_id
            {conditions}
            ORDER BY po.data_criacao DESC NULLS LAST
            LIMIT ? OFFSET ?
        """
        rows = self.conn.execute(q, params).fetchall()
        cols = [
            "id", "empresa_id", "supplier_id", "status", "tipo_envio",
            "total_base", "portes_totais", "impostos", "total_final",
            "billing_nif", "billing_address", "billing_name", "supplier_order_id",
            "data_criacao", "supplier_nome", "empresa_nome",
        ]
        return [dict(zip(cols, row)) for row in rows], int(total)

    def close(self):
        try:
            if self.conn:
                self.conn.close()
        except Exception:
            pass
