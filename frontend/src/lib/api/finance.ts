import apiClient from './client';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface LedgerLine {
  id: number;
  empresa_id: number | null;
  supplier_id: number | null;
  data_movimento: string | null;
  tipo: string;
  documento_ref: string | null;
  purchase_order_id: number | null;
  valor_credito: number;
  valor_debito: number;
  saldo_acumulado: number;
  notas: string | null;
  created_at: string | null;
  supplier_nome: string | null;
  empresa_nome: string | null;
}

export interface LedgerResponse {
  entries: LedgerLine[];
  total: number;
  saldo_atual: number;
}

export interface LedgerEntryIn {
  empresa_id: number;
  supplier_id: number;
  tipo: string;
  valor_credito?: number;
  valor_debito?: number;
  documento_ref?: string;
  purchase_order_id?: number;
  notas?: string;
  data_movimento?: string;
}

export interface AgingRow {
  supplier_id: number;
  supplier_nome: string;
  empresa_id: number | null;
  empresa_nome: string | null;
  a_vencer: number;
  vencido_30: number;
  vencido_mais_30: number;
  total_divida: number;
}

export interface DiscrepancyRow {
  id: number;
  empresa_id: number | null;
  purchase_order_id: number | null;
  invoice_ref: string | null;
  invoice_amount: number | null;
  po_amount: number | null;
  bank_movement_id: number | null;
  bank_amount: number | null;
  status: string;
  discrepancy_amount: number | null;
  discrepancy_notes: string | null;
  created_at: string | null;
  supplier_order_id: string | null;
  data_ordered: string | null;
  supplier_nome: string | null;
  empresa_nome: string | null;
}

export interface DiscrepanciesResponse {
  items: DiscrepancyRow[];
  total: number;
}

export interface ProfitabilityData {
  gmv: number;
  devolucoes: number;
  comissoes: number;
  custo_base: number;
  portes_reais: number;
  impostos_po: number;
  custo_total: number;
  lucro_real: number;
  margem_pct: number;
}

export interface CashFlowDay {
  data_vencimento: string;
  total_saidas: number;
  num_pos: number;
  pos: Array<{ po_id: number; empresa_nome: string; supplier_nome: string; total: number }>;
}

export interface CashFlowProjectionDay {
  data: string;
  valor_dia: number;
  saldo_acumulado: number;
}

export interface SupplierHealthRow {
  supplier_id: number;
  supplier_nome: string;
  health_score: number;
  lead_time_days: number | null;
  return_rate_pct: number;
  margin_alert_count: number;
  avg_margin_pct: number | null;
}

export interface MatchResult {
  purchase_order_id: number;
  po_amount: number;
  invoice_amount: number | null;
  bank_amount: number | null;
  status: string;
  discrepancy_amount: number;
  discrepancy_notes: string | null;
}

// ─── Pagamentos (Antecipado, Sugestão, Confirmar) ───────────────────────────

export interface PaymentSuggestionItem {
  purchase_order_id: number;
  empresa_id: number | null;
  empresa_nome: string | null;
  supplier_id: number | null;
  supplier_nome: string | null;
  total_final: number;
  data_ordered: string | null;
  due_date: string | null;
  invoice_ref: string | null;
  status: string | null;
  prazo_pagamento: string | null;
  metodo_pagamento: string | null;
}

export interface PaymentHistoricoItem {
  ledger_id: number;
  data_movimento: string | null;
  empresa_id: number | null;
  empresa_nome: string | null;
  supplier_id: number | null;
  supplier_nome: string | null;
  metodo_pagamento: string | null;
  purchase_order_id: number | null;
  documento_ref: string | null;
  valor: number;
  notas: string | null;
}

export interface PaymentsAntecipadoResponse {
  items: PaymentSuggestionItem[];
  total: number;
}

export interface PaymentsSugestaoResponse {
  items: PaymentSuggestionItem[];
  total_valor: number;
}

export interface ConfirmPaymentItem {
  purchase_order_id: number;
  valor?: number;
}

export interface ConfirmPaymentRequest {
  empresa_id: number;
  items: ConfirmPaymentItem[];
  data_pagamento?: string;
  criar_movimento_banco?: boolean;
}

export interface ConfirmPaymentResponse {
  created_ledger_ids: number[];
  updated_po_ids: number[];
  reconciliation_ids: number[];
  bank_movement_id: number | null;
  total_pago: number;
}

export interface LedgerMovimento {
  id: number;
  data_movimento: string | null;
  tipo: string;
  tipo_doc: string;          // FT | NC | ND | RE | AJ
  dc: string;                // D | C
  num_doc: string | null;
  descricao: string | null;
  valor_credito: number;
  valor_debito: number;
  saldo_corrente: number;
  purchase_order_id: number | null;
}

export interface LedgerExtractResponse {
  saldo_inicial: number;
  movimentos: LedgerMovimento[];
  total_creditos: number;
  total_debitos: number;
  saldo_final: number;
  supplier_nome: string;
  empresa_nome: string | null;
}

// ─── Faturas ERP-Grade ───────────────────────────────────────────────────────

export interface OpenPoForInvoice {
  id: number;
  status: string;
  total_final: number;
  data_criacao: string | null;
  supplier_order_id: string | null;
  invoice_ref: string | null;
  empresa_id: number;
  empresa_nome: string | null;
}

export interface SupplierInvoice {
  id: number;
  empresa_id: number;
  supplier_id: number;
  invoice_ref: string;
  invoice_date: string | null;
  invoice_amount: number;
  status: string;
  notas: string | null;
  supplier_nome: string | null;
  empresa_nome: string | null;
  po_count: number;
  po_ids: number[];
  has_ledger_entry: boolean;
  data_criacao: string | null;
}

export type DocumentTypeInvoice = 'Fatura' | 'NE' | 'Proforma';

export interface CreateInvoiceRequest {
  empresa_id: number;
  supplier_id: number;
  invoice_ref: string;
  invoice_amount: number;
  invoice_date?: string;
  po_ids: number[];
  notas?: string;
  post_to_ledger: boolean;
  document_type?: DocumentTypeInvoice;
}

// ─── API ─────────────────────────────────────────────────────────────────────

export const financeApi = {
  getLedgerExtract: async (
    supplierId: number,
    params: { empresa_id?: number; start_date?: string; end_date?: string } = {}
  ): Promise<LedgerExtractResponse> => {
    const s = new URLSearchParams();
    if (params.empresa_id != null) s.append('empresa_id', String(params.empresa_id));
    if (params.start_date) s.append('start_date', params.start_date);
    if (params.end_date) s.append('end_date', params.end_date);
    const { data } = await apiClient.get<LedgerExtractResponse>(
      `/api/v1/finance/ledger/${supplierId}/extract?${s}`
    );
    return data;
  },

  getLedger: async (
    supplierId: number,
    params: { empresa_id?: number; limit?: number; offset?: number } = {}
  ): Promise<LedgerResponse> => {
    const s = new URLSearchParams();
    if (params.empresa_id != null) s.append('empresa_id', String(params.empresa_id));
    s.append('limit', String(params.limit ?? 100));
    s.append('offset', String(params.offset ?? 0));
    const { data } = await apiClient.get<LedgerResponse>(
      `/api/v1/finance/ledger/${supplierId}?${s}`
    );
    return data;
  },

  createLedgerEntry: async (entry: LedgerEntryIn): Promise<{ id: number; saldo_acumulado: number }> => {
    const { data } = await apiClient.post('/api/v1/finance/ledger/entry', entry);
    return data;
  },

  getAging: async (empresaId?: number): Promise<AgingRow[]> => {
    const s = new URLSearchParams();
    if (empresaId != null) s.append('empresa_id', String(empresaId));
    const { data } = await apiClient.get<AgingRow[]>(`/api/v1/finance/aging?${s}`);
    return data;
  },

  getDiscrepancies: async (
    params: { empresa_id?: number; limit?: number; offset?: number } = {}
  ): Promise<DiscrepanciesResponse> => {
    const s = new URLSearchParams();
    if (params.empresa_id != null) s.append('empresa_id', String(params.empresa_id));
    s.append('limit', String(params.limit ?? 100));
    s.append('offset', String(params.offset ?? 0));
    const { data } = await apiClient.get<DiscrepanciesResponse>(
      `/api/v1/finance/reconciliation/discrepancies?${s}`
    );
    return data;
  },

  runTripleMatch: async (poId: number): Promise<MatchResult> => {
    const { data } = await apiClient.post<MatchResult>(
      `/api/v1/finance/reconciliation/match/${poId}`
    );
    return data;
  },

  getProfitability: async (
    params: { empresa_id?: number; data_inicio?: string; data_fim?: string } = {}
  ): Promise<ProfitabilityData> => {
    const s = new URLSearchParams();
    if (params.empresa_id != null) s.append('empresa_id', String(params.empresa_id));
    if (params.data_inicio) s.append('data_inicio', params.data_inicio);
    if (params.data_fim) s.append('data_fim', params.data_fim);
    const { data } = await apiClient.get<ProfitabilityData>(`/api/v1/finance/profitability?${s}`);
    return data;
  },

  getCashFlowForecast: async (
    params: { empresa_id?: number; days?: number } = {}
  ): Promise<CashFlowDay[]> => {
    const s = new URLSearchParams();
    if (params.empresa_id != null) s.append('empresa_id', String(params.empresa_id));
    s.append('days', String(params.days ?? 30));
    const { data } = await apiClient.get<CashFlowDay[]>(`/api/v1/finance/cash-flow-forecast?${s}`);
    return data;
  },

  getCashFlowProjection: async (
    params: { empresa_id?: number; days?: number; initial_balance?: number } = {}
  ): Promise<CashFlowProjectionDay[]> => {
    const s = new URLSearchParams();
    if (params.empresa_id != null) s.append('empresa_id', String(params.empresa_id));
    s.append('days', String(params.days ?? 30));
    if (params.initial_balance != null) s.append('initial_balance', String(params.initial_balance));
    const { data } = await apiClient.get<CashFlowProjectionDay[]>(`/api/v1/finance/cash-flow-projection?${s}`);
    return data;
  },

  getSupplierHealth: async (empresaId?: number): Promise<SupplierHealthRow[]> => {
    const s = new URLSearchParams();
    if (empresaId != null) s.append('empresa_id', String(empresaId));
    const { data } = await apiClient.get<SupplierHealthRow[]>(`/api/v1/finance/supplier-health?${s}`);
    return data;
  },

  getPaymentsAntecipado: async (empresaId?: number): Promise<PaymentsAntecipadoResponse> => {
    const s = new URLSearchParams();
    if (empresaId != null) s.append('empresa_id', String(empresaId));
    const { data } = await apiClient.get<PaymentsAntecipadoResponse>(`/api/v1/finance/payments/antecipado?${s}`);
    return data;
  },

  getPaymentsSugestao: async (params: {
    empresa_id?: number;
    data_inicio?: string;
    data_fim?: string;
  } = {}): Promise<PaymentsSugestaoResponse> => {
    const s = new URLSearchParams();
    if (params.empresa_id != null) s.append('empresa_id', String(params.empresa_id));
    if (params.data_inicio) s.append('data_inicio', params.data_inicio);
    if (params.data_fim) s.append('data_fim', params.data_fim);
    const { data } = await apiClient.get<PaymentsSugestaoResponse>(`/api/v1/finance/payments/sugestao?${s}`);
    return data;
  },

  confirmarPagamentos: async (body: ConfirmPaymentRequest): Promise<ConfirmPaymentResponse> => {
    const { data } = await apiClient.post<ConfirmPaymentResponse>('/api/v1/finance/payments/confirmar', body);
    return data;
  },

  getPaymentsHistorico: async (params: {
    empresa_id?: number;
    data_inicio?: string;
    data_fim?: string;
    metodo?: string;
  } = {}): Promise<PaymentHistoricoItem[]> => {
    const s = new URLSearchParams();
    if (params.empresa_id != null) s.append('empresa_id', String(params.empresa_id));
    if (params.data_inicio) s.append('data_inicio', params.data_inicio);
    if (params.data_fim) s.append('data_fim', params.data_fim);
    if (params.metodo) s.append('metodo', params.metodo);
    const { data } = await apiClient.get<PaymentHistoricoItem[]>(`/api/v1/finance/payments/historico?${s}`);
    return data;
  },

  getPaymentsHistoricoExport: async (params: {
    empresa_id?: number;
    data_inicio?: string;
    data_fim?: string;
    metodo?: string;
  } = {}): Promise<Blob> => {
    const s = new URLSearchParams();
    if (params.empresa_id != null) s.append('empresa_id', String(params.empresa_id));
    if (params.data_inicio) s.append('data_inicio', params.data_inicio);
    if (params.data_fim) s.append('data_fim', params.data_fim);
    if (params.metodo) s.append('metodo', params.metodo);
    const { data } = await apiClient.get<Blob>(`/api/v1/finance/payments/historico/export?${s}`, {
      responseType: 'blob',
    });
    return data;
  },

  // ── Módulo de Faturas ERP-Grade ────────────────────────────────────────────

  getSupplierOpenPos: async (
    supplierId: number,
    empresaId?: number,
  ): Promise<OpenPoForInvoice[]> => {
    const s = new URLSearchParams();
    if (empresaId != null) s.append('empresa_id', String(empresaId));
    const { data } = await apiClient.get<OpenPoForInvoice[]>(
      `/api/v1/finance/suppliers/${supplierId}/open-pos?${s}`
    );
    return data;
  },

  listSupplierInvoices: async (params: {
    empresa_id?: number;
    supplier_id?: number;
    status?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ items: SupplierInvoice[]; total: number }> => {
    const s = new URLSearchParams();
    if (params.empresa_id != null) s.append('empresa_id', String(params.empresa_id));
    if (params.supplier_id != null) s.append('supplier_id', String(params.supplier_id));
    if (params.status) s.append('status', params.status);
    if (params.limit != null) s.append('limit', String(params.limit));
    if (params.offset != null) s.append('offset', String(params.offset));
    const { data } = await apiClient.get<{ items: SupplierInvoice[]; total: number }>(
      `/api/v1/finance/invoices?${s}`
    );
    return data;
  },

  createSupplierInvoice: async (
    body: CreateInvoiceRequest,
  ): Promise<{ success: boolean; invoice_id: number; ledger_created: boolean; po_count: number }> => {
    const { data } = await apiClient.post<{ success: boolean; invoice_id: number; ledger_created: boolean; po_count: number }>(
      '/api/v1/finance/invoices',
      body,
    );
    return data;
  },
};
