'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useInvoices } from '@/lib/hooks/useInvoices';
import { transactionsApi } from '@/lib/api/transactions';
import type { Transaction } from '@/types/transactions';
import { formatCurrency } from '@/lib/utils';
import { Search } from 'lucide-react';
import { useApp } from '@/context/AppContext';

export function TransactionsList() {
  const { empresaSelecionada, marketplaceSelecionado } = useApp();
  const { cycles, loading: cyclesLoading } = useInvoices();
  const [selectedCycle, setSelectedCycle] = useState<string>('todos');
  const [cicloInicio, setCicloInicio] = useState<string>('');
  const [cicloFim, setCicloFim] = useState<string>('');
  const [filterMode, setFilterMode] = useState<'single' | 'range'>('single');
  const [selectedType, setSelectedType] = useState<string>('todos');
  const [transactionTypes, setTransactionTypes] = useState<string[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadTransactionTypes();
    loadTransactions();
  }, []);

  useEffect(() => {
    loadTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCycle, cicloInicio, cicloFim, filterMode, selectedType, empresaSelecionada?.id, marketplaceSelecionado?.id]);

  const loadTransactionTypes = async () => {
    try {
      setLoadingTypes(true);
      const types = await transactionsApi.getTransactionTypes();
      setTransactionTypes(types);
    } catch (error) {
      console.error('Erro ao carregar tipos:', error);
    } finally {
      setLoadingTypes(false);
    }
  };

  const loadTransactions = async () => {
    try {
      setLoading(true);
      const response = await transactionsApi.getTransactions(
        filterMode === 'single' && selectedCycle !== 'todos' ? selectedCycle : null,
        filterMode === 'range' && cicloInicio ? cicloInicio : null,
        filterMode === 'range' && cicloFim ? cicloFim : null,
        selectedType !== 'todos' ? selectedType : null,
        10000,
        0,
        empresaSelecionada?.id,
        marketplaceSelecionado?.id
      );
      setTransactions(response.transactions);
      setTotal(response.total);
    } catch (error) {
      console.error('Erro ao carregar transações:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filtrar transações por termo de pesquisa
  const filteredTransactions = transactions.filter((t) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      (t.tipo?.toLowerCase().includes(search)) ||
      (t.descricao?.toLowerCase().includes(search)) ||
      (t.numero_pedido?.toLowerCase().includes(search)) ||
      (t.numero_fatura?.toLowerCase().includes(search)) ||
      (t.sku_oferta?.toLowerCase().includes(search))
    );
  });

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>📋 Listagens de Transações</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Modo de Filtro */}
            <div>
              <label className="block text-sm font-medium mb-3 text-slate-300">
                Modo de Filtro
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value="single"
                    checked={filterMode === 'single'}
                    onChange={(e) => setFilterMode(e.target.value as 'single' | 'range')}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-slate-300">Ciclo Único</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value="range"
                    checked={filterMode === 'range'}
                    onChange={(e) => setFilterMode(e.target.value as 'single' | 'range')}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-slate-300">Intervalo de Ciclos</span>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Filtro por Ciclo Único */}
              {filterMode === 'single' && (
                <div>
                  <label className="block text-sm font-medium mb-3 text-slate-300">
                    Filtrar por Ciclo
                  </label>
                  <select
                    value={selectedCycle}
                    onChange={(e) => setSelectedCycle(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-600 border border-slate-500 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    disabled={cyclesLoading}
                  >
                    <option value="todos">Todos os Ciclos</option>
                    {cycles.map((cycle) => (
                      <option key={cycle} value={cycle}>
                        {cycle}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Intervalo de Ciclos */}
              {filterMode === 'range' && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-3 text-slate-300">
                      Ciclo Inicial
                    </label>
                    <select
                      value={cicloInicio}
                      onChange={(e) => setCicloInicio(e.target.value)}
                      className="w-full px-4 py-2 bg-slate-600 border border-slate-500 rounded-lg text-white focus:outline-none focus:border-blue-500"
                      disabled={cyclesLoading}
                    >
                      <option value="">Selecione...</option>
                      {cycles.map((cycle) => (
                        <option key={cycle} value={cycle}>
                          {cycle}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-3 text-slate-300">
                      Ciclo Final
                    </label>
                    <select
                      value={cicloFim}
                      onChange={(e) => setCicloFim(e.target.value)}
                      className="w-full px-4 py-2 bg-slate-600 border border-slate-500 rounded-lg text-white focus:outline-none focus:border-blue-500"
                      disabled={cyclesLoading}
                    >
                      <option value="">Selecione...</option>
                      {cycles.map((cycle) => (
                        <option key={cycle} value={cycle}>
                          {cycle}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {/* Filtro por Tipo */}
              <div>
                <label className="block text-sm font-medium mb-3 text-slate-300">
                  Filtrar por Tipo
                </label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-600 border border-slate-500 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  disabled={loadingTypes}
                >
                  <option value="todos">Todos os Tipos</option>
                  {transactionTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              {/* Pesquisa */}
              <div>
                <label className="block text-sm font-medium mb-3 text-slate-300">
                  Pesquisar
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Pesquisar por tipo, descrição, pedido..."
                    className="w-full pl-10 pr-4 py-2 bg-slate-600 border border-slate-500 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 text-sm text-slate-400">
              Mostrando {filteredTransactions.length} de {total} transações
              {filterMode === 'single' && selectedCycle !== 'todos' && ` (Ciclo: ${selectedCycle})`}
              {filterMode === 'range' && cicloInicio && cicloFim && ` (Intervalo: ${cicloInicio} a ${cicloFim})`}
              {selectedType !== 'todos' && ` (Tipo: ${selectedType})`}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Transações */}
      <Card>
        <CardHeader>
          <CardTitle>Transações</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12 text-slate-400">A carregar transações...</div>
          ) : filteredTransactions.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              Nenhuma transação encontrada
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-700 border-b border-slate-600">
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Ciclo</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Data Criação</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Nº Pedido</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Tipo</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Descrição</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-slate-300">Crédito</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-slate-300">Débito</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-slate-300">Valor</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-slate-300">Real</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">SKU</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((transaction, index) => (
                    <tr
                      key={index}
                      className="border-b border-slate-700 hover:bg-slate-800 transition-colors"
                    >
                      <td className="px-4 py-3 text-sm text-slate-300">
                        {transaction.ciclo_pagamento || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-300">
                        {transaction.data_criacao
                          ? new Date(transaction.data_criacao).toLocaleDateString('pt-PT')
                          : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-blue-300">
                        {transaction.numero_pedido || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-300">
                        {transaction.tipo || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-300 max-w-xs truncate" title={transaction.descricao || ''}>
                        {transaction.descricao || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-green-400">
                        {transaction.credito !== 0 ? formatCurrency(transaction.credito) : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-red-400">
                        {transaction.debito !== 0 ? formatCurrency(transaction.debito) : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-blue-400">
                        {transaction.valor ? formatCurrency(transaction.valor) : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-medium">
                        <span className={transaction.real >= 0 ? 'text-green-400' : 'text-red-400'}>
                          {formatCurrency(transaction.real)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-300">
                        {transaction.sku_oferta || '-'}
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

