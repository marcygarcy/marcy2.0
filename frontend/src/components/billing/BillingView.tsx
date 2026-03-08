'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { billingApi, type BillingDocumentItem, type ProformaData } from '@/lib/api/billing';
import { formatCurrency } from '@/lib/utils';
import { FileText, Loader2, Eye, XCircle, RefreshCw, Calculator } from 'lucide-react';
import { ProformaPreview } from './ProformaPreview';
import { BatchInvoicingView } from './BatchInvoicingView';
import { useApp } from '@/context/AppContext';
import { empresasApi, type Empresa } from '@/lib/api/empresas';

export function BillingView() {
  const { empresaSelecionada } = useApp();
  const [activeTab, setActiveTab] = useState<'documentos' | 'batch'>('documentos');
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresaFilter, setEmpresaFilter] = useState<number | ''>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [docTypeFilter, setDocTypeFilter] = useState<string>('Proforma');
  const [items, setItems] = useState<BillingDocumentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [previewData, setPreviewData] = useState<ProformaData | null>(null);
  const limit = 50;

  useEffect(() => {
    empresasApi.getAll().then((data) => {
      if (Array.isArray(data) && data.length > 0) setEmpresas(data.filter((e: Empresa) => e.ativo));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (empresaSelecionada && empresaFilter === '') {
      setEmpresaFilter(empresaSelecionada.id);
    }
  }, [empresaSelecionada]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await billingApi.listDocuments({
        empresa_id: empresaFilter === '' ? undefined : Number(empresaFilter),
        doc_type: docTypeFilter || undefined,
        status: statusFilter || undefined,
        limit,
        offset: page * limit,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch {
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [empresaFilter, statusFilter, docTypeFilter, page]);

  const handleCancel = async (id: number) => {
    if (!confirm('Anular este documento?')) return;
    try {
      await billingApi.cancelDocument(id);
      load();
    } catch (e) {
      alert('Erro ao anular documento.');
    }
  };

  const handlePreview = async (salesOrderId: number) => {
    try {
      const data = await billingApi.getProformaData(salesOrderId);
      setPreviewData(data);
    } catch {
      alert('Erro ao carregar proforma.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-slate-200">
        <FileText className="w-6 h-6 text-amber-400" />
        <h1 className="text-2xl font-bold">Gestão Comercial</h1>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'documentos' | 'batch')}>
        <TabsList className="bg-slate-800 p-1">
          <TabsTrigger value="documentos" className="data-[state=active]:bg-amber-600 data-[state=active]:text-white">
            <FileText className="w-3 h-3 mr-2" />
            Documentos emitidos
          </TabsTrigger>
          <TabsTrigger value="batch" className="data-[state=active]:bg-amber-600 data-[state=active]:text-white">
            <Calculator className="w-3 h-3 mr-2" />
            Processamento de Faturação Mensal
          </TabsTrigger>
        </TabsList>

        <TabsContent value="batch" className="mt-6">
          <BatchInvoicingView />
        </TabsContent>

        <TabsContent value="documentos" className="mt-6">
      <Card className="border-slate-700 bg-slate-800/50">
        <CardHeader>
          <CardTitle className="text-lg text-slate-200">Documentos emitidos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Empresa</label>
              <select
                value={empresaFilter}
                onChange={(e) => {
                  setEmpresaFilter(e.target.value === '' ? '' : Number(e.target.value));
                  setPage(0);
                }}
                className="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm min-w-[180px]"
              >
                <option value="">Todas</option>
                {empresas.map((e) => (
                  <option key={e.id} value={e.id}>{e.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Tipo</label>
              <select
                value={docTypeFilter}
                onChange={(e) => { setDocTypeFilter(e.target.value); setPage(0); }}
                className="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm"
              >
                <option value="Proforma">Proforma</option>
                <option value="">Todos</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Estado</label>
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
                className="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm"
              >
                <option value="">Todos</option>
                <option value="issued">Emitido</option>
                <option value="cancelled">Anulado</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => load()}
                className="p-2 rounded bg-slate-700 text-slate-300 hover:bg-slate-600"
                title="Atualizar"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              A carregar...
            </div>
          ) : items.length === 0 ? (
            <p className="text-slate-400 text-center py-12">
              Nenhum documento encontrado. Gere proformas a partir do módulo Vendas (Sales Explorer).
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-600">
                    <th className="text-left py-2 px-2 text-slate-300 font-semibold">Nº Doc</th>
                    <th className="text-left py-2 px-2 text-slate-300 font-semibold">Tipo</th>
                    <th className="text-left py-2 px-2 text-slate-300 font-semibold">Data</th>
                    <th className="text-left py-2 px-2 text-slate-300 font-semibold">Pedido</th>
                    <th className="text-left py-2 px-2 text-slate-300 font-semibold">Marketplace</th>
                    <th className="text-left py-2 px-2 text-slate-300 font-semibold">País</th>
                    <th className="text-right py-2 px-2 text-slate-300 font-semibold">Total</th>
                    <th className="text-left py-2 px-2 text-slate-300 font-semibold">Estado</th>
                    <th className="text-left py-2 px-2 text-slate-300 font-semibold">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((doc) => (
                    <tr key={doc.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                      <td className="py-2 px-2 text-slate-200 font-medium">{doc.document_number}</td>
                      <td className="py-2 px-2 text-slate-400">{doc.doc_type}</td>
                      <td className="py-2 px-2 text-slate-400">
                        {doc.issued_at ? new Date(doc.issued_at).toLocaleDateString('pt-PT') : '—'}
                      </td>
                      <td className="py-2 px-2 text-slate-400">{doc.external_order_id ?? '—'}</td>
                      <td className="py-2 px-2 text-slate-400">{doc.marketplace_nome ?? '—'}</td>
                      <td className="py-2 px-2 text-slate-400">{doc.customer_country ?? '—'}</td>
                      <td className="py-2 px-2 text-right text-emerald-400">
                        {doc.total_gross != null ? formatCurrency(doc.total_gross) : '—'}
                      </td>
                      <td className="py-2 px-2">
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          doc.status === 'cancelled' ? 'bg-red-900/50 text-red-400' : 'bg-emerald-900/50 text-emerald-400'
                        }`}>
                          {doc.status === 'cancelled' ? 'Anulado' : 'Emitido'}
                        </span>
                      </td>
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handlePreview(doc.sales_order_id)}
                            className="p-1.5 rounded bg-slate-700 text-slate-300 hover:bg-slate-600"
                            title="Ver proforma"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {doc.status !== 'cancelled' && (
                            <button
                              type="button"
                              onClick={() => handleCancel(doc.id)}
                              className="p-1.5 rounded bg-red-900/50 text-red-400 hover:bg-red-800/50"
                              title="Anular"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {total > limit && (
            <div className="flex justify-between items-center mt-4">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1.5 rounded bg-slate-700 text-slate-300 disabled:opacity-50 text-sm"
              >
                Anterior
              </button>
              <span className="text-slate-400 text-sm">
                {page * limit + 1}–{Math.min((page + 1) * limit, total)} de {total}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={(page + 1) * limit >= total}
                className="px-3 py-1.5 rounded bg-slate-700 text-slate-300 disabled:opacity-50 text-sm"
              >
                Seguinte
              </button>
            </div>
          )}
        </CardContent>
      </Card>
        </TabsContent>
      </Tabs>

      {previewData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <ProformaPreview
              data={previewData}
              showActions
              onClose={() => setPreviewData(null)}
              onPrint={() => window.print()}
            />
          </div>
        </div>
      )}
    </div>
  );
}
