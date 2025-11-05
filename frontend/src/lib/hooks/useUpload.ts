import { useState } from 'react';
import { uploadApi } from '@/lib/api/upload';
import type { UploadResponse, UploadType } from '@/types/transactions';

export function useUpload() {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const upload = async (file: File, type: UploadType) => {
    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      let response: UploadResponse;
      
      if (type === 'transactions') {
        response = await uploadApi.uploadTransactions(file);
      } else if (type === 'trf') {
        response = await uploadApi.uploadTRF(file);
      } else if (type === 'orders') {
        response = await uploadApi.uploadOrders(file);
      } else {
        throw new Error('Tipo de upload não suportado');
      }

      if (response.success) {
        setSuccess(response.message);
      } else {
        setError(response.message);
      }

      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao fazer upload';
      setError(message);
      throw err;
    } finally {
      setUploading(false);
    }
  };

  const reset = () => {
    setError(null);
    setSuccess(null);
  };

  return { upload, uploading, error, success, reset };
}

