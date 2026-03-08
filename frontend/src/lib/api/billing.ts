import apiClient from './client';

export interface ProformaCompany {
  id?: number;
  nome: string;
  nif: string;
  morada: string;
  pais: string;
}

export interface ProformaItem {
  id: number;
  sku_marketplace?: string;
  internal_sku?: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
  vat_type?: string;
  vat_amount: number;
  line_total?: number;
  line_net?: number;
}

export interface ProformaOrder {
  id: number;
  empresa_id: number;
  external_order_id: string;
  marketplace_id?: number;
  order_date?: string;
  customer_country?: string;
  customer_name?: string | null;
  customer_address?: string | null;
  customer_nif?: string | null;
  currency?: string;
  total_gross: number;
  total_commission_fixed?: number;
  total_commission_percent?: number;
  total_net_value?: number;
  marketplace_nome?: string;
  items: ProformaItem[];
  total_vat?: number;
  total_net?: number;
  billing_document_id?: number | null;
  document_number?: string | null;
  document_status?: string | null;
}

export interface ProformaData {
  company: ProformaCompany;
  order: ProformaOrder;
}

export interface BillingDocumentItem {
  id: number;
  empresa_id?: number;
  sales_order_id: number;
  doc_type: string;
  document_number: string;
  status: string;
  total_gross?: number;
  total_net?: number;
  total_vat?: number;
  customer_country?: string;
  issued_at?: string;
  created_at?: string;
  cancelled_at?: string;
  external_order_id?: string;
  order_date?: string;
  marketplace_nome?: string;
}

export interface DocumentsListResponse {
  items: BillingDocumentItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface SimulationDocumentItem {
  tipo_documento: string;
  referencia_encomenda: string;
  valor_base: number;
  iva: number;
  total: number;
}

export interface SimulationResponse {
  items: SimulationDocumentItem[];
  total_faturas: number;
  total_nc: number;
  saldo_liquido: number;
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

export const billingApi = {
  getProformaData(salesOrderId: number): Promise<ProformaData> {
    return apiClient.get(`/api/v1/billing/proforma-data/${salesOrderId}`).then((r) => r.data);
  },

  createProforma(salesOrderId: number): Promise<ProformaData> {
    return apiClient.post('/api/v1/billing/proformas', { sales_order_id: salesOrderId }).then((r) => r.data);
  },

  listDocuments(params?: {
    empresa_id?: number;
    doc_type?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<DocumentsListResponse> {
    return apiClient.get('/api/v1/billing/documents', { params }).then((r) => r.data);
  },

  cancelDocument(documentId: number): Promise<{ success: boolean; document_id: number }> {
    return apiClient.put(`/api/v1/billing/documents/${documentId}/cancel`).then((r) => r.data);
  },

  bulkCreateProformas(salesOrderIds: number[]): Promise<{
    created: Array<{ sales_order_id: number; document_number: string }>;
    skipped: number[];
    errors: number[];
  }> {
    return apiClient.post('/api/v1/billing/bulk-proformas', { sales_order_ids: salesOrderIds }).then((r) => r.data);
  },

  /** Processamento de Faturação Mensal (Batch Invoicing) */
  simulateBatch(params: {
    date_from: string;
    date_to: string;
    empresa_id?: number;
    marketplace_id?: number;
    serie_faturas?: string;
    serie_nc?: string;
  }): Promise<SimulationResponse> {
    return apiClient.post('/api/v1/billing/simulate', params).then((r) => r.data);
  },

  executeBatch(params: {
    date_from: string;
    date_to: string;
    empresa_id?: number;
    marketplace_id?: number;
    serie_faturas?: string;
    serie_nc?: string;
  }): Promise<{ success: boolean; message: string; created_faturas: number; created_nc: number }> {
    return apiClient.post('/api/v1/billing/execute', params).then((r) => r.data);
  },

  simulateBatchDetailed(params: {
    date_from: string;
    date_to: string;
    empresa_id?: number;
    marketplace_id?: number;
    serie_faturas?: string;
    serie_nc?: string;
  }): Promise<SimulationDetailedResponse> {
    return apiClient.post('/api/v1/billing/simulate-detailed', params).then((r) => r.data);
  },
};
