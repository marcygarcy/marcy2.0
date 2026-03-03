/**
 * Fase 6 – API client para Validação Manual de Faturas de Fornecedores.
 */
import apiClient from './client';

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type InvoiceStatus =
  | 'pendente_validacao'
  | 'aprovada'
  | 'aprovada_com_nota'
  | 'contestada'
  | 'em_discussao'
  | 'anulada';

export interface SupplierInvoice {
  id: number;
  empresa_id: number;
  supplier_id: number;
  supplier_nome: string | null;
  supplier_email: string | null;
  purchase_order_id: number | null;
  supplier_order_id: string | null;   // NE do Fornecedor
  invoice_ref: string;
  invoice_date: string | null;
  valor_fatura: number;
  valor_po: number | null;
  diferenca: number | null;
  flag_divergencia: boolean;
  invoice_pdf_url: string | null;
  status: InvoiceStatus;
  source: string;
  aprovado_por: string | null;
  aprovado_em: string | null;
  nota_aprovacao: string | null;
  data_criacao: string;
  data_atualizacao: string | null;
  // detalhe (apenas em get_detail)
  po_referencia?: string | null;
  po_data?: string | null;
  po_total?: number | null;
  po_estado?: string | null;
}

export interface InvoiceComm {
  id: number;
  invoice_id: number;
  data_envio: string;
  tipo: 'email_contestacao' | 'email_followup' | 'nota_interna';
  para_email: string | null;
  assunto: string | null;
  corpo: string | null;
  enviado_por: string | null;
}

export interface InvoiceValidationStats {
  pendente_validacao: number;
  contestada: number;
  em_discussao: number;
  aprovada: number;
  aprovada_com_nota: number;
  anulada: number;
  total: number;
}

export interface ContestBody {
  email_para: string;
  assunto: string;
  corpo: string;
  enviado_por?: string;
}

// ─── API functions ────────────────────────────────────────────────────────────

export const invoiceValidationApi = {
  getInbox: async (params?: {
    empresa_id?: number;
    supplier_id?: number;
    status?: InvoiceStatus;
    apenas_divergencias?: boolean;
  }): Promise<SupplierInvoice[]> => {
    const res = await apiClient.get('/api/v1/invoice-validation/inbox', { params });
    return res.data;
  },

  getStats: async (empresa_id?: number): Promise<InvoiceValidationStats> => {
    const res = await apiClient.get('/api/v1/invoice-validation/stats', {
      params: empresa_id ? { empresa_id } : {},
    });
    return res.data;
  },

  getSmtpStatus: async (): Promise<{ configured: boolean }> => {
    const res = await apiClient.get('/api/v1/invoice-validation/smtp-status');
    return res.data;
  },

  getDetail: async (invoiceId: number): Promise<SupplierInvoice> => {
    const res = await apiClient.get(`/api/v1/invoice-validation/${invoiceId}`);
    return res.data;
  },

  approve: async (invoiceId: number, aprovado_por = 'utilizador') => {
    const res = await apiClient.post(`/api/v1/invoice-validation/${invoiceId}/approve`, {
      aprovado_por,
    });
    return res.data;
  },

  approveWithNote: async (invoiceId: number, nota: string, aprovado_por = 'utilizador') => {
    const res = await apiClient.post(
      `/api/v1/invoice-validation/${invoiceId}/approve-with-note`,
      { nota, aprovado_por },
    );
    return res.data;
  },

  contest: async (invoiceId: number, body: ContestBody) => {
    const res = await apiClient.post(
      `/api/v1/invoice-validation/${invoiceId}/contest`,
      body,
    );
    return res.data;
  },

  setDiscussion: async (invoiceId: number) => {
    const res = await apiClient.post(`/api/v1/invoice-validation/${invoiceId}/set-discussion`);
    return res.data;
  },

  annul: async (invoiceId: number, motivo = '') => {
    const res = await apiClient.post(`/api/v1/invoice-validation/${invoiceId}/annul`, { motivo });
    return res.data;
  },

  addNote: async (invoiceId: number, nota: string, utilizador = 'utilizador') => {
    const res = await apiClient.post(`/api/v1/invoice-validation/${invoiceId}/add-note`, {
      nota,
      utilizador,
    });
    return res.data;
  },

  getComms: async (invoiceId: number): Promise<InvoiceComm[]> => {
    const res = await apiClient.get(`/api/v1/invoice-validation/${invoiceId}/comms`);
    return res.data;
  },
};
