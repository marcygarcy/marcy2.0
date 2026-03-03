import apiClient from './client';

export interface TaxMatrixEntry {
  id: number;
  country_code: string;
  country_name: string;
  standard_rate: number;
  reduced_rate: number | null;
  reduced_rate_2: number | null;
  super_reduced_rate: number | null;
  is_eu: boolean;
  updated_at: string | null;
}

export interface SkuBridgeEntry {
  id: number;
  empresa_id: number | null;
  sku_global: string;
  descricao: string | null;
  ean: string | null;
  asin: string | null;
  ref_fornecedor_1: string | null;
  ref_fornecedor_2: string | null;
  marketplace: string | null;
  created_at: string | null;
}

export const configApi = {
  // ─── Tax Matrix ────────────────────────────────────────────────────────────
  listTaxMatrix: async (onlyEu?: boolean): Promise<TaxMatrixEntry[]> => {
    const params: Record<string, string> = {};
    if (onlyEu !== undefined) params.only_eu = String(onlyEu);
    const { data } = await apiClient.get<{ items: TaxMatrixEntry[] }>('/api/v1/config/tax-matrix', { params });
    return data.items;
  },

  updateTaxMatrix: async (
    countryCode: string,
    payload: {
      standard_rate: number;
      reduced_rate?: number | null;
      reduced_rate_2?: number | null;
      super_reduced_rate?: number | null;
      country_name?: string;
    }
  ): Promise<void> => {
    await apiClient.put(`/api/v1/config/tax-matrix/${countryCode}`, payload);
  },

  // ─── SKU Bridge ────────────────────────────────────────────────────────────
  listSkuBridge: async (params: {
    empresa_id?: number;
    q?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ items: SkuBridgeEntry[]; total: number }> => {
    const p: Record<string, string> = {};
    if (params.empresa_id != null) p.empresa_id = String(params.empresa_id);
    if (params.q) p.q = params.q;
    if (params.limit != null) p.limit = String(params.limit);
    if (params.offset != null) p.offset = String(params.offset);
    const { data } = await apiClient.get<{ items: SkuBridgeEntry[]; total: number }>(
      '/api/v1/config/sku-bridge',
      { params: p }
    );
    return data;
  },

  createSkuBridge: async (body: Omit<SkuBridgeEntry, 'id' | 'created_at'>): Promise<{ id: number }> => {
    const { data } = await apiClient.post<{ id: number }>('/api/v1/config/sku-bridge', body);
    return data;
  },

  updateSkuBridge: async (id: number, body: Omit<SkuBridgeEntry, 'id' | 'created_at'>): Promise<void> => {
    await apiClient.put(`/api/v1/config/sku-bridge/${id}`, body);
  },

  deleteSkuBridge: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/v1/config/sku-bridge/${id}`);
  },

  // ─── SMTP ──────────────────────────────────────────────────────────────────
  getSmtp: async (): Promise<SmtpConfig> => {
    const { data } = await apiClient.get<SmtpConfig>('/api/v1/config/smtp');
    return data;
  },

  saveSmtp: async (cfg: SmtpConfig & { smtp_password?: string }): Promise<void> => {
    await apiClient.post('/api/v1/config/smtp', cfg);
  },

  testSmtp: async (test_email: string): Promise<{ success: boolean; error?: string }> => {
    const { data } = await apiClient.post<{ success: boolean; error?: string }>(
      '/api/v1/config/smtp/test',
      { test_email }
    );
    return data;
  },
};

export interface SmtpConfig {
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_from: string;
  smtp_password_set: boolean;
}
