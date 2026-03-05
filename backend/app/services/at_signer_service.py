"""Serviço de assinatura RSA AT-compliant (Portugal).

Implementa:
- Geração e persistência de par RSA 1024-bit por empresa
- Hash chain: cada documento assina o anterior (RSA-SHA1 / PKCS1v15)
- Geração de ATCUD (Código Único do Documento)

Referência legal:
- Portaria 321-A/2007 (certificação de software AT)
- Decreto-Lei 198/2012 (hash RSA obrigatório)
- Portaria 195/2020 (QR Code obrigatório a partir 2022)
"""
from __future__ import annotations

import base64
from datetime import datetime

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.backends import default_backend

from app.config.database import get_db_connection


class ATSignerService:
    """Gestão de chaves RSA e hash chain para documentos AT-compliant."""

    # AT especifica RSA-SHA1 com PKCS1v15 (decreto-lei histórico de 2007/2012)
    KEY_SIZE = 1024

    # ── Gestão de chaves ─────────────────────────────────────────────────────

    def generate_rsa_keypair(self, empresa_id: int) -> dict:
        """Gera par RSA 1024-bit para empresa e guarda na DB. Devolve chave pública PEM."""
        private_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=self.KEY_SIZE,
            backend=default_backend(),
        )
        private_pem = private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=serialization.NoEncryption(),
        ).decode("utf-8")
        public_pem = private_key.public_key().public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        ).decode("utf-8")

        conn = get_db_connection()
        try:
            # Verificar se já existe
            existing = conn.execute(
                "SELECT id FROM at_rsa_keys WHERE empresa_id = ?", [empresa_id]
            ).fetchone()
            if existing:
                conn.execute(
                    "UPDATE at_rsa_keys SET private_key_pem = ?, public_key_pem = ?, created_at = CURRENT_TIMESTAMP WHERE empresa_id = ?",
                    [private_pem, public_pem, empresa_id],
                )
            else:
                max_id = conn.execute("SELECT COALESCE(MAX(id), 0) FROM at_rsa_keys").fetchone()[0]
                conn.execute(
                    "INSERT INTO at_rsa_keys (id, empresa_id, private_key_pem, public_key_pem) VALUES (?, ?, ?, ?)",
                    [max_id + 1, empresa_id, private_pem, public_pem],
                )
            conn.commit()
        finally:
            conn.close()

        return {"empresa_id": empresa_id, "public_key_pem": public_pem, "gerado_em": datetime.now().isoformat()}

    def get_private_key(self, empresa_id: int) -> rsa.RSAPrivateKey:
        """Carrega chave privada da DB. Lança ValueError se não existir."""
        conn = get_db_connection()
        try:
            row = conn.execute(
                "SELECT private_key_pem FROM at_rsa_keys WHERE empresa_id = ?", [empresa_id]
            ).fetchone()
        finally:
            conn.close()

        if not row:
            raise ValueError(f"Par RSA não encontrado para empresa {empresa_id}. Use /at-invoices/rsa/generate primeiro.")

        return serialization.load_pem_private_key(
            row[0].encode("utf-8"),
            password=None,
            backend=default_backend(),
        )

    def get_public_key_pem(self, empresa_id: int) -> str:
        """Devolve chave pública PEM (para submeter à AT)."""
        conn = get_db_connection()
        try:
            row = conn.execute(
                "SELECT public_key_pem FROM at_rsa_keys WHERE empresa_id = ?", [empresa_id]
            ).fetchone()
        finally:
            conn.close()

        if not row:
            raise ValueError(f"Par RSA não encontrado para empresa {empresa_id}.")
        return row[0]

    def has_keypair(self, empresa_id: int) -> bool:
        """Verifica se empresa tem par RSA gerado."""
        conn = get_db_connection()
        try:
            row = conn.execute(
                "SELECT id FROM at_rsa_keys WHERE empresa_id = ?", [empresa_id]
            ).fetchone()
            return row is not None
        finally:
            conn.close()

    # ── Hash chain ──────────────────────────────────────────────────────────

    def compute_hash(
        self,
        data_doc: str,       # YYYYMMDD
        total_bruto: float,
        total_iva: float,
        total_liquido: float,
        hash_anterior: str,  # '' para primeiro documento da série
        empresa_id: int,
    ) -> str:
        """
        Calcula hash RSA-SHA1 conforme AT.

        String a assinar: '{data};{total_bruto};{total_iva};{total_liq};{hash_anterior}'
        Assina com PKCS1v15 + SHA1. Devolve base64 da assinatura.
        """
        private_key = self.get_private_key(empresa_id)

        # Formatar valores com 2 casas decimais (separador ponto)
        hash_string = (
            f"{data_doc};"
            f"{total_bruto:.2f};"
            f"{total_iva:.2f};"
            f"{total_liquido:.2f};"
            f"{hash_anterior}"
        )

        signature = private_key.sign(
            hash_string.encode("utf-8"),
            padding.PKCS1v15(),
            hashes.SHA1(),  # noqa: S303 — AT exige SHA1 por especificação
        )
        return base64.b64encode(signature).decode("utf-8")

    def get_hash_4chars(self, hash_b64: str) -> str:
        """Primeiros 4 caracteres do base64 — impressos no documento (campo Q do QR)."""
        return hash_b64[:4] if hash_b64 else "0000"

    # ── ATCUD ───────────────────────────────────────────────────────────────

    def generate_atcud(self, codigo_validacao: str, numero_sequencial: int) -> str:
        """
        Formato: 'ATCUD:{codigo_validacao}-{numero_sequencial}'
        Em pré-certificação: codigo_validacao = '0'
        Após certificação AT: codigo_validacao = código real da série (ex: 'XPTO1234')
        """
        return f"ATCUD:{codigo_validacao}-{numero_sequencial}"

    # ── Série: último hash ──────────────────────────────────────────────────

    def get_series_last_hash(self, serie_id: int) -> str:
        """Último hash da série (hash_anterior para o próximo documento)."""
        conn = get_db_connection()
        try:
            row = conn.execute(
                "SELECT ultimo_hash FROM billing_series WHERE id = ?", [serie_id]
            ).fetchone()
            if row and row[0]:
                return row[0]
            return ""
        finally:
            conn.close()

    def update_series_hash(self, serie_id: int, new_hash: str) -> None:
        """Actualiza ultimo_hash na billing_series após emissão de documento."""
        conn = get_db_connection()
        try:
            conn.execute(
                "UPDATE billing_series SET ultimo_hash = ? WHERE id = ?",
                [new_hash, serie_id],
            )
            conn.commit()
        finally:
            conn.close()
