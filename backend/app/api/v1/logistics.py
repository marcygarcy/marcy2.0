"""
API Logística (Physical Hub): receção e expedição no escritório.
POST /logistics/receive-items  – registar entrada de artigos de uma PO
POST /logistics/dispatch-item   – registar expedição para o cliente
GET  /logistics/events           – listar eventos (opcional)
GET  /logistics/po-for-office    – listar itens de PO por escritório (para UI)
"""
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.services.logistics_service import LogisticsManager

router = APIRouter(prefix="/logistics", tags=["logistics"])


class ReceiveItemRow(BaseModel):
    purchase_order_item_id: int
    quantity_received: float
    serial_number: Optional[str] = None
    imei: Optional[str] = None


class ReceiveItemsBody(BaseModel):
    purchase_order_id: int
    office_id: int
    items: List[ReceiveItemRow]
    created_by: Optional[str] = None


class DispatchItemBody(BaseModel):
    purchase_order_item_id: int
    office_id: int
    quantity: float
    tracking_number: Optional[str] = None
    carrier_name: Optional[str] = None
    carrier_status: Optional[str] = None
    created_by: Optional[str] = None


@router.post("/receive-items")
async def receive_items(body: ReceiveItemsBody) -> Dict[str, Any]:
    """
    O operador dá entrada de artigos físicos de uma Purchase Order consolidada.
    Valida quantidades recebidas vs. pedidas; regista eventos e atualiza quantidade_recebida / logistics_status.
    """
    svc = LogisticsManager()
    try:
        items_payload = [
            {
                "purchase_order_item_id": it.purchase_order_item_id,
                "quantity_received": it.quantity_received,
                "serial_number": it.serial_number,
                "imei": it.imei,
            }
            for it in body.items
        ]
        result = svc.receive_items(
            purchase_order_id=body.purchase_order_id,
            office_id=body.office_id,
            items=items_payload,
            created_by=body.created_by,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        svc.close()


@router.post("/dispatch-item")
async def dispatch_item(body: DispatchItemBody) -> Dict[str, Any]:
    """
    Regista a saída da mercadoria para o cliente; gera logistics_event de expedição.
    Placeholder: atualização de tracking na marketplace (retorno marketplace_update).
    """
    svc = LogisticsManager()
    try:
        result = svc.dispatch_item(
            purchase_order_item_id=body.purchase_order_item_id,
            office_id=body.office_id,
            quantity=body.quantity,
            tracking_number=body.tracking_number,
            carrier_name=body.carrier_name,
            carrier_status=body.carrier_status,
            created_by=body.created_by,
        )
        if not result.get("success"):
            raise HTTPException(status_code=400, detail=result.get("error", "Erro ao expedir"))
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        svc.close()


@router.get("/events")
async def get_logistics_events(
    purchase_order_id: Optional[int] = Query(None),
    office_id: Optional[int] = Query(None),
    limit: int = Query(100, ge=1, le=500),
) -> List[Dict[str, Any]]:
    """Lista eventos de logística por PO ou escritório."""
    svc = LogisticsManager()
    try:
        return svc.get_events(purchase_order_id=purchase_order_id, office_id=office_id, limit=limit)
    finally:
        svc.close()


@router.get("/po-for-office")
async def get_po_items_for_office(
    office_id: int = Query(...),
    empresa_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None, description="pending_receipt | received_at_office | dispatched_to_customer"),
) -> List[Dict[str, Any]]:
    """Lista itens de POs com tipo_envio=Escritorio para o escritório (interface de conferência)."""
    svc = LogisticsManager()
    try:
        return svc.get_po_items_for_office(office_id=office_id, empresa_id=empresa_id, status_filter=status)
    finally:
        svc.close()
