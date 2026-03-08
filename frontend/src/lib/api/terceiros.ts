import apiClient from './client';

export interface GtGrupo {
  id: number;
  empresa_id: number | null;
  codigo: string;
  nome: string;
  ativo: boolean;
}

export interface GtMovimento {
  id: number;
  empresa_id: number | null;
  grupo_id: number | null;
  data_mov: string | null;
  grupo_terceiro: string | null;
  valor: number;
  conta_contabilidade: string | null;
  descricao: string | null;
  data_criacao: string | null;
}

export interface MovimentoLinhaIn {
  data?: string;
  grupo_terceiro?: string;
  valor?: number;
  conta_contabilidade?: string;
  descricao?: string;
}

export const terceirosApi = {
  listGrupos: async (empresaId?: number): Promise<GtGrupo[]> => {
    const params = empresaId != null ? { empresa_id: empresaId } : {};
    const { data } = await apiClient.get<GtGrupo[]>('/api/v1/terceiros/grupos', { params });
    return data;
  },

  createMovimentos: async (
    body: { empresa_id?: number; linhas: MovimentoLinhaIn[] }
  ): Promise<{ created: number }> => {
    const { data } = await apiClient.post<{ created: number }>(
      '/api/v1/terceiros/movimentos',
      body
    );
    return data;
  },

  listMovimentos: async (
    params?: { empresa_id?: number; limit?: number; offset?: number; conta_contabilidade?: string; ano?: number; mes?: number }
  ): Promise<{ items: GtMovimento[]; total: number }> => {
    const { data } = await apiClient.get<{ items: GtMovimento[]; total: number }>(
      '/api/v1/terceiros/movimentos',
      { params }
    );
    return data;
  },

  updateMovimento: async (
    movimentoId: number,
    body: Partial<{ data_mov: string; grupo_terceiro: string; valor: number; conta_contabilidade: string; descricao: string }>
  ): Promise<{ updated: number }> => {
    const { data } = await apiClient.patch<{ updated: number }>(
      `/api/v1/terceiros/movimentos/${movimentoId}`,
      body
    );
    return data;
  },
};
