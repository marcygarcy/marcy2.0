"""API Gestão de Terceiros: GT (Grupos de Terceiro) e Movimentos / Contabilidade."""
from fastapi import APIRouter, Query
from pydantic import BaseModel
from typing import Any, List, Optional

from app.services.terceiros_service import TerceirosService

router = APIRouter(prefix="/terceiros", tags=["Gestão de Terceiros"])


class CreateMovimentosBody(BaseModel):
    empresa_id: Optional[int] = None
    linhas: List[dict]


class UpdateMovimentoBody(BaseModel):
    data_mov: Optional[str] = None
    grupo_terceiro: Optional[str] = None
    valor: Optional[float] = None
    conta_contabilidade: Optional[str] = None
    descricao: Optional[str] = None


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
    conta_contabilidade: Optional[str] = Query(None, description="Código do diário (ex: B001)"),
    ano: Optional[int] = Query(None, ge=2000, le=2100, description="Ano para filtrar (ex: 2026)"),
    mes: Optional[int] = Query(None, ge=1, le=12, description="Mês para filtrar (1-12)"),
):
    """Lista movimentos GT com paginação e filtros por diário e ano/mês."""
    svc = TerceirosService()
    try:
        items, total = svc.list_movimentos(
            empresa_id=empresa_id,
            limit=limit,
            offset=offset,
            conta_contabilidade=conta_contabilidade,
            ano=ano,
            mes=mes,
        )
        return {"items": items, "total": total}
    finally:
        svc.close()


@router.patch("/movimentos/{movimento_id}")
def update_movimento(movimento_id: int, body: UpdateMovimentoBody):
    """Atualiza um movimento GT (manutenção)."""
    svc = TerceirosService()
    try:
        return svc.update_movimento(movimento_id, body.model_dump(exclude_unset=True))
    finally:
        svc.close()
