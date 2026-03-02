import apiClient from './client';

export interface Marketplace {
  id: number;
  empresa_id: number;
  nome: string;
  codigo?: string;
  descricao?: string;
  ativo: boolean;
}

export interface MarketplaceCreate {
  empresa_id: number;
  nome: string;
  codigo?: string;
  descricao?: string;
}

export interface MarketplaceUpdate {
  nome?: string;
  codigo?: string;
  descricao?: string;
  ativo?: boolean;
}

export const marketplacesApi = {
  getAll: async (empresaId?: number): Promise<Marketplace[]> => {
    const params = empresaId != null ? { empresa_id: empresaId } : {};
    const { data } = await apiClient.get<{ marketplaces?: Marketplace[] }>('/api/v1/marketplaces/', { params });
    return Array.isArray(data?.marketplaces) ? data.marketplaces : [];
  },

  getByEmpresa: async (empresaId: number): Promise<Marketplace[]> => {
    const { data } = await apiClient.get<{ marketplaces?: Marketplace[] }>(`/api/v1/marketplaces/empresa/${empresaId}`);
    return Array.isArray(data?.marketplaces) ? data.marketplaces : [];
  },

  getById: async (id: number): Promise<Marketplace> => {
    const { data } = await apiClient.get<Marketplace>(`/api/v1/marketplaces/${id}`);
    return data;
  },

  create: async (marketplace: MarketplaceCreate): Promise<Marketplace> => {
    const { data } = await apiClient.post<Marketplace>('/api/v1/marketplaces/', marketplace);
    return data;
  },

  update: async (id: number, marketplace: MarketplaceUpdate): Promise<Marketplace> => {
    const { data } = await apiClient.put<Marketplace>(`/api/v1/marketplaces/${id}`, marketplace);
    return data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/v1/marketplaces/${id}`);
  },
};

