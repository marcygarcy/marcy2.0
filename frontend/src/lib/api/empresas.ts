import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface Empresa {
  id: number;
  nome: string;
  codigo?: string;
  nif?: string;
  morada?: string;
  email?: string;
  telefone?: string;
  ativo: boolean;
}

export interface EmpresaCreate {
  nome: string;
  codigo?: string;
  nif?: string;
  morada?: string;
  email?: string;
  telefone?: string;
}

export interface EmpresaUpdate {
  nome?: string;
  codigo?: string;
  nif?: string;
  morada?: string;
  email?: string;
  telefone?: string;
  ativo?: boolean;
}

export const empresasApi = {
  getAll: async (): Promise<Empresa[]> => {
    const response = await axios.get(`${API_URL}/api/v1/empresas/`);
    return response.data.empresas || [];
  },

  getById: async (id: number): Promise<Empresa> => {
    const response = await axios.get(`${API_URL}/api/v1/empresas/${id}`);
    return response.data;
  },

  create: async (empresa: EmpresaCreate): Promise<Empresa> => {
    const response = await axios.post(`${API_URL}/api/v1/empresas/`, empresa);
    return response.data;
  },

  update: async (id: number, empresa: EmpresaUpdate): Promise<Empresa> => {
    const response = await axios.put(`${API_URL}/api/v1/empresas/${id}`, empresa);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await axios.delete(`${API_URL}/api/v1/empresas/${id}`);
  },
};

