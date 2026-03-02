"""Endpoints de meios de pagamento por empresa."""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
from app.services.payment_method_service import PaymentMethodService

router = APIRouter(prefix="/payment-methods", tags=["payment-methods"])


class PaymentMethodCreate(BaseModel):
    empresa_id: int
    metodo_tipo: str
    designacao: str
    referencia_last_4: Optional[str] = None


@router.get("")
async def list_payment_methods(empresa_id: int = Query(..., description="ID da empresa")):
    svc = PaymentMethodService()
    try:
        items = svc.list_by_empresa(empresa_id)
        return {"items": items}
    finally:
        svc.close()


@router.get("/{method_id}")
async def get_payment_method(method_id: int):
    svc = PaymentMethodService()
    try:
        row = svc.get(method_id)
        if not row:
            raise HTTPException(status_code=404, detail="Meio de pagamento não encontrado")
        return row
    finally:
        svc.close()


@router.post("/")
async def create_payment_method(body: PaymentMethodCreate):
    svc = PaymentMethodService()
    try:
        created = svc.create(
            empresa_id=body.empresa_id,
            metodo_tipo=body.metodo_tipo,
            designacao=body.designacao,
            referencia_last_4=body.referencia_last_4,
        )
        return created
    finally:
        svc.close()
