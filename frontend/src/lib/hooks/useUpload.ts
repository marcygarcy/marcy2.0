import { useState } from 'react';
import { uploadApi } from '@/lib/api/upload';
import { useApp } from '@/context/AppContext';
import type { UploadResponse, UploadType } from '@/types/transactions';

export function useUpload() {
  const { empresaSelecionada, marketplaceSelecionado } = useApp();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const upload = async (file: File, type: UploadType) => {
    console.log('[UPLOAD_HOOK] Iniciando upload...', { 
      fileName: file.name, 
      fileSize: file.size, 
      fileType: file.type,
      uploadType: type 
    });
    
    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      let response: UploadResponse;
      
      // Usar empresa e marketplace selecionados, ou padrão
      const empresaId = empresaSelecionada?.id || 2; // Default: Teste 123
      const marketplaceId = marketplaceSelecionado?.id || 1; // Default: Pixmania
      
      console.log('[UPLOAD_HOOK] Parâmetros:', { 
        empresaId, 
        marketplaceId, 
        empresaSelecionada: empresaSelecionada?.nome,
        marketplaceSelecionado: marketplaceSelecionado?.nome
      });
      
      console.log('[UPLOAD_HOOK] Chamando API...', { type });
      
      if (type === 'transactions') {
        console.log('[UPLOAD_HOOK] Chamando uploadTransactions...');
        response = await uploadApi.uploadTransactions(file, empresaId, marketplaceId);
        console.log('[UPLOAD_HOOK] Resposta recebida:', response);
      } else if (type === 'trf') {
        console.log('[UPLOAD_HOOK] Chamando uploadTRF...');
        response = await uploadApi.uploadTRF(file, empresaId, marketplaceId);
        console.log('[UPLOAD_HOOK] Resposta recebida:', response);
      } else if (type === 'orders') {
        console.log('[UPLOAD_HOOK] Chamando uploadOrders...');
        response = await uploadApi.uploadOrders(file, empresaId, marketplaceId);
        console.log('[UPLOAD_HOOK] Resposta recebida:', response);
      } else {
        throw new Error('Tipo de upload não suportado');
      }

      console.log('[UPLOAD_HOOK] Processando resposta:', { success: response.success, message: response.message });

      if (response.success) {
        setSuccess(response.message);
        console.log('[UPLOAD_HOOK] Upload bem-sucedido!');
      } else {
        setError(response.message);
        console.error('[UPLOAD_HOOK] Upload falhou:', response.message);
      }

      return response;
    } catch (err) {
      console.error('[UPLOAD_HOOK] Erro capturado:', err);
      const message = err instanceof Error ? err.message : 'Erro ao fazer upload';
      setError(message);
      throw err;
    } finally {
      console.log('[UPLOAD_HOOK] Finalizando upload...');
      setUploading(false);
    }
  };

  const reset = () => {
    setError(null);
    setSuccess(null);
  };

  return { upload, uploading, error, success, reset };
}

