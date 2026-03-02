import apiClient from './client';

export interface SupplierMaster {
  id?: number;
  empresa_id: number;
  nome: string;
  codigo?: string | null;
  entidade_id?: number | null;
  designacao_social?: string | null;
  nif_cif?: string | null;
  website_url?: string | null;
  morada?: string | null;
  codigo_postal?: string | null;
  localidade?: string | null;
  pais?: string | null;
  pais_iva?: string | null;
  regime_iva?: string | null;
  taxa_iva_padrao?: number | null;
  tel?: string | null;
  email?: string | null;
  email_comercial?: string | null;
  metodo_pagamento?: string | null;
  iban?: string | null;
  cartao_id?: number | null;
  prazo_pagamento?: string | null;
  default_shipping_type?: string | null;
  tipo_envio?: string | null;
  office_id?: number | null;
  entidade?: number | null;
  lead_time_estimado?: number | null;
  custo_envio_base?: number | null;
  supplier_score?: number | null;
  ativo?: boolean | null;
  payment_method_id?: number | null;
}

export interface OfficeLocation {
  id: number;
  empresa_id: number | null;
  designacao: string;
  morada: string | null;
  codigo_postal: string | null;
  localidade: string | null;
  pais: string;
  ativo: boolean | null;
}

export interface PrepareDraftPurchaseResult {
  success: boolean;
  order_id?: number;
  error?: string;
  supplier_id?: number;
  supplier_nome?: string;
  default_shipping_type?: string;
  delivery_address?: { designacao?: string; morada?: string; codigo_postal?: string; localidade?: string; pais?: string };
  custo_total_previsto?: number;
  custo_unitario?: number;
  quantidade?: number;
  portes_linha?: number;
  regime_iva?: string;
  iva_pct?: number;
  website_url?: string | null;
}

export const suppliersApi = {
  list: async (empresaId?: number): Promise<{ items: SupplierMaster[] }> => {
    const params = new URLSearchParams();
    if (empresaId != null) params.append('empresa_id', String(empresaId));
    const { data } = await apiClient.get<{ items: SupplierMaster[] }>(`/api/v1/suppliers?${params}`);
    return data;
  },

  get: async (supplierId: number): Promise<SupplierMaster> => {
    const { data } = await apiClient.get<SupplierMaster>(`/api/v1/suppliers/${supplierId}`);
    return data;
  },

  create: async (body: Partial<SupplierMaster> & { empresa_id: number; nome: string }): Promise<{ id: number }> => {
    const { data } = await apiClient.post<{ id: number }>('/api/v1/suppliers', body);
    return data;
  },

  update: async (supplierId: number, body: Partial<SupplierMaster>): Promise<{ message: string }> => {
    const { data } = await apiClient.put<{ message: string }>(`/api/v1/suppliers/${supplierId}`, body);
    return data;
  },

  listOffices: async (empresaId?: number): Promise<{ items: OfficeLocation[] }> => {
    const params = new URLSearchParams();
    if (empresaId != null) params.append('empresa_id', String(empresaId));
    const { data } = await apiClient.get<{ items: OfficeLocation[] }>(`/api/v1/suppliers/offices?${params}`);
    return data;
  },

  prepareDraftPurchase: async (orderId: number): Promise<PrepareDraftPurchaseResult> => {
    const { data } = await apiClient.post<PrepareDraftPurchaseResult>('/api/v1/suppliers/prepare-draft-purchase', { order_id: orderId });
    return data;
  },

  /** Devolve o blob do template Excel para download */
  downloadTemplate: async (): Promise<Blob> => {
    const { data } = await apiClient.get<Blob>('/api/v1/suppliers/template', { responseType: 'blob' });
    return data;
  },

  /** Acessos (credenciais para API/RPA + flags Midnight Sync): obter */
  getAccess: async (supplierId: number): Promise<{
    has_access: boolean;
    url_site?: string;
    login_user?: string;
    password_set?: boolean;
    api_key?: string;
    last_sync?: string;
    auto_sync_prices?: boolean;
    auto_sync_trackings?: boolean;
    auto_sync_invoices?: boolean;
  }> => {
    const { data } = await apiClient.get(`/api/v1/suppliers/${supplierId}/access`);
    return data;
  },

  /** Acessos: gravar (senha encriptada no backend + flags automação) */
  putAccess: async (supplierId: number, body: {
    url_site?: string;
    login_user?: string;
    login_password?: string;
    api_key?: string;
    auto_sync_prices?: boolean;
    auto_sync_trackings?: boolean;
    auto_sync_invoices?: boolean;
  }): Promise<{ message: string }> => {
    const { data } = await apiClient.put<{ message: string }>(`/api/v1/suppliers/${supplierId}/access`, body);
    return data;
  },

  /** Sincronizar dados do site (robô): extrai NIF, morada, nome legal e atualiza a ficha */
  syncProfile: async (supplierId: number): Promise<{ success: boolean; error?: string; updated?: Record<string, string>; message?: string }> => {
    const { data } = await apiClient.post<{ success: boolean; error?: string; updated?: Record<string, string>; message?: string }>(`/api/v1/suppliers/${supplierId}/sync-profile`);
    return data;
  },

  /** Importação em lote: envia ficheiro Excel e devolve resultado (inserted, errors) */
  importExcel: async (file: File): Promise<{ success: boolean; inserted?: number; errors?: string[]; error?: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await apiClient.post<{ success: boolean; inserted?: number; errors?: string[]; error?: string }>(
      '/api/v1/suppliers/import',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return data;
  },
};
