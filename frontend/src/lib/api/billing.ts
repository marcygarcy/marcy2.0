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
};
