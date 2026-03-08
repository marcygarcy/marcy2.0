"""
API Gestão Comercial: Pricing Engine, Catálogo, Sourcing, BI e estruturas para Batch.
Modelos Pydantic: ProductSKU, SupplierCost, MarketplacePricingRule, DocumentLine, DocumentPreview.
"""
from fastapi import APIRouter, UploadFile, File
from typing import List, Optional, Dict, Any
from pydantic import BaseModel

router = APIRouter(prefix="/comercial", tags=["comercial"])


# ── Tab 1: Pricing Engine & Catálogo ───────────────────────────────────────

class SupplierCost(BaseModel):
    """Custo de aprovisionamento (fornecedor + portes estimados)."""
    sku: str
    supplier_name: Optional[str] = None
    cost_unit: float
    shipping_estimate: float = 0.0
    cost_base: float  # cost_unit * qty + shipping (para referência)


class MarketplacePricingRule(BaseModel):
    """Regra de preço por marketplace. Fórmula: PVP - IVA - Comissão - Custo = Margem."""
    marketplace_id: int
    marketplace_name: str
    pvp: float
    commission_pct: float
    vat_rate: float
    cost_base: float
    margin_net_pct: float  # Margem líquida estimada (%)


class ProductSKU(BaseModel):
    """Produto (SKU) com custo base e preços por marketplace."""
    sku_interno: str
    descricao: Optional[str] = None
    custo_base: float  # Fornecedor + portes estimados
    marketplaces: List[MarketplacePricingRule] = []


class MarginSimulatorRequest(BaseModel):
    """Input do simulador de margem: PVP sugerido com base na margem desejada."""
    custo_base: float
    margem_desejada_pct: float
    comissao_marketplace_pct: float
    vat_rate: float


class MarginSimulatorResponse(BaseModel):
    """PVP sugerido e breakdown (base, IVA, comissão, custo, margem)."""
    pvp_sugerido: float
    base_tributavel: float
    iva: float
    comissao: float
    custo: float
    margem_liquida: float
    margem_liquida_pct: float


# ── Tab 2: Sourcing (upload CSV) ────────────────────────────────────────────

class SourcingUploadResult(BaseModel):
    """Resultado pós-upload do CSV de custos."""
    total_linhas: int
    skus_atualizados: int
    skus_aumento_custo: int
    skus_margem_negativa_worten: int
    skus_margem_negativa_amazon: int
    alertas: List[str]


# ── Tab 3: BI Performance & Blacklist ───────────────────────────────────────

class TopPerformerItem(BaseModel):
    """SKU com maior lucro líquido real (vendas - devoluções - custos)."""
    sku_interno: str
    descricao: Optional[str] = None
    unidades_vendidas: int
    lucro_liquido_real: float
    margem_pct: float


class BlacklistItem(BaseModel):
    """SKU recomendado para blacklist (destrói margem operacional)."""
    sku_interno: str
    descricao: Optional[str] = None
    unidades_devolvidas: int
    custo_devolucoes: float
    margem_operacional_pct: float
    motivo: str


# ── Tab 4: Batch Invoicing (estruturas detalhadas) ──────────────────────────

class DocumentLine(BaseModel):
    """Linha de documento: artigo, qtd, preço, taxa IVA, valor IVA, total linha."""
    artigo: str
    quantidade: float
    preco_unitario: float
    taxa_iva: float
    valor_iva: float
    total_linha: float


class DocumentPreview(BaseModel):
    """Documento simulado com linhas (master-detail). Totais = soma das linhas."""
    tipo_documento: str
    referencia_encomenda: str
    cliente: Optional[str] = None
    marketplace_nome: Optional[str] = None
    valor_base: float
    iva: float
    total: float
    linhas: List[DocumentLine] = []
    sales_order_id: Optional[int] = None


class VatSummaryItem(BaseModel):
    """Resumo de IVA por taxa (ex: 23%, 6%)."""
    taxa_iva: float
    base_tributavel: float
    valor_iva: float


class SimulateBatchResponse(BaseModel):
    """Resposta do simulate com documentos expandíveis e resumo IVA."""
    documentos: List[DocumentPreview]
    total_faturas: float
    total_nc: float
    saldo_liquido: float
    resumo_iva: List[VatSummaryItem]


# ── Endpoints mockados (Tab 1–3) ───────────────────────────────────────────

@router.get("/catalogo", response_model=List[ProductSKU])
async def get_catalogo_pricing(
    empresa_id: Optional[int] = None,
    limit: int = 100,
) -> List[ProductSKU]:
    """Lista catálogo com custos e preços por marketplace (dummy)."""
    dummy = [
        ProductSKU(
            sku_interno="SKU-001",
            descricao="Artigo A",
            custo_base=45.00,
            marketplaces=[
                MarketplacePricingRule(
                    marketplace_id=1, marketplace_name="Worten", pvp=79.99,
                    commission_pct=10.0, vat_rate=23.0, cost_base=45.00, margin_net_pct=18.5,
                ),
                MarketplacePricingRule(
                    marketplace_id=2, marketplace_name="Amazon", pvp=84.99,
                    commission_pct=15.0, vat_rate=23.0, cost_base=45.00, margin_net_pct=14.2,
                ),
            ],
        ),
        ProductSKU(
            sku_interno="SKU-002",
            descricao="Artigo B",
            custo_base=12.50,
            marketplaces=[
                MarketplacePricingRule(
                    marketplace_id=1, marketplace_name="Worten", pvp=24.99,
                    commission_pct=10.0, vat_rate=23.0, cost_base=12.50, margin_net_pct=22.0,
                ),
                MarketplacePricingRule(
                    marketplace_id=2, marketplace_name="Amazon", pvp=22.00,
                    commission_pct=15.0, vat_rate=23.0, cost_base=12.50, margin_net_pct=3.5,
                ),
            ],
        ),
        ProductSKU(
            sku_interno="SKU-003",
            descricao="Artigo C",
            custo_base=89.00,
            marketplaces=[
                MarketplacePricingRule(
                    marketplace_id=1, marketplace_name="Worten", pvp=99.99,
                    commission_pct=10.0, vat_rate=23.0, cost_base=89.00, margin_net_pct=-2.1,
                ),
                MarketplacePricingRule(
                    marketplace_id=2, marketplace_name="Amazon", pvp=119.00,
                    commission_pct=15.0, vat_rate=23.0, cost_base=89.00, margin_net_pct=12.0,
                ),
            ],
        ),
    ]
    return dummy[:limit]


@router.post("/simulador-margem", response_model=MarginSimulatorResponse)
async def simulador_margem(body: MarginSimulatorRequest) -> MarginSimulatorResponse:
    """Calcula PVP sugerido: PVP - IVA - Comissão - Custo = Margem."""
    custo = body.custo_base
    margem_pct = body.margem_desejada_pct / 100.0
    comissao_pct = body.comissao_marketplace_pct / 100.0
    vat_rate = body.vat_rate / 100.0
    # base_tributavel = PVP / (1 + vat_rate)  =>  PVP = base * (1+vat)
    # comissao = PVP * comissao_pct
    # margem = base - comissao - custo  =>  base = (custo + margem) / (1 - comissao_pct/(1+vat_rate)?)
    # Simplificado: PVP tal que (PVP/(1+vat) - PVP*comissao_pct - custo) / (PVP/(1+vat)) = margem_pct
    # base = PVP / (1+vat),  comissao = PVP * comissao_pct,  margem = base - comissao - custo
    # margem = base * (1 - comissao_pct*(1+vat)) - custo?  Não. comissao é sobre PVP.
    # base = PVP/(1+vat),  comissao = PVP*comissao_pct =>  margem = base - PVP*comissao_pct - custo = base - base*(1+vat)*comissao_pct - custo
    # margem = base * (1 - (1+vat)*comissao_pct) - custo  =>  base = (margem + custo) / (1 - (1+vat)*comissao_pct)
    # Queremos margem = base * margem_pct  =>  base * margem_pct = base * (1 - (1+vat)*comissao_pct) - custo
    # base * (1 - (1+vat)*comissao_pct - margem_pct) = custo  =>  base = custo / (1 - (1+vat)*comissao_pct - margem_pct)
    denom = 1.0 - (1.0 + vat_rate) * comissao_pct - margem_pct
    if denom <= 0:
        base_tributavel = custo / 0.5
    else:
        base_tributavel = custo / denom
    pvp = round(base_tributavel * (1.0 + vat_rate), 2)
    iva = round(pvp - base_tributavel, 2)
    comissao = round(pvp * comissao_pct, 2)
    margem_liquida = round(base_tributavel - comissao - custo, 2)
    margem_liq_pct = round((margem_liquida / base_tributavel * 100) if base_tributavel else 0, 2)
    return MarginSimulatorResponse(
        pvp_sugerido=pvp,
        base_tributavel=round(base_tributavel, 2),
        iva=iva,
        comissao=comissao,
        custo=custo,
        margem_liquida=margem_liquida,
        margem_liquida_pct=margem_liq_pct,
    )


@router.post("/sourcing/upload", response_model=SourcingUploadResult)
async def upload_sourcing_csv(file: UploadFile = File(...)) -> SourcingUploadResult:
    """Upload CSV de custos fornecedores; análise de impacto (mock)."""
    # Mock: simula análise
    return SourcingUploadResult(
        total_linhas=42,
        skus_atualizados=38,
        skus_aumento_custo=15,
        skus_margem_negativa_worten=3,
        skus_margem_negativa_amazon=0,
        alertas=[
            "15 SKUs sofreram aumento de custo.",
            "3 SKUs entraram em Margem Negativa na Worten. [Rever Preços]",
        ],
    )


@router.get("/bi/top-performers", response_model=List[TopPerformerItem])
async def get_top_performers(empresa_id: Optional[int] = None, limit: int = 10) -> List[TopPerformerItem]:
    """Top SKUs por lucro líquido real (vendas - devoluções - custos). Dummy."""
    return [
        TopPerformerItem(sku_interno="SKU-001", descricao="Artigo A", unidades_vendidas=120, lucro_liquido_real=4200.00, margem_pct=18.5),
        TopPerformerItem(sku_interno="SKU-002", descricao="Artigo B", unidades_vendidas=340, lucro_liquido_real=3100.00, margem_pct=22.0),
        TopPerformerItem(sku_interno="SKU-005", descricao="Artigo E", unidades_vendidas=89, lucro_liquido_real=2800.00, margem_pct=25.0),
    ][:limit]


@router.get("/bi/blacklist", response_model=List[BlacklistItem])
async def get_blacklist_recomendada(empresa_id: Optional[int] = None, limit: int = 10) -> List[BlacklistItem]:
    """SKUs recomendados para blacklist (destroem margem). Dummy."""
    return [
        BlacklistItem(
            sku_interno="SKU-003", descricao="Artigo C",
            unidades_devolvidas=45, custo_devolucoes=4005.00, margem_operacional_pct=-2.1,
            motivo="Margem negativa e alta taxa de devolução",
        ),
        BlacklistItem(
            sku_interno="SKU-007", descricao="Artigo G",
            unidades_devolvidas=22, custo_devolucoes=1980.00, margem_operacional_pct=1.2,
            motivo="Margem operacional muito baixa",
        ),
    ][:limit]
