import apiClient from './client';

export interface Empresa {
  id: number;
  nome: string;
  codigo?: string;
  nif?: string;
  morada?: string;
  pais?: string;
  email?: string;
  telefone?: string;
  ativo: boolean;
  designacao_social?: string;
  morada_fiscal?: string;
  email_financeiro?: string;
  logotipo_url?: string;
  iban?: string;
  moeda_base?: string;
}

export interface EmpresaCreate {
  nome: string;
  codigo?: string;
  nif?: string;
  morada?: string;
  email?: string;
  telefone?: string;
  pais?: string;
  designacao_social?: string;
  morada_fiscal?: string;
  email_financeiro?: string;
  logotipo_url?: string;
  iban?: string;
  moeda_base?: string;
}

export interface EmpresaUpdate {
  nome?: string;
  codigo?: string;
  nif?: string;
  morada?: string;
  email?: string;
  telefone?: string;
  ativo?: boolean;
  pais?: string;
  designacao_social?: string;
  morada_fiscal?: string;
  email_financeiro?: string;
  logotipo_url?: string;
  iban?: string;
  moeda_base?: string;
}

export const empresasApi = {
  getAll: async (): Promise<Empresa[]> => {
    const { data } = await apiClient.get<{ empresas?: Empresa[] }>('/api/v1/empresas/');
    return Array.isArray(data?.empresas) ? data.empresas : [];
  },

  getById: async (id: number): Promise<Empresa> => {
    const { data } = await apiClient.get<Empresa>(`/api/v1/empresas/${id}`);
    return data;
  },

  create: async (empresa: EmpresaCreate): Promise<Empresa> => {
    const { data } = await apiClient.post<Empresa>('/api/v1/empresas/', empresa);
    return data;
  },

  update: async (id: number, empresa: EmpresaUpdate): Promise<Empresa> => {
    const { data } = await apiClient.put<Empresa>(`/api/v1/empresas/${id}`, empresa);
    return data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/v1/empresas/${id}`);
  },
};

