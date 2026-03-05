import apiClient from './client';

export interface OrderWithMargin {
  id: number;
  numero_pedido: string | null;
  data_criacao: string | null;
  empresa_id: number | null;
  marketplace_id: number | null;
  sku_oferta: string | null;
  nome_produto: string | null;
  quantidade: number | null;
  valor_total_com_iva: number | null;
  iva_total: number | null;
  comissao_sem_impostos: number | null;
  valor_transferido_loja: number | null;
  custo_fornecedor: number | null;
  gastos_envio: number | null;
  outras_taxas: number | null;
  status_operacional: string | null;
  status: string | null;
  canal_vendas: string | null;
  margem_total_linha: number | null;
}

export interface SalesListResponse {
  orders: OrderWithMargin[];
  total: number;
  limit: number;
  offset: number;
}

export interface SalesMetrics {
  gmv: number;
  vendas_sem_iva: number;
  total_comissao: number;
  num_linhas: number;
  margem_contribuicao_total: number;
  margem_pct: number;
}

export interface TopProduct {
  sku: string;
  nome_produto: string;
  quantidade_vendida: number;
  gmv_produto: number;
  margem_total: number;
}

export interface SalesQueryParams {
  empresa_id?: number;
  marketplace_id?: number;
  data_inicio?: string;
  data_fim?: string;
  limit?: number;
  offset?: number;
}

export interface SalesOrderListItem {
  id: number;
  empresa_id: number | null;
  external_order_id: string | null;
  marketplace_id: number | null;
  order_date: string | null;
  import_date: string | null;
  status: string | null;
  customer_country: string | null;
  currency: string | null;
  total_gross: number | null;
  total_commission_fixed: number | null;
  total_commission_percent: number | null;
  total_net_value: number | null;
  marketplace_nome: string | null;
  shipping_status?: string | null;
  carrier_name?: string | null;
  tracking_number?: string | null;
  carrier_status?: string | null;
  shipped_at?: string | null;
  purchase_order_id?: number | null;
  po_status?: string | null;
  supplier_nome?: string | null;
  lucro_previsto?: number | null;
  margem_pct?: number | null;
}

export interface SalesOrderItemDetail {
  id: number;
  sku_marketplace: string | null;
  internal_sku: string | null;
  quantity: number | null;
  unit_price: number | null;
  vat_rate: number | null;
  linha_gross: number | null;
  nome_produto: string | null;
  custo_fornecedor: number | null;
}

export interface SalesOrderPODetail {
  id: number;
  status: string | null;
  invoice_ref: string | null;
  total_final: number | null;
  supplier_nome: string | null;
  supplier_id: number | null;
  data_criacao: string | null;
  due_date: string | null;
}

export interface SalesOrderDetail {
  id: number;
  empresa_id: number | null;
  empresa_nome: string | null;
  external_order_id: string | null;
  marketplace_id: number | null;
  marketplace_nome: string | null;
  order_date: string | null;
  status: string | null;
  customer_country: string | null;
  currency: string | null;
  total_gross: number | null;
  total_commission_fixed: number | null;
  total_commission_percent: number | null;
  total_net_value: number | null;
  shipping_status: string | null;
  carrier_name: string | null;
  tracking_number: string | null;
  carrier_status: string | null;
  shipped_at: string | null;
  customer_name: string | null;
  customer_address: string | null;
  customer_nif: string | null;
  lucro_previsto: number | null;
  custo_previsto: number | null;
  margem_pct: number | null;
  items_sem_mapping: number | null;
  items: SalesOrderItemDetail[];
  purchase_orders: SalesOrderPODetail[];
}

export interface SalesListModuleResponse {
  items: SalesOrderListItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface SalesStats {
  num_orders: number;
  gmv: number;
  total_commission_fixed: number;
  total_commission_percent: number;
  avg_commission_rate_pct: number;
  total_net_value: number;
  lucro_previsto?: number;
}

export interface SalesKpisTopProduct {
  sku: string;
  nome_produto: string;
  quantidade_vendida: number;
  gmv_produto: number;
}

export interface SalesKpisMarketplace {
  marketplace_id: number | null;
  nome: string;
  volume?: number | null;
  num_orders?: number | null;
}

export interface SalesKpisResponse {
  ano: number;
  mes: number;
  vendas_acumuladas: number;
  vendas_mes: number;
  total_orders_ativas: number;
  orders_concluidas: number;
  orders_pendentes: number;
  orders_canceladas: number;
  orders_reembolsadas: number;
  top_10_produtos: SalesKpisTopProduct[];
  marketplace_maior_volume: SalesKpisMarketplace;
  marketplace_mais_orders: SalesKpisMarketplace;
}

export interface RecentWithMarginItem {
  sales_order_id: number;
  external_order_id: string | null;
  empresa_id: number | null;
  marketplace_id: number | null;
  order_date: string | null;
  total_gross: number | null;
  total_net_value: number | null;
  sales_order_item_id: number | null;
  sku_marketplace: string | null;
  internal_sku: string | null;
  qty: number | null;
  unit_price: number | null;
  linha_gross: number | null;
  cost_price_base: number | null;
  custo_previsto_linha: number | null;
  lucro_previsto_linha: number | null;
  mapping_em_falta: number | null;
}

export interface SalesImportResponse {
  success: boolean;
  error: string | null;
  sales_orders_created: number;
  sales_order_items_created: number;
  orders_trigger_created: number;
}

export const salesApi = {
  getOrdersWithMargin: async (params: SalesQueryParams): Promise<SalesListResponse> => {
    const search = new URLSearchParams();
    if (params.empresa_id != null) search.append('empresa_id', String(params.empresa_id));
    if (params.marketplace_id != null) search.append('marketplace_id', String(params.marketplace_id));
    if (params.data_inicio) search.append('data_inicio', params.data_inicio);
    if (params.data_fim) search.append('data_fim', params.data_fim);
    search.append('limit', String(params.limit ?? 100));
    search.append('offset', String(params.offset ?? 0));
    const { data } = await apiClient.get<SalesListResponse>(`/api/v1/sales/orders?${search.toString()}`);
    return data;
  },

  getMetrics: async (params: Pick<SalesQueryParams, 'empresa_id' | 'marketplace_id' | 'data_inicio' | 'data_fim'> = {}): Promise<SalesMetrics> => {
    const search = new URLSearchParams();
    if (params.empresa_id != null) search.append('empresa_id', String(params.empresa_id));
    if (params.marketplace_id != null) search.append('marketplace_id', String(params.marketplace_id));
    if (params.data_inicio) search.append('data_inicio', params.data_inicio);
    if (params.data_fim) search.append('data_fim', params.data_fim);
    const { data } = await apiClient.get<SalesMetrics>(`/api/v1/sales/metrics?${search.toString()}`);
    return data;
  },

  getTopProducts: async (params: SalesQueryParams & { limit?: number } = {}): Promise<TopProduct[]> => {
    const search = new URLSearchParams();
    if (params.empresa_id != null) search.append('empresa_id', String(params.empresa_id));
    if (params.marketplace_id != null) search.append('marketplace_id', String(params.marketplace_id));
    if (params.data_inicio) search.append('data_inicio', params.data_inicio);
    if (params.data_fim) search.append('data_fim', params.data_fim);
    search.append('limit', String(params.limit ?? 20));
    const { data } = await apiClient.get<TopProduct[]>(`/api/v1/sales/top-products?${search.toString()}`);
    return data;
  },

  /** Módulo Sales (sales_orders): import, list, stats */
  importSales: async (
    file: File,
    empresaId: number,
    marketplaceId?: number,
    marketplaceCode?: string
  ): Promise<SalesImportResponse> => {
    const form = new FormData();
    form.append('file', file);
    form.append('empresa_id', String(empresaId));
    if (marketplaceId != null) form.append('marketplace_id', String(marketplaceId));
    if (marketplaceCode) form.append('marketplace_code', marketplaceCode);
    const { data } = await apiClient.post<SalesImportResponse>('/api/v1/sales/import', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  getSalesList: async (params: {
    empresa_id?: number;
    marketplace_id?: number;
    customer_country?: string;
    status?: string;
    data_inicio?: string;
    data_fim?: string;
    only_without_proforma?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<SalesListModuleResponse> => {
    const search = new URLSearchParams();
    if (params.empresa_id != null) search.append('empresa_id', String(params.empresa_id));
    if (params.marketplace_id != null) search.append('marketplace_id', String(params.marketplace_id));
    if (params.customer_country) search.append('customer_country', params.customer_country);
    if (params.status) search.append('status', params.status);
    if (params.data_inicio) search.append('data_inicio', params.data_inicio);
    if (params.data_fim) search.append('data_fim', params.data_fim);
    if (params.only_without_proforma === true) search.append('only_without_proforma', 'true');
    search.append('limit', String(params.limit ?? 100));
    search.append('offset', String(params.offset ?? 0));
    const { data } = await apiClient.get<SalesListModuleResponse>(`/api/v1/sales/list?${search.toString()}`);
    return data;
  },

  getSalesStats: async (params: {
    empresa_id?: number;
    marketplace_id?: number;
    data_inicio?: string;
    data_fim?: string;
  } = {}): Promise<SalesStats> => {
    const search = new URLSearchParams();
    if (params.empresa_id != null) search.append('empresa_id', String(params.empresa_id));
    if (params.marketplace_id != null) search.append('marketplace_id', String(params.marketplace_id));
    if (params.data_inicio) search.append('data_inicio', params.data_inicio);
    if (params.data_fim) search.append('data_fim', params.data_fim);
    const { data } = await apiClient.get<SalesStats>(`/api/v1/sales/stats?${search.toString()}`);
    return data;
  },

  /** KPIs de vendas por ano/mês (sales_orders): vendas acumuladas, mês, orders por estado, top produtos, marketplaces */
  getSalesKpis: async (params: { ano: number; mes: number; empresa_id?: number }): Promise<SalesKpisResponse> => {
    const search = new URLSearchParams();
    search.append('ano', String(params.ano));
    search.append('mes', String(params.mes));
    if (params.empresa_id != null) search.append('empresa_id', String(params.empresa_id));
    const { data } = await apiClient.get<SalesKpisResponse>(`/api/v1/sales/kpis?${search.toString()}`);
    return data;
  },

  /** Vendas recentes com Lucro Previsto por linha e indicador Mapping em falta */
  getRecentWithMargin: async (params: { empresa_id?: number; limit?: number } = {}): Promise<RecentWithMarginItem[]> => {
    const search = new URLSearchParams();
    if (params.empresa_id != null) search.append('empresa_id', String(params.empresa_id));
    search.append('limit', String(params.limit ?? 100));
    const { data } = await apiClient.get<RecentWithMarginItem[]>(`/api/v1/sales/recent-with-margin?${search.toString()}`);
    return data;
  },

  /** Detalhe completo de uma sales_order */
  getOrderDetail: async (salesOrderId: number): Promise<SalesOrderDetail> => {
    const { data } = await apiClient.get<SalesOrderDetail>(`/api/v1/sales/orders/${salesOrderId}`);
    return data;
  },

  /** Exporta vendas para Excel */
  exportSales: async (params: {
    empresa_id?: number;
    marketplace_id?: number;
    customer_country?: string;
    status?: string;
    data_inicio?: string;
    data_fim?: string;
    ids?: number[];
  }): Promise<Blob> => {
    const search = new URLSearchParams();
    if (params.empresa_id != null) search.append('empresa_id', String(params.empresa_id));
    if (params.marketplace_id != null) search.append('marketplace_id', String(params.marketplace_id));
    if (params.customer_country) search.append('customer_country', params.customer_country);
    if (params.status) search.append('status', params.status);
    if (params.data_inicio) search.append('data_inicio', params.data_inicio);
    if (params.data_fim) search.append('data_fim', params.data_fim);
    if (params.ids && params.ids.length > 0) search.append('ids', params.ids.join(','));
    const { data } = await apiClient.get<Blob>(`/api/v1/sales/export?${search.toString()}`, { responseType: 'blob' });
    return data;
  },

  /** Cancelar venda: NC ao cliente, RMA e (opcional) stock em escritório quando fornecedor não aceita devolução */
  cancelSale: async (
    salesOrderId: number,
    body: { reason?: string; supplier_accepts_return?: boolean; create_credit_note?: boolean; refund_customer_value?: number }
  ): Promise<{ success: boolean; sales_order_id: number; credit_note?: { document_number: string }; rma_claim_id?: number; office_stock_created?: unknown[] }> => {
    const { data } = await apiClient.post(
      `/api/v1/sales/orders/${salesOrderId}/cancel`,
      {
        reason: body.reason ?? 'Cliente cancelou',
        supplier_accepts_return: body.supplier_accepts_return ?? false,
        create_credit_note: body.create_credit_note ?? true,
        refund_customer_value: body.refund_customer_value ?? undefined,
      }
    );
    return data;
  },
};
