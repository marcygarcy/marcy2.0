import apiClient from './client';

export interface PaymentMethod {
  id: number;
  empresa_id: number;
  metodo_tipo: string;
  designacao: string;
  referencia_last_4?: string | null;
  ativo?: boolean | null;
  data_criacao?: string | null;
}

export const paymentMethodsApi = {
  listByEmpresa: async (empresaId: number): Promise<PaymentMethod[]> => {
    const { data } = await apiClient.get<{ items: PaymentMethod[] }>(
      `/api/v1/payment-methods?empresa_id=${empresaId}`
    );
    return data?.items ?? [];
  },
};
