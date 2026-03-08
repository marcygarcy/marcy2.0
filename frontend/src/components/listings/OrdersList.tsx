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
      const empresaId = empresaSelecionada?.id || 2;
      const marketplaceId = marketplaceSelecionado?.id || 1;
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
                <table className="w-full text-sm min-w-[2800px]">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left py-3 px-2 text-slate-300 font-semibold whitespace-nowrap">Data de criação</th>
                      <th className="text-left py-3 px-2 text-slate-300 font-semibold whitespace-nowrap">N° do pedido</th>
                      <th className="text-right py-3 px-2 text-slate-300 font-semibold whitespace-nowrap">Quantidade</th>
                      <th className="text-left py-3 px-2 text-slate-300 font-semibold whitespace-nowrap">Detalhes</th>
                      <th className="text-left py-3 px-2 text-slate-300 font-semibold whitespace-nowrap">Status</th>
                      <th className="text-right py-3 px-2 text-slate-300 font-semibold whitespace-nowrap">Valor</th>
                      <th className="text-left py-3 px-2 text-slate-300 font-semibold whitespace-nowrap">Canal</th>
                      <th className="text-left py-3 px-2 text-slate-300 font-semibold whitespace-nowrap">SKU da oferta</th>
                      <th className="text-left py-3 px-2 text-slate-300 font-semibold whitespace-nowrap">Marca</th>
                      <th className="text-left py-3 px-2 text-slate-300 font-semibold whitespace-nowrap">Etiqueta de categoria</th>
                      <th className="text-right py-3 px-2 text-slate-300 font-semibold whitespace-nowrap">Preço unitário</th>
                      <th className="text-right py-3 px-2 text-slate-300 font-semibold whitespace-nowrap">Valor total do pedido sem impostos</th>
                      <th className="text-right py-3 px-2 text-slate-300 font-semibold whitespace-nowrap">Valor total do pedido (incluindo IVA e despesas de envio)</th>
                      <th className="text-right py-3 px-2 text-slate-300 font-semibold whitespace-nowrap">Comissão (sem impostos)</th>
                      <th className="text-right py-3 px-2 text-slate-300 font-semibold whitespace-nowrap">Valor da comissão (incluindo impostos)</th>
                      <th className="text-right py-3 px-2 text-slate-300 font-semibold whitespace-nowrap">Valor transferido para loja (incluindo impostos)</th>
                      <th className="text-left py-3 px-2 text-slate-300 font-semibold whitespace-nowrap">País do endereço de faturamento</th>
                      <th className="text-right py-3 px-2 text-slate-300 font-semibold whitespace-nowrap">Valor do imposto sobre o produto (TVA FR - tva-fr-20)</th>
                      <th className="text-right py-3 px-2 text-slate-300 font-semibold whitespace-nowrap">Valor dos impostos de envio (TVA FR - tva-fr-20)</th>
                      <th className="text-right py-3 px-2 text-slate-300 font-semibold whitespace-nowrap">Valor do imposto sobre o produto (TVA ES - tva-es-21)</th>
                      <th className="text-right py-3 px-2 text-slate-300 font-semibold whitespace-nowrap">Valor dos impostos de envio (TVA ES - tva-es-21)</th>
                      <th className="text-right py-3 px-2 text-slate-300 font-semibold whitespace-nowrap">Valor do imposto sobre o produto (TVA IT - tva-it-22)</th>
                      <th className="text-right py-3 px-2 text-slate-300 font-semibold whitespace-nowrap">Valor dos impostos de envio (TVA IT - tva-it-22)</th>
                      <th className="text-right py-3 px-2 text-slate-300 font-semibold whitespace-nowrap">Valor do imposto sobre o produto (TVA ZERO - tva-zero)</th>
                      <th className="text-right py-3 px-2 text-slate-300 font-semibold whitespace-nowrap">Valor dos impostos de envio (TVA ZERO - tva-zero)</th>
                      <th className="text-right py-3 px-2 text-slate-300 font-semibold whitespace-nowrap">Total de impostos do pedido</th>
                      <th className="text-right py-3 px-2 text-slate-300 font-semibold whitespace-nowrap">Total dos impostos de envio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr key={order.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                        <td className="py-3 px-2 text-slate-400 whitespace-nowrap">{formatDate(order.data_criacao)}</td>
                        <td className="py-3 px-2 text-slate-200 font-medium whitespace-nowrap">
                          {order.numero_pedido || `ORD-${order.id}`}
                        </td>
                        <td className="py-3 px-2 text-right text-slate-300 whitespace-nowrap">
                          {order.quantidade !== null && order.quantidade !== undefined ? order.quantidade.toFixed(2) : 'N/A'}
                        </td>
                        <td className="py-3 px-2 text-slate-400 whitespace-nowrap max-w-xs truncate" title={order.detalhes || ''}>
                          {order.detalhes || 'N/A'}
                        </td>
                        <td className="py-3 px-2 text-slate-400 whitespace-nowrap">{order.status || 'N/A'}</td>
                        <td className="py-3 px-2 text-right text-blue-400 font-medium whitespace-nowrap">
                          {order.valor !== null && order.valor !== undefined ? formatCurrency(order.valor) : 'N/A'}
                        </td>
                        <td className="py-3 px-2 text-slate-400 whitespace-nowrap">{order.canal_vendas || 'N/A'}</td>
                        <td className="py-3 px-2 text-slate-400 whitespace-nowrap">{order.sku_oferta || 'N/A'}</td>
                        <td className="py-3 px-2 text-slate-400 whitespace-nowrap">{order.marca || 'N/A'}</td>
                        <td className="py-3 px-2 text-slate-400 whitespace-nowrap">{order.etiqueta_categoria || 'N/A'}</td>
                        <td className="py-3 px-2 text-right text-slate-300 whitespace-nowrap">
                          {order.preco_unitario !== null && order.preco_unitario !== undefined ? formatCurrency(order.preco_unitario) : 'N/A'}
                        </td>
                        <td className="py-3 px-2 text-right text-slate-300 whitespace-nowrap">
                          {order.valor_total_sem_impostos !== null && order.valor_total_sem_impostos !== undefined ? formatCurrency(order.valor_total_sem_impostos) : 'N/A'}
                        </td>
                        <td className="py-3 px-2 text-right text-blue-400 font-medium whitespace-nowrap">
                          {order.valor_total_com_iva !== null && order.valor_total_com_iva !== undefined ? formatCurrency(order.valor_total_com_iva) : 'N/A'}
                        </td>
                        <td className="py-3 px-2 text-right text-slate-300 whitespace-nowrap">
                          {order.comissao_sem_impostos !== null && order.comissao_sem_impostos !== undefined ? formatCurrency(order.comissao_sem_impostos) : 'N/A'}
                        </td>
                        <td className="py-3 px-2 text-right text-slate-300 whitespace-nowrap">
                          {order.valor_comissao_com_impostos !== null && order.valor_comissao_com_impostos !== undefined ? formatCurrency(order.valor_comissao_com_impostos) : 'N/A'}
                        </td>
                        <td className="py-3 px-2 text-right text-green-400 font-medium whitespace-nowrap">
                          {order.valor_transferido_loja !== null && order.valor_transferido_loja !== undefined ? formatCurrency(order.valor_transferido_loja) : 'N/A'}
                        </td>
                        <td className="py-3 px-2 text-slate-400 whitespace-nowrap">{order.pais_faturamento || 'N/A'}</td>
                        <td className="py-3 px-2 text-right text-slate-300 whitespace-nowrap">
                          {order.imposto_produto_tva_fr_20 !== null && order.imposto_produto_tva_fr_20 !== undefined ? formatCurrency(order.imposto_produto_tva_fr_20) : 'N/A'}
                        </td>
                        <td className="py-3 px-2 text-right text-slate-300 whitespace-nowrap">
                          {order.imposto_envio_tva_fr_20 !== null && order.imposto_envio_tva_fr_20 !== undefined ? formatCurrency(order.imposto_envio_tva_fr_20) : 'N/A'}
                        </td>
                        <td className="py-3 px-2 text-right text-slate-300 whitespace-nowrap">
                          {order.imposto_produto_tva_es_21 !== null && order.imposto_produto_tva_es_21 !== undefined ? formatCurrency(order.imposto_produto_tva_es_21) : 'N/A'}
                        </td>
                        <td className="py-3 px-2 text-right text-slate-300 whitespace-nowrap">
                          {order.imposto_envio_tva_es_21 !== null && order.imposto_envio_tva_es_21 !== undefined ? formatCurrency(order.imposto_envio_tva_es_21) : 'N/A'}
                        </td>
                        <td className="py-3 px-2 text-right text-slate-300 whitespace-nowrap">
                          {order.imposto_produto_tva_it_22 !== null && order.imposto_produto_tva_it_22 !== undefined ? formatCurrency(order.imposto_produto_tva_it_22) : 'N/A'}
                        </td>
                        <td className="py-3 px-2 text-right text-slate-300 whitespace-nowrap">
                          {order.imposto_envio_tva_it_22 !== null && order.imposto_envio_tva_it_22 !== undefined ? formatCurrency(order.imposto_envio_tva_it_22) : 'N/A'}
                        </td>
                        <td className="py-3 px-2 text-right text-slate-300 whitespace-nowrap">
                          {order.imposto_produto_tva_zero !== null && order.imposto_produto_tva_zero !== undefined ? formatCurrency(order.imposto_produto_tva_zero) : 'N/A'}
                        </td>
                        <td className="py-3 px-2 text-right text-slate-300 whitespace-nowrap">
                          {order.imposto_envio_tva_zero !== null && order.imposto_envio_tva_zero !== undefined ? formatCurrency(order.imposto_envio_tva_zero) : 'N/A'}
                        </td>
                        <td className="py-3 px-2 text-right text-red-400 font-medium whitespace-nowrap">
                          {order.total_impostos_pedido !== null && order.total_impostos_pedido !== undefined ? formatCurrency(order.total_impostos_pedido) : 'N/A'}
                        </td>
                        <td className="py-3 px-2 text-right text-red-400 font-medium whitespace-nowrap">
                          {order.total_impostos_envio !== null && order.total_impostos_envio !== undefined ? formatCurrency(order.total_impostos_envio) : 'N/A'}
                        </td>
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
