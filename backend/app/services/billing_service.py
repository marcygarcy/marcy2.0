"""
Gestão Comercial (Billing): Proformas e documentos de venda.
- get_proforma_data(sales_order_id): dados para renderizar proforma (empresa, ordem, linhas, IVA OSS).
- create_proforma(sales_order_id): gera número sequencial, grava billing_documents, retorna dados.
- list_documents(): lista com filtros (empresa, tipo, status).
- cancel_document(id): marca documento como anulado.
- bulk_create_proformas(sales_order_ids): cria proformas em lote (ignora se já existir).
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from app.config.database import get_db_connection


def _next_id(conn, table: str) -> int:
    r = conn.execute(f"SELECT COALESCE(MAX(id), 0) + 1 FROM {table}").fetchone()
    return int(r[0]) if r and r[0] else 1


def _get_oss_vat_rate(conn, seller_country: str, customer_country: Optional[str]) -> float:
    """
    Taxa de IVA aplicável (OSS): destino para B2C intra-UE, nacional para vendas domésticas.
    Usa tax_oss_matrix. standard_rate do país de destino quando UE e diferente do vendedor.
    """
    if not customer_country:
        customer_country = ""
    seller_country = (seller_country or "PT").strip().upper()[:2]
    customer_country = (customer_country or "").strip().upper()[:2]
    # Venda doméstica: taxa do país do vendedor
    if seller_country == customer_country:
        row = conn.execute(
            "SELECT standard_rate FROM tax_oss_matrix WHERE country_code = ?",
            [seller_country],
        ).fetchone()
        return float(row[0] or 0) if row else 0.0
    # Intra-UE (OSS): taxa do país de destino
    row = conn.execute(
        "SELECT standard_rate, is_eu FROM tax_oss_matrix WHERE country_code = ?",
        [customer_country],
    ).fetchone()
    if not row:
        return 0.0
    is_eu = bool(row[1]) if row[1] is not None else (customer_country in (
        "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU",
        "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE"
    ))
    if is_eu:
        return float(row[0] or 0)
    return 0.0


def _next_document_number(conn, empresa_id: int, doc_type: str = "Proforma", prefix: str = "PROF") -> str:
    """Obtém próximo número da série (por ano). Formato: PROF-2025-00001."""
    year = datetime.now().year
    row = conn.execute(
        """
        SELECT id, last_sequence FROM billing_series
        WHERE empresa_id = ? AND doc_type = ? AND year = ?
        """,
        [empresa_id, doc_type, year],
    ).fetchone()
    if row:
        new_seq = int(row[1] or 0) + 1
        conn.execute(
            "UPDATE billing_series SET last_sequence = ? WHERE id = ?",
            [new_seq, row[0]],
        )
        return f"{prefix}-{year}-{new_seq:05d}"
    # Criar série para o ano
    sid = _next_id(conn, "billing_series")
    conn.execute(
        """
        INSERT INTO billing_series (id, empresa_id, doc_type, prefix, year, last_sequence)
        VALUES (?, ?, ?, ?, ?, 1)
        """,
        [sid, empresa_id, doc_type, prefix, year],
    )
    return f"{prefix}-{year}-00001"


class BillingService:
    """Serviço de documentos comerciais (proformas, faturas)."""

    def __init__(self):
        self.conn = get_db_connection()

    def get_proforma_data(self, sales_order_id: int) -> Optional[Dict[str, Any]]:
        """
        Dados para renderizar uma proforma: empresa (vendedor), ordem, linhas com IVA OSS.
        Se já existir billing_document para este sales_order, inclui document_number e status.
        """
        try:
            so = self.conn.execute(
                """
                SELECT so.id, so.empresa_id, so.external_order_id, so.marketplace_id, so.order_date,
                       so.customer_country, so.currency, so.total_gross, so.total_commission_fixed,
                       so.total_commission_percent, so.total_net_value,
                       so.customer_name, so.customer_address, so.customer_nif,
                       m.nome AS marketplace_nome
                FROM sales_orders so
                LEFT JOIN marketplaces m ON m.id = so.marketplace_id
                WHERE so.id = ?
                """,
                [sales_order_id],
            ).fetchone()
            cols_so = [
                "id", "empresa_id", "external_order_id", "marketplace_id", "order_date",
                "customer_country", "currency", "total_gross", "total_commission_fixed",
                "total_commission_percent", "total_net_value",
                "customer_name", "customer_address", "customer_nif",
                "marketplace_nome",
            ]
        except Exception:
            so = self.conn.execute(
                """
                SELECT so.id, so.empresa_id, so.external_order_id, so.marketplace_id, so.order_date,
                       so.customer_country, so.currency, so.total_gross, so.total_commission_fixed,
                       so.total_commission_percent, so.total_net_value,
                       m.nome AS marketplace_nome
                FROM sales_orders so
                LEFT JOIN marketplaces m ON m.id = so.marketplace_id
                WHERE so.id = ?
                """,
                [sales_order_id],
            ).fetchone()
            cols_so = [
                "id", "empresa_id", "external_order_id", "marketplace_id", "order_date",
                "customer_country", "currency", "total_gross", "total_commission_fixed",
                "total_commission_percent", "total_net_value",
                "marketplace_nome",
            ]
        if not so:
            return None
        order_data = dict(zip(cols_so, so))
        order_data.setdefault("customer_name", None)
        order_data.setdefault("customer_address", None)
        order_data.setdefault("customer_nif", None)

        empresa_id = order_data["empresa_id"]
        emp = self.conn.execute(
            "SELECT id, nome, nif, COALESCE(morada_fiscal, morada) AS morada, pais FROM empresas WHERE id = ?",
            [empresa_id],
        ).fetchone()
        if not emp:
            company = {"nome": "Empresa", "nif": "", "morada": "", "pais": "PT"}
        else:
            company = {
                "id": emp[0],
                "nome": emp[1] or "Empresa",
                "nif": emp[2] or "",
                "morada": emp[3] or "",
                "pais": (emp[4] or "PT").strip().upper()[:2],
            }

        items = self.conn.execute(
            """
            SELECT id, sku_marketplace, internal_sku, quantity, unit_price, vat_rate, vat_type, vat_amount
            FROM sales_order_items
            WHERE sales_order_id = ?
            ORDER BY id
            """,
            [sales_order_id],
        ).fetchall()
        item_cols = ["id", "sku_marketplace", "internal_sku", "quantity", "unit_price", "vat_rate", "vat_type", "vat_amount"]
        order_data["items"] = [dict(zip(item_cols, row)) for row in items]

        # Aplicar Tax Engine (OSS): taxa do país de destino para intra-UE, nacional para doméstico
        seller_country = company.get("pais") or "PT"
        customer_country = (order_data.get("customer_country") or "").strip().upper()[:2]
        oss_rate = _get_oss_vat_rate(self.conn, seller_country, customer_country)

        for it in order_data["items"]:
            it["quantity"] = float(it["quantity"] or 0)
            it["unit_price"] = float(it["unit_price"] or 0)
            # Recalcular IVA com a taxa OSS correta (preço unit. considerado com IVA)
            it["vat_rate"] = round(oss_rate, 2)
            line_total = it["quantity"] * it["unit_price"]
            it["line_total"] = line_total
            if oss_rate > 0:
                it["line_net"] = round(line_total / (1 + oss_rate / 100), 2)
                it["vat_amount"] = round(line_total - it["line_net"], 2)
            else:
                it["line_net"] = line_total
                it["vat_amount"] = 0.0

        total_vat = sum(it["vat_amount"] for it in order_data["items"])
        total_net = sum(it["line_net"] for it in order_data["items"])
        order_data["total_vat"] = round(total_vat, 2)
        order_data["total_net"] = round(total_net, 2)
        order_data["total_gross"] = float(order_data.get("total_gross") or 0)
        if order_data["total_gross"] == 0 and order_data["items"]:
            order_data["total_gross"] = round(total_net + total_vat, 2)

        # Documento já emitido?
        doc = self.conn.execute(
            "SELECT id, document_number, status FROM billing_documents WHERE sales_order_id = ? AND doc_type = 'Proforma'",
            [sales_order_id],
        ).fetchone()
        if doc:
            order_data["billing_document_id"] = doc[0]
            order_data["document_number"] = doc[1]
            order_data["document_status"] = doc[2]
        else:
            order_data["billing_document_id"] = None
            order_data["document_number"] = None
            order_data["document_status"] = None

        return {"company": company, "order": order_data}

    def create_proforma(self, sales_order_id: int) -> Optional[Dict[str, Any]]:
        """Cria registo em billing_documents e devolve get_proforma_data (com document_number)."""
        data = self.get_proforma_data(sales_order_id)
        if not data:
            return None
        if data["order"].get("billing_document_id"):
            return data  # já existe

        empresa_id = data["order"]["empresa_id"]
        doc_number = _next_document_number(self.conn, empresa_id)
        total_gross = data["order"]["total_gross"]
        total_net = data["order"]["total_net"]
        total_vat = data["order"]["total_vat"]
        customer_country = data["order"].get("customer_country") or ""

        bid = _next_id(self.conn, "billing_documents")
        self.conn.execute(
            """
            INSERT INTO billing_documents
            (id, empresa_id, sales_order_id, doc_type, document_number, status, total_gross, total_net, total_vat, customer_country)
            VALUES (?, ?, ?, 'Proforma', ?, 'issued', ?, ?, ?, ?)
            """,
            [bid, empresa_id, sales_order_id, doc_number, total_gross, total_net, total_vat, customer_country],
        )
        data["order"]["billing_document_id"] = bid
        data["order"]["document_number"] = doc_number
        data["order"]["document_status"] = "issued"
        return data

    def create_customer_credit_note(self, sales_order_id: int) -> Optional[Dict[str, Any]]:
        """
        Emite Nota de Crédito ao cliente para uma venda (ex.: cancelamento).
        Cria billing_document com doc_type 'NotaCreditoCliente'. Retorna dados do documento.
        """
        data = self.get_proforma_data(sales_order_id)
        if not data:
            return None
        existing = self.conn.execute(
            "SELECT id, document_number FROM billing_documents WHERE sales_order_id = ? AND doc_type = 'NotaCreditoCliente'",
            [sales_order_id],
        ).fetchone()
        if existing:
            return {"billing_document_id": existing[0], "document_number": existing[1], "already_issued": True}

        empresa_id = data["order"]["empresa_id"]
        doc_number = _next_document_number(
            self.conn, empresa_id, doc_type="NotaCreditoCliente", prefix="NC"
        )
        total_gross = data["order"].get("total_gross") or 0
        total_net = data["order"].get("total_net") or 0
        total_vat = data["order"].get("total_vat") or 0
        customer_country = (data["order"].get("customer_country") or "")

        bid = _next_id(self.conn, "billing_documents")
        self.conn.execute(
            """
            INSERT INTO billing_documents
            (id, empresa_id, sales_order_id, doc_type, document_number, status, total_gross, total_net, total_vat, customer_country)
            VALUES (?, ?, ?, 'NotaCreditoCliente', ?, 'issued', ?, ?, ?, ?)
            """,
            [bid, empresa_id, sales_order_id, doc_number, total_gross, total_net, total_vat, customer_country],
        )
        self.conn.commit()
        return {"billing_document_id": bid, "document_number": doc_number, "already_issued": False}

    def list_documents(
        self,
        empresa_id: Optional[int] = None,
        doc_type: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> Tuple[List[Dict[str, Any]], int]:
        """Lista billing_documents com filtros."""
        conditions = []
        params: List[Any] = []
        if empresa_id is not None:
            conditions.append("bd.empresa_id = ?")
            params.append(empresa_id)
        if doc_type:
            conditions.append("bd.doc_type = ?")
            params.append(doc_type)
        if status:
            conditions.append("bd.status = ?")
            params.append(status)
        where = " AND " + " AND ".join(conditions) if conditions else ""

        count_sql = f"SELECT COUNT(*) FROM billing_documents bd WHERE 1=1 {where}"
        total = self.conn.execute(count_sql, params).fetchone()[0]

        q = f"""
            SELECT bd.id, bd.empresa_id, bd.sales_order_id, bd.doc_type, bd.document_number,
                   bd.status, bd.total_gross, bd.total_net, bd.total_vat, bd.customer_country,
                   bd.issued_at, bd.created_at, bd.cancelled_at,
                   so.external_order_id, so.order_date,
                   m.nome AS marketplace_nome
            FROM billing_documents bd
            LEFT JOIN sales_orders so ON so.id = bd.sales_order_id
            LEFT JOIN marketplaces m ON m.id = so.marketplace_id
            WHERE 1=1 {where}
            ORDER BY bd.issued_at DESC NULLS LAST, bd.id DESC
            LIMIT ? OFFSET ?
        """
        params.extend([limit, offset])
        rows = self.conn.execute(q, params).fetchall()
        cols = [
            "id", "empresa_id", "sales_order_id", "doc_type", "document_number",
            "status", "total_gross", "total_net", "total_vat", "customer_country",
            "issued_at", "created_at", "cancelled_at",
            "external_order_id", "order_date", "marketplace_nome",
        ]
        return [dict(zip(cols, row)) for row in rows], int(total)

    def cancel_document(self, document_id: int) -> bool:
        """Anula um documento (status=cancelled, cancelled_at=now)."""
        r = self.conn.execute(
            "UPDATE billing_documents SET status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP WHERE id = ?",
            [document_id],
        )
        return r.rowcount > 0

    def bulk_create_proformas(self, sales_order_ids: List[int]) -> Dict[str, Any]:
        """Cria proformas para uma lista de sales_order_id. Ignora os que já têm proforma."""
        created = []
        skipped = []
        errors = []
        for sid in sales_order_ids:
            if not sid:
                continue
            existing = self.conn.execute(
                "SELECT id FROM billing_documents WHERE sales_order_id = ? AND doc_type = 'Proforma'",
                [sid],
            ).fetchone()
            if existing:
                skipped.append(sid)
                continue
            data = self.create_proforma(sid)
            if data:
                created.append({"sales_order_id": sid, "document_number": data["order"]["document_number"]})
            else:
                errors.append(sid)
        return {"created": created, "skipped": skipped, "errors": errors}

    def close(self):
        try:
            self.conn.close()
        except Exception:
            pass
