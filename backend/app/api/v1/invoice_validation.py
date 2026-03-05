"""
Fase 6/7 – Endpoints de Validação Manual de Faturas de Fornecedores.

GET  /invoice-validation/inbox                ?empresa_id&supplier_id&status&apenas_divergencias
GET  /invoice-validation/stats                ?empresa_id
GET  /invoice-validation/smtp-status
GET  /invoice-validation/pos/search           ?q&supplier_id&empresa_id
GET  /invoice-validation/{id}
PATCH /invoice-validation/{id}
POST /invoice-validation/{id}/approve
POST /invoice-validation/{id}/approve-with-note
POST /invoice-validation/{id}/contest
POST /invoice-validation/{id}/set-discussion
POST /invoice-validation/{id}/annul
POST /invoice-validation/{id}/add-note
GET  /invoice-validation/{id}/comms
GET  /invoice-validation/{id}/pos
POST /invoice-validation/{id}/pos
GET  /invoice-validation/{id}/credit-notes
POST /invoice-validation/{id}/credit-notes
DELETE /invoice-validation/{id}/credit-notes/{nc_id}
"""
from typing import List, Optional

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


class SetLinkedPosBody(BaseModel):
    po_ids: List[int]


class UpdateInvoiceBody(BaseModel):
    supplier_id: Optional[int] = None
    invoice_ref: Optional[str] = None
    invoice_date: Optional[str] = None
    data_vencimento: Optional[str] = None
    valor_base: Optional[float] = None
    valor_iva: Optional[float] = None
    valor_portes: Optional[float] = None
    divergence_code: Optional[str] = None
    nota_aprovacao: Optional[str] = None


class AddCreditNoteBody(BaseModel):
    nc_ref: str
    valor: float
    nc_date: Optional[str] = None
    notas: Optional[str] = None


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


@router.get("/pos/search")
def search_pos(
    q: Optional[str] = Query(None),
    supplier_id: Optional[int] = Query(None),
    empresa_id: Optional[int] = Query(None),
):
    """Pesquisa POs por PO# ou NE do fornecedor. Sem q= retorna todas as POs abertas do fornecedor."""
    return _svc.search_pos(q, supplier_id, empresa_id)


@router.get("/{invoice_id}")
def get_detail(invoice_id: int):
    detail = _svc.get_detail(invoice_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Fatura não encontrada")
    return detail


@router.patch("/{invoice_id}")
def update_invoice(invoice_id: int, body: UpdateInvoiceBody):
    """Actualiza campos editáveis da fatura (decomposição, datas, fornecedor, código)."""
    return _svc.update_invoice(invoice_id, body.model_dump(exclude_none=True))


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


# ─── Fase 7: POs ligadas ─────────────────────────────────────────────────────

@router.get("/{invoice_id}/pos")
def get_linked_pos(invoice_id: int):
    return _svc.get_linked_pos(invoice_id)


@router.post("/{invoice_id}/pos")
def set_linked_pos(invoice_id: int, body: SetLinkedPosBody):
    return _svc.set_linked_pos(invoice_id, body.po_ids)


# ─── Fase 7: Notas de Crédito ────────────────────────────────────────────────

@router.get("/{invoice_id}/credit-notes")
def get_credit_notes(invoice_id: int):
    return _svc.get_credit_notes(invoice_id)


@router.post("/{invoice_id}/credit-notes")
def add_credit_note(invoice_id: int, body: AddCreditNoteBody):
    try:
        return _svc.add_credit_note(
            invoice_id, body.nc_ref, body.valor, body.nc_date, body.notas
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/{invoice_id}/credit-notes/{nc_id}")
def delete_credit_note(invoice_id: int, nc_id: int):
    return _svc.delete_credit_note(invoice_id, nc_id)
