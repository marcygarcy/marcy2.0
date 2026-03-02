'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Package, Loader2, RefreshCw } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { officeStockApi, type OfficeStockItem } from '@/lib/api/officeStock';

function formatDate(d: string | null) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('pt-PT');
  } catch {
    return d;
  }
}

export function OfficeStockView() {
  const { empresaSelecionada } = useApp();
  const [items, setItems] = useState<OfficeStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [skuFilter, setSkuFilter] = useState('');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await officeStockApi.list({
        empresa_id: empresaSelecionada?.id,
        status: statusFilter || undefined,
        sku: skuFilter || undefined,
        limit: 200,
      });
      setItems(Array.isArray(list) ? list : []);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string }; status?: number } })?.response?.data?.detail
        ?? (err as Error)?.message
        ?? 'Erro ao carregar stock. Verifique se o backend está a correr (e se executou o seed: scripts.seed_cancellation_office_stock).';
      setError(msg);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [empresaSelecionada?.id, statusFilter, skuFilter]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Package className="w-6 h-6 text-amber-400" />
        <div>
          <h2 className="text-xl font-bold text-white">Stock em escritório</h2>
          <p className="text-sm text-slate-400">
            Mercadoria com origem em cancelamentos (cliente cancelou, fornecedor não aceitou devolução). Disponível para reutilização em novos pedidos.
          </p>
        </div>
      </div>

      <Card className="bg-slate-800/60 border-slate-600">
        <CardHeader>
          <CardTitle className="text-lg text-slate-200 flex items-center justify-between">
            <span>Listagem</span>
            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-white"
              >
                <option value="">Todos os estados</option>
                <option value="available">Disponível</option>
                <option value="reserved">Reservado</option>
                <option value="consumed">Consumido</option>
              </select>
              <input
                type="text"
                placeholder="Filtrar por SKU..."
                value={skuFilter}
                onChange={(e) => setSkuFilter(e.target.value)}
                className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-white w-40"
              />
              <button
                type="button"
                onClick={load}
                disabled={loading}
                className="p-1.5 rounded bg-slate-600 text-white hover:bg-slate-500 disabled:opacity-50"
                title="Atualizar"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-400 mb-2">{error}</p>
              <p className="text-slate-500 text-sm">Confirme que o backend está em execução e que correu o seed: <code className="bg-slate-700 px-1 rounded">python -m scripts.seed_cancellation_office_stock</code></p>
              <button type="button" onClick={load} className="mt-3 px-4 py-2 rounded bg-slate-600 text-white text-sm hover:bg-slate-500">Tentar novamente</button>
            </div>
          ) : items.length === 0 ? (
            <p className="text-slate-400 text-center py-8">
              Nenhum stock em escritório. O stock aparece aqui quando cancela uma venda e indica que o fornecedor não aceita devolução (mercadoria no escritório não expedida). Pode inserir dados de teste com: <code className="bg-slate-700 px-1 rounded text-xs">python -m scripts.seed_cancellation_office_stock</code>
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-2 px-3 text-slate-300">ID</th>
                    <th className="text-left py-2 px-3 text-slate-300">SKU (marketplace)</th>
                    <th className="text-left py-2 px-3 text-slate-300">SKU fornecedor</th>
                    <th className="text-right py-2 px-3 text-slate-300">Qtd</th>
                    <th className="text-left py-2 px-3 text-slate-300">Estado</th>
                    <th className="text-left py-2 px-3 text-slate-300">Origem venda #</th>
                    <th className="text-left py-2 px-3 text-slate-300">PO #</th>
                    <th className="text-left py-2 px-3 text-slate-300">Escritório</th>
                    <th className="text-left py-2 px-3 text-slate-300">Data entrada</th>
                    <th className="text-left py-2 px-3 text-slate-300">Consumido por venda</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={row.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                      <td className="py-2 px-3 text-slate-400">{row.id}</td>
                      <td className="py-2 px-3 text-slate-200 font-mono text-xs">{row.sku_marketplace}</td>
                      <td className="py-2 px-3 text-slate-400 text-xs">{row.sku_fornecedor ?? '—'}</td>
                      <td className="py-2 px-3 text-right text-slate-200">{row.quantity}</td>
                      <td className="py-2 px-3">
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          row.status === 'available' ? 'bg-emerald-900/50 text-emerald-400' :
                          row.status === 'consumed' ? 'bg-slate-600 text-slate-300' :
                          'bg-amber-900/50 text-amber-400'
                        }`}>
                          {row.status === 'available' ? 'Disponível' : row.status === 'consumed' ? 'Consumido' : row.status}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-400">{row.source_sales_order_id ?? '—'}</td>
                      <td className="py-2 px-3 text-slate-400">{row.source_purchase_order_id ?? '—'}</td>
                      <td className="py-2 px-3 text-slate-400">{row.office_nome ?? '—'}</td>
                      <td className="py-2 px-3 text-slate-400">{formatDate(row.received_at ?? row.created_at)}</td>
                      <td className="py-2 px-3 text-slate-400">
                        {row.consumed_by_sales_order_id != null ? `Venda #${row.consumed_by_sales_order_id}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
