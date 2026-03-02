import apiClient from './client';
import type { KPIs, ReconciliationResponse, Prazos, Comissoes, Reembolsos, Reserva, CycleBreakdownResponse } from '@/types/kpis';

export const kpiApi = {
  getAll: async (empresaId?: number, marketplaceId?: number): Promise<KPIs> => {
    const params = new URLSearchParams();
    if (empresaId !== undefined) params.append('empresa_id', empresaId.toString());
    if (marketplaceId !== undefined) params.append('marketplace_id', marketplaceId.toString());
    const queryString = params.toString();
    const url = `/api/v1/kpis/all${queryString ? `?${queryString}` : ''}`;
    const response = await apiClient.get<KPIs>(url);
    return response.data;
  },

  getPrazos: async (): Promise<Prazos> => {
    const response = await apiClient.get<Prazos>('/api/v1/kpis/prazos');
    return response.data;
  },

  getComissoesAcum: async (): Promise<Comissoes> => {
    const response = await apiClient.get<Comissoes>('/api/v1/kpis/comissoes/acum');
    return response.data;
  },

  getComissoesUlt: async (): Promise<Comissoes> => {
    const response = await apiClient.get<Comissoes>('/api/v1/kpis/comissoes/ult');
    return response.data;
  },

  getReembolsosAcum: async (): Promise<Reembolsos> => {
    const response = await apiClient.get<Reembolsos>('/api/v1/kpis/reembolsos/acum');
    return response.data;
  },

  getReembolsosUlt: async (): Promise<Reembolsos> => {
    const response = await apiClient.get<Reembolsos>('/api/v1/kpis/reembolsos/ult');
    return response.data;
  },

  getReservaSaldo: async (): Promise<Reserva> => {
    const response = await apiClient.get<Reserva>('/api/v1/kpis/reserva/saldo');
    return response.data;
  },

  getReconciliation: async (empresaId?: number, marketplaceId?: number): Promise<ReconciliationResponse> => {
    const params = new URLSearchParams();
    if (empresaId !== undefined) params.append('empresa_id', empresaId.toString());
    if (marketplaceId !== undefined) params.append('marketplace_id', marketplaceId.toString());
    const queryString = params.toString();
    const url = `/api/v1/kpis/reconciliation${queryString ? `?${queryString}` : ''}`;
    const response = await apiClient.get<ReconciliationResponse>(url);
    return response.data;
  },

  getUltimoCicloDetalhes: async (ciclo?: string, empresaId?: number, marketplaceId?: number): Promise<CycleBreakdownResponse> => {
    const params = new URLSearchParams();
    if (ciclo) params.append('ciclo', ciclo);
    if (empresaId !== undefined) params.append('empresa_id', empresaId.toString());
    if (marketplaceId !== undefined) params.append('marketplace_id', marketplaceId.toString());
    const queryString = params.toString();
    const url = `/api/v1/kpis/ultimo-ciclo/detalhes${queryString ? `?${queryString}` : ''}`;
    const response = await apiClient.get<CycleBreakdownResponse>(url);
    return response.data;
  },

  getAvailableCycles: async (empresaId?: number, marketplaceId?: number): Promise<string[]> => {
    const params = new URLSearchParams();
    if (empresaId !== undefined) params.append('empresa_id', empresaId.toString());
    if (marketplaceId !== undefined) params.append('marketplace_id', marketplaceId.toString());
    const queryString = params.toString();
    const url = `/api/v1/kpis/cycles${queryString ? `?${queryString}` : ''}`;
    const response = await apiClient.get<{ cycles: string[] }>(url);
    return response.data.cycles;
  },

  getVendasBrutasPorCiclo: async (empresaId?: number, marketplaceId?: number): Promise<{ cycles: Array<{ ciclo: string; data_ciclo: string; vendas_brutas: number }> }> => {
    const params = new URLSearchParams();
    if (empresaId !== undefined) params.append('empresa_id', empresaId.toString());
    if (marketplaceId !== undefined) params.append('marketplace_id', marketplaceId.toString());
    const queryString = params.toString();
    const url = `/api/v1/kpis/vendas-brutas-por-ciclo${queryString ? `?${queryString}` : ''}`;
    const response = await apiClient.get<{ cycles: Array<{ ciclo: string; data_ciclo: string; vendas_brutas: number }> }>(url);
    return response.data;
  },

  getComissoesPorCiclo: async (empresaId?: number, marketplaceId?: number): Promise<{ cycles: Array<{ ciclo: string; data_ciclo: string; comissoes: number; imposto: number }> }> => {
    const params = new URLSearchParams();
    if (empresaId !== undefined) params.append('empresa_id', empresaId.toString());
    if (marketplaceId !== undefined) params.append('marketplace_id', marketplaceId.toString());
    const queryString = params.toString();
    const url = `/api/v1/kpis/comissoes-por-ciclo${queryString ? `?${queryString}` : ''}`;
    const response = await apiClient.get<{ cycles: Array<{ ciclo: string; data_ciclo: string; comissoes: number; imposto: number }> }>(url);
    return response.data;
  },

  getProdutosMaisVendidos: async (empresaId?: number, marketplaceId?: number): Promise<{
    historico: { sku: string; categoria: string; quantidade: number; valor_total: number; preco_unitario: number } | null;
    ultimos_60_dias: { sku: string; categoria: string; quantidade: number; valor_total: number; preco_unitario: number } | null;
  }> => {
    const params = new URLSearchParams();
    if (empresaId !== undefined) params.append('empresa_id', empresaId.toString());
    if (marketplaceId !== undefined) params.append('marketplace_id', marketplaceId.toString());
    const queryString = params.toString();
    const url = `/api/v1/kpis/produtos-mais-vendidos${queryString ? `?${queryString}` : ''}`;
    const response = await apiClient.get<{
      historico: { sku: string; categoria: string; quantidade: number; valor_total: number; preco_unitario: number } | null;
      ultimos_60_dias: { sku: string; categoria: string; quantidade: number; valor_total: number; preco_unitario: number } | null;
    }>(url);
    return response.data;
  },

  getReservasList: async (empresaId?: number, marketplaceId?: number): Promise<{
    reservas: Array<{
      numero_transacao: string;
      data_criacao: string | null;
      numero_fatura: string;
      descricao: string;
      tipo: string;
      valor: number;
      ciclo_pagamento: string;
      real: number;
      credito: number;
      debito: number;
    }>;
    count: number;
  }> => {
    const params = new URLSearchParams();
    if (empresaId !== undefined) params.append('empresa_id', empresaId.toString());
    if (marketplaceId !== undefined) params.append('marketplace_id', marketplaceId.toString());
    const queryString = params.toString();
    const url = `/api/v1/kpis/reservas${queryString ? `?${queryString}` : ''}`;
    const response = await apiClient.get<{
      reservas: Array<{
        numero_transacao: string;
        data_criacao: string | null;
        numero_fatura: string;
        descricao: string;
        tipo: string;
        valor: number;
        ciclo_pagamento: string;
        real: number;
        credito: number;
        debito: number;
      }>;
      count: number;
    }>(url);
    return response.data;
  },

  deleteReserva: async (
    numero_transacao: string,
    numero_fatura: string,
    data_criacao: string,
    tipo: string
  ): Promise<void> => {
    await apiClient.delete('/api/v1/kpis/reservas', {
      params: {
        numero_transacao,
        numero_fatura,
        data_criacao,
        tipo,
      },
    });
  },
};

