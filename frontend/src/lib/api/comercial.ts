import apiClient from './client';

export interface MarketplacePricingRule {
  marketplace_id: number;
  marketplace_name: string;
  pvp: number;
  commission_pct: number;
  vat_rate: number;
  cost_base: number;
  margin_net_pct: number;
}

export interface ProductSKU {
  sku_interno: string;
  descricao?: string;
  custo_base: number;
  marketplaces: MarketplacePricingRule[];
}

export interface MarginSimulatorResponse {
  pvp_sugerido: number;
  base_tributavel: number;
  iva: number;
  comissao: number;
  custo: number;
  margem_liquida: number;
  margem_liquida_pct: number;
}

export interface SourcingUploadResult {
  total_linhas: number;
  skus_atualizados: number;
  skus_aumento_custo: number;
  skus_margem_negativa_worten: number;
  skus_margem_negativa_amazon: number;
  alertas: string[];
}

export interface TopPerformerItem {
  sku_interno: string;
  descricao?: string;
  unidades_vendidas: number;
  lucro_liquido_real: number;
  margem_pct: number;
}

export interface BlacklistItem {
  sku_interno: string;
  descricao?: string;
  unidades_devolvidas: number;
  custo_devolucoes: number;
  margem_operacional_pct: number;
  motivo: string;
}

export interface DocumentLine {
  artigo: string;
  quantidade: number;
  preco_unitario: number;
  taxa_iva: number;
  valor_iva: number;
  total_linha: number;
}

export interface DocumentPreview {
  tipo_documento: string;
  referencia_encomenda: string;
  cliente?: string;
  marketplace_nome?: string;
  valor_base: number;
  iva: number;
  total: number;
  linhas: DocumentLine[];
  sales_order_id?: number;
}

export interface VatSummaryItem {
  taxa_iva: number;
  base_tributavel: number;
  valor_iva: number;
}

export interface SimulationDetailedResponse {
  documentos: DocumentPreview[];
  total_faturas: number;
  total_nc: number;
  saldo_liquido: number;
  resumo_iva: VatSummaryItem[];
}

export const comercialApi = {
  getCatalogo: (params?: { empresa_id?: number; limit?: number }) =>
    apiClient.get<ProductSKU[]>('/api/v1/comercial/catalogo', { params }).then((r) => r.data),

  simuladorMargem: (body: {
    custo_base: number;
    margem_desejada_pct: number;
    comissao_marketplace_pct: number;
    vat_rate: number;
  }) =>
    apiClient.post<MarginSimulatorResponse>('/api/v1/comercial/simulador-margem', body).then((r) => r.data),

  uploadSourcing: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return apiClient.post<SourcingUploadResult>('/api/v1/comercial/sourcing/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data);
  },

  getTopPerformers: (params?: { empresa_id?: number; limit?: number }) =>
    apiClient.get<TopPerformerItem[]>('/api/v1/comercial/bi/top-performers', { params }).then((r) => r.data),

  getBlacklist: (params?: { empresa_id?: number; limit?: number }) =>
    apiClient.get<BlacklistItem[]>('/api/v1/comercial/bi/blacklist', { params }).then((r) => r.data),
};
