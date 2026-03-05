"""Serviço de geração de PDF AT-compliant com ReportLab.

Layout A4 conforme boas práticas AT:
- Cabeçalho: tipo/número/data/ATCUD
- Bloco emitente (esquerda) + adquirente (direita)
- Tabela de linhas: Descrição | Qty | Preço Un. | IVA% | Total
- Resumo IVA por taxa
- Totais: Subtotal, IVA, Total Final
- QR Code (canto inferior direito)
- Rodapé: hash 4 chars + certificação + dados empresa
"""
from __future__ import annotations

import io
from typing import Optional

try:
    from reportlab.lib import colors
    from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.platypus import (
        SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable,
        KeepTogether,
    )
    from reportlab.platypus.flowables import Image as RLImage
    HAS_REPORTLAB = True
except ImportError:
    HAS_REPORTLAB = False


class ATPDFService:
    """Geração de PDF de faturas AT-compliant com ReportLab."""

    PAGE_W, PAGE_H = A4  # 595 × 842 pts
    MARGIN = 15 * mm

    TIPO_LABELS = {
        "FT": "FATURA",
        "FS": "FATURA SIMPLIFICADA",
        "NC": "NOTA DE CRÉDITO",
        "ND": "NOTA DE DÉBITO",
        "RC": "RECIBO",
    }

    def generate_invoice_pdf(
        self,
        doc_data: dict,
        company_data: dict,
        qr_image_bytes: Optional[bytes] = None,
    ) -> bytes:
        """
        Gera PDF da fatura/documento.

        doc_data: dict com campos do at_invoice_documents
        company_data: dict com dados da empresa (nome, nif, morada, etc.)
        qr_image_bytes: PNG do QR Code AT
        """
        if not HAS_REPORTLAB:
            raise ImportError("Pacote 'reportlab' não instalado. Execute: pip install reportlab")

        buf = io.BytesIO()
        doc = SimpleDocTemplate(
            buf,
            pagesize=A4,
            leftMargin=self.MARGIN,
            rightMargin=self.MARGIN,
            topMargin=self.MARGIN,
            bottomMargin=20 * mm,
        )

        styles = getSampleStyleSheet()
        story = []

        # ── Estilos personalizados ──────────────────────────────────────────
        style_titulo = ParagraphStyle(
            "Titulo",
            parent=styles["Heading1"],
            fontSize=16,
            textColor=colors.HexColor("#1a1a2e"),
            spaceAfter=2,
        )
        style_subtitulo = ParagraphStyle(
            "Subtitulo",
            parent=styles["Normal"],
            fontSize=10,
            textColor=colors.HexColor("#444"),
        )
        style_label = ParagraphStyle(
            "Label",
            parent=styles["Normal"],
            fontSize=8,
            textColor=colors.HexColor("#666"),
        )
        style_value = ParagraphStyle(
            "Value",
            parent=styles["Normal"],
            fontSize=9,
            textColor=colors.HexColor("#111"),
        )
        style_bold = ParagraphStyle(
            "Bold",
            parent=styles["Normal"],
            fontSize=9,
            fontName="Helvetica-Bold",
        )
        style_small = ParagraphStyle(
            "Small",
            parent=styles["Normal"],
            fontSize=7.5,
            textColor=colors.HexColor("#555"),
        )
        style_center = ParagraphStyle(
            "Center",
            parent=styles["Normal"],
            fontSize=9,
            alignment=TA_CENTER,
        )
        style_right = ParagraphStyle(
            "Right",
            parent=styles["Normal"],
            fontSize=9,
            alignment=TA_RIGHT,
        )

        usable_w = self.PAGE_W - 2 * self.MARGIN

        # ── Tipo documento + número + data ─────────────────────────────────
        tipo_label = self.TIPO_LABELS.get(doc_data.get("tipo_doc", "FT"), "DOCUMENTO")
        numero = doc_data.get("numero_documento", "—")
        data_emissao = doc_data.get("data_emissao", "")
        atcud = doc_data.get("atcud", "ATCUD:0-0")

        # Cabeçalho: empresa (esq) + tipo doc (dir)
        header_data = [
            [
                Paragraph(
                    f"<b>{company_data.get('nome', '')}</b><br/>"
                    f"<font size=8 color='#555'>NIF: {company_data.get('nif', '')}</font>",
                    style_value,
                ),
                Paragraph(
                    f"<b>{tipo_label}</b><br/>"
                    f"<font size=10>{numero}</font>",
                    ParagraphStyle("HDirDoc", parent=style_value, alignment=TA_RIGHT, fontSize=9, fontName="Helvetica-Bold"),
                ),
            ]
        ]
        header_tbl = Table(header_data, colWidths=[usable_w * 0.6, usable_w * 0.4])
        header_tbl.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ]))
        story.append(header_tbl)
        story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#1a1a2e"), spaceAfter=4))

        # Data + ATCUD
        meta_data = [
            [
                Paragraph(f"<font size=8 color='#666'>Data: </font><font size=8>{data_emissao}</font>", style_value),
                Paragraph(f"<font size=8 color='#666'>ATCUD: </font><font size=8>{atcud}</font>", style_right),
            ]
        ]
        meta_tbl = Table(meta_data, colWidths=[usable_w * 0.5, usable_w * 0.5])
        meta_tbl.setStyle(TableStyle([
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        story.append(meta_tbl)

        # ── Bloco emitente / adquirente ─────────────────────────────────────
        emitente_lines = [
            f"<b>EMITENTE</b>",
            company_data.get("nome", ""),
            f"NIF: {company_data.get('nif', '')}",
        ]
        if company_data.get("morada"):
            emitente_lines.append(company_data["morada"])

        adquirente_lines = [
            f"<b>ADQUIRENTE</b>",
            doc_data.get("customer_name") or "Consumidor Final",
        ]
        if doc_data.get("customer_nif"):
            adquirente_lines.append(f"NIF: {doc_data['customer_nif']}")
        if doc_data.get("customer_address"):
            adquirente_lines.append(doc_data["customer_address"])
        adquirente_lines.append(f"País: {doc_data.get('customer_country', 'PT')}")

        parties_data = [
            [
                Paragraph("<br/>".join(emitente_lines), style_small),
                Paragraph("<br/>".join(adquirente_lines), style_small),
            ]
        ]
        parties_tbl = Table(parties_data, colWidths=[usable_w * 0.48, usable_w * 0.48])
        parties_tbl.setStyle(TableStyle([
            ("BOX", (0, 0), (0, 0), 0.5, colors.HexColor("#ddd")),
            ("BOX", (1, 0), (1, 0), 0.5, colors.HexColor("#ddd")),
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f9f9f9")),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("COLPADDING", (0, 0), (-1, -1), 6),
        ]))
        story.append(Spacer(1, 4))
        story.append(parties_tbl)
        story.append(Spacer(1, 8))

        # Referência doc (NC/ND)
        if doc_data.get("reference_doc"):
            story.append(Paragraph(
                f"<font size=8 color='#666'>Documento de referência: </font>"
                f"<font size=8>{doc_data['reference_doc']}</font>",
                style_value,
            ))
            story.append(Spacer(1, 4))

        # ── Tabela de linhas ────────────────────────────────────────────────
        import json as _json
        linhas = []
        if doc_data.get("linhas"):
            try:
                linhas = _json.loads(doc_data["linhas"]) if isinstance(doc_data["linhas"], str) else doc_data["linhas"]
            except Exception:
                linhas = []

        col_widths_items = [
            usable_w * 0.38,  # Descrição
            usable_w * 0.09,  # Qty
            usable_w * 0.14,  # Preço Un.
            usable_w * 0.09,  # IVA%
            usable_w * 0.14,  # Base
            usable_w * 0.14,  # Total c/IVA
        ]

        hdr_style = ParagraphStyle("HdrItem", parent=style_bold, fontSize=8, alignment=TA_CENTER)
        items_header = [
            Paragraph("Descrição", hdr_style),
            Paragraph("Qty", hdr_style),
            Paragraph("Pr. Un.", hdr_style),
            Paragraph("IVA %", hdr_style),
            Paragraph("Base", hdr_style),
            Paragraph("Total", hdr_style),
        ]
        items_rows = [items_header]
        for linha in linhas:
            qty = float(linha.get("quantidade", 1))
            preco = float(linha.get("preco_unitario", 0))
            taxa = float(linha.get("taxa_iva", 23))
            base = qty * preco
            total = base * (1 + taxa / 100)
            items_rows.append([
                Paragraph(str(linha.get("descricao", "")), style_small),
                Paragraph(f"{qty:.0f}" if qty == int(qty) else f"{qty:.2f}", style_center),
                Paragraph(f"{preco:.2f} €", style_right),
                Paragraph(f"{taxa:.0f}%", style_center),
                Paragraph(f"{base:.2f} €", style_right),
                Paragraph(f"{total:.2f} €", style_right),
            ])

        items_tbl = Table(items_rows, colWidths=col_widths_items, repeatRows=1)
        items_tbl.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1a1a2e")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 8),
            ("ALIGN", (0, 0), (-1, 0), "CENTER"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f5f5f5")]),
            ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#ddd")),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ]))
        story.append(items_tbl)
        story.append(Spacer(1, 8))

        # ── Resumo IVA + Totais + QR Code ──────────────────────────────────
        vat_breakdown = []
        if doc_data.get("vat_breakdown"):
            try:
                vat_breakdown = _json.loads(doc_data["vat_breakdown"]) if isinstance(doc_data["vat_breakdown"], str) else doc_data["vat_breakdown"]
            except Exception:
                vat_breakdown = []

        # Coluna esquerda: resumo IVA
        vat_rows = [[
            Paragraph("<b>Taxa IVA</b>", ParagraphStyle("vh", parent=style_bold, fontSize=7.5)),
            Paragraph("<b>Base</b>", ParagraphStyle("vh", parent=style_bold, fontSize=7.5, alignment=TA_RIGHT)),
            Paragraph("<b>IVA</b>", ParagraphStyle("vh", parent=style_bold, fontSize=7.5, alignment=TA_RIGHT)),
        ]]
        for vb in vat_breakdown:
            vat_rows.append([
                Paragraph(f"{float(vb.get('taxa', 0)):.0f}%", style_small),
                Paragraph(f"{float(vb.get('base', 0)):.2f} €", ParagraphStyle("vr", parent=style_small, alignment=TA_RIGHT)),
                Paragraph(f"{float(vb.get('valor', 0)):.2f} €", ParagraphStyle("vr", parent=style_small, alignment=TA_RIGHT)),
            ])

        vat_tbl = Table(vat_rows, colWidths=[20 * mm, 25 * mm, 22 * mm])
        vat_tbl.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#eee")),
            ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#ddd")),
            ("TOPPADDING", (0, 0), (-1, -1), 2),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ("LEFTPADDING", (0, 0), (-1, -1), 3),
            ("RIGHTPADDING", (0, 0), (-1, -1), 3),
        ]))

        # Coluna direita: totais
        total_bruto = float(doc_data.get("total_bruto", 0))
        total_iva = float(doc_data.get("total_iva", 0))
        total_liquido = float(doc_data.get("total_liquido", 0))

        totais_rows = [
            [Paragraph("Subtotal (s/IVA)", style_small), Paragraph(f"{total_bruto:.2f} €", ParagraphStyle("tr", parent=style_small, alignment=TA_RIGHT))],
            [Paragraph("IVA", style_small), Paragraph(f"{total_iva:.2f} €", ParagraphStyle("tr", parent=style_small, alignment=TA_RIGHT))],
        ]
        totais_tbl = Table(totais_rows, colWidths=[35 * mm, 25 * mm])
        totais_tbl.setStyle(TableStyle([
            ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#ddd")),
            ("TOPPADDING", (0, 0), (-1, -1), 2),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ("LEFTPADDING", (0, 0), (-1, -1), 3),
            ("RIGHTPADDING", (0, 0), (-1, -1), 3),
        ]))

        total_final_tbl = Table(
            [[
                Paragraph("<b>TOTAL</b>", ParagraphStyle("TF", parent=style_bold, fontSize=11)),
                Paragraph(f"<b>{total_liquido:.2f} €</b>", ParagraphStyle("TFR", parent=style_bold, fontSize=11, alignment=TA_RIGHT)),
            ]],
            colWidths=[35 * mm, 25 * mm],
        )
        total_final_tbl.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#1a1a2e")),
            ("TEXTCOLOR", (0, 0), (-1, -1), colors.white),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LEFTPADDING", (0, 0), (-1, -1), 5),
            ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ]))

        # QR Code
        qr_cell_content: object
        if qr_image_bytes:
            qr_buf = io.BytesIO(qr_image_bytes)
            qr_cell_content = RLImage(qr_buf, width=32 * mm, height=32 * mm)
        else:
            qr_cell_content = Paragraph("<font size=7 color='#999'>QR Code</font>", style_center)

        # Layout: [vat_tbl (esq)] [espaço] [totais_tbl + total_final (dir)] [qr (extrema dir)]
        bottom_left = [vat_tbl]
        bottom_mid = [totais_tbl, Spacer(1, 2), total_final_tbl]

        bottom_data = [
            [
                KeepTogether(bottom_left),
                KeepTogether(bottom_mid),
                qr_cell_content,
            ]
        ]
        bottom_tbl = Table(
            bottom_data,
            colWidths=[usable_w * 0.35, usable_w * 0.38, usable_w * 0.25],
        )
        bottom_tbl.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "BOTTOM"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("ALIGN", (2, 0), (2, 0), "RIGHT"),
        ]))
        story.append(bottom_tbl)

        # ── Condições de pagamento ──────────────────────────────────────────
        if doc_data.get("payment_terms"):
            story.append(Spacer(1, 6))
            story.append(Paragraph(
                f"<font size=8 color='#666'>Condições: </font><font size=8>{doc_data['payment_terms']}</font>",
                style_value,
            ))

        # ── Notas ──────────────────────────────────────────────────────────
        if doc_data.get("notes"):
            story.append(Spacer(1, 4))
            story.append(Paragraph(
                f"<font size=8 color='#666'>Notas: </font><font size=8>{doc_data['notes']}</font>",
                style_value,
            ))

        # ── Rodapé: hash + certificação ────────────────────────────────────
        story.append(Spacer(1, 8))
        story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#ccc"), spaceAfter=4))

        hash_4 = doc_data.get("hash_4chars", "0000")
        num_cert = doc_data.get("num_certificacao", "0/AT")
        story.append(Paragraph(
            f"<font size=7 color='#777'>Processado por programa certificado nº {num_cert} — Hash: {hash_4}</font>",
            style_small,
        ))
        story.append(Paragraph(
            f"<font size=7 color='#777'>{company_data.get('nome', '')} · NIF {company_data.get('nif', '')} · {company_data.get('morada', '')}</font>",
            style_small,
        ))

        doc.build(story)
        return buf.getvalue()
