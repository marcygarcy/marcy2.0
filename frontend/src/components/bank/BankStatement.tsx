'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { bankApi, BankMovement } from '@/lib/api/bank';
import { formatCurrency } from '@/lib/utils';
import { useInvoices } from '@/lib/hooks/useInvoices';

export function BankStatement() {
  const { cycles, loading: cyclesLoading } = useInvoices();
  const [movements, setMovements] = useState<BankMovement[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [filterMode, setFilterMode] = useState<'month' | 'range'>('month');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [dataInicio, setDataInicio] = useState<string>('');
  const [dataFim, setDataFim] = useState<string>('');

  // Formulário
  const [showForm, setShowForm] = useState(false);
  const [editingMovement, setEditingMovement] = useState<BankMovement | null>(null);
  const [formData, setFormData] = useState<BankMovement>({
    data_ctb: '',
    data_movimento: '',
    ciclo: '',
    montante: 0
  });

  useEffect(() => {
    loadMovements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterMode, selectedMonth, dataInicio, dataFim]);

  // Inicializar com o mês atual
  useEffect(() => {
    if (filterMode === 'month' && !selectedMonth) {
      const now = new Date();
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      setSelectedMonth(month);
    }
  }, [filterMode, selectedMonth]);

  const loadMovements = async () => {
    try {
      setLoading(true);
      const mes = filterMode === 'month' && selectedMonth ? selectedMonth : undefined;
      const inicio = filterMode === 'range' && dataInicio ? dataInicio : undefined;
      const fim = filterMode === 'range' && dataFim ? dataFim : undefined;

      const response = await bankApi.getMovements(mes, inicio, fim);
      setMovements(response.movements);
      setTotal(response.total);
    } catch (error) {
      console.error('Erro ao carregar movimentos bancários:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingMovement?.id) {
        await bankApi.updateMovement(editingMovement.id, formData);
      } else {
        await bankApi.createMovement(formData);
      }
      setShowForm(false);
      setEditingMovement(null);
      setFormData({ data_ctb: '', data_movimento: '', ciclo: '', montante: 0 });
      loadMovements();
    } catch (error) {
      console.error('Erro ao salvar movimento:', error);
      alert('Erro ao salvar movimento. Verifique os dados.');
    }
  };

  const handleEdit = (movement: BankMovement) => {
    setEditingMovement(movement);
    setFormData({
      data_ctb: movement.data_ctb || '',
      data_movimento: movement.data_movimento || '',
      ciclo: movement.ciclo || '',
      montante: movement.montante || 0
    });
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Tem certeza que deseja remover este movimento?')) {
      return;
    }
    try {
      await bankApi.deleteMovement(id);
      loadMovements();
    } catch (error) {
      console.error('Erro ao remover movimento:', error);
      alert('Erro ao remover movimento.');
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingMovement(null);
    setFormData({ data_ctb: '', data_movimento: '', ciclo: '', montante: 0 });
  };

  // Gerar lista de meses disponíveis (últimos 12 meses)
  const getAvailableMonths = (): string[] => {
    const months: string[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      months.push(month);
    }
    return months;
  };

  const formatMonth = (month: string): string => {
    const [year, monthNum] = month.split('-');
    const date = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
    return date.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
  };

  const formatDate = (dateString: string): string => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho com botão de adicionar */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">Movimentos Bancários</h2>
        <button
          onClick={() => {
            setShowForm(true);
            setEditingMovement(null);
            setFormData({ data_ctb: '', data_movimento: '', ciclo: '', montante: 0 });
          }}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          + Adicionar Movimento
        </button>
      </div>

      {/* Formulário */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingMovement ? 'Editar Movimento' : 'Novo Movimento'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-slate-300">
                    Data CTB *
                  </label>
                  <input
                    type="date"
                    value={formData.data_ctb}
                    onChange={(e) => setFormData({ ...formData, data_ctb: e.target.value })}
                    required
                    className="w-full px-4 py-2 bg-slate-600 border border-slate-500 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-slate-300">
                    Data Movimento *
                  </label>
                  <input
                    type="date"
                    value={formData.data_movimento}
                    onChange={(e) => setFormData({ ...formData, data_movimento: e.target.value })}
                    required
                    className="w-full px-4 py-2 bg-slate-600 border border-slate-500 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-slate-300">
                    Ciclo
                  </label>
                  <select
                    value={formData.ciclo}
                    onChange={(e) => setFormData({ ...formData, ciclo: e.target.value })}
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
                <div>
                  <label className="block text-sm font-medium mb-2 text-slate-300">
                    Montante *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.montante || ''}
                    onChange={(e) => setFormData({ ...formData, montante: parseFloat(e.target.value) || 0 })}
                    required
                    className="w-full px-4 py-2 bg-slate-600 border border-slate-500 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  {editingMovement ? 'Atualizar' : 'Adicionar'}
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Modo de Filtro */}
            <div>
              <label className="block text-sm font-medium mb-3 text-slate-300">
                Tipo de Filtro
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="filterMode"
                    value="month"
                    checked={filterMode === 'month'}
                    onChange={(e) => setFilterMode(e.target.value as 'month')}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-slate-300">Por Mês</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="filterMode"
                    value="range"
                    checked={filterMode === 'range'}
                    onChange={(e) => setFilterMode(e.target.value as 'range')}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-slate-300">Intervalo de Datas</span>
                </label>
              </div>
            </div>

            {/* Filtro por Mês */}
            {filterMode === 'month' && (
              <div>
                <label className="block text-sm font-medium mb-3 text-slate-300">
                  Selecionar Mês
                </label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-600 border border-slate-500 rounded-lg text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="">Selecione um mês...</option>
                  {getAvailableMonths().map((month) => (
                    <option key={month} value={month}>
                      {formatMonth(month)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Filtro por Intervalo de Datas */}
            {filterMode === 'range' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-3 text-slate-300">
                    Data Inicial
                  </label>
                  <input
                    type="date"
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-600 border border-slate-500 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-3 text-slate-300">
                    Data Final
                  </label>
                  <input
                    type="date"
                    value={dataFim}
                    onChange={(e) => setDataFim(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-600 border border-slate-500 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Resumo */}
      <Card>
        <CardHeader>
          <CardTitle>Resumo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-slate-400">Total de Movimentos</p>
              <p className="text-2xl font-bold text-white">{movements.length}</p>
            </div>
            <div>
              <p className="text-sm text-slate-400">Montante Total</p>
              <p className="text-2xl font-bold text-green-400">{formatCurrency(total)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Movimentos */}
      <Card>
        <CardHeader>
          <CardTitle>Movimentos Bancários</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12 text-slate-400">A carregar movimentos...</div>
          ) : movements.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              Nenhum movimento encontrado para o período selecionado
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-700 border-b border-slate-600">
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">
                      Data CTB
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">
                      Data Movimento
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">
                      Ciclo
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-slate-300">
                      Montante
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-slate-300">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((movement) => (
                    <tr
                      key={movement.id}
                      className="border-b border-slate-700 hover:bg-slate-800 transition-colors"
                    >
                      <td className="px-4 py-3 text-sm text-slate-300">
                        {formatDate(movement.data_ctb)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-300">
                        {formatDate(movement.data_movimento)}
                      </td>
                      <td className="px-4 py-3 text-sm text-blue-300">
                        {movement.ciclo || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-green-400">
                        {formatCurrency(movement.montante)}
                      </td>
                      <td className="px-4 py-3 text-sm text-center">
                        <div className="flex gap-2 justify-center">
                          <button
                            onClick={() => handleEdit(movement)}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs transition-colors"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => movement.id && handleDelete(movement.id)}
                            className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs transition-colors"
                          >
                            Remover
                          </button>
                        </div>
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
