import apiClient from './client';

export interface PendingSale {
  id: number;
  numero_pedido: string | null;
  data_criacao: string | null;
  empresa_id: number | null;
  marketplace_id: number | null;
  sku_oferta: string | null;
  nome_produto: string | null;
  quantidade: number | null;
  valor_total_sem_impostos: number | null;
  comissao_sem_impostos: number | null;
  valor_transferido_loja: number | null;
}

export interface PurchaseOrderItem {
  id: number;
  purchase_order_id: number;
  order_id: number;
  sales_order_item_id?: number | null;
  sku_marketplace: string | null;
  sku_fornecedor: string | null;
  quantidade: number;
  custo_unitario: number;
  portes_rateados: number | null;
  impostos_rateados: number | null;
}

export interface GlobalPendingItem {
  id: number;
  numero_pedido: string | null;
  data_criacao: string | null;
  empresa_id: number | null;
  sku_oferta: string | null;
  nome_produto: string | null;
  quantidade: number | null;
  supplier_id: number | null;
  supplier_nome: string | null;
  custo_fornecedor: number | null;
  sku_fornecedor: string | null;
  empresa_nome: string | null;
  valor_transferido_loja: number | null;
}

export interface SaleStateItem {
  order_id: number;
  empresa_id: number | null;
  numero_pedido: string | null;
  sales_order_id: number | null;
  sales_order_item_id: number | null;
  sku_oferta: string | null;
  quantidade: number | null;
  valor_transferido_loja: number | null;
  empresa_nome: string | null;
  estado_venda: string;
  purchase_order_id: number | null;
  po_status: string | null;
  supplier_order_id: string | null;
}

export interface PendingPurchaseItem {
  id: number;
  empresa_id: number;
  sales_order_id: number;
  sales_order_item_id: number;
  sku_marketplace: string | null;
  sku_supplier: string | null;
  supplier_id: number | null;
  quantity: number;
  cost_price_base: number;
  expected_profit: number | null;
  data_criacao: string | null;
  supplier_nome: string | null;
  empresa_nome: string | null;
}

export interface PurchaseOrder {
  id: number;
  empresa_id: number;
  supplier_id: number | null;
  status: string;
  tipo_envio: string;
  total_base: number;
  portes_totais: number;
  impostos: number;
  total_final: number;
  data_criacao: string | null;
  data_ordered: string | null;
  data_paid: string | null;
  notas: string | null;
  billing_nif?: string | null;
  billing_address?: string | null;
  billing_name?: string | null;
  supplier_order_id?: string | null;
  tracking_number?: string | null;
  supplier_nome: string | null;
  empresa_nome?: string | null;
  order_refs?: string | null;
  items?: PurchaseOrderItem[];
}

/** PO com estado de fatura e conta corrente (match PO ↔ Fatura) */
export interface PurchaseOrderWithInvoiceStatus {
  id: number;
  empresa_id: number;
  supplier_id: number | null;
  status: string;
  tipo_envio: string;
  total_final: number;
  data_criacao: string | null;
  data_ordered: string | null;
  invoice_ref: string | null;
  invoice_amount: number | null;
  invoice_pdf_url: string | null;
  supplier_nome: string | null;
  empresa_nome: string | null;
  has_ledger_entry: boolean;
  invoice_status: 'none' | 'url_only' | 'ref_and_amount';
  is_reconciled?: boolean;
}

/** v3.5: Detalhe para Checkout Inteligente (custos, IVA por regime, margem) */
export interface CheckoutDetail {
  id: number;
  empresa_id: number;
  supplier_id: number | null;
  status: string;
  tipo_envio: string;
  office_id: number | null;
  total_base: number;
  portes_totais: number;
  impostos: number;
  total_final: number;
  taxas_pagamento: number;
  valor_base_artigos: number;
  iva_total: number;
  custo_portes_fornecedor: number;
  billing_nif: string | null;
  billing_address: string | null;
  billing_name: string | null;
  supplier_order_id: string | null;
  notas: string | null;
  supplier_nome: string | null;
  supplier_designacao: string | null;
  supplier_nif: string | null;
  supplier_morada: string | null;
  supplier_cp: string | null;
  supplier_localidade: string | null;
  supplier_pais: string | null;
  regime_iva: string | null;
  empresa_nome: string | null;
  empresa_nif: string | null;
  empresa_morada: string | null;
  empresa_pais: string | null;
  taxa_iva_pct: number;
  linked_sales_total: number;
  margin_eur: number;
  margin_pct: number;
  shipping_address: { tipo: string; designacao: string; morada?: string; codigo_postal?: string; localidade?: string; pais?: string };
  items: Array<{
    id: number;
    purchase_order_id: number;
    sales_order_item_id: number | null;
    sku_marketplace: string | null;
    sku_fornecedor: string | null;
    quantidade: number;
    custo_unitario: number;
    portes_rateados: number;
    impostos_rateados: number;
  }>;
}

export interface AggregateResponse {
  success: boolean;
  purchase_order_id: number | null;
  total_base: number | null;
  portes_totais: number | null;
  impostos: number | null;
  total_final: number | null;
  items_count: number | null;
  error: string | null;
}

export const purchasesApi = {
  getPendingSales: async (empresaId: number, limit = 500): Promise<{ items: PendingSale[] }> => {
    const { data } = await apiClient.get<{ items: PendingSale[] }>(
      `/api/v1/purchases/pending-sales?empresa_id=${empresaId}&limit=${limit}`
    );
    return data;
  },

  listPurchaseOrders: async (
    empresaId?: number,
    status?: string,
    limit = 100,
    offset = 0,
    dataInicio?: string,
    dataFim?: string,
  ): Promise<{ items: PurchaseOrder[]; total: number }> => {
    const params = new URLSearchParams();
    if (empresaId != null) params.append('empresa_id', String(empresaId));
    if (status) params.append('status', status);
    if (dataInicio) params.append('data_inicio', dataInicio);
    if (dataFim) params.append('data_fim', dataFim);
    params.append('limit', String(limit));
    params.append('offset', String(offset));
    const { data } = await apiClient.get<{ items: PurchaseOrder[]; total: number }>(
      `/api/v1/purchases/orders?${params}`
    );
    return data;
  },

  getPurchaseOrder: async (purchaseOrderId: number): Promise<PurchaseOrder> => {
    const { data } = await apiClient.get<PurchaseOrder>(`/api/v1/purchases/orders/${purchaseOrderId}`);
    return data;
  },

  /** v3.5: Checkout Inteligente — detalhe com custos, IVA por regime, margem */
  getCheckoutDetail: async (
    purchaseOrderId: number,
    params?: { portes?: number; taxas_pagamento?: number }
  ): Promise<CheckoutDetail> => {
    const sp = new URLSearchParams();
    if (params?.portes != null) sp.append('portes', String(params.portes));
    if (params?.taxas_pagamento != null) sp.append('taxas_pagamento', String(params.taxas_pagamento));
    const q = sp.toString();
    const { data } = await apiClient.get<CheckoutDetail>(
      `/api/v1/purchases/orders/${purchaseOrderId}/checkout-detail${q ? `?${q}` : ''}`
    );
    return data;
  },

  updatePoTotals: async (
    purchaseOrderId: number,
    body: { portes_totais: number; taxas_pagamento: number; total_final?: number; valor_base_artigos?: number; iva_total?: number }
  ): Promise<{ success: boolean; total_final?: number; margin_eur?: number; margin_pct?: number }> => {
    const { data } = await apiClient.patch(
      `/api/v1/purchases/orders/${purchaseOrderId}/totals`,
      body
    );
    return data;
  },

  /** Altera o fornecedor da PO (checkout: escolher outro fornecedor que não o proposto). */
  setPoSupplier: async (purchaseOrderId: number, supplierId: number): Promise<{ success: boolean; supplier_id?: number }> => {
    const { data } = await apiClient.patch(
      `/api/v1/purchases/orders/${purchaseOrderId}/supplier`,
      { supplier_id: supplierId }
    );
    return data;
  },

  finalizePo: async (
    purchaseOrderId: number,
    body?: { supplier_order_id?: string; portes_totais?: number; taxas_pagamento?: number; total_final?: number; valor_base_artigos?: number; iva_total?: number }
  ): Promise<{ success: boolean; status?: string }> => {
    const { data } = await apiClient.post(
      `/api/v1/purchases/orders/${purchaseOrderId}/finalize`,
      body ?? {}
    );
    return data;
  },

  updateStatus: async (purchaseOrderId: number, status: string): Promise<{ success: boolean }> => {
    const { data } = await apiClient.patch<{ success: boolean }>(
      `/api/v1/purchases/orders/${purchaseOrderId}`,
      { status }
    );
    return data;
  },

  aggregate: async (body: {
    empresa_id: number;
    order_ids: number[];
    supplier_id?: number;
    tipo_envio?: string;
    portes_totais?: number;
    taxa_iva_pct?: number;
  }): Promise<AggregateResponse> => {
    const { data } = await apiClient.post<AggregateResponse>('/api/v1/purchases/aggregate', body);
    return data;
  },

  getGlobalPending: async (supplierId?: number, limit = 1000): Promise<{ items: GlobalPendingItem[] }> => {
    const params = new URLSearchParams();
    if (supplierId != null) params.append('supplier_id', String(supplierId));
    params.append('limit', String(limit));
    const { data } = await apiClient.get<{ items: GlobalPendingItem[] }>(`/api/v1/purchases/global-pending?${params}`);
    return data;
  },

  prepareBulk: async (body: {
    order_ids: number[];
    portes_totais?: number;
    taxa_iva_pct?: number;
    tipo_envio?: string;
  }): Promise<{ success: boolean; error?: string; purchase_orders: { purchase_order_id: number; empresa_id: number; supplier_id: number | null; items_count: number; total_final: number; billing_name: string | null }[] }> => {
    const { data } = await apiClient.post('/api/v1/purchases/prepare-bulk', body);
    return data;
  },

  setSupplierOrderId: async (purchaseOrderId: number, supplierOrderId: string): Promise<{ success: boolean }> => {
    const { data } = await apiClient.patch<{ success: boolean }>(
      `/api/v1/purchases/orders/${purchaseOrderId}/supplier-order-id`,
      { supplier_order_id: supplierOrderId }
    );
    return data;
  },

  /** Lista POs com estado de fatura e conta corrente (para match PO ↔ Fatura) */
  listPurchaseOrdersWithInvoiceStatus: async (
    empresaId?: number,
    status?: string,
    invoiceState?: string,
    limit = 200,
    offset = 0
  ): Promise<{ items: PurchaseOrderWithInvoiceStatus[]; total: number }> => {
    const params = new URLSearchParams();
    if (empresaId != null) params.append('empresa_id', String(empresaId));
    if (status) params.append('status', status);
    if (invoiceState) params.append('invoice_state', invoiceState);
    params.append('limit', String(limit));
    params.append('offset', String(offset));
    params.append('with_invoice_status', 'true');
    const { data } = await apiClient.get<{ items: PurchaseOrderWithInvoiceStatus[]; total: number }>(
      `/api/v1/purchases/orders?${params}`
    );
    return data;
  },

  /** Regista fatura na PO e opcionalmente envia para conta corrente */
  registerPoInvoice: async (
    purchaseOrderId: number,
    body: { invoice_ref?: string; invoice_amount?: number; post_to_ledger?: boolean }
  ): Promise<{ success: boolean; ledger_created?: boolean }> => {
    const { data } = await apiClient.patch<{ success: boolean; ledger_created?: boolean }>(
      `/api/v1/purchases/orders/${purchaseOrderId}/invoice`,
      { invoice_ref: body.invoice_ref ?? null, invoice_amount: body.invoice_amount ?? null, post_to_ledger: body.post_to_ledger !== false }
    );
    return data;
  },

  getSaleState: async (empresaId?: number, limit = 500): Promise<{ items: SaleStateItem[] }> => {
    const params = new URLSearchParams();
    if (empresaId != null) params.append('empresa_id', String(empresaId));
    params.append('limit', String(limit));
    const { data } = await apiClient.get<{ items: SaleStateItem[] }>(`/api/v1/purchases/sale-state?${params}`);
    return data;
  },

  /** Fase 3: Central de Compras — pending_purchase_items (todas as empresas) */
  getPendingForCockpit: async (supplierId?: number, limit = 2000): Promise<{ items: PendingPurchaseItem[] }> => {
    const params = new URLSearchParams();
    if (supplierId != null) params.append('supplier_id', String(supplierId));
    params.append('limit', String(limit));
    const { data } = await apiClient.get<{ items: PendingPurchaseItem[] }>(`/api/v1/purchases/pending?${params}`);
    return data;
  },

  /** Fase 3: Split fiscal — cria POs por (empresa_id, supplier_id) a partir de pending_item_ids */
  consolidatePurchases: async (body: {
    pending_item_ids: number[];
    portes_totais?: number;
    taxa_iva_pct?: number;
  }): Promise<{
    success: boolean;
    error?: string;
    purchase_orders: { purchase_order_id: number; empresa_id: number; supplier_id: number | null; items_count: number; total_final: number; billing_name: string | null }[];
    num_pos?: number;
    num_items_processed?: number;
  }> => {
    const { data } = await apiClient.post('/api/v1/purchases/consolidate', body);
    return data;
  },

  /** Fase 3: Lista de POs em Draft (para Wizard de Checkout) */
  getDrafts: async (empresaId?: number, limit = 100, offset = 0): Promise<{ items: PurchaseOrder[]; total: number; limit: number; offset: number }> => {
    const params = new URLSearchParams();
    if (empresaId != null) params.append('empresa_id', String(empresaId));
    params.append('limit', String(limit));
    params.append('offset', String(offset));
    const { data } = await apiClient.get<{ items: PurchaseOrder[]; total: number; limit: number; offset: number }>(`/api/v1/purchases/drafts?${params}`);
    return data;
  },
};
