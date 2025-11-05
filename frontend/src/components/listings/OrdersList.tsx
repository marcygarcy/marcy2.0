'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ShoppingCart, Loader2 } from 'lucide-react';
import { ordersApi, type Order } from '@/lib/api/orders';
import { useApp } from '@/context/AppContext';
import { formatCurrency } from '@/lib/utils';

export function OrdersList() {
  const { empresaSelecionada, marketplaceSelecionado } = useApp();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const limit = 50;

  useEffect(() => {
    loadOrders();
  }, [empresaSelecionada?.id, marketplaceSelecionado?.id, page]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      const empresaId = empresaSelecionada?.id || 2; // Default: Teste 123
      const marketplaceId = marketplaceSelecionado?.id || 1; // Default: Pixmania
      const response = await ordersApi.getAll(empresaId, marketplaceId, limit, page * limit);
      setOrders(response.orders);
      setTotal(response.total);
    } catch (err: any) {
      console.error('Erro ao carregar orders:', err);
      setError(err.message || 'Erro ao carregar pedidos');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('pt-PT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  if (loading && orders.length === 0) {
    return (
      <div className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-blue-400" />
              Listagem de Pedidos Global
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
              <span className="ml-3 text-slate-400">A carregar pedidos...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-blue-400" />
            Listagem de Pedidos Global
            {total > 0 && (
              <span className="text-sm font-normal text-slate-400 ml-2">
                ({total} {total === 1 ? 'pedido' : 'pedidos'})
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="bg-red-900/20 border border-red-500 text-red-400 px-4 py-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          {orders.length === 0 && !loading ? (
            <div className="text-slate-400 text-center py-12">
              Nenhum pedido encontrado. Faça upload de um ficheiro de listagem de orders na aba Upload.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left py-3 px-4 text-slate-300 font-semibold">Nº Pedido</th>
                      <th className="text-left py-3 px-4 text-slate-300 font-semibold">Data Criação</th>
                      <th className="text-left py-3 px-4 text-slate-300 font-semibold">Data Pagamento</th>
                      <th className="text-left py-3 px-4 text-slate-300 font-semibold">Ciclo Pagamento</th>
                      <th className="text-right py-3 px-4 text-slate-300 font-semibold">Valor Total</th>
                      <th className="text-right py-3 px-4 text-slate-300 font-semibold">Qtd. Itens</th>
                      <th className="text-left py-3 px-4 text-slate-300 font-semibold">Status</th>
                      <th className="text-left py-3 px-4 text-slate-300 font-semibold">Canal Vendas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr key={order.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                        <td className="py-3 px-4 text-slate-200 font-medium">{order.numero_pedido}</td>
                        <td className="py-3 px-4 text-slate-400">{formatDate(order.data_criacao)}</td>
                        <td className="py-3 px-4 text-slate-400">{formatDate(order.data_pagamento)}</td>
                        <td className="py-3 px-4 text-slate-400">{order.ciclo_pagamento || 'N/A'}</td>
                        <td className="py-3 px-4 text-right text-blue-400 font-medium">
                          {order.valor_total ? formatCurrency(order.valor_total) : 'N/A'}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-300">
                          {order.quantidade_itens ?? 'N/A'}
                        </td>
                        <td className="py-3 px-4 text-slate-400">{order.status || 'N/A'}</td>
                        <td className="py-3 px-4 text-slate-400">{order.canal_vendas || 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {total > limit && (
                <div className="flex items-center justify-between mt-6">
                  <div className="text-slate-400 text-sm">
                    Mostrando {page * limit + 1} - {Math.min((page + 1) * limit, total)} de {total}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage(p => Math.max(0, p - 1))}
                      disabled={page === 0}
                      className="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Anterior
                    </button>
                    <button
                      onClick={() => setPage(p => p + 1)}
                      disabled={(page + 1) * limit >= total}
                      className="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Seguinte
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
