import apiClient from './client';
import type { TransactionsResponse } from '@/types/transactions';

export const transactionsApi = {
  async getTransactions(
    cicloPagamento?: string | null,
    cicloInicio?: string | null,
    cicloFim?: string | null,
    tipo?: string | null,
    limit: number = 1000,
    offset: number = 0
  ): Promise<TransactionsResponse> {
    const params: any = {
      limit,
      offset,
    };
    
    if (cicloPagamento && cicloPagamento !== 'todos' && !cicloInicio && !cicloFim) {
      params.ciclo_pagamento = cicloPagamento;
    }
    
    if (cicloInicio && cicloFim) {
      params.ciclo_inicio = cicloInicio;
      params.ciclo_fim = cicloFim;
    }
    
    if (tipo && tipo !== 'todos') {
      params.tipo = tipo;
    }
    
    const response = await apiClient.get<TransactionsResponse>(
      '/api/v1/transactions/',
      { params }
    );
    return response.data;
  },

  async getTransactionTypes(): Promise<string[]> {
    const response = await apiClient.get<{ types: string[] }>('/api/v1/transactions/types');
    return response.data.types;
  },
};

