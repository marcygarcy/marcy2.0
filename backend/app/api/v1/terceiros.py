"""API Gestão de Terceiros: GT (Grupos de Terceiro) e Movimentos / Contabilidade."""
from fastapi import APIRouter, Query
from pydantic import BaseModel
from typing import Any, List, Optional

from app.services.terceiros_service import TerceirosService

router = APIRouter(prefix="/terceiros", tags=["Gestão de Terceiros"])


class CreateMovimentosBody(BaseModel):
    empresa_id: Optional[int] = None
    linhas: List[dict]


@router.get("/grupos")
def list_grupos(empresa_id: Optional[int] = Query(None)):
    """Lista grupos de terceiro (GT)."""
    svc = TerceirosService()
    try:
        return svc.list_grupos(empresa_id=empresa_id)
    finally:
        svc.close()


@router.post("/movimentos")
def create_movimentos(body: CreateMovimentosBody):
    """Insere movimentos GT (ligação GT/Contabilidade)."""
    svc = TerceirosService()
    try:
        return svc.create_movimentos(empresa_id=body.empresa_id, linhas=body.linhas)
    finally:
        svc.close()


@router.get("/movimentos")
def list_movimentos(
    empresa_id: Optional[int] = Query(None),
    limit: int = Query(200, le=500),
    offset: int = Query(0, ge=0),
):
    """Lista movimentos GT com paginação."""
    svc = TerceirosService()
    try:
        items, total = svc.list_movimentos(empresa_id=empresa_id, limit=limit, offset=offset)
        return {"items": items, "total": total}
    finally:
        svc.close()
