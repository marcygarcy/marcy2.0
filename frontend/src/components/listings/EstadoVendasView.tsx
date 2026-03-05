'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Loader2, BarChart2, RefreshCw } from 'lucide-react';
import { purchasesApi, type SaleStateItem } from '@/lib/api/purchases';
import { useApp } from '@/context/AppContext';

export function EstadoVendasView() {
  const { empresaSelecionada } = useApp();
  const empresaId = empresaSelecionada?.id ?? undefined;
  const [saleState, setSaleState] = useState<SaleStateItem[]>([]);
  const [loadingState, setLoadingState] = useState(false);
  const [estadoFilter, setEstadoFilter] = useState('');

  useEffect(() => {
    setLoadingState(true);
    purchasesApi.getSaleState(empresaId, 500)
      .then((r) => setSaleState(r.items ?? []))
      .catch(() => setSaleState([]))
      .finally(() => setLoadingState(false));
  }, [empresaId]);

  const filtered = estadoFilter.trim()
    ? saleState.filter((s) =>
        (s.numero_pedido ?? '').toLowerCase().includes(estadoFilter.toLowerCase()) ||
        (s.sku_oferta ?? '').toLowerCase().includes(estadoFilter.toLowerCase())
      )
    : saleState;

  const countByEstado = filtered.reduce<Record<string, number>>((acc, s) => {
    const k = s.estado_venda ?? 'Desconhecido';
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart2 className="w-5 h-5 text-amber-400" />
          Estado das Vendas (pipeline)
        </CardTitle>
        <p className="text-slate-400 text-sm mt-1">
          Visão do ciclo completo: venda → compra → receção → expedição ao cliente.
        </p>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <input
            type="text"
            placeholder="Filtrar por n.º pedido ou SKU..."
            value={estadoFilter}
            onChange={(e) => setEstadoFilter(e.target.value)}
            className="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm w-72"
          />
          <button
            type="button"
            onClick={() => {
              setLoadingState(true);
              purchasesApi.getSaleState(empresaId, 500)
                .then((r) => setSaleState(r.items ?? []))
                .catch(() => setSaleState([]))
                .finally(() => setLoadingState(false));
            }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-700 text-slate-200 text-sm hover:bg-slate-600"
          >
            <RefreshCw className="w-4 h-4" /> Atualizar
          </button>
        </div>

        {loadingState ? (
          <div className="flex items-center justify-center py-12 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> A carregar...
          </div>
        ) : saleState.length === 0 ? (
          <p className="text-slate-400 text-center py-8">
            Nenhuma venda com dados de pipeline disponíveis. Certifique-se que as vendas têm ordens de compra associadas.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 mb-4">
              {Object.entries(countByEstado).map(([estado, count]) => (
                <span key={estado} className="px-3 py-1 rounded-full text-xs font-medium bg-slate-700 text-slate-300">
                  {estado}: <strong className="text-white">{count}</strong>
                </span>
              ))}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-2 px-2 text-slate-300 font-semibold">N.º pedido</th>
                    <th className="text-left py-2 px-2 text-slate-300 font-semibold">SKU</th>
                    <th className="text-right py-2 px-2 text-slate-300 font-semibold">Qtd</th>
                    <th className="text-left py-2 px-2 text-slate-300 font-semibold">Estado venda</th>
                    <th className="text-left py-2 px-2 text-slate-300 font-semibold">Empresa</th>
                    <th className="text-left py-2 px-2 text-slate-300 font-semibold">PO</th>
                    <th className="text-left py-2 px-2 text-slate-300 font-semibold">Ref. fornecedor</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s, idx) => (
                    <tr key={idx} className="border-b border-slate-800 hover:bg-slate-800/50">
                      <td className="py-2 px-2 text-slate-200">{s.numero_pedido ?? `#${s.order_id}`}</td>
                      <td className="py-2 px-2 text-slate-400 font-mono text-xs">{s.sku_oferta ?? '—'}</td>
                      <td className="py-2 px-2 text-right text-slate-300">{s.quantidade ?? '—'}</td>
                      <td className="py-2 px-2">
                        <span className={`text-xs font-medium ${
                          s.estado_venda === 'Expedido ao Cliente' ? 'text-emerald-400' :
                          s.estado_venda === 'No Escritório' ? 'text-blue-400' :
                          s.estado_venda === 'Em Processamento de Compra' ? 'text-amber-400' :
                          'text-slate-400'
                        }`}>
                          {s.estado_venda ?? '—'}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-slate-400">{s.empresa_nome ?? '—'}</td>
                      <td className="py-2 px-2 text-slate-400">
                        {s.purchase_order_id ? (
                          <span className="text-xs bg-amber-900/40 text-amber-300 px-2 py-0.5 rounded">
                            PO #{s.purchase_order_id}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="py-2 px-2 text-slate-400 font-mono text-xs">{s.supplier_order_id ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
