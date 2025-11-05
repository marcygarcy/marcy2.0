"""Endpoints de marketplaces."""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
from app.services.marketplace_service import MarketplaceService
from app.api.deps import get_marketplace_service

router = APIRouter(prefix="/marketplaces", tags=["marketplaces"])


class MarketplaceCreate(BaseModel):
    """Modelo para criação de marketplace."""
    empresa_id: int
    nome: str
    codigo: Optional[str] = None
    descricao: Optional[str] = None


class MarketplaceUpdate(BaseModel):
    """Modelo para atualização de marketplace."""
    nome: Optional[str] = None
    codigo: Optional[str] = None
    descricao: Optional[str] = None
    ativo: Optional[bool] = None


@router.get("/")
async def get_marketplaces(
    empresa_id: Optional[int] = Query(None, description="Filtrar por empresa"),
    service: MarketplaceService = Depends(get_marketplace_service)
):
    """Obtém todos os marketplaces ou filtrados por empresa."""
    try:
        if empresa_id:
            marketplaces = service.get_marketplaces_by_empresa(empresa_id)
        else:
            marketplaces = service.get_all_marketplaces()
        return {"marketplaces": marketplaces, "count": len(marketplaces)}
    except Exception as e:
        import traceback
        print(f"Erro ao obter marketplaces: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Erro ao obter marketplaces: {str(e)}")
    finally:
        service.close()


@router.get("/empresa/{empresa_id}")
async def get_marketplaces_by_empresa(
    empresa_id: int,
    service: MarketplaceService = Depends(get_marketplace_service)
):
    """Obtém marketplaces de uma empresa específica."""
    try:
        marketplaces = service.get_marketplaces_by_empresa(empresa_id)
        return {"marketplaces": marketplaces, "count": len(marketplaces)}
    except Exception as e:
        import traceback
        print(f"Erro ao obter marketplaces da empresa: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Erro ao obter marketplaces: {str(e)}")
    finally:
        service.close()


@router.get("/{marketplace_id}")
async def get_marketplace(
    marketplace_id: int,
    service: MarketplaceService = Depends(get_marketplace_service)
):
    """Obtém um marketplace por ID."""
    try:
        marketplace = service.get_marketplace_by_id(marketplace_id)
        if not marketplace:
            raise HTTPException(status_code=404, detail="Marketplace não encontrado")
        return marketplace
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"Erro ao obter marketplace: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Erro ao obter marketplace: {str(e)}")
    finally:
        service.close()


@router.post("/")
async def create_marketplace(
    marketplace: MarketplaceCreate,
    service: MarketplaceService = Depends(get_marketplace_service)
):
    """Cria um novo marketplace."""
    try:
        result = service.create_marketplace(
            empresa_id=marketplace.empresa_id,
            nome=marketplace.nome,
            codigo=marketplace.codigo,
            descricao=marketplace.descricao
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        import traceback
        print(f"Erro ao criar marketplace: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Erro ao criar marketplace: {str(e)}")
    finally:
        service.close()


@router.put("/{marketplace_id}")
async def update_marketplace(
    marketplace_id: int,
    marketplace: MarketplaceUpdate,
    service: MarketplaceService = Depends(get_marketplace_service)
):
    """Atualiza um marketplace existente."""
    try:
        result = service.update_marketplace(
            marketplace_id=marketplace_id,
            nome=marketplace.nome,
            codigo=marketplace.codigo,
            descricao=marketplace.descricao,
            ativo=marketplace.ativo
        )
        if not result:
            raise HTTPException(status_code=404, detail="Marketplace não encontrado")
        return result
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"Erro ao atualizar marketplace: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Erro ao atualizar marketplace: {str(e)}")
    finally:
        service.close()


@router.delete("/{marketplace_id}")
async def delete_marketplace(
    marketplace_id: int,
    service: MarketplaceService = Depends(get_marketplace_service)
):
    """Remove um marketplace (soft delete)."""
    try:
        success = service.delete_marketplace(marketplace_id)
        if success:
            return {"success": True, "message": "Marketplace removido com sucesso"}
        else:
            raise HTTPException(status_code=404, detail="Marketplace não encontrado")
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"Erro ao remover marketplace: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Erro ao remover marketplace: {str(e)}")
    finally:
        service.close()

