import apiClient from './client';

export interface ReceiveItemRow {
  purchase_order_item_id: number;
  quantity_received: number;
  serial_number?: string | null;
  imei?: string | null;
}

export interface ReceiveItemsPayload {
  purchase_order_id: number;
  office_id: number;
  items: ReceiveItemRow[];
  created_by?: string | null;
}

export interface DispatchItemPayload {
  purchase_order_item_id: number;
  office_id: number;
  quantity: number;
  tracking_number?: string | null;
  carrier_name?: string | null;
  carrier_status?: string | null;
  created_by?: string | null;
}

export interface LogisticsEvent {
  id: number;
  purchase_order_id: number;
  purchase_order_item_id: number | null;
  office_id: number;
  event_type: string;
  quantity: number;
  serial_number: string | null;
  imei: string | null;
  tracking_number: string | null;
  notes: string | null;
  created_at: string;
}

export interface PoItemForOffice {
  id: number;
  purchase_order_id: number;
  order_id: number;
  sales_order_item_id: number | null;
  sku_marketplace: string | null;
  sku_fornecedor: string | null;
  quantidade: number;
  quantidade_recebida: number;
  logistics_status: string;
  supplier_order_id: string | null;
}

export const logisticsApi = {
  receiveItems: async (body: ReceiveItemsPayload): Promise<{ success: boolean; events_created: { id: number; purchase_order_item_id: number; quantity: number }[]; errors: string[] }> => {
    const { data } = await apiClient.post('/api/v1/logistics/receive-items', body);
    return data;
  },

  dispatchItem: async (body: DispatchItemPayload): Promise<{ success: boolean; event_id: number | null; marketplace_update: string | null; error?: string }> => {
    const { data } = await apiClient.post('/api/v1/logistics/dispatch-item', body);
    return data;
  },

  getEvents: async (params?: { purchase_order_id?: number; office_id?: number; limit?: number }): Promise<LogisticsEvent[]> => {
    const search = new URLSearchParams();
    if (params?.purchase_order_id != null) search.set('purchase_order_id', String(params.purchase_order_id));
    if (params?.office_id != null) search.set('office_id', String(params.office_id));
    if (params?.limit != null) search.set('limit', String(params.limit));
    const { data } = await apiClient.get<LogisticsEvent[]>(`/api/v1/logistics/events?${search}`);
    return data;
  },

  getPoForOffice: async (officeId: number, empresaId?: number, status?: string): Promise<PoItemForOffice[]> => {
    const search = new URLSearchParams({ office_id: String(officeId) });
    if (empresaId != null) search.set('empresa_id', String(empresaId));
    if (status) search.set('status', status);
    const { data } = await apiClient.get<PoItemForOffice[]>(`/api/v1/logistics/po-for-office?${search}`);
    return data;
  },
};
