"""Endpoints do Módulo de Compras (Purchases): draft automático, consolidação, rentabilidade triangular."""
from fastapi import APIRouter, Query, Depends, HTTPException
from typing import List, Optional
from pydantic import BaseModel
from app.services.purchase_service import (
    SKUTranslatorService,
    OrderAggregatorService,
    TriangularProfitService,
    PurchaseOrderService,
    BulkPurchaseService,
)
from app.services.purchase_aggregator_service import PurchaseAggregatorService
from app.services.purchase_checkout_service import PurchaseCheckoutService
from app.services.accounting_match_service import AccountingMatchService
from app.api.deps import get_bulk_purchase_service, get_purchase_aggregator_service

router = APIRouter(prefix="/purchases", tags=["purchases"])


class SKUResolveResponse(BaseModel):
    sku_mapping_id: Optional[int]
    supplier_id: Optional[int]
    sku_fornecedor: Optional[str]
    custo_fornecedor: float
    nome_produto: Optional[str]
    supplier_nome: Optional[str]


class AggregateRequest(BaseModel):
    empresa_id: int
    order_ids: List[int]
    supplier_id: Optional[int] = None
    tipo_envio: str = "Escritorio"
    portes_totais: float = 0
    taxa_iva_pct: float = 0


class AggregateResponse(BaseModel):
    success: bool
    purchase_order_id: Optional[int] = None
    total_base: Optional[float] = None
    portes_totais: Optional[float] = None
    impostos: Optional[float] = None
    total_final: Optional[float] = None
    items_count: Optional[int] = None
    error: Optional[str] = None


@router.get("/sku-resolve", response_model=SKUResolveResponse)
async def resolve_sku(
    empresa_id: int = Query(...),
    sku_marketplace: str = Query(...),
    marketplace_id: Optional[int] = Query(None),
):
    """Dado SKU do marketplace, devolve fornecedor, SKU fornecedor e custo base (SKU Translator)."""
    svc = SKUTranslatorService()
    try:
        r = svc.resolve(empresa_id, sku_marketplace, marketplace_id)
        if not r:
            return SKUResolveResponse(custo_fornecedor=0)
        return SKUResolveResponse(**r)
    finally:
        svc.close()


@router.post("/aggregate", response_model=AggregateResponse)
async def create_purchase_order_from_sales(body: AggregateRequest):
    """
    Agrega várias vendas (order_ids) numa única purchase_order (Draft).
    Order Aggregator: consolidação 1:N com rateio de portes e IVA.
    """
    svc = OrderAggregatorService()
    try:
        result = svc.create_draft_from_sales(
            empresa_id=body.empresa_id,
            order_ids=body.order_ids,
            supplier_id=body.supplier_id,
            tipo_envio=body.tipo_envio,
            portes_totais=body.portes_totais,
            taxa_iva_pct=body.taxa_iva_pct,
        )
        return AggregateResponse(
            success=result["success"],
            purchase_order_id=result.get("purchase_order_id"),
            total_base=result.get("total_base"),
            portes_totais=result.get("portes_totais"),
            impostos=result.get("impostos"),
            total_final=result.get("total_final"),
            items_count=result.get("items_count"),
            error=result.get("error"),
        )
    finally:
        svc.close()


@router.get("/rentabilidade")
async def get_rentabilidade_triangular(
    empresa_id: Optional[int] = Query(None),
    purchase_order_id: Optional[int] = Query(None),
    order_id: Optional[int] = Query(None),
):
    """Vista de rentabilidade triangular: Venda vs Compra. Margem real por linha (com rateio se consolidado)."""
    svc = TriangularProfitService()
    try:
        rows = svc.get_rentabilidade(empresa_id=empresa_id, purchase_order_id=purchase_order_id, order_id=order_id)
        return {"items": rows}
    finally:
        svc.close()


@router.get("/orders")
async def list_purchase_orders(
    empresa_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    data_inicio: Optional[str] = Query(None, description="YYYY-MM-DD"),
    data_fim: Optional[str] = Query(None, description="YYYY-MM-DD"),
    invoice_state: Optional[str] = Query(
        None,
        description="Estado fatura/conciliação: fatura_em_falta, por_enviar_cc, na_conta_corrente, conciliado",
    ),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    with_invoice_status: bool = Query(False, description="Incluir estado fatura e has_ledger_entry"),
):
    """Lista ordens de compra (purchase_orders). Se with_invoice_status=true, inclui invoice_ref, invoice_amount, invoice_status, has_ledger_entry e is_reconciled."""
    svc = PurchaseOrderService()
    try:
        if with_invoice_status:
            items, total = svc.list_purchase_orders_with_invoice_status(
                empresa_id=empresa_id,
                status=status,
                invoice_state=invoice_state,
                limit=limit,
                offset=offset,
            )
        else:
            items, total = svc.list_purchase_orders(
                empresa_id=empresa_id, status=status,
                data_inicio=data_inicio, data_fim=data_fim,
                limit=limit, offset=offset,
            )
        return {"items": items, "total": total, "limit": limit, "offset": offset}
    finally:
        svc.close()


# Rotas com segmento extra primeiro (evitar 405 por match em GET /orders/{id})
@router.get("/orders/{purchase_order_id}/checkout-detail")
async def get_checkout_detail(
    purchase_order_id: int,
    portes: Optional[float] = Query(None),
    taxas_pagamento: Optional[float] = Query(None),
):
    """v3.5: Detalhe para Checkout Inteligente (custos, IVA por regime, margem, moradas)."""
    svc = PurchaseCheckoutService()
    try:
        detail = svc.get_checkout_detail(purchase_order_id, portes_override=portes, taxas_pagamento_override=taxas_pagamento)
        if not detail:
            raise HTTPException(status_code=404, detail="Ordem de compra não encontrada")
        return detail
    finally:
        svc.close()


class PoTotalsBody(BaseModel):
    portes_totais: float = 0
    taxas_pagamento: float = 0
    total_final: Optional[float] = None
    valor_base_artigos: Optional[float] = None
    iva_total: Optional[float] = None


@router.patch("/orders/{purchase_order_id}/totals")
async def update_po_totals(purchase_order_id: int, body: PoTotalsBody):
    """v3.5: Atualiza totais da PO (portes, taxas, total; opcionalmente valor base e IVA quando fornecedor alterado)."""
    svc = PurchaseCheckoutService()
    try:
        result = svc.update_po_totals(
            purchase_order_id,
            body.portes_totais,
            body.taxas_pagamento,
            total_final_override=body.total_final,
            valor_base_override=body.valor_base_artigos,
            iva_total_override=body.iva_total,
        )
        if not result.get("success"):
            raise HTTPException(status_code=400, detail=result.get("error", "Erro ao atualizar"))
        return result
    finally:
        svc.close()


class SetSupplierBody(BaseModel):
    supplier_id: int


@router.patch("/orders/{purchase_order_id}/supplier")
async def set_po_supplier(purchase_order_id: int, body: SetSupplierBody):
    """Altera o fornecedor da PO (para o checkout: escolher outro fornecedor que não o proposto)."""
    svc = PurchaseCheckoutService()
    try:
        result = svc.set_po_supplier(purchase_order_id, body.supplier_id)
        if not result.get("success"):
            raise HTTPException(status_code=400, detail=result.get("error", "Erro ao alterar fornecedor"))
        return result
    finally:
        svc.close()


class FinalizePoBody(BaseModel):
    supplier_order_id: Optional[str] = None
    portes_totais: Optional[float] = None
    taxas_pagamento: Optional[float] = None
    total_final: Optional[float] = None
    valor_base_artigos: Optional[float] = None
    iva_total: Optional[float] = None


@router.post("/orders/{purchase_order_id}/finalize")
async def finalize_po(purchase_order_id: int, body: Optional[FinalizePoBody] = None):
    """v3.5: Grava totais (opcional; incl. base e IVA quando fornecedor alterado), regista ID fornecedor e move PO para Ordered."""
    svc = PurchaseCheckoutService()
    try:
        b = body or FinalizePoBody()
        result = svc.finalize_po(
            purchase_order_id,
            supplier_order_id=b.supplier_order_id,
            portes_totais=b.portes_totais,
            taxas_pagamento=b.taxas_pagamento,
            total_final=b.total_final,
            valor_base_artigos=b.valor_base_artigos,
            iva_total=b.iva_total,
        )
        return result
    finally:
        svc.close()


class RegisterInvoiceBody(BaseModel):
    """Registar fatura na PO e opcionalmente enviar para conta corrente."""
    invoice_ref: Optional[str] = None
    invoice_amount: Optional[float] = None
    post_to_ledger: bool = True


@router.patch("/orders/{purchase_order_id}/invoice")
async def register_po_invoice(purchase_order_id: int, body: RegisterInvoiceBody):
    """
    Regista ref e valor da fatura na PO. Se post_to_ledger=true, cria lançamento
    'Fatura' na conta corrente do fornecedor (se ainda não existir).
    """
    po_svc = PurchaseOrderService()
    try:
        updated = po_svc.update_invoice(
            purchase_order_id,
            invoice_ref=body.invoice_ref,
            invoice_amount=body.invoice_amount,
        )
        if not updated:
            raise HTTPException(status_code=404, detail="Ordem de compra não encontrada")
        ledger_created = False
        if body.post_to_ledger:
            acct = AccountingMatchService()
            try:
                existing = acct.conn.execute(
                    "SELECT 1 FROM supplier_ledger WHERE purchase_order_id = ? AND tipo = 'Fatura' LIMIT 1",
                    [purchase_order_id],
                ).fetchone()
                if not existing:
                    valor = body.invoice_amount if body.invoice_amount is not None else updated["total_final"]
                    acct.create_ledger_entry(
                        empresa_id=updated["empresa_id"],
                        supplier_id=updated["supplier_id"],
                        tipo="Fatura",
                        valor_credito=float(valor or 0),
                        documento_ref=body.invoice_ref or f"PO #{purchase_order_id}",
                        purchase_order_id=purchase_order_id,
                        notas="Fatura registada manualmente (match PO)",
                    )
                    ledger_created = True
            finally:
                acct.close()
        return {
            "success": True,
            "purchase_order_id": purchase_order_id,
            "invoice_ref": body.invoice_ref,
            "invoice_amount": body.invoice_amount,
            "ledger_created": ledger_created,
        }
    finally:
        po_svc.close()


class UpdateStatusBody(BaseModel):
    status: str


@router.patch("/orders/{purchase_order_id}")
async def update_purchase_order_status(purchase_order_id: int, body: UpdateStatusBody):
    """Atualiza status da ordem de compra (Draft, Ordered, Paid)."""
    svc = PurchaseOrderService()
    try:
        ok = svc.update_status(purchase_order_id, body.status)
        if not ok:
            raise HTTPException(status_code=400, detail="Status inválido. Use Draft, Ordered ou Paid.")
        return {"success": True, "status": body.status}
    finally:
        svc.close()


@router.get("/orders/{purchase_order_id}")
async def get_purchase_order(purchase_order_id: int):
    """Detalhe de uma ordem de compra com itens."""
    svc = PurchaseOrderService()
    try:
        po = svc.get_purchase_order_detail(purchase_order_id)
        if not po:
            raise HTTPException(status_code=404, detail="Ordem de compra não encontrada")
        return po
    finally:
        svc.close()


@router.get("/pending-sales")
async def get_pending_sales(empresa_id: int = Query(...), limit: int = Query(500, ge=1, le=1000)):
    """Vendas (orders) que ainda não estão em nenhuma ordem de compra (por empresa)."""
    svc = PurchaseOrderService()
    try:
        items = svc.get_pending_sales_orders(empresa_id=empresa_id, limit=limit)
        return {"items": items}
    finally:
        svc.close()


# --- Fase 3: Central de Compras (pending_purchase_items -> POs por empresa/fornecedor) ---


class ConsolidateBody(BaseModel):
    pending_item_ids: List[int]
    portes_totais: float = 0
    taxa_iva_pct: float = 0


@router.get("/pending")
async def get_pending_for_cockpit(
    supplier_id: Optional[int] = Query(None, description="Filtrar por fornecedor"),
    limit: int = Query(2000, ge=1, le=5000),
    service: PurchaseAggregatorService = Depends(get_purchase_aggregator_service),
):
    """Lista consolidada de pending_purchase_items (todas as empresas) para o Cockpit. Agrupar por fornecedor no frontend."""
    try:
        items = service.list_pending_for_cockpit(supplier_id=supplier_id, limit=limit)
        return {"items": items}
    finally:
        service.close()


@router.post("/consolidate")
async def consolidate_purchases(
    body: ConsolidateBody,
    service: PurchaseAggregatorService = Depends(get_purchase_aggregator_service),
):
    """
    Recebe IDs de pending_purchase_items e executa o Split Fiscal.
    Agrupa por (empresa_id, supplier_id) e cria uma PO por grupo. Atualiza status dos itens para 'ordered'.
    """
    try:
        result = service.create_pos_from_pending(
            pending_item_ids=body.pending_item_ids,
            portes_totais=body.portes_totais,
            taxa_iva_pct=body.taxa_iva_pct,
        )
        return result
    finally:
        service.close()


@router.get("/drafts")
async def get_drafts(
    empresa_id: Optional[int] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    service: PurchaseAggregatorService = Depends(get_purchase_aggregator_service),
):
    """Lista de POs em estado Draft para o operador executar no site do fornecedor (Wizard de Checkout)."""
    try:
        items, total = service.list_drafts(empresa_id=empresa_id, limit=limit, offset=offset)
        return {"items": items, "total": total, "limit": limit, "offset": offset}
    finally:
        service.close()


# --- Global Cockpit & Bulk Prepare (múltiplas empresas, baseado em orders) ---

@router.get("/global-pending")
async def get_global_pending(
    supplier_id: Optional[int] = Query(None, description="Filtrar por fornecedor"),
    limit: int = Query(1000, ge=1, le=2000),
    service: BulkPurchaseService = Depends(get_bulk_purchase_service),
):
    """Lista vendas pendentes de todas as empresas, agrupáveis por fornecedor (Global Cockpit)."""
    try:
        items = service.get_global_pending(supplier_id=supplier_id, limit=limit)
        return {"items": items}
    finally:
        service.close()


class PrepareBulkBody(BaseModel):
    order_ids: List[int]
    portes_totais: float = 0
    taxa_iva_pct: float = 0
    tipo_envio: str = "Escritorio"


@router.post("/prepare-bulk")
async def prepare_bulk_purchases(
    body: PrepareBulkBody,
    service: BulkPurchaseService = Depends(get_bulk_purchase_service),
):
    """
    Seleção global -> múltiplas POs (uma por empresa_id).
    Agrupa order_ids por empresa e fornecedor, cria uma PO por grupo com dados fiscais.
    """
    try:
        result = service.prepare_bulk_purchases(
            order_ids=body.order_ids,
            portes_totais=body.portes_totais,
            taxa_iva_pct=body.taxa_iva_pct,
            tipo_envio=body.tipo_envio,
        )
        return result
    finally:
        service.close()


@router.get("/sale-state")
async def get_sale_state(
    empresa_id: Optional[int] = Query(None),
    limit: int = Query(500, ge=1, le=2000),
    service: BulkPurchaseService = Depends(get_bulk_purchase_service),
):
    """BI: estado de cada venda (Vendido | Em Processamento de Compra | Comprado (PO #123))."""
    try:
        items = service.get_sale_state_list(empresa_id=empresa_id, limit=limit)
        return {"items": items}
    finally:
        service.close()


class SetSupplierOrderIdBody(BaseModel):
    supplier_order_id: str


@router.patch("/orders/{purchase_order_id}/supplier-order-id")
async def set_supplier_order_id(
    purchase_order_id: int,
    body: SetSupplierOrderIdBody,
):
    """Regista o ID da encomenda no site do fornecedor (após checkout)."""
    svc = PurchaseOrderService()
    try:
        svc.update_supplier_order_id(purchase_order_id, body.supplier_order_id)
        return {"success": True, "supplier_order_id": body.supplier_order_id}
    finally:
        svc.close()
