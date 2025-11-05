'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, X, Download, Trash2, FileText } from 'lucide-react';
import { useInvoices, useInvoicesByCycle } from '@/lib/hooks/useInvoices';
import { invoicesApi } from '@/lib/api/invoices';
import type { InvoiceType } from '@/types/invoices';

export function InvoiceManager() {
  const { cycles, loading: cyclesLoading } = useInvoices();
  const [selectedCycle, setSelectedCycle] = useState<string>('');
  const [selectedType, setSelectedType] = useState<InvoiceType>('fatura');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  const { invoices, loading: invoicesLoading, refresh: refreshInvoices } = useInvoicesByCycle(
    selectedCycle || null
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles((prev) => [...prev, ...files]);
    setUploadMessage(null);
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (!selectedCycle) {
      setUploadMessage({ type: 'error', text: 'Selecione um ciclo primeiro' });
      return;
    }

    if (selectedFiles.length === 0) {
      setUploadMessage({ type: 'error', text: 'Selecione pelo menos um ficheiro' });
      return;
    }

    try {
      setUploading(true);
      setUploadMessage(null);

      const result = await invoicesApi.uploadMultipleInvoices(
        selectedCycle,
        selectedType,
        selectedFiles
      );

      console.log('Resultado do upload:', result);
      
      // Verificar se há resultados individuais
      if (result.results && result.results.length > 0) {
        const successCount = result.results.filter((r: any) => r.success).length;
        const failCount = result.results.filter((r: any) => !r.success).length;
        
        // Log dos resultados individuais
        result.results.forEach((r: any) => {
          if (!r.success) {
            console.error(`Falha no ficheiro ${r.filename}: ${r.message}`);
          }
        });
        
        if (failCount === 0) {
          setUploadMessage({ type: 'success', text: `${successCount} faturas carregadas com sucesso!` });
          setSelectedFiles([]);
          refreshInvoices();
        } else if (successCount > 0) {
          setUploadMessage({ 
            type: 'error', 
            text: `${successCount} sucesso, ${failCount} falhas. Primeira falha: ${result.results.find((r: any) => !r.success)?.message || 'Erro desconhecido'}` 
          });
          setSelectedFiles([]);
          refreshInvoices();
        } else {
          // Todas falharam
          const firstError = result.results.find((r: any) => !r.success);
          setUploadMessage({ 
            type: 'error', 
            text: `Nenhuma fatura carregada. ${firstError?.message || 'Erro desconhecido'}` 
          });
        }
      } else if (result.success) {
        setUploadMessage({ type: 'success', text: 'Faturas carregadas com sucesso!' });
        setSelectedFiles([]);
        refreshInvoices();
      } else {
        setUploadMessage({ type: 'error', text: result.message || 'Erro ao carregar faturas' });
      }
    } catch (error: any) {
      console.error('Erro completo no upload:', error);
      const errorMessage = error.response?.data?.detail || 
                          error.response?.data?.message || 
                          error.message || 
                          'Erro ao carregar faturas';
      setUploadMessage({
        type: 'error',
        text: errorMessage
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (invoiceId: number) => {
    try {
      await invoicesApi.downloadInvoice(invoiceId);
    } catch (error) {
      console.error('Erro ao descarregar fatura:', error);
      alert('Erro ao descarregar fatura');
    }
  };

  const handleDelete = async (invoiceId: number) => {
    if (!confirm('Tem a certeza que deseja eliminar esta fatura?')) {
      return;
    }

    try {
      await invoicesApi.deleteInvoice(invoiceId);
      refreshInvoices();
    } catch (error) {
      console.error('Erro ao eliminar fatura:', error);
      alert('Erro ao eliminar fatura');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle>📄 Carregar Faturas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Seleção de Ciclo */}
            <div>
              <label className="block text-sm font-medium mb-3 text-slate-300">
                Ciclo de Pagamento
              </label>
              <select
                value={selectedCycle}
                onChange={(e) => {
                  setSelectedCycle(e.target.value);
                  setSelectedFiles([]);
                  setUploadMessage(null);
                }}
                className="w-full px-4 py-2 bg-slate-600 border border-slate-500 rounded-lg text-white focus:outline-none focus:border-blue-500"
                disabled={cyclesLoading}
              >
                <option value="">Selecione um ciclo...</option>
                {cycles.map((cycle) => (
                  <option key={cycle} value={cycle}>
                    {cycle}
                  </option>
                ))}
              </select>
            </div>

            {/* Seleção de Tipo */}
            <div>
              <label className="block text-sm font-medium mb-3 text-slate-300">
                Tipo de Documento
              </label>
              <select
                value={selectedType}
                onChange={(e) => {
                  setSelectedType(e.target.value as InvoiceType);
                  setUploadMessage(null);
                }}
                className="w-full px-4 py-2 bg-slate-600 border border-slate-500 rounded-lg text-white focus:outline-none focus:border-blue-500"
              >
                <option value="fatura">Fatura</option>
                <option value="crédito automático">Crédito Automático</option>
              </select>
            </div>

            {/* Área de Upload */}
            <div className="border-2 border-dashed border-slate-500 rounded-lg p-8 text-center hover:border-blue-500 transition-colors cursor-pointer relative">
              <input
                type="file"
                onChange={handleFileSelect}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                accept=".pdf,.jpg,.jpeg,.png"
                multiple
                disabled={uploading || !selectedCycle}
              />
              <Upload className="mx-auto mb-3 text-slate-400" size={32} />
              <p className="text-slate-300 font-medium">
                Clique para selecionar ou arraste os ficheiros
              </p>
              <p className="text-slate-500 text-sm mt-2">
                PDF, JPG, PNG (múltiplos ficheiros permitidos)
              </p>
            </div>

            {/* Lista de Ficheiros Selecionados */}
            {selectedFiles.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-slate-400">Ficheiros selecionados:</p>
                {selectedFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between bg-slate-700 p-3 rounded-lg"
                  >
                    <span className="text-slate-300 text-sm">{file.name}</span>
                    <button
                      onClick={() => removeFile(index)}
                      className="text-red-400 hover:text-red-300"
                    >
                      <X size={18} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Mensagens */}
            {uploadMessage && (
              <div
                className={`px-4 py-3 rounded-lg ${
                  uploadMessage.type === 'success'
                    ? 'bg-green-900/20 border border-green-500 text-green-400'
                    : 'bg-red-900/20 border border-red-500 text-red-400'
                }`}
              >
                {uploadMessage.text}
              </div>
            )}

            {/* Botão Upload */}
            <Button
              onClick={handleUpload}
              disabled={!selectedCycle || selectedFiles.length === 0 || uploading}
              className="w-full"
            >
              {uploading ? 'A carregar...' : `Carregar ${selectedFiles.length} ficheiro(s)`}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Faturas */}
      {selectedCycle && (
        <Card>
          <CardHeader>
            <CardTitle>Faturas do Ciclo: {selectedCycle}</CardTitle>
          </CardHeader>
          <CardContent>
            {invoicesLoading ? (
              <div className="text-center py-8 text-slate-400">A carregar faturas...</div>
            ) : invoices.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                Nenhuma fatura carregada para este ciclo
              </div>
            ) : (
              <div className="space-y-3">
                {invoices.map((invoice) => (
                  <div
                    key={invoice.id}
                    className="flex items-center justify-between bg-slate-700 p-4 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="text-blue-400" size={24} />
                      <div>
                        <p className="text-white font-medium">{invoice.nome_ficheiro}</p>
                        <p className="text-slate-400 text-sm">
                          {invoice.tipo_documento} • {formatFileSize(invoice.tamanho_ficheiro)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDownload(invoice.id)}
                        className="p-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white"
                        title="Descarregar"
                      >
                        <Download size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(invoice.id)}
                        className="p-2 bg-red-600 hover:bg-red-700 rounded-lg text-white"
                        title="Eliminar"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

