"""
Serviço de segurança para encriptação de senhas (supplier_access, etc.).
Usa ENCRYPTION_KEY no .env — chave Fernet gerada com: Fernet.generate_key().decode()
"""
from __future__ import annotations

import os
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Chave deve ser gerada uma vez e guardada no .env
# Comando para gerar: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
MASTER_KEY = os.getenv("ENCRYPTION_KEY")
_fernet: Optional[Fernet] = None
if MASTER_KEY and MASTER_KEY.strip():
    try:
        _fernet = Fernet(MASTER_KEY.strip().encode())
    except Exception:
        _fernet = None


def encrypt_password(plain_text: str) -> Optional[str]:
    """Encripta a senha. Retorna None se ENCRYPTION_KEY não estiver configurada."""
    if not plain_text or not _fernet:
        return None
    try:
        return _fernet.encrypt(plain_text.encode()).decode()
    except Exception:
        return None


def decrypt_password(encrypted_text: str) -> Optional[str]:
    """Desencripta a senha. Retorna None se falhar ou chave em falta."""
    if not encrypted_text or not _fernet:
        return None
    try:
        return _fernet.decrypt(encrypted_text.encode()).decode()
    except InvalidToken:
        return None
