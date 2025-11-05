import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

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
    const url = empresaId
      ? `${API_URL}/api/v1/marketplaces/?empresa_id=${empresaId}`
      : `${API_URL}/api/v1/marketplaces/`;
    const response = await axios.get(url);
    return response.data.marketplaces || [];
  },

  getByEmpresa: async (empresaId: number): Promise<Marketplace[]> => {
    const response = await axios.get(`${API_URL}/api/v1/marketplaces/empresa/${empresaId}`);
    return response.data.marketplaces || [];
  },

  getById: async (id: number): Promise<Marketplace> => {
    const response = await axios.get(`${API_URL}/api/v1/marketplaces/${id}`);
    return response.data;
  },

  create: async (marketplace: MarketplaceCreate): Promise<Marketplace> => {
    const response = await axios.post(`${API_URL}/api/v1/marketplaces/`, marketplace);
    return response.data;
  },

  update: async (id: number, marketplace: MarketplaceUpdate): Promise<Marketplace> => {
    const response = await axios.put(`${API_URL}/api/v1/marketplaces/${id}`, marketplace);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await axios.delete(`${API_URL}/api/v1/marketplaces/${id}`);
  },
};

