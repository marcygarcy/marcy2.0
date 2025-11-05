import apiClient from './client';

export interface Order {
  id: number;
  numero_pedido: string;
  data_criacao: string | null;
  data_pagamento: string | null;
  ciclo_pagamento: string | null;
  valor_total: number | null;
  quantidade_itens: number | null;
  status: string | null;
  canal_vendas: string | null;
  empresa_id: number | null;
  marketplace_id: number | null;
  data_upload: string | null;
}

export interface OrdersResponse {
  orders: Order[];
  total: number;
  limit: number;
  offset: number;
}

export const ordersApi = {
  getAll: async (
    empresaId?: number,
    marketplaceId?: number,
    limit: number = 100,
    offset: number = 0
  ): Promise<OrdersResponse> => {
    const params = new URLSearchParams();
    if (empresaId !== undefined) params.append('empresa_id', empresaId.toString());
    if (marketplaceId !== undefined) params.append('marketplace_id', marketplaceId.toString());
    params.append('limit', limit.toString());
    params.append('offset', offset.toString());
    
    const response = await apiClient.get<OrdersResponse>(`/api/v1/orders/?${params.toString()}`);
    return response.data;
  },
};

