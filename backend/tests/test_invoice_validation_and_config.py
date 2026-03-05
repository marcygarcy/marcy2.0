"""
Testes para Validação de Faturas (Fase 6) e Configuração SMTP.

Executar a partir da raiz do backend:
  pytest tests/ -v
  pytest tests/test_invoice_validation_and_config.py -v
"""
import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


# ─── Invoice Validation ───────────────────────────────────────────────────────

def test_invoice_validation_inbox_returns_list():
    """GET /api/v1/invoice-validation/inbox devolve lista (pode estar vazia)."""
    r = client.get("/api/v1/invoice-validation/inbox")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)


def test_invoice_validation_inbox_with_filters():
    """GET /api/v1/invoice-validation/inbox aceita query params."""
    r = client.get(
        "/api/v1/invoice-validation/inbox",
        params={"empresa_id": 1, "status": "pendente_validacao", "apenas_divergencias": False},
    )
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_invoice_validation_stats_returns_dict():
    """GET /api/v1/invoice-validation/stats devolve contagens por estado."""
    r = client.get("/api/v1/invoice-validation/stats")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, dict)
    for key in ("pendente_validacao", "contestada", "em_discussao", "aprovada", "total"):
        assert key in data
        assert isinstance(data[key], int)


def test_invoice_validation_smtp_status():
    """GET /api/v1/invoice-validation/smtp-status devolve configured (bool)."""
    r = client.get("/api/v1/invoice-validation/smtp-status")
    assert r.status_code == 200
    data = r.json()
    assert "configured" in data
    assert isinstance(data["configured"], bool)


def test_invoice_validation_detail_404_when_missing():
    """GET /api/v1/invoice-validation/999999 devolve 404."""
    r = client.get("/api/v1/invoice-validation/999999")
    assert r.status_code == 404


# ─── Config SMTP ──────────────────────────────────────────────────────────────

def test_config_smtp_get_returns_config():
    """GET /api/v1/config/smtp devolve host, port, user, from (sem password)."""
    r = client.get("/api/v1/config/smtp")
    assert r.status_code == 200
    data = r.json()
    assert "smtp_host" in data
    assert "smtp_port" in data
    assert "smtp_user" in data
    assert "smtp_from" in data
    assert "smtp_password" not in data or data.get("smtp_password") is None


def test_config_smtp_save_accepts_body():
    """POST /api/v1/config/smtp aceita body e devolve 200."""
    r = client.post(
        "/api/v1/config/smtp",
        json={
            "smtp_host": "smtp.example.com",
            "smtp_port": 587,
            "smtp_user": "test@example.com",
            "smtp_from": "ERP <test@example.com>",
        },
    )
    assert r.status_code == 200


def test_config_smtp_test_requires_email():
    """POST /api/v1/config/smtp/test com test_email devolve success ou error (não 500)."""
    r = client.post(
        "/api/v1/config/smtp/test",
        json={"test_email": "noreply@example.com"},
    )
    # Pode ser 200 (sucesso) ou 200 com success: false se SMTP não configurado
    assert r.status_code == 200
    data = r.json()
    assert "success" in data
    assert isinstance(data["success"], bool)


# ─── Finance open-pos (modal Registar Fatura) ──────────────────────────────────

def test_finance_supplier_open_pos_returns_list():
    """GET /api/v1/finance/suppliers/{id}/open-pos devolve lista (exclui POs já com fatura)."""
    r = client.get("/api/v1/finance/suppliers/1/open-pos")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)


# ─── Health / app ─────────────────────────────────────────────────────────────

def test_app_has_docs():
    """A aplicação expõe OpenAPI docs."""
    r = client.get("/docs")
    assert r.status_code == 200
