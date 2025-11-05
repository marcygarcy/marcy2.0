export interface Invoice {
  id: number;
  tipo_documento: string;
  nome_ficheiro: string;
  tamanho_ficheiro: number;
  data_upload: string | null;
}

export type InvoiceType = 'fatura' | 'crédito automático';

