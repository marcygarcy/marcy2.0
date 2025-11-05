"""Endpoints de empresas."""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
from app.services.empresa_service import EmpresaService
from app.api.deps import get_empresa_service

router = APIRouter(prefix="/empresas", tags=["empresas"])


class EmpresaCreate(BaseModel):
    """Modelo para criação de empresa."""
    nome: str
    codigo: Optional[str] = None
    nif: Optional[str] = None
    morada: Optional[str] = None
    email: Optional[str] = None
    telefone: Optional[str] = None


class EmpresaUpdate(BaseModel):
    """Modelo para atualização de empresa."""
    nome: Optional[str] = None
    codigo: Optional[str] = None
    nif: Optional[str] = None
    morada: Optional[str] = None
    email: Optional[str] = None
    telefone: Optional[str] = None
    ativo: Optional[bool] = None


@router.get("/")
async def get_empresas(
    service: EmpresaService = Depends(get_empresa_service)
):
    """Obtém todas as empresas."""
    try:
        empresas = service.get_all_empresas()
        return {"empresas": empresas, "count": len(empresas)}
    except Exception as e:
        import traceback
        print(f"Erro ao obter empresas: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Erro ao obter empresas: {str(e)}")
    finally:
        service.close()


@router.get("/{empresa_id}")
async def get_empresa(
    empresa_id: int,
    service: EmpresaService = Depends(get_empresa_service)
):
    """Obtém uma empresa por ID."""
    try:
        empresa = service.get_empresa_by_id(empresa_id)
        if not empresa:
            raise HTTPException(status_code=404, detail="Empresa não encontrada")
        return empresa
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"Erro ao obter empresa: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Erro ao obter empresa: {str(e)}")
    finally:
        service.close()


@router.post("/")
async def create_empresa(
    empresa: EmpresaCreate,
    service: EmpresaService = Depends(get_empresa_service)
):
    """Cria uma nova empresa."""
    try:
        result = service.create_empresa(
            nome=empresa.nome,
            codigo=empresa.codigo,
            nif=empresa.nif,
            morada=empresa.morada,
            email=empresa.email,
            telefone=empresa.telefone
        )
        return result
    except Exception as e:
        import traceback
        print(f"Erro ao criar empresa: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Erro ao criar empresa: {str(e)}")
    finally:
        service.close()


@router.put("/{empresa_id}")
async def update_empresa(
    empresa_id: int,
    empresa: EmpresaUpdate,
    service: EmpresaService = Depends(get_empresa_service)
):
    """Atualiza uma empresa existente."""
    try:
        result = service.update_empresa(
            empresa_id=empresa_id,
            nome=empresa.nome,
            codigo=empresa.codigo,
            nif=empresa.nif,
            morada=empresa.morada,
            email=empresa.email,
            telefone=empresa.telefone,
            ativo=empresa.ativo
        )
        if not result:
            raise HTTPException(status_code=404, detail="Empresa não encontrada")
        return result
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"Erro ao atualizar empresa: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Erro ao atualizar empresa: {str(e)}")
    finally:
        service.close()


@router.delete("/{empresa_id}")
async def delete_empresa(
    empresa_id: int,
    service: EmpresaService = Depends(get_empresa_service)
):
    """Remove uma empresa (soft delete)."""
    try:
        success = service.delete_empresa(empresa_id)
        if success:
            return {"success": True, "message": "Empresa removida com sucesso"}
        else:
            raise HTTPException(status_code=404, detail="Empresa não encontrada")
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"Erro ao remover empresa: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Erro ao remover empresa: {str(e)}")
    finally:
        service.close()

