import apiClient from './client';

export interface BankMovement {
  id?: number;
  data_ctb: string;
  data_movimento: string;
  ciclo: string;
  montante: number;
}

export interface BankMovementsResponse {
  movements: BankMovement[];
  total: number;
  count: number;
}

export const bankApi = {
  getMovements: async (
    mes?: string,
    dataInicio?: string,
    dataFim?: string
  ): Promise<BankMovementsResponse> => {
    const params: Record<string, string> = {};
    if (mes) params.mes = mes;
    if (dataInicio) params.data_inicio = dataInicio;
    if (dataFim) params.data_fim = dataFim;

    const response = await apiClient.get<BankMovementsResponse>('/api/v1/bank/movements', { params });
    return response.data;
  },

  createMovement: async (movement: BankMovement): Promise<BankMovement> => {
    const response = await apiClient.post<BankMovement>('/api/v1/bank/movements', movement);
    return response.data;
  },

  updateMovement: async (id: number, movement: BankMovement): Promise<BankMovement> => {
    const response = await apiClient.put<BankMovement>(`/api/v1/bank/movements/${id}`, movement);
    return response.data;
  },

  deleteMovement: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/v1/bank/movements/${id}`);
  },

  getCycles: async (): Promise<string[]> => {
    const response = await apiClient.get<{ cycles: string[] }>('/api/v1/bank/cycles');
    return response.data.cycles;
  },
};
