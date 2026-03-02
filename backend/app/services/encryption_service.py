"""
Encriptação de senhas para supplier_access.
Usa chave mestra (SUPPLIER_ACCESS_SECRET) nas variáveis de ambiente.
"""
from __future__ import annotations

import base64
import hashlib
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken
from app.config.settings import get_settings


def _get_fernet() -> Optional[Fernet]:
    """Obtém instância Fernet a partir da chave mestra em .env."""
    secret = get_settings().supplier_access_secret
    if not secret or not secret.strip():
        return None
    # Derivar chave 32 bytes para Fernet: SHA256(secret) -> base64
    key = base64.urlsafe_b64encode(hashlib.sha256(secret.strip().encode()).digest())
    return Fernet(key)


def encrypt_password(plain: str) -> Optional[str]:
    """Encripta a senha em texto limpo. Retorna None se não houver chave configurada."""
    if not plain:
        return None
    f = _get_fernet()
    if not f:
        return None
    return f.encrypt(plain.encode()).decode()


def decrypt_password(encrypted: str) -> Optional[str]:
    """Desencripta a senha. Retorna None se falhar ou chave em falta."""
    if not encrypted:
        return None
    f = _get_fernet()
    if not f:
        return None
    try:
        return f.decrypt(encrypted.encode()).decode()
    except InvalidToken:
        return None
