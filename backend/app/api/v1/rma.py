"""
v3.0 – API RMA: Reembolsos e alertas de Nota de Crédito.
"""
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Query

from app.services.refund_monitoring_service import RefundMonitoringService

router = APIRouter(prefix="/rma", tags=["rma"])


class RegisterRefundBody(dict):
    """Body para registar reembolso (RMA claim)."""
    pass


@router.post("/register-refund")
async def register_refund(body: Dict[str, Any]) -> Dict[str, Any]:
    """
    Regista um reembolso (quando banco ou marketplace indica reembolso).
    Cria um RMA claim em estado Pending.
    """
    svc = RefundMonitoringService()
    try:
        return svc.register_refund(
            empresa_id=body["empresa_id"],
            sales_order_id=body.get("sales_order_id"),
            sales_order_item_id=body.get("sales_order_item_id"),
            supplier_id=body.get("supplier_id"),
            refund_customer_value=float(body.get("refund_customer_value", 0)),
            reason=body.get("reason"),
            external_order_id=body.get("external_order_id"),
        )
    finally:
        svc.close()


@router.get("/alerts")
async def get_rma_alerts(
    empresa_id: Optional[int] = Query(None),
    days_without_credit_note: int = Query(7, ge=1, le=90),
) -> List[Dict[str, Any]]:
    """
    Alertas: reembolsos há mais de N dias sem Nota de Crédito do fornecedor.
    Para exibir na página inicial / dashboard.
    """
    svc = RefundMonitoringService()
    try:
        return svc.get_alerts(empresa_id=empresa_id, days_without_credit_note=days_without_credit_note)
    finally:
        svc.close()


@router.get("/pending")
async def get_pending_rma(
    empresa_id: Optional[int] = Query(None),
) -> List[Dict[str, Any]]:
    """Lista todos os RMA em estado Pending (para dashboard e listagens)."""
    svc = RefundMonitoringService()
    try:
        return svc.get_all_pending_rma(empresa_id=empresa_id)
    finally:
        svc.close()
