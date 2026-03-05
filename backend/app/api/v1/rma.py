"""
v3.0 – API RMA: Reembolsos, alertas de Nota de Crédito e fluxo Incidências (Compras → Logística → Contabilidade).
"""
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Query

from app.services.refund_monitoring_service import RefundMonitoringService
from app.services.incident_service import IncidentService

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


# ── Incidências (workflow por fase) ─────────────────────────────────────────

@router.get("/incidents")
async def list_incidents_by_phase(
    phase: str,
    empresa_id: Optional[int] = Query(None),
) -> List[Dict[str, Any]]:
    """
    Lista incidências por fase: intervencao_compras | reembolsos_pendentes | logistica_intercecao | auto_resolvida | perda_assumida.
    """
    svc = IncidentService()
    try:
        return svc.list_by_phase(phase=phase, empresa_id=empresa_id)
    finally:
        svc.close()


@router.post("/incidents/{incident_id}/fornecedor-aceitou")
async def incident_fornecedor_aceitou(
    incident_id: int,
    body: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Ação: Fornecedor Aceitou cancelamento.
    body: { "payment_was_made": bool } — true se o pagamento já foi feito (→ Reembolsos Pendentes), false → bloqueia PO e auto-resolve.
    """
    payment_was_made = bool(body.get("payment_was_made", False))
    svc = IncidentService()
    try:
        return svc.fornecedor_aceitou(incident_id=incident_id, payment_was_made=payment_was_made)
    finally:
        svc.close()


@router.post("/incidents/{incident_id}/fornecedor-recusou")
async def incident_fornecedor_recusou(incident_id: int) -> Dict[str, Any]:
    """Ação: Fornecedor Recusou → move para Logística (Interceção)."""
    svc = IncidentService()
    try:
        return svc.fornecedor_recusou(incident_id=incident_id)
    finally:
        svc.close()


@router.post("/incidents/{incident_id}/registar-nc")
async def incident_registar_nc(
    incident_id: int,
    body: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Regista Nota de Crédito do fornecedor.
    body: { "numero_nc": str, "valor": float, "tipo": "transferencia" | "credito_conta" }.
    """
    svc = IncidentService()
    try:
        return svc.registar_nc(
            incident_id=incident_id,
            numero_nc=str(body.get("numero_nc", "")).strip(),
            valor=float(body.get("valor", 0)),
            tipo=str(body.get("tipo", "credito_conta")).strip().lower() or "credito_conta",
        )
    finally:
        svc.close()


@router.post("/incidents/{incident_id}/intercecao-sucesso")
async def incident_intercecao_sucesso(incident_id: int) -> Dict[str, Any]:
    """Ação: Interceção com sucesso – mercadoria a voltar ao armazém."""
    svc = IncidentService()
    try:
        return svc.intercecao_sucesso(incident_id=incident_id)
    finally:
        svc.close()


@router.post("/incidents/{incident_id}/perda-assumida")
async def incident_perda_assumida(
    incident_id: int,
    body: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Ação: Perda assumida (cliente recebeu). Regista imparidade e afeta P&L.
    body opcional: { "valor_imparidade": float } — se omitido, usa total da PO.
    """
    body = body or {}
    valor = body.get("valor_imparidade")
    svc = IncidentService()
    try:
        return svc.perda_assumida(incident_id=incident_id, valor_imparidade=valor)
    finally:
        svc.close()
