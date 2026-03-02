import apiClient from './client';

export interface OfficeStockItem {
  id: number;
  empresa_id: number;
  office_id: number | null;
  sku_marketplace: string;
  sku_fornecedor: string | null;
  quantity: number;
  source_type: string;
  source_sales_order_id: number | null;
  source_sales_order_item_id: number | null;
  source_purchase_order_id: number | null;
  source_purchase_order_item_id: number | null;
  status: string;
  condition: string;
  received_at: string | null;
  rma_claim_id: number | null;
  created_at: string | null;
  consumed_by_sales_order_id: number | null;
  consumed_by_sales_order_item_id: number | null;
  consumed_at: string | null;
  office_nome?: string | null;
  empresa_nome?: string | null;
}

export const officeStockApi = {
  list: async (params: {
    empresa_id?: number;
    office_id?: number;
    sku?: string;
    status?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<OfficeStockItem[]> => {
    const search = new URLSearchParams();
    if (params.empresa_id != null) search.append('empresa_id', String(params.empresa_id));
    if (params.office_id != null) search.append('office_id', String(params.office_id));
    if (params.sku) search.append('sku', params.sku);
    if (params.status) search.append('status', params.status);
    search.append('limit', String(params.limit ?? 200));
    search.append('offset', String(params.offset ?? 0));
    const { data } = await apiClient.get<OfficeStockItem[]>(`/api/v1/office-stock?${search.toString()}`);
    return data;
  },

  getAvailableBySku: async (params: {
    empresa_id: number;
    sku_marketplace: string;
    office_id?: number;
  }): Promise<{ id: number; quantity: number; sku_fornecedor: string | null; source_sales_order_id: number | null; office_id: number | null; office_nome: string | null }[]> => {
    const search = new URLSearchParams();
    search.append('empresa_id', String(params.empresa_id));
    search.append('sku_marketplace', params.sku_marketplace);
    if (params.office_id != null) search.append('office_id', String(params.office_id));
    const { data } = await apiClient.get(`/api/v1/office-stock/available-by-sku?${search.toString()}`);
    return data;
  },

  consume: async (
    officeStockId: number,
    body: { quantity: number; sales_order_id: number; sales_order_item_id?: number }
  ): Promise<{ success: boolean; quantity_consumed: number; sales_order_id: number }> => {
    const { data } = await apiClient.post(`/api/v1/office-stock/${officeStockId}/consume`, body);
    return data;
  },
};
