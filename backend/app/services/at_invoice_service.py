"""Orquestrador AT-compliant de faturação portuguesa.

Fluxo de emissão:
1. Obter/criar série activa
2. Calcular totais + breakdown IVA
3. Gerar número sequencial
4. Obter hash_anterior da série
5. Computar hash RSA (ATSignerService)
6. Gerar ATCUD
7. Montar string QR + gerar imagem
8. Inserir at_invoice_documents
9. Actualizar ultimo_hash na série
10. Gerar PDF e guardar em data/invoices/
11. Retornar documento completo
"""
from __future__ import annotations

import json
import os
from datetime import date, datetime
from pathlib import Path
from typing import List, Optional

from app.config.database import get_db_connection, DB_PATH
from app.services.at_signer_service import ATSignerService
from app.services.at_qrcode_service import ATQRCodeService
from app.services.at_pdf_service import ATPDFService

PDF_DIR = DB_PATH.parent / "invoices"

TIPOS_DOC = {
    "FT": "Fatura",
    "FS": "Fatura Simplificada",
    "NC": "Nota de Crédito",
    "ND": "Nota de Débito",
    "RC": "Recibo",
}


class ATInvoiceService:
    """Emissão, cancelamento e consulta de documentos AT-compliant."""

    def __init__(self):
        self._signer = ATSignerService()
        self._qrcode = ATQRCodeService()
        self._pdf = ATPDFService()

    # ── Séries ──────────────────────────────────────────────────────────────

    def ensure_series(self, empresa_id: int, tipo_doc: str, ano: int) -> dict:
        """Cria série se não existir. Prefixo padrão: {tipo_doc}{ano}A."""
        prefix = f"{tipo_doc}{str(ano)[-2:]}A"
        conn = get_db_connection()
        try:
            row = conn.execute(
                "SELECT id FROM billing_series WHERE empresa_id = ? AND doc_type = ? AND year = ?",
                [empresa_id, tipo_doc, ano],
            ).fetchone()
            if not row:
                max_id = conn.execute("SELECT COALESCE(MAX(id), 0) FROM billing_series").fetchone()[0]
                conn.execute(
                    """INSERT INTO billing_series
                       (id, empresa_id, doc_type, prefix, year, last_sequence,
                        codigo_validacao_at, ano_exercicio, ultimo_hash, tipo_doc, ativo)
                       VALUES (?, ?, ?, ?, ?, 0, '0', ?, NULL, ?, TRUE)""",
                    [max_id + 1, empresa_id, tipo_doc, prefix, ano, ano, tipo_doc],
                )
                conn.commit()
                serie_id = max_id + 1
            else:
                serie_id = row[0]

            serie = conn.execute("SELECT * FROM billing_series WHERE id = ?", [serie_id]).fetchone()
            cols = [d[0] for d in conn.execute("DESCRIBE billing_series").fetchall()]
            return dict(zip(cols, serie))
        finally:
            conn.close()

    def get_series_list(self, empresa_id: int) -> List[dict]:
        """Séries activas com estatísticas."""
        conn = get_db_connection()
        try:
            rows = conn.execute(
                """SELECT bs.*,
                   (SELECT COUNT(*) FROM at_invoice_documents d WHERE d.serie_id = bs.id) AS total_docs,
                   (SELECT MAX(d.numero_sequencial) FROM at_invoice_documents d WHERE d.serie_id = bs.id) AS ultimo_seq
                   FROM billing_series bs
                   WHERE bs.empresa_id = ?
                   ORDER BY bs.year DESC, bs.doc_type""",
                [empresa_id],
            ).fetchall()
            cols = [d[0] for d in conn.execute("DESCRIBE billing_series").fetchall()]
            result = []
            for row in rows:
                d = dict(zip(cols, row[:len(cols)]))
                d["total_docs"] = row[-2] or 0
                d["ultimo_seq"] = row[-1] or 0
                d["proximo_numero"] = d["ultimo_seq"] + 1
                result.append(d)
            return result
        finally:
            conn.close()

    def update_atcud_code(self, serie_id: int, codigo_validacao: str) -> dict:
        """Actualiza código de validação AT recebido após registo da série."""
        conn = get_db_connection()
        try:
            conn.execute(
                "UPDATE billing_series SET codigo_validacao_at = ? WHERE id = ?",
                [codigo_validacao, serie_id],
            )
            conn.commit()
            row = conn.execute("SELECT * FROM billing_series WHERE id = ?", [serie_id]).fetchone()
            cols = [d[0] for d in conn.execute("DESCRIBE billing_series").fetchall()]
            return dict(zip(cols, row))
        finally:
            conn.close()

    # ── Emissão ──────────────────────────────────────────────────────────────

    def emit_document(
        self,
        empresa_id: int,
        tipo_doc: str,
        cliente: dict,
        linhas: List[dict],
        referencia_doc: Optional[str] = None,
        metodo_pagamento: Optional[str] = None,
        notas: Optional[str] = None,
    ) -> dict:
        """
        Emite documento AT-compliant. Retorna dict completo do documento.
        cliente: {nome, nif, pais, morada}
        linhas: [{descricao, quantidade, preco_unitario, taxa_iva}]
        """
        if tipo_doc not in TIPOS_DOC:
            raise ValueError(f"Tipo de documento inválido: {tipo_doc}. Use: {list(TIPOS_DOC.keys())}")

        ano = datetime.now().year
        serie = self.ensure_series(empresa_id, tipo_doc, ano)
        serie_id = serie["id"]

        # ── Totais ────────────────────────────────────────────────────────
        vat_groups: dict[float, dict] = {}
        total_bruto = 0.0

        for linha in linhas:
            qty = float(linha.get("quantidade", 1))
            preco = float(linha.get("preco_unitario", 0))
            taxa = float(linha.get("taxa_iva", 23))
            base = round(qty * preco, 6)
            iva = round(base * taxa / 100, 6)
            total_bruto += base
            if taxa not in vat_groups:
                vat_groups[taxa] = {"taxa": taxa, "base": 0.0, "valor": 0.0}
            vat_groups[taxa]["base"] += base
            vat_groups[taxa]["valor"] += iva

        # Arredondar
        vat_breakdown = []
        total_iva = 0.0
        for grp in vat_groups.values():
            grp["base"] = round(grp["base"], 2)
            grp["valor"] = round(grp["valor"], 2)
            total_iva += grp["valor"]
            vat_breakdown.append(grp)

        total_bruto = round(total_bruto, 2)
        total_iva = round(total_iva, 2)
        total_liquido = round(total_bruto + total_iva, 2)

        # ── Número sequencial ─────────────────────────────────────────────
        conn = get_db_connection()
        try:
            # Incrementar last_sequence atomicamente
            conn.execute(
                "UPDATE billing_series SET last_sequence = last_sequence + 1 WHERE id = ?",
                [serie_id],
            )
            conn.commit()
            seq = conn.execute(
                "SELECT last_sequence FROM billing_series WHERE id = ?", [serie_id]
            ).fetchone()[0]
        finally:
            conn.close()

        prefix = serie.get("prefix", f"{tipo_doc}{str(ano)[-2:]}A")
        numero_documento = f"{prefix}/{seq}"
        data_emissao = date.today()
        data_str = data_emissao.strftime("%Y%m%d")

        # ── Hash RSA ──────────────────────────────────────────────────────
        hash_anterior = self._signer.get_series_last_hash(serie_id)

        if self._signer.has_keypair(empresa_id):
            hash_b64 = self._signer.compute_hash(
                data_doc=data_str,
                total_bruto=total_bruto,
                total_iva=total_iva,
                total_liquido=total_liquido,
                hash_anterior=hash_anterior,
                empresa_id=empresa_id,
            )
        else:
            # Sem chave RSA — hash placeholder (documento não é válido AT sem chave)
            hash_b64 = "SEMPARHASH"

        hash_4chars = self._signer.get_hash_4chars(hash_b64)

        # ── ATCUD ─────────────────────────────────────────────────────────
        codigo_validacao = serie.get("codigo_validacao_at") or "0"
        atcud = self._signer.generate_atcud(codigo_validacao, seq)

        # ── QR Code ───────────────────────────────────────────────────────
        empresa_data = self._get_empresa_data(empresa_id)
        nif_emitente = empresa_data.get("nif", "999999999")

        qr_string = self._qrcode.build_qr_string(
            nif_emitente=nif_emitente,
            nif_adquirente=cliente.get("nif"),
            pais_adquirente=cliente.get("pais", "PT"),
            tipo_doc=tipo_doc,
            estado_doc="N",
            data_doc=data_str,
            numero_doc=numero_documento,
            atcud=atcud,
            vat_breakdown=vat_breakdown,
            total_iva=total_iva,
            total_doc=total_liquido,
            hash_4chars=hash_4chars,
        )

        # ── Inserir na DB ─────────────────────────────────────────────────
        conn = get_db_connection()
        try:
            max_id = conn.execute("SELECT COALESCE(MAX(id), 0) FROM at_invoice_documents").fetchone()[0]
            doc_id = max_id + 1

            conn.execute(
                """INSERT INTO at_invoice_documents (
                    id, empresa_id, tipo_doc, serie_id, numero_sequencial, numero_documento,
                    status, data_emissao, customer_name, customer_nif, customer_country,
                    customer_address, linhas, vat_breakdown, total_bruto, total_iva, total_liquido,
                    hash_documento, hash_anterior, hash_4chars, atcud, qrcode_data,
                    num_certificacao, payment_terms, reference_doc, notes
                ) VALUES (?, ?, ?, ?, ?, ?, 'emitido', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '0/AT', ?, ?, ?)""",
                [
                    doc_id, empresa_id, tipo_doc, serie_id, seq, numero_documento,
                    data_emissao.isoformat(),
                    cliente.get("nome"), cliente.get("nif"), cliente.get("pais", "PT"),
                    cliente.get("morada"),
                    json.dumps(linhas, ensure_ascii=False),
                    json.dumps(vat_breakdown, ensure_ascii=False),
                    total_bruto, total_iva, total_liquido,
                    hash_b64, hash_anterior, hash_4chars, atcud, qr_string,
                    metodo_pagamento, referencia_doc, notas,
                ],
            )
            conn.commit()
        finally:
            conn.close()

        # ── Actualizar hash da série ──────────────────────────────────────
        self._signer.update_series_hash(serie_id, hash_b64)

        # ── Gerar PDF ─────────────────────────────────────────────────────
        doc_dict = self.get_document_detail(doc_id)
        pdf_path = self._generate_and_save_pdf(doc_dict, empresa_data)

        # Guardar caminho PDF
        if pdf_path:
            conn = get_db_connection()
            try:
                conn.execute(
                    "UPDATE at_invoice_documents SET pdf_path = ? WHERE id = ?",
                    [pdf_path, doc_id],
                )
                conn.commit()
            finally:
                conn.close()
            doc_dict["pdf_path"] = pdf_path

        return doc_dict

    # ── Cancelamento ────────────────────────────────────────────────────────

    def cancel_document(self, doc_id: int, motivo: str) -> dict:
        """Cancela documento. Regra AT: não se apaga, muda status para 'anulado'."""
        conn = get_db_connection()
        try:
            row = conn.execute(
                "SELECT status FROM at_invoice_documents WHERE id = ?", [doc_id]
            ).fetchone()
            if not row:
                raise ValueError(f"Documento {doc_id} não encontrado.")
            if row[0] == "anulado":
                raise ValueError(f"Documento {doc_id} já está anulado.")

            conn.execute(
                """UPDATE at_invoice_documents
                   SET status = 'anulado', motivo_anulacao = ?, anulado_em = CURRENT_TIMESTAMP
                   WHERE id = ?""",
                [motivo, doc_id],
            )
            conn.commit()
        finally:
            conn.close()

        return self.get_document_detail(doc_id)

    # ── Consultas ───────────────────────────────────────────────────────────

    def get_document_detail(self, doc_id: int) -> dict:
        """Detalhe completo incluindo QR base64 para preview."""
        conn = get_db_connection()
        try:
            row = conn.execute(
                "SELECT * FROM at_invoice_documents WHERE id = ?", [doc_id]
            ).fetchone()
            if not row:
                raise ValueError(f"Documento {doc_id} não encontrado.")
            cols = [d[0] for d in conn.execute("DESCRIBE at_invoice_documents").fetchall()]
            doc = dict(zip(cols, row))
        finally:
            conn.close()

        # Parsed fields
        for field in ("linhas", "vat_breakdown"):
            if doc.get(field) and isinstance(doc[field], str):
                try:
                    doc[field] = json.loads(doc[field])
                except Exception:
                    doc[field] = []

        # QR base64 para preview
        if doc.get("qrcode_data"):
            try:
                doc["qrcode_b64"] = self._qrcode.get_qr_base64(doc["qrcode_data"])
            except Exception:
                doc["qrcode_b64"] = None

        return doc

    def list_documents(
        self,
        empresa_id: int,
        tipo_doc: Optional[str] = None,
        data_inicio: Optional[str] = None,
        data_fim: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> dict:
        """Listagem paginada com filtros."""
        where = ["empresa_id = ?"]
        params: list = [empresa_id]

        if tipo_doc:
            where.append("tipo_doc = ?")
            params.append(tipo_doc)
        if data_inicio:
            where.append("data_emissao >= ?")
            params.append(data_inicio)
        if data_fim:
            where.append("data_emissao <= ?")
            params.append(data_fim)
        if status:
            where.append("status = ?")
            params.append(status)

        where_clause = " AND ".join(where)

        conn = get_db_connection()
        try:
            total = conn.execute(
                f"SELECT COUNT(*) FROM at_invoice_documents WHERE {where_clause}", params
            ).fetchone()[0]

            rows = conn.execute(
                f"""SELECT id, empresa_id, tipo_doc, numero_documento, status,
                           data_emissao, customer_name, customer_nif,
                           total_bruto, total_iva, total_liquido,
                           atcud, hash_4chars, pdf_path, created_at
                    FROM at_invoice_documents
                    WHERE {where_clause}
                    ORDER BY data_emissao DESC, id DESC
                    LIMIT ? OFFSET ?""",
                params + [limit, offset],
            ).fetchall()

            cols = ["id", "empresa_id", "tipo_doc", "numero_documento", "status",
                    "data_emissao", "customer_name", "customer_nif",
                    "total_bruto", "total_iva", "total_liquido",
                    "atcud", "hash_4chars", "pdf_path", "created_at"]

            items = [dict(zip(cols, row)) for row in rows]
        finally:
            conn.close()

        return {"total": total, "limit": limit, "offset": offset, "items": items}

    # ── PDF ─────────────────────────────────────────────────────────────────

    def get_pdf_bytes(self, doc_id: int) -> bytes:
        """Carrega PDF do disco ou regenera se necessário."""
        doc = self.get_document_detail(doc_id)
        pdf_path = doc.get("pdf_path")

        if pdf_path and os.path.exists(pdf_path):
            with open(pdf_path, "rb") as f:
                return f.read()

        # Regenerar
        empresa_data = self._get_empresa_data(doc["empresa_id"])
        return self._pdf.generate_invoice_pdf(
            doc_data=doc,
            company_data=empresa_data,
            qr_image_bytes=self._get_qr_bytes(doc),
        )

    # ── RSA ─────────────────────────────────────────────────────────────────

    def generate_rsa_keys(self, empresa_id: int) -> dict:
        return self._signer.generate_rsa_keypair(empresa_id)

    def get_public_key(self, empresa_id: int) -> str:
        return self._signer.get_public_key_pem(empresa_id)

    def has_rsa_keys(self, empresa_id: int) -> bool:
        return self._signer.has_keypair(empresa_id)

    # ── Helpers ─────────────────────────────────────────────────────────────

    def _get_empresa_data(self, empresa_id: int) -> dict:
        conn = get_db_connection()
        try:
            row = conn.execute("SELECT * FROM empresas WHERE id = ?", [empresa_id]).fetchone()
            if not row:
                return {"id": empresa_id, "nome": "Empresa", "nif": "999999999"}
            cols = [d[0] for d in conn.execute("DESCRIBE empresas").fetchall()]
            return dict(zip(cols, row))
        finally:
            conn.close()

    def _get_qr_bytes(self, doc: dict) -> Optional[bytes]:
        if doc.get("qrcode_data"):
            try:
                return self._qrcode.generate_qr_image_bytes(doc["qrcode_data"])
            except Exception:
                return None
        return None

    def _generate_and_save_pdf(self, doc: dict, empresa_data: dict) -> Optional[str]:
        """Gera PDF e guarda em data/invoices/. Retorna caminho relativo."""
        try:
            PDF_DIR.mkdir(parents=True, exist_ok=True)
            qr_bytes = self._get_qr_bytes(doc)
            pdf_bytes = self._pdf.generate_invoice_pdf(
                doc_data=doc,
                company_data=empresa_data,
                qr_image_bytes=qr_bytes,
            )
            filename = f"{doc['numero_documento'].replace('/', '_')}.pdf"
            filepath = PDF_DIR / filename
            with open(filepath, "wb") as f:
                f.write(pdf_bytes)
            return str(filepath)
        except Exception as e:
            print(f"Aviso ao gerar PDF: {e}")
            return None
