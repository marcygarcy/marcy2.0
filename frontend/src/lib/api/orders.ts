import apiClient from './client';

export interface Order {
  id: number;
  numero_pedido: string;
  data_criacao: string | null;
  quantidade: number | null;
  detalhes: string | null;
  status: string | null;
  valor: number | null;
  canal_vendas: string | null;
  sku_oferta: string | null;
  marca: string | null;
  etiqueta_categoria: string | null;
  preco_unitario: number | null;
  valor_total_sem_impostos: number | null;
  valor_total_com_iva: number | null;
  comissao_sem_impostos: number | null;
  valor_comissao_com_impostos: number | null;
  valor_transferido_loja: number | null;
  pais_faturamento: string | null;
  imposto_produto_tva_fr_20: number | null;
  imposto_envio_tva_fr_20: number | null;
  imposto_produto_tva_es_21: number | null;
  imposto_envio_tva_es_21: number | null;
  imposto_produto_tva_it_22: number | null;
  imposto_envio_tva_it_22: number | null;
  imposto_produto_tva_zero: number | null;
  imposto_envio_tva_zero: number | null;
  total_impostos_pedido: number | null;
  total_impostos_envio: number | null;
  // Campos antigos (compatibilidade)
  data_pagamento: string | null;
  ciclo_pagamento: string | null;
  valor_total: number | null;
  quantidade_itens: number | null;
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

