"""Endpoints do Módulo de Vendas (Sales & Orders) para Dropshipping."""
import io
import tempfile
from pathlib import Path
from fastapi import APIRouter, Depends, Query, UploadFile, File, Form, HTTPException, Body
from fastapi.responses import StreamingResponse
from typing import List, Optional, Any, Dict
from pydantic import BaseModel
import pandas as pd
from app.services.sales_service import SalesService
from app.services.sales_module_service import SalesModuleService
from app.services.universal_sales_ingestor import UniversalSalesIngestor
from app.services.cancellation_service import CancellationService
from app.api.deps import get_sales_service, get_sales_module_service

router = APIRouter(prefix="/sales", tags=["sales"])


class OrderWithMargin(BaseModel):
    """Linha de venda com margem calculada."""
    id: int
    numero_pedido: Optional[str] = None
    data_criacao: Optional[str] = None
    empresa_id: Optional[int] = None
    marketplace_id: Optional[int] = None
    sku_oferta: Optional[str] = None
    nome_produto: Optional[str] = None
    quantidade: Optional[float] = None
    valor_total_com_iva: Optional[float] = None
    iva_total: Optional[float] = None
    comissao_sem_impostos: Optional[float] = None
    valor_transferido_loja: Optional[float] = None
    custo_fornecedor: Optional[float] = None
    gastos_envio: Optional[float] = None
    outras_taxas: Optional[float] = None
    status_operacional: Optional[str] = None
    status: Optional[str] = None
    canal_vendas: Optional[str] = None
    margem_total_linha: Optional[float] = None


class SalesListResponse(BaseModel):
    """Resposta da listagem de vendas com margem."""
    orders: List[OrderWithMargin]
    total: int
    limit: int
    offset: int


class SalesMetricsResponse(BaseModel):
    """Métricas de vendas (GMV, margem, etc.)."""
    gmv: float
    vendas_sem_iva: float
    total_comissao: float
    num_linhas: int
    margem_contribuicao_total: float
    margem_pct: float


class TopProduct(BaseModel):
    """Produto no ranking de rentabilidade."""
    sku: str
    nome_produto: str
    quantidade_vendida: float
    gmv_produto: float
    margem_total: float


@router.get("/orders", response_model=SalesListResponse)
async def list_sales_with_margin(
    empresa_id: Optional[int] = Query(None, description="Filtrar por empresa"),
    marketplace_id: Optional[int] = Query(None, description="Filtrar por marketplace"),
    data_inicio: Optional[str] = Query(None, description="Data início (YYYY-MM-DD)"),
    data_fim: Optional[str] = Query(None, description="Data fim (YYYY-MM-DD)"),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    service: SalesService = Depends(get_sales_service),
):
    """Lista vendas (orders) com margem calculada por linha. Multi-tenant e período."""
    try:
        orders, total = service.get_orders_with_margin(
            empresa_id=empresa_id,
            marketplace_id=marketplace_id,
            data_inicio=data_inicio,
            data_fim=data_fim,
            limit=limit,
            offset=offset,
        )
        items = [
            OrderWithMargin(
                id=o["id"],
                numero_pedido=o.get("numero_pedido"),
                data_criacao=str(o["data_criacao"]) if o.get("data_criacao") else None,
                empresa_id=o.get("empresa_id"),
                marketplace_id=o.get("marketplace_id"),
                sku_oferta=o.get("sku_oferta"),
                nome_produto=o.get("nome_produto"),
                quantidade=o.get("quantidade"),
                valor_total_com_iva=o.get("valor_total_com_iva"),
                iva_total=o.get("iva_total"),
                comissao_sem_impostos=o.get("comissao_sem_impostos"),
                valor_transferido_loja=o.get("valor_transferido_loja"),
                custo_fornecedor=o.get("custo_fornecedor"),
                gastos_envio=o.get("gastos_envio"),
                outras_taxas=o.get("outras_taxas"),
                status_operacional=o.get("status_operacional"),
                status=o.get("status"),
                canal_vendas=o.get("canal_vendas"),
                margem_total_linha=o.get("margem_total_linha"),
            )
            for o in orders
        ]
        return SalesListResponse(orders=items, total=total, limit=limit, offset=offset)
    finally:
        service.close()


@router.get("/metrics", response_model=SalesMetricsResponse)
async def get_sales_metrics(
    empresa_id: Optional[int] = Query(None),
    marketplace_id: Optional[int] = Query(None),
    data_inicio: Optional[str] = Query(None, description="YYYY-MM-DD"),
    data_fim: Optional[str] = Query(None, description="YYYY-MM-DD"),
    service: SalesService = Depends(get_sales_service),
):
    """GMV, Margem de Contribuição Total e número de linhas. Filtros multi-tenant e período."""
    try:
        m = service.get_sales_metrics(
            empresa_id=empresa_id,
            marketplace_id=marketplace_id,
            data_inicio=data_inicio,
            data_fim=data_fim,
        )
        return SalesMetricsResponse(**m)
    finally:
        service.close()


@router.get("/top-products", response_model=List[TopProduct])
async def get_top_products(
    empresa_id: Optional[int] = Query(None),
    marketplace_id: Optional[int] = Query(None),
    data_inicio: Optional[str] = Query(None),
    data_fim: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    service: SalesService = Depends(get_sales_service),
):
    """Ranking de produtos (SKU) mais rentáveis por margem total."""
    try:
        rows = service.get_top_products(
            empresa_id=empresa_id,
            marketplace_id=marketplace_id,
            data_inicio=data_inicio,
            data_fim=data_fim,
            limit=limit,
        )
        return [TopProduct(**r) for r in rows]
    finally:
        service.close()


# --- Módulo Sales (sales_orders / sales_order_items): import, list, stats ---

class SalesOrderListItem(BaseModel):
    id: int
    empresa_id: Optional[int] = None
    external_order_id: Optional[str] = None
    marketplace_id: Optional[int] = None
    order_date: Optional[str] = None
    import_date: Optional[str] = None
    status: Optional[str] = None
    customer_country: Optional[str] = None
    currency: Optional[str] = None
    total_gross: Optional[float] = None
    total_commission_fixed: Optional[float] = None
    total_commission_percent: Optional[float] = None
    total_net_value: Optional[float] = None
    marketplace_nome: Optional[str] = None
    shipping_status: Optional[str] = None
    carrier_name: Optional[str] = None
    tracking_number: Optional[str] = None
    carrier_status: Optional[str] = None
    shipped_at: Optional[str] = None
    # Enriquecimento: PO + margem
    purchase_order_id: Optional[int] = None
    po_status: Optional[str] = None
    supplier_nome: Optional[str] = None
    lucro_previsto: Optional[float] = None
    margem_pct: Optional[float] = None


class SalesOrderItemDetail(BaseModel):
    id: int
    sku_marketplace: Optional[str] = None
    internal_sku: Optional[str] = None
    quantity: Optional[float] = None
    unit_price: Optional[float] = None
    vat_rate: Optional[float] = None
    linha_gross: Optional[float] = None
    nome_produto: Optional[str] = None
    custo_fornecedor: Optional[float] = None


class SalesOrderPODetail(BaseModel):
    id: int
    status: Optional[str] = None
    invoice_ref: Optional[str] = None
    total_final: Optional[float] = None
    supplier_nome: Optional[str] = None
    supplier_id: Optional[int] = None
    data_criacao: Optional[str] = None
    due_date: Optional[str] = None


class SalesOrderDetail(BaseModel):
    id: int
    empresa_id: Optional[int] = None
    empresa_nome: Optional[str] = None
    external_order_id: Optional[str] = None
    marketplace_id: Optional[int] = None
    marketplace_nome: Optional[str] = None
    order_date: Optional[str] = None
    status: Optional[str] = None
    customer_country: Optional[str] = None
    currency: Optional[str] = None
    total_gross: Optional[float] = None
    total_commission_fixed: Optional[float] = None
    total_commission_percent: Optional[float] = None
    total_net_value: Optional[float] = None
    shipping_status: Optional[str] = None
    carrier_name: Optional[str] = None
    tracking_number: Optional[str] = None
    carrier_status: Optional[str] = None
    shipped_at: Optional[str] = None
    customer_name: Optional[str] = None
    customer_address: Optional[str] = None
    customer_nif: Optional[str] = None
    lucro_previsto: Optional[float] = None
    custo_previsto: Optional[float] = None
    margem_pct: Optional[float] = None
    items_sem_mapping: Optional[int] = None
    items: List[SalesOrderItemDetail] = []
    purchase_orders: List[SalesOrderPODetail] = []


class SalesListModuleResponse(BaseModel):
    items: List[SalesOrderListItem]
    total: int
    limit: int
    offset: int


class SalesStatsResponse(BaseModel):
    num_orders: int
    gmv: float
    total_commission_fixed: float
    total_commission_percent: float
    avg_commission_rate_pct: float
    total_net_value: float
    lucro_previsto: float = 0.0


class SalesImportResponse(BaseModel):
    success: bool
    error: Optional[str] = None
    sales_orders_created: int = 0
    sales_order_items_created: int = 0
    orders_trigger_created: int = 0


@router.post("/import", response_model=SalesImportResponse)
async def sales_import(
    file: UploadFile = File(...),
    empresa_id: int = Form(...),
    marketplace_id: Optional[int] = Form(None),
    marketplace_code: Optional[str] = Form(None),
    service: SalesModuleService = Depends(get_sales_module_service),
):
    """Importa ficheiro de vendas: normaliza para sales_orders + sales_order_items e dispara gatilho de compras."""
    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xls", ".csv")):
        raise HTTPException(status_code=400, detail="Formato não suportado. Use XLSX, XLS ou CSV.")
    with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = Path(tmp.name)
    try:
        result = service.import_orders(
            tmp_path,
            empresa_id=empresa_id,
            marketplace_id=marketplace_id,
            marketplace_code=marketplace_code,
        )
        return SalesImportResponse(
            success=result.get("success", False),
            error=result.get("error"),
            sales_orders_created=result.get("sales_orders_created", 0),
            sales_order_items_created=result.get("sales_order_items_created", 0),
            orders_trigger_created=result.get("orders_trigger_created", 0),
        )
    finally:
        tmp_path.unlink(missing_ok=True)
        service.close()


class SalesImportJsonBody(BaseModel):
    empresa_id: int
    marketplace_id: Optional[int] = None
    items: List[Dict[str, Any]]


@router.post("/import/json", response_model=SalesImportResponse)
async def sales_import_json(body: SalesImportJsonBody):
    """Importa vendas a partir de JSON (ex.: API Worten/Amazon). Normalização automática de colunas (OrderNo, SKU, etc.)."""
    ingestor = UniversalSalesIngestor()
    result = ingestor.ingest_from_payload(
        payload=body.items,
        empresa_id=body.empresa_id,
        marketplace_id=body.marketplace_id,
    )
    return SalesImportResponse(
        success=result.get("success", False),
        error=result.get("error"),
        sales_orders_created=result.get("sales_orders_created", 0),
        sales_order_items_created=result.get("sales_order_items_created", 0),
        orders_trigger_created=result.get("orders_trigger_created", 0),
    )


@router.get("/list", response_model=SalesListModuleResponse)
async def sales_list(
    empresa_id: Optional[int] = Query(None),
    marketplace_id: Optional[int] = Query(None),
    customer_country: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    data_inicio: Optional[str] = Query(None, description="YYYY-MM-DD"),
    data_fim: Optional[str] = Query(None, description="YYYY-MM-DD"),
    only_without_proforma: Optional[bool] = Query(None, description="Apenas vendas sem proforma emitida"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    service: SalesModuleService = Depends(get_sales_module_service),
):
    """Lista sales_orders com filtros (empresa, marketplace, país, status, período)."""
    try:
        items, total = service.list_sales(
            empresa_id=empresa_id,
            marketplace_id=marketplace_id,
            customer_country=customer_country,
            status=status,
            data_inicio=data_inicio,
            data_fim=data_fim,
            only_without_proforma=only_without_proforma or False,
            limit=limit,
            offset=offset,
        )
        out = [
            SalesOrderListItem(
                id=r["id"],
                empresa_id=r.get("empresa_id"),
                external_order_id=r.get("external_order_id"),
                marketplace_id=r.get("marketplace_id"),
                order_date=str(r["order_date"]) if r.get("order_date") else None,
                import_date=str(r["import_date"]) if r.get("import_date") else None,
                status=r.get("status"),
                customer_country=r.get("customer_country"),
                currency=r.get("currency"),
                total_gross=r.get("total_gross"),
                total_commission_fixed=r.get("total_commission_fixed"),
                total_commission_percent=r.get("total_commission_percent"),
                total_net_value=r.get("total_net_value"),
                marketplace_nome=r.get("marketplace_nome"),
                shipping_status=r.get("shipping_status"),
                carrier_name=r.get("carrier_name"),
                tracking_number=r.get("tracking_number"),
                carrier_status=r.get("carrier_status"),
                shipped_at=str(r["shipped_at"]) if r.get("shipped_at") else None,
                purchase_order_id=r.get("purchase_order_id"),
                po_status=r.get("po_status"),
                supplier_nome=r.get("supplier_nome"),
                lucro_previsto=r.get("lucro_previsto"),
                margem_pct=r.get("margem_pct"),
            )
            for r in items
        ]
        return SalesListModuleResponse(items=out, total=total, limit=limit, offset=offset)
    finally:
        service.close()


@router.get("/orders/{sales_order_id}", response_model=SalesOrderDetail)
async def sales_order_detail(
    sales_order_id: int,
    service: SalesModuleService = Depends(get_sales_module_service),
):
    """Detalhe completo de uma sales_order: linhas, POs associadas, margem e info de cliente."""
    try:
        detail = service.get_order_detail(sales_order_id)
        if not detail:
            raise HTTPException(status_code=404, detail="Order não encontrada.")
        return SalesOrderDetail(
            id=detail["id"],
            empresa_id=detail.get("empresa_id"),
            empresa_nome=detail.get("empresa_nome"),
            external_order_id=detail.get("external_order_id"),
            marketplace_id=detail.get("marketplace_id"),
            marketplace_nome=detail.get("marketplace_nome"),
            order_date=detail.get("order_date"),
            status=detail.get("status"),
            customer_country=detail.get("customer_country"),
            currency=detail.get("currency"),
            total_gross=detail.get("total_gross"),
            total_commission_fixed=detail.get("total_commission_fixed"),
            total_commission_percent=detail.get("total_commission_percent"),
            total_net_value=detail.get("total_net_value"),
            shipping_status=detail.get("shipping_status"),
            carrier_name=detail.get("carrier_name"),
            tracking_number=detail.get("tracking_number"),
            carrier_status=detail.get("carrier_status"),
            shipped_at=str(detail["shipped_at"])[:10] if detail.get("shipped_at") else None,
            customer_name=detail.get("customer_name"),
            customer_address=detail.get("customer_address"),
            customer_nif=detail.get("customer_nif"),
            lucro_previsto=detail.get("lucro_previsto"),
            custo_previsto=detail.get("custo_previsto"),
            margem_pct=detail.get("margem_pct"),
            items_sem_mapping=detail.get("items_sem_mapping", 0),
            items=[SalesOrderItemDetail(**i) for i in detail.get("items", [])],
            purchase_orders=[SalesOrderPODetail(**p) for p in detail.get("purchase_orders", [])],
        )
    finally:
        service.close()


@router.get("/export")
async def sales_export(
    empresa_id: Optional[int] = Query(None),
    marketplace_id: Optional[int] = Query(None),
    customer_country: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    data_inicio: Optional[str] = Query(None),
    data_fim: Optional[str] = Query(None),
    ids: Optional[str] = Query(None, description="IDs separados por vírgula (opcional, para exportar seleção)"),
    service: SalesModuleService = Depends(get_sales_module_service),
):
    """Exporta sales_orders para Excel (.xlsx). Se ids fornecido, exporta apenas esses."""
    try:
        items, _ = service.list_sales(
            empresa_id=empresa_id,
            marketplace_id=marketplace_id,
            customer_country=customer_country,
            status=status,
            data_inicio=data_inicio,
            data_fim=data_fim,
            limit=5000,
            offset=0,
        )
        if ids:
            id_set = {int(x) for x in ids.split(",") if x.strip().isdigit()}
            items = [r for r in items if r["id"] in id_set]

        rows = []
        for r in items:
            rows.append({
                "Pedido": r.get("external_order_id") or f"#{r['id']}",
                "Canal": r.get("marketplace_nome") or "",
                "Data": str(r.get("order_date") or "")[:10],
                "País": r.get("customer_country") or "",
                "Estado": r.get("status") or "",
                "Bruto (€)": r.get("total_gross"),
                "Comissão Fixa (€)": r.get("total_commission_fixed"),
                "Comissão % (€)": r.get("total_commission_percent"),
                "Líquido (€)": r.get("total_net_value"),
                "Lucro Previsto (€)": r.get("lucro_previsto"),
                "Margem (%)": r.get("margem_pct"),
                "PO #": r.get("purchase_order_id"),
                "Estado PO": r.get("po_status") or "",
                "Fornecedor": r.get("supplier_nome") or "",
                "Estado Envio": r.get("shipping_status") or "",
                "Transportadora": r.get("carrier_name") or "",
                "Tracking": r.get("tracking_number") or "",
                "Estado Transportadora": r.get("carrier_status") or "",
            })

        df = pd.DataFrame(rows)
        buf = io.BytesIO()
        with pd.ExcelWriter(buf, engine="openpyxl") as writer:
            df.to_excel(writer, index=False, sheet_name="Vendas")
        buf.seek(0)
        filename = f"vendas_export.xlsx"
        return StreamingResponse(
            buf,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    finally:
        service.close()


@router.get("/stats", response_model=SalesStatsResponse)
async def sales_stats(
    empresa_id: Optional[int] = Query(None),
    marketplace_id: Optional[int] = Query(None),
    data_inicio: Optional[str] = Query(None, description="YYYY-MM-DD"),
    data_fim: Optional[str] = Query(None, description="YYYY-MM-DD"),
    service: SalesModuleService = Depends(get_sales_module_service),
):
    """KPIs: GMV, comissões e Lucro Previsto acumulado por empresa (venda - comissão - custo mapeado)."""
    try:
        s = service.get_stats(
            empresa_id=empresa_id,
            marketplace_id=marketplace_id,
            data_inicio=data_inicio,
            data_fim=data_fim,
        )
        return SalesStatsResponse(**s)
    finally:
        service.close()


class RecentWithMarginItem(BaseModel):
    sales_order_id: int
    external_order_id: Optional[str] = None
    empresa_id: Optional[int] = None
    marketplace_id: Optional[int] = None
    order_date: Optional[str] = None
    total_gross: Optional[float] = None
    total_net_value: Optional[float] = None
    sales_order_item_id: Optional[int] = None
    sku_marketplace: Optional[str] = None
    internal_sku: Optional[str] = None
    qty: Optional[float] = None
    unit_price: Optional[float] = None
    linha_gross: Optional[float] = None
    cost_price_base: Optional[float] = None
    custo_previsto_linha: Optional[float] = None
    lucro_previsto_linha: Optional[float] = None
    mapping_em_falta: Optional[int] = None


@router.get("/recent-with-margin", response_model=List[RecentWithMarginItem])
async def sales_recent_with_margin(
    empresa_id: Optional[int] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    service: SalesModuleService = Depends(get_sales_module_service),
):
    """Vendas recentes com Lucro Previsto por linha e indicador Mapping em falta (para ecrã Vendas Recentes)."""
    try:
        items = service.get_recent_with_margin(empresa_id=empresa_id, limit=limit)
        return [RecentWithMarginItem(**r) for r in items]
    finally:
        service.close()


class CancelSaleBody(BaseModel):
    """Body para cancelar venda: motivo, se fornecedor aceita devolução, emitir NC ao cliente."""
    reason: str = "Cliente cancelou"
    supplier_accepts_return: bool = False
    create_credit_note: bool = True
    refund_customer_value: Optional[float] = None


@router.post("/orders/{sales_order_id}/cancel")
async def cancel_sale(sales_order_id: int, body: CancelSaleBody):
    """
    Cancela uma venda: atualiza status, emite Nota de Crédito ao cliente (opcional),
    cria RMA com disposition (stock_we_keep ou return_to_supplier) e, se ficarmos com a mercadoria,
    cria linhas em office_stock para itens no escritório não expedidos.
    """
    svc = CancellationService()
    try:
        result = svc.cancel_sale(
            sales_order_id=sales_order_id,
            reason=body.reason,
            supplier_accepts_return=body.supplier_accepts_return,
            create_credit_note=body.create_credit_note,
            refund_customer_value=body.refund_customer_value,
        )
        if not result.get("success"):
            raise HTTPException(status_code=400, detail=result.get("error", "Erro ao cancelar"))
        return result
    finally:
        svc.close()
