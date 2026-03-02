'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { pendentesApi } from '@/lib/api/pendentes';
import type { PendenteTransaction, PendenteOrder } from '@/lib/api/pendentes';
import { formatCurrency } from '@/lib/utils';
import { useApp } from '@/context/AppContext';

export function PendentesList() {
  const { empresaSelecionada, marketplaceSelecionado } = useApp();
  const empresaId = empresaSelecionada?.id;
  const marketplaceId = marketplaceSelecionado?.id;
  const [transacoes, setTransacoes] = useState<PendenteTransaction[]>([]);
  const [pedidos, setPedidos] = useState<PendenteOrder[]>([]);
  const [totalTransacoes, setTotalTransacoes] = useState(0);
  const [totalPedidos, setTotalPedidos] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'transacoes' | 'pedidos'>('transacoes');

  useEffect(() => {
    loadPendentes();
  }, [empresaId, marketplaceId]);

  const loadPendentes = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await pendentesApi.getAll(
        empresaId || undefined,
        marketplaceId || undefined,
        1000
      );
      setTransacoes(response.transacoes);
      setPedidos(response.pedidos);
      setTotalTransacoes(response.total_transacoes);
      setTotalPedidos(response.total_pedidos);
    } catch (err: any) {
      setError(err?.message || 'Erro ao carregar pendentes');
      console.error('Erro ao carregar pendentes:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>⏳ Listagem de Pendentes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-slate-400">A carregar pendentes...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>⏳ Listagem de Pendentes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-red-400">Erro: {error}</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>⏳ Listagem de Pendentes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-6 border-b border-slate-700 pb-4">
            <button
              onClick={() => setActiveTab('transacoes')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'transacoes'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              Transações Pendentes ({totalTransacoes})
            </button>
            <button
              onClick={() => setActiveTab('pedidos')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'pedidos'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              Pedidos Pendentes ({totalPedidos})
            </button>
          </div>

          {activeTab === 'transacoes' && (
            <div>
              {transacoes.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  Nenhuma transação pendente encontrada
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left p-3 text-slate-300">Data Criação</th>
                        <th className="text-left p-3 text-slate-300">Nº Pedido</th>
                        <th className="text-left p-3 text-slate-300">Tipo</th>
                        <th className="text-left p-3 text-slate-300">Descrição</th>
                        <th className="text-right p-3 text-slate-300">Crédito</th>
                        <th className="text-right p-3 text-slate-300">Débito</th>
                        <th className="text-right p-3 text-slate-300">Valor</th>
                        <th className="text-left p-3 text-slate-300">Canal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transacoes.map((trans, index) => (
                        <tr
                          key={index}
                          className="border-b border-slate-800 hover:bg-slate-800 transition-colors"
                        >
                          <td className="p-3 text-slate-300">
                            {trans.data_criacao ? new Date(trans.data_criacao).toLocaleDateString('pt-PT') : '-'}
                          </td>
                          <td className="p-3 text-slate-200">{trans.numero_pedido || '-'}</td>
                          <td className="p-3 text-slate-300">{trans.tipo || '-'}</td>
                          <td className="p-3 text-slate-300 max-w-xs truncate" title={trans.descricao || ''}>
                            {trans.descricao || '-'}
                          </td>
                          <td className="p-3 text-right text-green-400">
                            {trans.credito > 0 ? formatCurrency(trans.credito) : '-'}
                          </td>
                          <td className="p-3 text-right text-red-400">
                            {trans.debito > 0 ? formatCurrency(trans.debito) : '-'}
                          </td>
                          <td className="p-3 text-right text-blue-400 font-semibold">
                            {trans.valor ? formatCurrency(trans.valor) : '-'}
                          </td>
                          <td className="p-3 text-slate-300">{trans.canal_vendas || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'pedidos' && (
            <div>
              {pedidos.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  Nenhum pedido pendente encontrado
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left p-3 text-slate-300">Nº Pedido</th>
                        <th className="text-left p-3 text-slate-300">Data Criação</th>
                        <th className="text-left p-3 text-slate-300">Status</th>
                        <th className="text-right p-3 text-slate-300">Valor Total</th>
                        <th className="text-right p-3 text-slate-300">Qtd. Itens</th>
                        <th className="text-left p-3 text-slate-300">Canal</th>
                        <th className="text-left p-3 text-slate-300">Ciclo Pagamento</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pedidos.map((pedido) => (
                        <tr
                          key={pedido.id}
                          className="border-b border-slate-800 hover:bg-slate-800 transition-colors"
                        >
                          <td className="p-3 text-slate-200 font-medium">{pedido.numero_pedido}</td>
                          <td className="p-3 text-slate-300">
                            {pedido.data_criacao ? new Date(pedido.data_criacao).toLocaleDateString('pt-PT') : '-'}
                          </td>
                          <td className="p-3 text-slate-300">
                            <span className={`px-2 py-1 rounded ${
                              pedido.status?.toLowerCase().includes('pendente')
                                ? 'bg-yellow-500/20 text-yellow-400'
                                : 'bg-slate-700 text-slate-300'
                            }`}>
                              {pedido.status || 'Pendente'}
                            </span>
                          </td>
                          <td className="p-3 text-right text-green-400 font-semibold">
                            {pedido.valor_total ? formatCurrency(pedido.valor_total) : '-'}
                          </td>
                          <td className="p-3 text-right text-slate-300">{pedido.quantidade_itens || '-'}</td>
                          <td className="p-3 text-slate-300">{pedido.canal_vendas || '-'}</td>
                          <td className="p-3 text-slate-300">{pedido.ciclo_pagamento || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

