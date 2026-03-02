import apiClient from './client';

export interface SyncHistoryItem {
  id: number;
  supplier_id: number;
  empresa_id?: number | null;
  supplier_nome: string | null;
  sync_type: string;
  started_at: string | null;
  finished_at: string | null;
  status: string;
  message: string | null;
  records_updated: number | null;
  duration_seconds?: number | null;
}

export interface AutomationStats {
  prices_updated_today: number;
  trackings_captured_today: number;
  invoices_downloaded_today: number;
  error?: string;
}

export interface AutomationStatus {
  suppliers_with_access?: Array<{ supplier_id: number; supplier_nome: string }>;
  last_price_syncs: Array<{
    supplier_id: number;
    supplier_nome: string;
    finished_at: string | null;
    status: string;
    records_updated: number | null;
  }>;
  last_tracking_syncs: Array<{
    supplier_id: number;
    supplier_nome: string;
    finished_at: string | null;
    status: string;
    records_updated: number | null;
  }>;
  syncs_today_count: number;
  records_updated_today: number;
  suppliers_with_automation: number;
  error?: string;
}

export const automationApi = {
  getStatus: async (): Promise<AutomationStatus> => {
    const { data } = await apiClient.get<AutomationStatus>('/api/v1/automation/status');
    return data;
  },

  getStats: async (): Promise<AutomationStats> => {
    const { data } = await apiClient.get<AutomationStats>('/api/v1/automation/stats');
    return data;
  },

  getHistory: async (params?: { supplier_id?: number; sync_type?: string; limit?: number }): Promise<{ items: SyncHistoryItem[] }> => {
    const search = new URLSearchParams();
    if (params?.supplier_id != null) search.append('supplier_id', String(params.supplier_id));
    if (params?.sync_type) search.append('sync_type', params.sync_type);
    if (params?.limit != null) search.append('limit', String(params.limit));
    const { data } = await apiClient.get<{ items: SyncHistoryItem[] }>(`/api/v1/automation/history?${search}`);
    return data;
  },

  getSyncHistory: async (params?: { supplier_id?: number; sync_type?: string; limit?: number }): Promise<{ items: SyncHistoryItem[] }> => {
    const search = new URLSearchParams();
    if (params?.supplier_id != null) search.append('supplier_id', String(params.supplier_id));
    if (params?.sync_type) search.append('sync_type', params.sync_type);
    if (params?.limit != null) search.append('limit', String(params.limit));
    const { data } = await apiClient.get<{ items: SyncHistoryItem[] }>(`/api/v1/automation/sync-history?${search}`);
    return data;
  },

  syncNow: async (supplierId: number): Promise<{ success: boolean; message: string; supplier_id: number }> => {
    const { data } = await apiClient.post<{ success: boolean; message: string; supplier_id: number }>(`/api/v1/automation/sync-now/${supplierId}`);
    return data;
  },
};
