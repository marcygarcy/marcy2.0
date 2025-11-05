"""Endpoints para gestão de movimentos bancários."""

from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.services.bank_service import BankService
from app.api.deps import get_bank_service

router = APIRouter(prefix="/bank", tags=["bank"])


class BankMovementCreate(BaseModel):
    """Modelo para criação de movimento bancário."""
    data_ctb: str
    data_movimento: str
    ciclo: str
    montante: float


class BankMovementUpdate(BaseModel):
    """Modelo para atualização de movimento bancário."""
    data_ctb: str
    data_movimento: str
    ciclo: str
    montante: float


@router.get("/movements")
async def get_bank_movements(
    mes: Optional[str] = Query(None, description="Mês no formato YYYY-MM (ex: 2024-10)"),
    data_inicio: Optional[str] = Query(None, description="Data inicial no formato YYYY-MM-DD"),
    data_fim: Optional[str] = Query(None, description="Data final no formato YYYY-MM-DD"),
    service: BankService = Depends(get_bank_service)
):
    """
    Obtém movimentos bancários.
    
    Pode filtrar por mês ou por intervalo de datas.
    Se ambos forem fornecidos, o intervalo de datas tem prioridade.
    """
    try:
        # Se intervalo de datas for fornecido, ignorar filtro de mês
        if data_inicio or data_fim:
            mes = None
        
        movements = service.get_bank_movements(
            mes=mes,
            data_inicio=data_inicio,
            data_fim=data_fim
        )
        
        total = service.get_total_amount(
            mes=mes,
            data_inicio=data_inicio,
            data_fim=data_fim
        )
        
        return {
            "movements": movements,
            "total": total,
            "count": len(movements)
        }
    except Exception as e:
        print(f"Erro ao obter movimentos bancários: {e}")
        import traceback
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Erro ao obter movimentos bancários: {str(e)}")
    finally:
        service.close()


@router.post("/movements")
async def create_bank_movement(
    movement: BankMovementCreate,
    service: BankService = Depends(get_bank_service)
):
    """Cria um novo movimento bancário."""
    try:
        result = service.create_bank_movement(
            data_ctb=movement.data_ctb,
            data_movimento=movement.data_movimento,
            ciclo=movement.ciclo,
            montante=movement.montante
        )
        return result
    except Exception as e:
        print(f"Erro ao criar movimento bancário: {e}")
        import traceback
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Erro ao criar movimento bancário: {str(e)}")
    finally:
        service.close()


@router.put("/movements/{movement_id}")
async def update_bank_movement(
    movement_id: int,
    movement: BankMovementUpdate,
    service: BankService = Depends(get_bank_service)
):
    """Atualiza um movimento bancário existente."""
    try:
        result = service.update_bank_movement(
            movement_id=movement_id,
            data_ctb=movement.data_ctb,
            data_movimento=movement.data_movimento,
            ciclo=movement.ciclo,
            montante=movement.montante
        )
        return result
    except Exception as e:
        print(f"Erro ao atualizar movimento bancário: {e}")
        import traceback
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Erro ao atualizar movimento bancário: {str(e)}")
    finally:
        service.close()


@router.delete("/movements/{movement_id}")
async def delete_bank_movement(
    movement_id: int,
    service: BankService = Depends(get_bank_service)
):
    """Remove um movimento bancário."""
    try:
        success = service.delete_bank_movement(movement_id)
        if success:
            return {"success": True, "message": "Movimento removido com sucesso"}
        else:
            raise HTTPException(status_code=404, detail="Movimento não encontrado")
    except Exception as e:
        print(f"Erro ao remover movimento bancário: {e}")
        import traceback
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Erro ao remover movimento bancário: {str(e)}")
    finally:
        service.close()


@router.get("/cycles")
async def get_available_cycles(
    service: BankService = Depends(get_bank_service)
):
    """Obtém lista de ciclos disponíveis."""
    try:
        cycles = service.get_available_cycles()
        return {"cycles": cycles}
    except Exception as e:
        print(f"Erro ao obter ciclos: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao obter ciclos: {str(e)}")
    finally:
        service.close()
