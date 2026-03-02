import apiClient from './client';
import type { UploadResponse, UploadType } from '@/types/transactions';

export const uploadApi = {
  uploadTransactions: async (file: File, empresaId: number = 2, marketplaceId: number = 1): Promise<UploadResponse> => {
    console.log('[UPLOAD_API] uploadTransactions iniciado', { 
      fileName: file.name, 
      fileSize: file.size,
      empresaId, 
      marketplaceId 
    });
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('empresa_id', empresaId.toString());
    formData.append('marketplace_id', marketplaceId.toString());
    
    console.log('[UPLOAD_API] FormData criado, verificando entradas...');
    for (const [key, value] of formData.entries()) {
      if (value instanceof File) {
        console.log(`[UPLOAD_API] FormData[${key}]: File(${value.name}, ${value.size} bytes, ${value.type})`);
      } else {
        console.log(`[UPLOAD_API] FormData[${key}]: ${value}`);
      }
    }
    
    console.log('[UPLOAD_API] Enviando pedido POST para /api/v1/upload/transactions...');
    const startTime = Date.now();
    
    try {
      // Não definir Content-Type manualmente - o axios faz isso automaticamente com boundary
      const response = await apiClient.post<UploadResponse>(
        '/api/v1/upload/transactions',
        formData
      );
      
      const duration = Date.now() - startTime;
      console.log(`[UPLOAD_API] Resposta recebida em ${duration}ms:`, response.data);
      
      return response.data;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error(`[UPLOAD_API] Erro após ${duration}ms:`, {
        message: error?.message,
        response: error?.response?.data,
        status: error?.response?.status,
        statusText: error?.response?.statusText,
        config: {
          url: error?.config?.url,
          method: error?.config?.method,
          headers: error?.config?.headers
        }
      });
      throw error;
    }
  },

  uploadTRF: async (file: File, empresaId: number = 2, marketplaceId: number = 1): Promise<UploadResponse> => {
    console.log('[UPLOAD_API] uploadTRF iniciado', { 
      fileName: file.name, 
      fileSize: file.size,
      empresaId, 
      marketplaceId 
    });
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('empresa_id', empresaId.toString());
    formData.append('marketplace_id', marketplaceId.toString());
    
    console.log('[UPLOAD_API] Enviando pedido POST para /api/v1/upload/trf...');
    const startTime = Date.now();
    
    try {
      const response = await apiClient.post<UploadResponse>(
        '/api/v1/upload/trf',
        formData
      );
      
      const duration = Date.now() - startTime;
      console.log(`[UPLOAD_API] Resposta recebida em ${duration}ms:`, response.data);
      
      return response.data;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error(`[UPLOAD_API] Erro após ${duration}ms:`, error);
      throw error;
    }
  },

  uploadOrders: async (file: File, empresaId: number = 2, marketplaceId: number = 1): Promise<UploadResponse> => {
    console.log('[UPLOAD_API] uploadOrders iniciado', { 
      fileName: file.name, 
      fileSize: file.size,
      empresaId, 
      marketplaceId 
    });
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('empresa_id', empresaId.toString());
    formData.append('marketplace_id', marketplaceId.toString());
    
    console.log('[UPLOAD_API] Enviando pedido POST para /api/v1/upload/orders...');
    const startTime = Date.now();
    
    try {
      const response = await apiClient.post<UploadResponse>(
        '/api/v1/upload/orders',
        formData
      );
      
      const duration = Date.now() - startTime;
      console.log(`[UPLOAD_API] Resposta recebida em ${duration}ms:`, response.data);
      
      return response.data;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error(`[UPLOAD_API] Erro após ${duration}ms:`, error);
      throw error;
    }
  },
};

