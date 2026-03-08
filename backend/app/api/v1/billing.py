"""API Gestão Comercial: proformas, documentos de venda e processamento de faturação mensal (batch)."""
from fastapi import APIRouter, Depends, Query, HTTPException, Body
from typing import List, Optional, Any, Dict
from pydantic import BaseModel

from app.services.billing_service import BillingService
from app.api.deps import get_billing_service


router = APIRouter(prefix="/billing", tags=["billing"])


# ── Batch Invoicing (Processamento de Faturação Mensal) ─────────────────────

class SimulationRequest(BaseModel):
    """Parâmetros para simulação e execução do batch de faturação."""
    date_from: str
    date_to: str
    empresa_id: Optional[int] = None
    marketplace_id: Optional[int] = None
    serie_faturas: Optional[str] = None
    serie_nc: Optional[str] = None


class SimulationDocumentItem(BaseModel):
    tipo_documento: str
    referencia_encomenda: str
    valor_base: float
    iva: float
    total: float


class SimulationResponse(BaseModel):
    items: List[SimulationDocumentItem]
    total_faturas: float
    total_nc: float
    saldo_liquido: float


# ── Simulate detalhado (master-detail + resumo IVA) ─────────────────────────

class DocumentLineResponse(BaseModel):
    artigo: str
    quantidade: float
    preco_unitario: float
    taxa_iva: float
    valor_iva: float
    total_linha: float


class DocumentPreviewResponse(BaseModel):
    tipo_documento: str
    referencia_encomenda: str
    cliente: Optional[str] = None
    marketplace_nome: Optional[str] = None
    valor_base: float
    iva: float
    total: float
    linhas: List[DocumentLineResponse] = []
    sales_order_id: Optional[int] = None


class VatSummaryItemResponse(BaseModel):
    taxa_iva: float
    base_tributavel: float
    valor_iva: float


class SimulationDetailedResponse(BaseModel):
    documentos: List[DocumentPreviewResponse]
    total_faturas: float
    total_nc: float
    saldo_liquido: float
    resumo_iva: List[VatSummaryItemResponse]


@router.post("/simulate", response_model=SimulationResponse)
async def simulate_batch_invoicing(
    body: SimulationRequest,
    service: BillingService = Depends(get_billing_service),
):
    """
    Simula o processamento de faturação mensal.
    Devolve encomendas elegíveis para Fatura e devoluções para NC, com totais.
    Não altera o estado na BD (idempotente e seguro).
    """
    try:
        result = service.simulate_batch(
            date_from=body.date_from,
            date_to=body.date_to,
            empresa_id=body.empresa_id,
            marketplace_id=body.marketplace_id,
            serie_faturas=body.serie_faturas,
            serie_nc=body.serie_nc,
        )
        items = [
            SimulationDocumentItem(
                tipo_documento=it["tipo_documento"],
                referencia_encomenda=it["referencia_encomenda"],
                valor_base=it["valor_base"],
                iva=it["iva"],
                total=it["total"],
            )
            for it in result["items"]
        ]
        return SimulationResponse(
            items=items,
            total_faturas=result["total_faturas"],
            total_nc=result["total_nc"],
            saldo_liquido=result["saldo_liquido"],
        )
    finally:
        service.close()


@router.post("/simulate-detailed", response_model=SimulationDetailedResponse)
async def simulate_batch_detailed(
    body: SimulationRequest,
    service: BillingService = Depends(get_billing_service),
):
    """
    Simula faturação com detalhe por linha (master-detail) e resumo IVA por taxa.
    Totais = soma exata das linhas.
    """
    try:
        result = service.simulate_batch_detailed(
            date_from=body.date_from,
            date_to=body.date_to,
            empresa_id=body.empresa_id,
            marketplace_id=body.marketplace_id,
            serie_faturas=body.serie_faturas,
            serie_nc=body.serie_nc,
        )
        docs = [
            DocumentPreviewResponse(
                tipo_documento=d["tipo_documento"],
                referencia_encomenda=d["referencia_encomenda"],
                cliente=d.get("cliente"),
                marketplace_nome=d.get("marketplace_nome"),
                valor_base=d["valor_base"],
                iva=d["iva"],
                total=d["total"],
                linhas=[
                    DocumentLineResponse(
                        artigo=ln["artigo"],
                        quantidade=ln["quantidade"],
                        preco_unitario=ln["preco_unitario"],
                        taxa_iva=ln["taxa_iva"],
                        valor_iva=ln["valor_iva"],
                        total_linha=ln["total_linha"],
                    )
                    for ln in d.get("linhas", [])
                ],
                sales_order_id=d.get("sales_order_id"),
            )
            for d in result["documentos"]
        ]
        return SimulationDetailedResponse(
            documentos=docs,
            total_faturas=result["total_faturas"],
            total_nc=result["total_nc"],
            saldo_liquido=result["saldo_liquido"],
            resumo_iva=[
                VatSummaryItemResponse(
                    taxa_iva=x["taxa_iva"],
                    base_tributavel=x["base_tributavel"],
                    valor_iva=x["valor_iva"],
                )
                for x in result["resumo_iva"]
            ],
        )
    finally:
        service.close()


@router.post("/execute")
async def execute_batch_invoicing(
    body: SimulationRequest,
    service: BillingService = Depends(get_billing_service),
) -> Dict[str, Any]:
    """
    Executa a faturação definitiva: cria Faturas e Notas de Crédito,
    atribui números sequenciais e marca as encomendas como faturadas.
    Ação irreversível.
    """
    try:
        result = service.execute_batch(
            date_from=body.date_from,
            date_to=body.date_to,
            empresa_id=body.empresa_id,
            marketplace_id=body.marketplace_id,
            serie_faturas=body.serie_faturas,
            serie_nc=body.serie_nc,
        )
        return result
    finally:
        service.close()


class ProformaDataResponse(BaseModel):
    company: dict
    order: dict


class BulkProformasRequest(BaseModel):
    sales_order_ids: List[int]


class DocumentListItem(BaseModel):
    id: int
    empresa_id: Optional[int]
    sales_order_id: int
    doc_type: str
    document_number: str
    status: str
    total_gross: Optional[float]
    total_net: Optional[float]
    total_vat: Optional[float]
    customer_country: Optional[str]
    issued_at: Optional[str]
    created_at: Optional[str]
    cancelled_at: Optional[str]
    external_order_id: Optional[str]
    order_date: Optional[str]
    marketplace_nome: Optional[str]


class DocumentsListResponse(BaseModel):
    items: List[DocumentListItem]
    total: int
    limit: int
    offset: int


@router.get("/proforma-data/{sales_order_id}", response_model=ProformaDataResponse)
async def get_proforma_data(
    sales_order_id: int,
    service: BillingService = Depends(get_billing_service),
):
    """Dados para preview/impressão da proforma (empresa, ordem, linhas com IVA)."""
    try:
        data = service.get_proforma_data(sales_order_id)
        if not data:
            raise HTTPException(status_code=404, detail="Venda não encontrada")
        return ProformaDataResponse(company=data["company"], order=data["order"])
    finally:
        service.close()


@router.post("/proformas", response_model=ProformaDataResponse)
async def create_proforma(
    sales_order_id: int = Body(..., embed=True),
    service: BillingService = Depends(get_billing_service),
):
    """Cria proforma para uma venda e devolve dados para impressão."""
    try:
        data = service.create_proforma(sales_order_id)
        if not data:
            raise HTTPException(status_code=404, detail="Venda não encontrada")
        return ProformaDataResponse(company=data["company"], order=data["order"])
    finally:
        service.close()


@router.get("/documents", response_model=DocumentsListResponse)
async def list_documents(
    empresa_id: Optional[int] = Query(None),
    doc_type: Optional[str] = Query(None, description="Proforma, Fatura, NC"),
    status: Optional[str] = Query(None, description="issued, cancelled"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    service: BillingService = Depends(get_billing_service),
):
    """Lista documentos comerciais com filtros."""
    try:
        items, total = service.list_documents(
            empresa_id=empresa_id,
            doc_type=doc_type,
            status=status,
            limit=limit,
            offset=offset,
        )
        out = [
            DocumentListItem(
                id=r["id"],
                empresa_id=r.get("empresa_id"),
                sales_order_id=r["sales_order_id"],
                doc_type=r["doc_type"],
                document_number=r["document_number"],
                status=r["status"],
                total_gross=r.get("total_gross"),
                total_net=r.get("total_net"),
                total_vat=r.get("total_vat"),
                customer_country=r.get("customer_country"),
                issued_at=str(r["issued_at"]) if r.get("issued_at") else None,
                created_at=str(r["created_at"]) if r.get("created_at") else None,
                cancelled_at=str(r["cancelled_at"]) if r.get("cancelled_at") else None,
                external_order_id=r.get("external_order_id"),
                order_date=str(r["order_date"]) if r.get("order_date") else None,
                marketplace_nome=r.get("marketplace_nome"),
            )
            for r in items
        ]
        return DocumentsListResponse(items=out, total=total, limit=limit, offset=offset)
    finally:
        service.close()


@router.put("/documents/{document_id}/cancel")
async def cancel_document(
    document_id: int,
    service: BillingService = Depends(get_billing_service),
):
    """Anula um documento comercial."""
    try:
        ok = service.cancel_document(document_id)
        if not ok:
            raise HTTPException(status_code=404, detail="Documento não encontrado")
        return {"success": True, "document_id": document_id}
    finally:
        service.close()


@router.post("/bulk-proformas")
async def bulk_create_proformas(
    body: BulkProformasRequest,
    service: BillingService = Depends(get_billing_service),
):
    """Cria proformas em lote para várias vendas. Ignora as que já têm proforma."""
    try:
        result = service.bulk_create_proformas(body.sales_order_ids)
        return result
    finally:
        service.close()
