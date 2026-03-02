"""
API: Stock em escritório (origem cancelamentos). Listar e consumir para reutilização.
"""
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel

from app.services.office_stock_service import OfficeStockService

router = APIRouter(prefix="/office-stock", tags=["office-stock"])


class ConsumeStockBody(BaseModel):
    quantity: float
    sales_order_id: int
    sales_order_item_id: Optional[int] = None


@router.get("", response_model=List[Dict[str, Any]])
async def list_office_stock(
    empresa_id: Optional[int] = Query(None),
    office_id: Optional[int] = Query(None),
    sku: Optional[str] = Query(None),
    status: Optional[str] = Query(None, description="available | reserved | consumed"),
    limit: int = Query(200, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    """Lista stock em escritório (origem: cancelamentos). Filtros por empresa, escritório, SKU, status."""
    svc = OfficeStockService()
    try:
        return svc.list_stock(
            empresa_id=empresa_id,
            office_id=office_id,
            sku=sku,
            status=status,
            limit=limit,
            offset=offset,
        )
    finally:
        svc.close()


@router.get("/available-by-sku", response_model=List[Dict[str, Any]])
async def get_available_by_sku(
    empresa_id: int = Query(..., description="ID da empresa"),
    sku_marketplace: str = Query(..., description="SKU no marketplace"),
    office_id: Optional[int] = Query(None),
):
    """Devolve linhas de stock disponíveis para um SKU (para sugerir uso em novo pedido)."""
    svc = OfficeStockService()
    try:
        return svc.get_available_by_sku(
            empresa_id=empresa_id,
            sku_marketplace=sku_marketplace,
            office_id=office_id,
        )
    finally:
        svc.close()


@router.post("/{office_stock_id}/consume")
async def consume_stock(office_stock_id: int, body: ConsumeStockBody):
    """Consome quantidade de uma linha de office_stock e associa ao pedido (reutilização)."""
    svc = OfficeStockService()
    try:
        result = svc.consume_stock(
            office_stock_id=office_stock_id,
            quantity=body.quantity,
            sales_order_id=body.sales_order_id,
            sales_order_item_id=body.sales_order_item_id,
        )
        if not result.get("success"):
            raise HTTPException(status_code=400, detail=result.get("error", "Erro ao consumir stock"))
        return result
    finally:
        svc.close()
