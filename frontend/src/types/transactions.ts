export interface Transaction {
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

export interface TransactionsResponse {
  transactions: Transaction[];
  total: number;
  limit: number;
  offset: number;
}

export type UploadType = 'transactions' | 'trf' | 'orders';

export interface UploadResponse {
  success: boolean;
  message: string;
  records_inserted?: number | null;
}
