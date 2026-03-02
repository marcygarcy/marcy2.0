import apiClient from './client';

export interface PendenteTransaction {
  ciclo_pagamento: string | null;
  data_ciclo_faturamento: string | null;
  data_criacao: string | null;
  canal_vendas: string | null;
  tipo: string | null;
  credito: number;
  debito: number;
  real: number;
  valor: number | null;
  descricao: string | null;
  numero_pedido: string | null;
  numero_fatura: string | null;
  numero_transacao: string | null;
  rotulo_categoria: string | null;
  sku_oferta: string | null;
  moeda: string | null;
}

export interface PendenteOrder {
  id: number;
  numero_pedido: string;
  data_criacao: string | null;
  data_pagamento: string | null;
  ciclo_pagamento: string | null;
  valor_total: number | null;
  quantidade_itens: number | null;
  status: string | null;
  canal_vendas: string | null;
}

export interface PendentesResponse {
  transacoes: PendenteTransaction[];
  pedidos: PendenteOrder[];
  total_transacoes: number;
  total_pedidos: number;
}

export const pendentesApi = {
  getAll: async (
    empresaId?: number,
    marketplaceId?: number,
    limit: number = 1000
  ): Promise<PendentesResponse> => {
    const params = new URLSearchParams();
    if (empresaId !== undefined) params.append('empresa_id', empresaId.toString());
    if (marketplaceId !== undefined) params.append('marketplace_id', marketplaceId.toString());
    params.append('limit', limit.toString());
    
    const response = await apiClient.get<PendentesResponse>(`/api/v1/pendentes/?${params.toString()}`);
    return response.data;
  },
};

