import apiClient from './client';

export interface RmaAlert {
  id: number;
  empresa_id: number;
  sales_order_id: number | null;
  supplier_id: number | null;
  supplier_nome: string;
  empresa_nome: string;
  refund_customer_value: number;
  credit_note_supplier_value: number;
  reason: string | null;
  created_at: string | null;
  external_order_id: string | null;
  alert_type: string;
  message: string;
}

export interface RmaPendingItem {
  id: number;
  empresa_id: number;
  sales_order_id: number | null;
  supplier_id: number | null;
  refund_customer_value: number;
  created_at: string | null;
  external_order_id: string | null;
  supplier_nome: string;
}

export const rmaApi = {
  getAlerts: async (params?: { empresa_id?: number; days_without_credit_note?: number }): Promise<RmaAlert[]> => {
    const s = new URLSearchParams();
    if (params?.empresa_id != null) s.append('empresa_id', String(params.empresa_id));
    if (params?.days_without_credit_note != null) s.append('days_without_credit_note', String(params.days_without_credit_note));
    const { data } = await apiClient.get<RmaAlert[]>(`/api/v1/rma/alerts?${s}`);
    return data;
  },

  getPending: async (empresaId?: number): Promise<RmaPendingItem[]> => {
    const s = new URLSearchParams();
    if (empresaId != null) s.append('empresa_id', String(empresaId));
    const { data } = await apiClient.get<RmaPendingItem[]>(`/api/v1/rma/pending?${s}`);
    return data;
  },

  registerRefund: async (body: {
    empresa_id: number;
    sales_order_id?: number;
    sales_order_item_id?: number;
    supplier_id?: number;
    refund_customer_value?: number;
    reason?: string;
    external_order_id?: string;
  }): Promise<{ id: number; status: string; message: string }> => {
    const { data } = await apiClient.post('/api/v1/rma/register-refund', body);
    return data;
  },
};
