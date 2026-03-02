'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { kpiApi } from '@/lib/api/kpis';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Lock } from 'lucide-react';
import { useApp } from '@/context/AppContext';

interface Reserva {
  numero_transacao: string;
  data_criacao: string | null;
  numero_fatura: string;
  descricao: string;
  tipo: string;
  valor: number;
  ciclo_pagamento: string;
  real: number;
  credito: number;
  debito: number;
}

export function ReservasList() {
  const { empresaSelecionada, marketplaceSelecionado } = useApp();
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    loadReservas();
  }, [empresaSelecionada?.id, marketplaceSelecionado?.id]);

  const loadReservas = async () => {
    try {
      setLoading(true);
      const response = await kpiApi.getReservasList(empresaSelecionada?.id, marketplaceSelecionado?.id);
      setReservas(response.reservas);
      setTotal(response.count);
    } catch (error) {
      console.error('Erro ao carregar reservas:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (reserva: Reserva) => {
    if (!window.confirm(`Tem certeza que deseja eliminar esta reserva?\n\nFatura: ${reserva.numero_fatura}\nTipo: ${reserva.tipo}\nValor: ${formatCurrency(reserva.valor)}`)) {
      return;
    }

    try {
      await kpiApi.deleteReserva(
        reserva.numero_transacao || '',
        reserva.numero_fatura || '',
        reserva.data_criacao || '',
        reserva.tipo || ''
      );
      // Recarregar a lista após eliminar
      loadReservas();
    } catch (error) {
      console.error('Erro ao eliminar reserva:', error);
      alert('Erro ao eliminar reserva. Por favor, tente novamente.');
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-yellow-400" />
            Lista de Reservas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <p className="text-sm text-slate-400">Total de reservas: <span className="font-bold text-white">{total}</span></p>
          </div>
          
          {loading ? (
            <div className="text-center py-12 text-slate-400">A carregar reservas...</div>
          ) : reservas.length === 0 ? (
            <div className="text-center py-12 text-slate-400">Nenhuma reserva encontrada</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-700 border-b border-slate-600">
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Data Criação</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Nº Fatura</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Tipo</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Descrição</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-slate-300">Valor</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-slate-300">Crédito</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-slate-300">Débito</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-slate-300">Real</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Ciclo Faturamento</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-slate-300">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {reservas.map((reserva, index) => (
                    <tr
                      key={index}
                      className="border-b border-slate-700 hover:bg-slate-800 transition-colors"
                    >
                      <td className="px-4 py-3 text-sm text-slate-300">
                        {reserva.data_criacao ? formatDate(reserva.data_criacao) : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-blue-300 font-mono">
                        {reserva.numero_fatura || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-300">
                        {reserva.tipo || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-300 max-w-xs truncate" title={reserva.descricao}>
                        {reserva.descricao || '-'}
                      </td>
                      <td className={`px-4 py-3 text-sm text-right font-medium ${
                        reserva.valor >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {formatCurrency(reserva.valor)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-green-400">
                        {formatCurrency(reserva.credito)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-red-400">
                        {formatCurrency(reserva.debito)}
                      </td>
                      <td className={`px-4 py-3 text-sm text-right font-medium ${
                        reserva.real >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {formatCurrency(reserva.real)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-300">
                        {reserva.ciclo_pagamento || '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleDelete(reserva)}
                          className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm"
                          title="Eliminar reserva"
                        >
                          Eliminar
                        </button>
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

