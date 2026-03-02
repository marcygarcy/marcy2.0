import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';
import { useUpload } from '@/lib/hooks/useUpload';
import type { UploadType } from '@/types/transactions';

interface FileUploadProps {
  onSuccess?: () => void;
}

export function FileUpload({ onSuccess }: FileUploadProps) {
  const [uploadType, setUploadType] = useState<UploadType>('transactions');
  const [file, setFile] = useState<File | null>(null);
  const { upload, uploading, error, success, reset } = useUpload();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      reset();
    }
  };

  const handleUpload = async () => {
    console.log('[FILE_UPLOAD] handleUpload chamado', { 
      hasFile: !!file, 
      fileName: file?.name,
      uploadType 
    });
    
    if (!file) {
      console.warn('[FILE_UPLOAD] Nenhum ficheiro selecionado');
      return;
    }

    console.log('[FILE_UPLOAD] Iniciando upload...');
    try {
      const result = await upload(file, uploadType);
      console.log('[FILE_UPLOAD] Upload concluído:', result);
      setFile(null);
      if (onSuccess) {
        console.log('[FILE_UPLOAD] Chamando onSuccess callback...');
        setTimeout(onSuccess, 1000);
      }
    } catch (err) {
      console.error('[FILE_UPLOAD] Erro no upload:', err);
    }
  };

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>📤 Carregar Ficheiros</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-3 text-slate-300">
              Tipo de Ficheiro
            </label>
            <select
              value={uploadType}
              onChange={(e) => {
                setUploadType(e.target.value as UploadType);
                reset();
              }}
              className="w-full px-4 py-2 bg-slate-600 border border-slate-500 rounded-lg text-white focus:outline-none focus:border-blue-500"
            >
              <option value="transactions">Histórico de Transações (XLSX/CSV)</option>
              <option value="trf">Transferências Bancárias (XLSX/CSV)</option>
              <option value="orders">Listagem de Orders (XLSX/CSV)</option>
            </select>
          </div>

          <div className="border-2 border-dashed border-slate-500 rounded-lg p-8 text-center hover:border-blue-500 transition-colors cursor-pointer relative">
            <input
              type="file"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              accept=".xlsx,.csv,.xls"
              disabled={uploading}
            />
            <Upload className="mx-auto mb-3 text-slate-400" size={32} />
            <p className="text-slate-300 font-medium">
              {file ? file.name : 'Clique para selecionar ou arraste o ficheiro'}
            </p>
            <p className="text-slate-500 text-sm mt-2">XLSX ou CSV</p>
          </div>

          {error && (
            <div className="bg-red-900/20 border border-red-500 text-red-400 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-900/20 border border-green-500 text-green-400 px-4 py-3 rounded-lg">
              {success}
            </div>
          )}

          <Button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="w-full"
          >
            {uploading ? 'A processar...' : 'Processar Ficheiro'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

