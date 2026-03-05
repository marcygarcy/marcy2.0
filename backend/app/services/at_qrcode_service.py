"""Serviço de QR Code AT-compliant (Portugal).

Implementa o formato de QR Code obrigatório conforme:
- Portaria 195/2020 (introdução QR Code em faturas)
- Ofício-Circulado 30217/2021 (especificação técnica campos QR)

Campos QR Code (separados por '*'):
    A  — NIF emitente
    B  — NIF adquirente (999999990 se consumidor final)
    C  — País do adquirente (PT, ES, DE, ...)
    D  — Tipo de documento (FT, FS, NC, ND, RC)
    E  — Estado do documento (N=Normal, A=Anulado, F=Faturado)
    F  — Data do documento (YYYYMMDD)
    G  — Número do documento (série/número)
    H  — ATCUD
    I1 — Espaço fiscal (PT)
    I2 — Base isenta (taxa 0%) — omitir se 0
    I3 — Base reduzida (taxa reduzida) — omitir se 0
    I4 — IVA reduzido — omitir se 0
    I5 — Base intermédia — omitir se 0
    I6 — IVA intermédio — omitir se 0
    I7 — Base normal (23%) — omitir se 0
    I8 — IVA normal — omitir se 0
    N  — Total IVA
    O  — Total com IVA (valor do documento)
    P  — Retenção na fonte — omitir se 0
    Q  — 4 primeiros caracteres do hash RSA
    R  — Número de certificação AT (0 em pré-certificação)
"""
from __future__ import annotations

import base64
import io
from typing import Optional

try:
    import qrcode
    from qrcode.constants import ERROR_CORRECT_M
    HAS_QRCODE = True
except ImportError:
    HAS_QRCODE = False


class ATQRCodeService:
    """QR Code formato AT (Portaria 195/2020)."""

    NIF_CONSUMIDOR_FINAL = "999999990"
    ESPACO_FISCAL_PT = "PT"
    TAXA_NORMAL_PT = 23.0
    TAXA_INTERMED_PT = 13.0
    TAXA_REDUZIDA_PT = 6.0

    def build_qr_string(
        self,
        nif_emitente: str,
        nif_adquirente: Optional[str],
        pais_adquirente: str,
        tipo_doc: str,
        estado_doc: str,        # "N" | "A" | "F"
        data_doc: str,          # YYYYMMDD
        numero_doc: str,
        atcud: str,
        vat_breakdown: list[dict],  # [{taxa, base, valor}]
        total_iva: float,
        total_doc: float,
        hash_4chars: str,
        num_certificacao: str = "0",
        retencao: float = 0.0,
    ) -> str:
        """
        Monta string QR conforme Portaria 195/2020.
        Devolve string pronta para codificar em QR.
        """
        nif_adq = nif_adquirente if nif_adquirente else self.NIF_CONSUMIDOR_FINAL

        # Classificar bases por taxa
        base_isenta = 0.0
        base_reduzida = 0.0
        iva_reduzido = 0.0
        base_intermed = 0.0
        iva_intermed = 0.0
        base_normal = 0.0
        iva_normal = 0.0

        for item in (vat_breakdown or []):
            taxa = float(item.get("taxa", 0))
            base = float(item.get("base", 0))
            valor = float(item.get("valor", 0))
            if taxa == 0:
                base_isenta += base
            elif abs(taxa - self.TAXA_REDUZIDA_PT) < 0.5:
                base_reduzida += base
                iva_reduzido += valor
            elif abs(taxa - self.TAXA_INTERMED_PT) < 0.5:
                base_intermed += base
                iva_intermed += valor
            else:
                # Taxa normal (ou outra taxa > 13%)
                base_normal += base
                iva_normal += valor

        fields: list[str] = [
            f"A:{nif_emitente}",
            f"B:{nif_adq}",
            f"C:{pais_adquirente}",
            f"D:{tipo_doc}",
            f"E:{estado_doc}",
            f"F:{data_doc}",
            f"G:{numero_doc}",
            f"H:{atcud}",
            f"I1:{self.ESPACO_FISCAL_PT}",
        ]

        if base_isenta > 0:
            fields.append(f"I2:{base_isenta:.2f}")
        if base_reduzida > 0:
            fields.append(f"I3:{base_reduzida:.2f}")
            fields.append(f"I4:{iva_reduzido:.2f}")
        if base_intermed > 0:
            fields.append(f"I5:{base_intermed:.2f}")
            fields.append(f"I6:{iva_intermed:.2f}")
        if base_normal > 0:
            fields.append(f"I7:{base_normal:.2f}")
            fields.append(f"I8:{iva_normal:.2f}")

        fields.append(f"N:{total_iva:.2f}")
        fields.append(f"O:{total_doc:.2f}")

        if retencao > 0:
            fields.append(f"P:{retencao:.2f}")

        fields.append(f"Q:{hash_4chars}")
        fields.append(f"R:{num_certificacao}")

        return "*".join(fields)

    def generate_qr_image_bytes(self, qr_string: str) -> bytes:
        """Gera imagem PNG do QR Code (bytes). Requer pacote 'qrcode'."""
        if not HAS_QRCODE:
            raise ImportError("Pacote 'qrcode' não instalado. Execute: pip install qrcode Pillow")

        qr = qrcode.QRCode(
            version=None,          # auto-detect version
            error_correction=ERROR_CORRECT_M,
            box_size=4,
            border=2,
        )
        qr.add_data(qr_string)
        qr.make(fit=True)

        img = qr.make_image(fill_color="black", back_color="white")
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return buf.getvalue()

    def get_qr_base64(self, qr_string: str) -> str:
        """QR Code em base64 data URI para preview no frontend."""
        png_bytes = self.generate_qr_image_bytes(qr_string)
        b64 = base64.b64encode(png_bytes).decode("utf-8")
        return f"data:image/png;base64,{b64}"
