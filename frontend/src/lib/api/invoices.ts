import apiClient from './client';
import type { Invoice } from '@/types/invoices';

export interface CycleOption {
  cycles: string[];
}

export interface InvoiceUploadResponse {
  success: boolean;
  message?: string;
  results?: Array<{
    filename: string;
    success: boolean;
    message: string;
  }>;
}

export interface InvoicesByCycleResponse {
  invoices: Invoice[];
}

export interface AllInvoicesResponse {
  invoices_by_cycle: Record<string, Invoice[]>;
}

export const invoicesApi = {
  async getCycles(): Promise<string[]> {
    const response = await apiClient.get<CycleOption>('/api/v1/invoices/cycles');
    return response.data.cycles;
  },

  async uploadInvoice(
    cicloPagamento: string,
    tipoDocumento: string,
    file: File
  ): Promise<InvoiceUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('ciclo_pagamento', cicloPagamento);
    formData.append('tipo_documento', tipoDocumento);

    const response = await apiClient.post<InvoiceUploadResponse>(
      '/api/v1/invoices/upload',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  },

  async uploadMultipleInvoices(
    cicloPagamento: string,
    tipoDocumento: string,
    files: File[]
  ): Promise<InvoiceUploadResponse> {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });
    formData.append('ciclo_pagamento', cicloPagamento);
    formData.append('tipo_documento', tipoDocumento);

    // Não definir Content-Type manualmente - o axios faz isso automaticamente com boundary
    const response = await apiClient.post<InvoiceUploadResponse>(
      '/api/v1/invoices/upload-multiple',
      formData
    );
    return response.data;
  },

  async getInvoicesByCycle(cicloPagamento: string): Promise<Invoice[]> {
    const response = await apiClient.get<InvoicesByCycleResponse>(
      `/api/v1/invoices/cycle`,
      {
        params: {
          ciclo_pagamento: cicloPagamento,
        },
      }
    );
    return response.data.invoices;
  },

  async getAllInvoices(): Promise<Record<string, Invoice[]>> {
    const response = await apiClient.get<AllInvoicesResponse>('/api/v1/invoices/all');
    return response.data.invoices_by_cycle;
  },

  async downloadInvoice(invoiceId: number): Promise<void> {
    const response = await apiClient.get(`/api/v1/invoices/download/${invoiceId}`, {
      responseType: 'blob',
    });
    
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'invoice.pdf');
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  async deleteInvoice(invoiceId: number): Promise<void> {
    await apiClient.delete(`/api/v1/invoices/${invoiceId}`);
  },
};

