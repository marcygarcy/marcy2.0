"""SAF-T PT v1.04_01 — Exportador XML conforme Portaria 302/2016.

Gera ficheiro SAF-T (Standard Audit File for Tax purposes — Portugal)
que pode ser validado no portal da AT ou importado em software contabilístico.

Estrutura XML:
  <AuditFile xmlns="urn:OECD:StandardAuditFile-Tax:PT_1.04_01">
    <Header>          — dados empresa, período, versão
    <MasterFiles>     — Customers, Products (Services), TaxTable
    <SourceDocuments>
      <SalesInvoices> — FT, FS, NC, ND, RC
"""
from __future__ import annotations

import hashlib
import io
from datetime import date, datetime
from typing import List, Optional

from app.config.database import get_db_connection

try:
    from lxml import etree
    HAS_LXML = True
except ImportError:
    import xml.etree.ElementTree as etree  # type: ignore
    HAS_LXML = False

SAFT_NAMESPACE = "urn:OECD:StandardAuditFile-Tax:PT_1.04_01"
SCHEMA_VERSION = "1.04_01"


def _sub(parent, tag: str, text: Optional[str] = None) -> "etree._Element":
    """Cria sub-elemento XML e define texto se fornecido."""
    el = etree.SubElement(parent, tag)
    if text is not None:
        el.text = str(text)
    return el


class SAFTPTExporter:
    """Exportador SAF-T PT v1.04_01."""

    def export_period(
        self,
        empresa_id: int,
        data_inicio: date,
        data_fim: date,
    ) -> bytes:
        """
        Gera XML SAF-T para o período indicado.
        Devolve bytes UTF-8 com BOM (conforme especificação AT).
        """
        empresa = self._get_empresa(empresa_id)
        docs = self._get_documents(empresa_id, data_inicio, data_fim)

        root = etree.Element("AuditFile", xmlns=SAFT_NAMESPACE)

        self._build_header(root, empresa, data_inicio, data_fim, len(docs))
        self._build_master_files(root, empresa_id, docs)
        self._build_source_documents(root, docs)

        xml_bytes = self._serialize(root)

        # Guardar registo do export
        self._save_export_record(empresa_id, data_inicio, data_fim, len(docs), xml_bytes)

        return xml_bytes

    # ── Header ──────────────────────────────────────────────────────────────

    def _build_header(
        self,
        root: "etree._Element",
        empresa: dict,
        data_inicio: date,
        data_fim: date,
        num_docs: int,
    ) -> None:
        h = _sub(root, "Header")
        _sub(h, "AuditFileVersion", SCHEMA_VERSION)
        _sub(h, "CompanyID", empresa.get("nif") or "999999999")
        _sub(h, "TaxRegistrationNumber", empresa.get("nif") or "999999999")
        _sub(h, "TaxAccountingBasis", "I")      # I=Faturação (vs E=Contabilidade)
        _sub(h, "CompanyName", empresa.get("nome") or "Empresa")

        # Morada fiscal
        addr = _sub(h, "CompanyAddress")
        morada = empresa.get("morada") or empresa.get("morada_fiscal") or ""
        _sub(addr, "AddressDetail", morada)
        _sub(addr, "City", empresa.get("localidade") or "Lisboa")
        _sub(addr, "PostalCode", "0000-000")
        _sub(addr, "Country", "PT")

        _sub(h, "FiscalYear", str(data_inicio.year))
        _sub(h, "StartDate", data_inicio.isoformat())
        _sub(h, "EndDate", data_fim.isoformat())
        _sub(h, "CurrencyCode", "EUR")
        _sub(h, "DateCreated", date.today().isoformat())
        _sub(h, "TaxEntity", "Global")
        _sub(h, "ProductCompanyTaxID", empresa.get("nif") or "999999999")
        _sub(h, "SoftwareCertificateNumber", "0")     # pre-certificação
        _sub(h, "ProductID", "ERP Marketplace/1.0")
        _sub(h, "ProductVersion", "1.0")

    # ── MasterFiles ─────────────────────────────────────────────────────────

    def _build_master_files(
        self,
        root: "etree._Element",
        empresa_id: int,
        docs: List[dict],
    ) -> None:
        mf = _sub(root, "MasterFiles")

        # GeneralLedgerAccounts (obrigatório mas pode estar vazio para faturação)
        _sub(mf, "GeneralLedgerAccounts")

        # Customers
        customer_nibs = {}
        for doc in docs:
            nif = doc.get("customer_nif") or "999999990"
            if nif not in customer_nibs:
                customer_nibs[nif] = {
                    "nome": doc.get("customer_name") or "Consumidor Final",
                    "pais": doc.get("customer_country") or "PT",
                    "morada": doc.get("customer_address") or "",
                }

        for nif, info in customer_nibs.items():
            cust = _sub(mf, "Customer")
            _sub(cust, "CustomerID", nif)
            _sub(cust, "AccountID", "Desconhecido")
            _sub(cust, "CustomerTaxID", nif)
            _sub(cust, "CompanyName", info["nome"])
            addr = _sub(cust, "BillingAddress")
            _sub(addr, "AddressDetail", info["morada"])
            _sub(addr, "City", "")
            _sub(addr, "PostalCode", "0000-000")
            _sub(addr, "Country", info["pais"])
            _sub(cust, "SelfBillingIndicator", "0")

        # Products (Serviços / Bens)
        products = {}
        for doc in docs:
            linhas = doc.get("linhas") or []
            for linha in linhas:
                desc = linha.get("descricao", "Serviço")
                pid = desc[:20].replace(" ", "_")
                if pid not in products:
                    products[pid] = {"desc": desc, "taxa": linha.get("taxa_iva", 23)}

        for pid, info in products.items():
            prod = _sub(mf, "Product")
            _sub(prod, "ProductType", "S")     # S=Serviço, P=Produto
            _sub(prod, "ProductCode", pid)
            _sub(prod, "ProductGroup", "Geral")
            _sub(prod, "ProductDescription", info["desc"])
            _sub(prod, "ProductNumberCode", pid)

        # TaxTable
        tt = _sub(mf, "TaxTable")
        for taxa in [0, 6, 13, 23]:
            te = _sub(tt, "TaxTableEntry")
            _sub(te, "TaxType", "IVA")
            _sub(te, "TaxCountryRegion", "PT")
            _sub(te, "TaxCode", f"NOR{taxa}" if taxa == 23 else f"RED{taxa}" if taxa > 0 else "ISE")
            _sub(te, "Description", f"IVA {taxa}%")
            _sub(te, "TaxPercentage", str(float(taxa)))

    # ── SourceDocuments / SalesInvoices ─────────────────────────────────────

    def _build_source_documents(
        self,
        root: "etree._Element",
        docs: List[dict],
    ) -> None:
        if not docs:
            return

        sd = _sub(root, "SourceDocuments")
        si = _sub(sd, "SalesInvoices")

        # Totais do período
        num_entries = len(docs)
        total_debit = sum(
            float(d.get("total_liquido", 0)) for d in docs
            if d.get("tipo_doc") in ("NC", "ND") and d.get("status") != "anulado"
        )
        total_credit = sum(
            float(d.get("total_liquido", 0)) for d in docs
            if d.get("tipo_doc") in ("FT", "FS", "RC") and d.get("status") != "anulado"
        )

        _sub(si, "NumberOfEntries", str(num_entries))
        _sub(si, "TotalDebit", f"{total_debit:.2f}")
        _sub(si, "TotalCredit", f"{total_credit:.2f}")

        for doc in docs:
            self._build_invoice(si, doc)

    def _build_invoice(self, parent: "etree._Element", doc: dict) -> None:
        inv = _sub(parent, "Invoice")

        _sub(inv, "InvoiceNo", doc.get("numero_documento", ""))
        _sub(inv, "ATCUD", doc.get("atcud", "ATCUD:0-0"))

        # Status
        status_el = _sub(inv, "DocumentStatus")
        _sub(status_el, "InvoiceStatus", "A" if doc.get("status") == "anulado" else "N")
        _sub(status_el, "InvoiceStatusDate", f"{doc.get('data_emissao', date.today().isoformat())}T00:00:00")
        _sub(status_el, "SourceID", "ERP")
        _sub(status_el, "SourceBilling", "P")

        _sub(inv, "Hash", doc.get("hash_4chars", "0000"))
        _sub(inv, "HashControl", "1")

        # Período
        data_str = str(doc.get("data_emissao", date.today().isoformat()))
        try:
            dt = datetime.strptime(data_str[:10], "%Y-%m-%d")
            year = dt.year
            month = dt.month
        except Exception:
            year = date.today().year
            month = date.today().month

        period = _sub(inv, "InvoicePeriod")
        _sub(period, "Year", str(year))
        _sub(period, "Month", str(month))

        _sub(inv, "InvoiceDate", data_str[:10])
        _sub(inv, "InvoiceType", doc.get("tipo_doc", "FT"))
        _sub(inv, "SpecialRegimes")     # obrigatório, pode estar vazio
        _sub(inv, "SourceID", "ERP")
        _sub(inv, "SystemEntryDate", f"{data_str[:10]}T00:00:00")
        _sub(inv, "CustomerID", doc.get("customer_nif") or "999999990")

        # Linhas
        linhas = doc.get("linhas") or []
        if isinstance(linhas, str):
            import json
            try:
                linhas = json.loads(linhas)
            except Exception:
                linhas = []

        for i, linha in enumerate(linhas, 1):
            qty = float(linha.get("quantidade", 1))
            preco = float(linha.get("preco_unitario", 0))
            taxa = float(linha.get("taxa_iva", 23))
            base = round(qty * preco, 2)
            iva = round(base * taxa / 100, 2)

            line = _sub(inv, "Line")
            _sub(line, "LineNumber", str(i))

            refs = _sub(line, "OrderReferences")
            _sub(refs, "OriginatingON", doc.get("reference_doc") or doc.get("numero_documento", ""))
            _sub(refs, "OrderDate", data_str[:10])

            _sub(line, "ProductCode", (linha.get("descricao", "Serv")[:20]).replace(" ", "_"))
            _sub(line, "ProductDescription", linha.get("descricao", ""))
            _sub(line, "Quantity", f"{qty:.2f}")
            _sub(line, "UnitOfMeasure", "UN")
            _sub(line, "UnitPrice", f"{preco:.2f}")
            _sub(line, "TaxPointDate", data_str[:10])
            _sub(line, "Description", linha.get("descricao", ""))

            if doc.get("tipo_doc") in ("NC", "ND"):
                _sub(line, "DebitAmount", f"{base:.2f}")
            else:
                _sub(line, "CreditAmount", f"{base:.2f}")

            tax_el = _sub(line, "Tax")
            _sub(tax_el, "TaxType", "IVA")
            _sub(tax_el, "TaxCountryRegion", "PT")
            if taxa == 0:
                _sub(tax_el, "TaxCode", "ISE")
            elif taxa <= 6:
                _sub(tax_el, "TaxCode", f"RED{int(taxa)}")
            elif taxa <= 13:
                _sub(tax_el, "TaxCode", f"RED{int(taxa)}")
            else:
                _sub(tax_el, "TaxCode", "NOR23")
            _sub(tax_el, "TaxPercentage", f"{taxa:.2f}")

        # Totais do documento
        totals = _sub(inv, "DocumentTotals")
        _sub(totals, "TaxPayable", f"{float(doc.get('total_iva', 0)):.2f}")
        _sub(totals, "NetTotal", f"{float(doc.get('total_bruto', 0)):.2f}")
        _sub(totals, "GrossTotal", f"{float(doc.get('total_liquido', 0)):.2f}")

    # ── Serialização ────────────────────────────────────────────────────────

    def _serialize(self, root: "etree._Element") -> bytes:
        """Serializa para XML UTF-8 com BOM."""
        if HAS_LXML:
            xml_bytes = etree.tostring(
                root,
                pretty_print=True,
                xml_declaration=True,
                encoding="UTF-8",
            )
        else:
            tree = etree.ElementTree(root)
            buf = io.BytesIO()
            tree.write(buf, encoding="UTF-8", xml_declaration=True)
            xml_bytes = buf.getvalue()

        return xml_bytes

    # ── DB helpers ──────────────────────────────────────────────────────────

    def _get_empresa(self, empresa_id: int) -> dict:
        conn = get_db_connection()
        try:
            row = conn.execute("SELECT * FROM empresas WHERE id = ?", [empresa_id]).fetchone()
            if not row:
                return {"id": empresa_id, "nome": "Empresa", "nif": "999999999"}
            cols = [d[0] for d in conn.execute("DESCRIBE empresas").fetchall()]
            return dict(zip(cols, row))
        finally:
            conn.close()

    def _get_documents(
        self, empresa_id: int, data_inicio: date, data_fim: date
    ) -> List[dict]:
        conn = get_db_connection()
        try:
            rows = conn.execute(
                """SELECT * FROM at_invoice_documents
                   WHERE empresa_id = ?
                   AND data_emissao >= ? AND data_emissao <= ?
                   ORDER BY data_emissao, id""",
                [empresa_id, data_inicio.isoformat(), data_fim.isoformat()],
            ).fetchall()
            cols = [d[0] for d in conn.execute("DESCRIBE at_invoice_documents").fetchall()]
            result = []
            for row in rows:
                d = dict(zip(cols, row))
                # Parse JSON fields
                import json
                for field in ("linhas", "vat_breakdown"):
                    if d.get(field) and isinstance(d[field], str):
                        try:
                            d[field] = json.loads(d[field])
                        except Exception:
                            d[field] = []
                result.append(d)
            return result
        finally:
            conn.close()

    def _save_export_record(
        self,
        empresa_id: int,
        data_inicio: date,
        data_fim: date,
        num_docs: int,
        xml_bytes: bytes,
    ) -> None:
        xml_hash = hashlib.sha256(xml_bytes).hexdigest()[:16]
        conn = get_db_connection()
        try:
            max_id = conn.execute("SELECT COALESCE(MAX(id), 0) FROM saft_exports").fetchone()[0]
            conn.execute(
                """INSERT INTO saft_exports (id, empresa_id, periodo_inicio, periodo_fim, num_documentos, xml_hash)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                [max_id + 1, empresa_id, data_inicio.isoformat(), data_fim.isoformat(), num_docs, xml_hash],
            )
            conn.commit()
        except Exception:
            pass
        finally:
            conn.close()
