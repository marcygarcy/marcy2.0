"""
Fase 6 – Endpoints de Validação Manual de Faturas de Fornecedores.

GET  /invoice-validation/inbox        ?empresa_id&supplier_id&status&apenas_divergencias
GET  /invoice-validation/stats        ?empresa_id
GET  /invoice-validation/smtp-status
GET  /invoice-validation/{id}
POST /invoice-validation/{id}/approve
POST /invoice-validation/{id}/approve-with-note
POST /invoice-validation/{id}/contest
POST /invoice-validation/{id}/set-discussion
POST /invoice-validation/{id}/annul
POST /invoice-validation/{id}/add-note
GET  /invoice-validation/{id}/comms
"""
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.services.invoice_validation_service import InvoiceValidationService, is_smtp_configured

router = APIRouter(prefix="/invoice-validation", tags=["invoice-validation"])
_svc = InvoiceValidationService()


# ─── Pydantic bodies ─────────────────────────────────────────────────────────

class ApproveBody(BaseModel):
    aprovado_por: str = "utilizador"


class ApproveWithNoteBody(BaseModel):
    nota: str
    aprovado_por: str = "utilizador"


class ContestBody(BaseModel):
    email_para: str
    assunto: str
    corpo: str
    enviado_por: str = "utilizador"


class AnnulBody(BaseModel):
    motivo: str = ""


class AddNoteBody(BaseModel):
    nota: str
    utilizador: str = "utilizador"


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("/inbox")
def get_inbox(
    empresa_id: Optional[int] = Query(None),
    supplier_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    apenas_divergencias: bool = Query(False),
):
    return _svc.list_inbox(empresa_id, supplier_id, status, apenas_divergencias)


@router.get("/stats")
def get_stats(empresa_id: Optional[int] = Query(None)):
    return _svc.get_stats(empresa_id)


@router.get("/smtp-status")
def smtp_status():
    """Informa o frontend se SMTP está configurado (para fallback mailto:)."""
    return {"configured": is_smtp_configured()}


@router.get("/{invoice_id}")
def get_detail(invoice_id: int):
    detail = _svc.get_detail(invoice_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Fatura não encontrada")
    return detail


@router.post("/{invoice_id}/approve")
def approve(invoice_id: int, body: ApproveBody):
    try:
        return _svc.approve(invoice_id, body.aprovado_por)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{invoice_id}/approve-with-note")
def approve_with_note(invoice_id: int, body: ApproveWithNoteBody):
    try:
        return _svc.approve_with_note(invoice_id, body.nota, body.aprovado_por)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{invoice_id}/contest")
def contest(invoice_id: int, body: ContestBody):
    return _svc.contest(
        invoice_id,
        body.email_para,
        body.assunto,
        body.corpo,
        body.enviado_por,
    )


@router.post("/{invoice_id}/set-discussion")
def set_discussion(invoice_id: int):
    return _svc.set_discussion(invoice_id)


@router.post("/{invoice_id}/annul")
def annul(invoice_id: int, body: AnnulBody):
    return _svc.annul(invoice_id, body.motivo)


@router.post("/{invoice_id}/add-note")
def add_note(invoice_id: int, body: AddNoteBody):
    return _svc.add_note(invoice_id, body.nota, body.utilizador)


@router.get("/{invoice_id}/comms")
def get_comms(invoice_id: int):
    return _svc.get_comms(invoice_id)
