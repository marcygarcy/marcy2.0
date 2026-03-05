"""
Testes de fluxo completo de Validação de Faturas.

Cobertura:
  - approve()              → muda status + cria lançamento ledger
  - approve_with_note()    → idem + guarda nota
  - set_discussion()       → status = em_discussao
  - annul()                → status = anulada
  - contest()              → SMTP mockado → email_sent + status = contestada
  - add_note()             → tipo = nota_interna em supplier_invoice_comms
  - get_comms()            → histórico após várias ações
  - get_stats()            → contagens incluem a fatura de teste
  - list_inbox() filtros   → filtra por status / flag_divergencia
  - get_detail()           → detalhe da fatura de teste

Executar:
  cd backend
  pytest tests/test_invoice_flow.py -v
"""
from __future__ import annotations

import pytest
from unittest.mock import patch

from app.services.invoice_validation_service import InvoiceValidationService

svc = InvoiceValidationService()


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _fetch_status(db, invoice_id: int) -> str:
    row = db.execute(
        "SELECT status FROM supplier_invoices WHERE id = ?", [invoice_id]
    ).fetchone()
    assert row is not None, f"Fatura #{invoice_id} não existe na BD"
    return row[0]


def _count_comms(db, invoice_id: int) -> int:
    row = db.execute(
        "SELECT COUNT(*) FROM supplier_invoice_comms WHERE invoice_id = ?",
        [invoice_id],
    ).fetchone()
    return int(row[0]) if row else 0


# ─── get_detail ───────────────────────────────────────────────────────────────

class TestGetDetail:
    def test_returns_detail_for_existing(self, test_invoice):
        detail = svc.get_detail(test_invoice)
        assert detail is not None
        assert detail["id"] == test_invoice
        assert detail["status"] == "pendente_validacao"
        assert detail["flag_divergencia"] is True
        assert detail["diferenca"] == pytest.approx(20.0)

    def test_returns_none_for_missing(self):
        detail = svc.get_detail(-999999)
        assert detail is None

    def test_detail_has_supplier_nome(self, test_invoice):
        detail = svc.get_detail(test_invoice)
        assert detail is not None
        assert "supplier_nome" in detail

    def test_detail_has_all_required_keys(self, test_invoice):
        detail = svc.get_detail(test_invoice)
        required = [
            "id", "empresa_id", "supplier_id", "invoice_ref",
            "valor_fatura", "valor_po", "diferenca", "flag_divergencia",
            "status", "source", "data_criacao",
        ]
        for key in required:
            assert key in detail, f"Chave ausente: {key}"


# ─── list_inbox ───────────────────────────────────────────────────────────────

class TestListInbox:
    def test_includes_test_invoice(self, test_invoice):
        items = svc.list_inbox()
        ids = [i["id"] for i in items]
        assert test_invoice in ids

    def test_filter_by_status_shows_pending(self, test_invoice):
        items = svc.list_inbox(status="pendente_validacao")
        ids = [i["id"] for i in items]
        assert test_invoice in ids

    def test_filter_by_status_excludes_others(self, test_invoice):
        items = svc.list_inbox(status="aprovada")
        ids = [i["id"] for i in items]
        assert test_invoice not in ids

    def test_filter_apenas_divergencias(self, test_invoice, test_invoice_no_divergencia):
        items = svc.list_inbox(apenas_divergencias=True)
        ids = [i["id"] for i in items]
        assert test_invoice in ids
        assert test_invoice_no_divergencia not in ids

    def test_filter_by_empresa_id(self, test_invoice):
        # empresa_id=-1 deve aparecer
        items = svc.list_inbox(empresa_id=-1)
        ids = [i["id"] for i in items]
        assert test_invoice in ids

    def test_filter_by_empresa_id_excludes(self, test_invoice):
        # empresa_id de produção não deve incluir a fatura de teste
        items = svc.list_inbox(empresa_id=9999)
        ids = [i["id"] for i in items]
        assert test_invoice not in ids


# ─── get_stats ────────────────────────────────────────────────────────────────

class TestGetStats:
    def test_stats_shape(self):
        stats = svc.get_stats()
        for key in ("pendente_validacao", "contestada", "em_discussao", "aprovada", "total"):
            assert key in stats
            assert isinstance(stats[key], int)

    def test_pending_count_includes_test(self, test_invoice):
        stats = svc.get_stats(empresa_id=-1)
        # A fatura de teste tem status=pendente_validacao e empresa_id=-1
        assert stats["pendente_validacao"] >= 1

    def test_total_is_sum_of_statuses(self, test_invoice):
        stats = svc.get_stats(empresa_id=-1)
        manual_total = (
            stats["pendente_validacao"]
            + stats["contestada"]
            + stats["em_discussao"]
            + stats["aprovada"]
            + stats.get("aprovada_com_nota", 0)
            + stats.get("anulada", 0)
        )
        assert stats["total"] == manual_total


# ─── set_discussion ───────────────────────────────────────────────────────────

class TestSetDiscussion:
    def test_changes_status_to_em_discussao(self, test_invoice, db):
        result = svc.set_discussion(test_invoice)
        assert result["ok"] is True
        assert result["status"] == "em_discussao"
        assert _fetch_status(db, test_invoice) == "em_discussao"


# ─── annul ────────────────────────────────────────────────────────────────────

class TestAnnul:
    def test_changes_status_to_anulada(self, test_invoice, db):
        result = svc.annul(test_invoice, motivo="Teste de anulação")
        assert result["ok"] is True
        assert result["status"] == "anulada"
        assert _fetch_status(db, test_invoice) == "anulada"


# ─── add_note ─────────────────────────────────────────────────────────────────

class TestAddNote:
    def test_creates_comm_record(self, test_invoice, db):
        before = _count_comms(db, test_invoice)
        result = svc.add_note(test_invoice, "Nota de teste pytest", "pytest")
        after = _count_comms(db, test_invoice)
        assert result["ok"] is True
        assert after == before + 1

    def test_comm_has_correct_type(self, test_invoice, db):
        svc.add_note(test_invoice, "Nota tipo pytest", "pytest")
        comms = svc.get_comms(test_invoice)
        types = [c["tipo"] for c in comms]
        assert "nota_interna" in types

    def test_status_unchanged_after_note(self, test_invoice, db):
        svc.add_note(test_invoice, "Nota não muda estado", "pytest")
        assert _fetch_status(db, test_invoice) == "pendente_validacao"


# ─── get_comms ────────────────────────────────────────────────────────────────

class TestGetComms:
    def test_returns_list(self, test_invoice):
        comms = svc.get_comms(test_invoice)
        assert isinstance(comms, list)

    def test_empty_for_new_invoice(self, test_invoice):
        comms = svc.get_comms(test_invoice)
        assert len(comms) == 0

    def test_returns_added_note(self, test_invoice):
        svc.add_note(test_invoice, "Nota visível nos comms", "pytest")
        comms = svc.get_comms(test_invoice)
        assert len(comms) >= 1
        assert any(c["corpo"] == "Nota visível nos comms" for c in comms)

    def test_comms_have_required_keys(self, test_invoice):
        svc.add_note(test_invoice, "Chaves obrigatórias", "pytest")
        comms = svc.get_comms(test_invoice)
        required = ["id", "invoice_id", "data_envio", "tipo", "corpo", "enviado_por"]
        for key in required:
            assert key in comms[-1], f"Chave ausente em comm: {key}"


# ─── contest (SMTP mockado) ───────────────────────────────────────────────────

class TestContest:
    def test_contest_with_smtp_mocked(self, test_invoice, db):
        """SMTP é mockado para nunca enviar email real."""
        with patch(
            "app.services.invoice_validation_service._send_email"
        ) as mock_send:
            mock_send.return_value = None  # simula envio bem-sucedido
            result = svc.contest(
                invoice_id=test_invoice,
                email_para="fornecedor@example.com",
                assunto="Contestação TEST-INV-001",
                corpo="Existe uma divergência de 20 €.",
                enviado_por="pytest",
            )

        assert result["ok"] is True
        assert result["status"] == "contestada"
        assert result["email_sent"] is True
        assert result["email_error"] is None
        assert _fetch_status(db, test_invoice) == "contestada"

    def test_contest_creates_comm_record(self, test_invoice, db):
        before = _count_comms(db, test_invoice)
        with patch("app.services.invoice_validation_service._send_email"):
            svc.contest(
                invoice_id=test_invoice,
                email_para="fornecedor@example.com",
                assunto="Contestação",
                corpo="Divergência.",
                enviado_por="pytest",
            )
        after = _count_comms(db, test_invoice)
        assert after == before + 1

    def test_contest_comm_type_is_email(self, test_invoice, db):
        with patch("app.services.invoice_validation_service._send_email"):
            svc.contest(
                invoice_id=test_invoice,
                email_para="teste@example.com",
                assunto="Assunto",
                corpo="Corpo",
                enviado_por="pytest",
            )
        comms = svc.get_comms(test_invoice)
        email_comms = [c for c in comms if c["tipo"] == "email_contestacao"]
        assert len(email_comms) >= 1

    def test_contest_smtp_error_still_saves(self, test_invoice, db):
        """Mesmo que SMTP falhe, o registo é guardado na BD."""
        with patch(
            "app.services.invoice_validation_service._send_email",
            side_effect=RuntimeError("SMTP connection refused"),
        ):
            result = svc.contest(
                invoice_id=test_invoice,
                email_para="fornecedor@example.com",
                assunto="Contestação com erro SMTP",
                corpo="Corpo",
                enviado_por="pytest",
            )

        assert result["ok"] is True
        assert result["email_sent"] is False
        assert result["email_error"] is not None
        # Status muda para contestada mesmo sem enviar email
        assert _fetch_status(db, test_invoice) == "contestada"


# ─── approve ──────────────────────────────────────────────────────────────────

class TestApprove:
    def test_approve_changes_status(self, test_invoice, db):
        """Aprovação muda status para 'aprovada'."""
        with patch(
            "app.services.accounting_match_service.AccountingMatchService.create_ledger_entry"
        ):
            result = svc.approve(test_invoice, aprovado_por="pytest")

        assert result["ok"] is True
        assert result["status"] == "aprovada"
        assert _fetch_status(db, test_invoice) == "aprovada"

    def test_approve_calls_ledger(self, test_invoice, db):
        """Aprovação invoca create_ledger_entry exactamente uma vez."""
        with patch(
            "app.services.accounting_match_service.AccountingMatchService.create_ledger_entry"
        ) as mock_ledger:
            svc.approve(test_invoice, aprovado_por="pytest")

        mock_ledger.assert_called_once()

    def test_approve_ledger_called_with_tipo_fatura(self, test_invoice, db):
        with patch(
            "app.services.accounting_match_service.AccountingMatchService.create_ledger_entry"
        ) as mock_ledger:
            svc.approve(test_invoice, aprovado_por="pytest")

        call_kwargs = mock_ledger.call_args
        # Pode ser posicional ou keyword
        args, kwargs = call_kwargs
        tipo = kwargs.get("tipo") or (args[2] if len(args) > 2 else None)
        assert tipo == "Fatura"

    def test_approve_nonexistent_raises(self):
        with pytest.raises(ValueError, match="não encontrada"):
            svc.approve(-999999)


# ─── approve_with_note ────────────────────────────────────────────────────────

class TestApproveWithNote:
    def test_approve_with_note_changes_status(self, test_invoice, db):
        with patch(
            "app.services.accounting_match_service.AccountingMatchService.create_ledger_entry"
        ):
            result = svc.approve_with_note(
                test_invoice, nota="Aprovado com ressalva", aprovado_por="pytest"
            )

        assert result["ok"] is True
        assert result["status"] == "aprovada_com_nota"
        assert _fetch_status(db, test_invoice) == "aprovada_com_nota"

    def test_approve_with_note_stores_nota(self, test_invoice, db):
        with patch(
            "app.services.accounting_match_service.AccountingMatchService.create_ledger_entry"
        ):
            svc.approve_with_note(
                test_invoice, nota="Nota guardada", aprovado_por="pytest"
            )

        detail = svc.get_detail(test_invoice)
        assert detail is not None
        assert detail["nota_aprovacao"] == "Nota guardada"

    def test_approve_with_note_nonexistent_raises(self):
        with pytest.raises(ValueError, match="não encontrada"):
            svc.approve_with_note(-999999, nota="x")


# ─── API endpoints (via TestClient) ───────────────────────────────────────────

class TestApiEndpoints:
    """Testes de fumo nos endpoints REST."""

    def test_inbox_returns_test_invoice(self, client, test_invoice):
        r = client.get("/api/v1/invoice-validation/inbox")
        assert r.status_code == 200
        ids = [i["id"] for i in r.json()]
        assert test_invoice in ids

    def test_inbox_filter_empresa(self, client, test_invoice):
        r = client.get(
            "/api/v1/invoice-validation/inbox", params={"empresa_id": -1}
        )
        assert r.status_code == 200
        ids = [i["id"] for i in r.json()]
        assert test_invoice in ids

    def test_detail_endpoint(self, client, test_invoice):
        r = client.get(f"/api/v1/invoice-validation/{test_invoice}")
        assert r.status_code == 200
        data = r.json()
        assert data["id"] == test_invoice

    def test_stats_endpoint(self, client):
        r = client.get("/api/v1/invoice-validation/stats")
        assert r.status_code == 200
        data = r.json()
        assert "pendente_validacao" in data
        assert "total" in data

    def test_set_discussion_endpoint(self, client, test_invoice, db):
        r = client.post(f"/api/v1/invoice-validation/{test_invoice}/set-discussion")
        assert r.status_code == 200
        assert r.json()["ok"] is True
        assert _fetch_status(db, test_invoice) == "em_discussao"

    def test_annul_endpoint(self, client, test_invoice, db):
        r = client.post(
            f"/api/v1/invoice-validation/{test_invoice}/annul",
            json={"motivo": "Anulado pelo teste"},
        )
        assert r.status_code == 200
        assert r.json()["ok"] is True
        assert _fetch_status(db, test_invoice) == "anulada"

    def test_add_note_endpoint(self, client, test_invoice, db):
        before = _count_comms(db, test_invoice)
        r = client.post(
            f"/api/v1/invoice-validation/{test_invoice}/add-note",
            json={"nota": "Nota via API", "utilizador": "pytest"},
        )
        assert r.status_code == 200
        assert r.json()["ok"] is True
        assert _count_comms(db, test_invoice) == before + 1

    def test_comms_endpoint(self, client, test_invoice):
        r = client.get(f"/api/v1/invoice-validation/{test_invoice}/comms")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_approve_endpoint(self, client, test_invoice, db):
        with patch(
            "app.services.accounting_match_service.AccountingMatchService.create_ledger_entry"
        ):
            r = client.post(
                f"/api/v1/invoice-validation/{test_invoice}/approve",
                json={"aprovado_por": "pytest_api"},
            )
        assert r.status_code == 200
        assert r.json()["ok"] is True
        assert _fetch_status(db, test_invoice) == "aprovada"

    def test_contest_endpoint(self, client, test_invoice, db):
        with patch("app.services.invoice_validation_service._send_email"):
            r = client.post(
                f"/api/v1/invoice-validation/{test_invoice}/contest",
                json={
                    "email_para": "fornecedor@example.com",
                    "assunto": "Contestação via API",
                    "corpo": "Divergência de 20 €.",
                    "enviado_por": "pytest_api",
                },
            )
        assert r.status_code == 200
        data = r.json()
        assert data["ok"] is True
        assert _fetch_status(db, test_invoice) == "contestada"

    def test_approve_with_note_endpoint(self, client, test_invoice, db):
        with patch(
            "app.services.accounting_match_service.AccountingMatchService.create_ledger_entry"
        ):
            r = client.post(
                f"/api/v1/invoice-validation/{test_invoice}/approve-with-note",
                json={"nota": "Aprovado com nota via API", "aprovado_por": "pytest_api"},
            )
        assert r.status_code == 200
        assert r.json()["status"] == "aprovada_com_nota"
        assert _fetch_status(db, test_invoice) == "aprovada_com_nota"

    def test_detail_404_for_missing(self, client):
        r = client.get("/api/v1/invoice-validation/-999999")
        assert r.status_code == 404
