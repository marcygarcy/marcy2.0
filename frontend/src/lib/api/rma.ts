import apiClient from './client';

/** Fases do workflow de incidências */
export type IncidentPhase =
  | 'intervencao_compras'
  | 'reembolsos_pendentes'
  | 'logistica_intercecao'
  | 'auto_resolvida'
  | 'perda_assumida';

export interface IncidentItem {
  id: number;
  empresa_id: number;
  sales_order_id: number | null;
  supplier_id: number | null;
  purchase_order_id: number | null;
  refund_customer_value: number;
  credit_note_supplier_value: number;
  reason: string | null;
  created_at: string | null;
  external_order_id: string | null;
  payment_was_made: number;
  payment_blocked_at: string | null;
  workflow_phase: string | null;
  credit_note_numero: string | null;
  credit_note_tipo: string | null;
  supplier_nome: string | null;
  empresa_nome: string | null;
  po_status: string | null;
  po_total: number;
}

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

  // ── Incidências (workflow por fase) ─────────────────────────────────────
  listIncidents: async (phase: IncidentPhase, empresaId?: number): Promise<IncidentItem[]> => {
    const s = new URLSearchParams({ phase });
    if (empresaId != null) s.append('empresa_id', String(empresaId));
    const { data } = await apiClient.get<IncidentItem[]>(`/api/v1/rma/incidents?${s}`);
    return data;
  },

  fornecedorAceitou: async (incidentId: number, paymentWasMade: boolean): Promise<{ success: boolean; workflow_phase?: string; error?: string }> => {
    const { data } = await apiClient.post(`/api/v1/rma/incidents/${incidentId}/fornecedor-aceitou`, { payment_was_made: paymentWasMade });
    return data;
  },

  fornecedorRecusou: async (incidentId: number): Promise<{ success: boolean; workflow_phase?: string; error?: string }> => {
    const { data } = await apiClient.post(`/api/v1/rma/incidents/${incidentId}/fornecedor-recusou`);
    return data;
  },

  registarNC: async (
    incidentId: number,
    payload: { numero_nc: string; valor: number; tipo: 'transferencia' | 'credito_conta' }
  ): Promise<{ success: boolean; workflow_phase?: string; error?: string }> => {
    const { data } = await apiClient.post(`/api/v1/rma/incidents/${incidentId}/registar-nc`, payload);
    return data;
  },

  intercecaoSucesso: async (incidentId: number): Promise<{ success: boolean; workflow_phase?: string; error?: string }> => {
    const { data } = await apiClient.post(`/api/v1/rma/incidents/${incidentId}/intercecao-sucesso`);
    return data;
  },

  perdaAssumida: async (incidentId: number, valorImparidade?: number): Promise<{ success: boolean; workflow_phase?: string; valor_imparidade?: number; error?: string }> => {
    const { data } = await apiClient.post(`/api/v1/rma/incidents/${incidentId}/perda-assumida`, valorImparidade != null ? { valor_imparidade: valorImparidade } : {});
    return data;
  },
};
