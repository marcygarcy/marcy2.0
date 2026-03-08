'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  billingApi,
  type SimulationResponse,
  type SimulationDocumentItem,
} from '@/lib/api/billing';
import { empresasApi, type Empresa } from '@/lib/api/empresas';
import { marketplacesApi, type Marketplace } from '@/lib/api/marketplaces';
import { useApp } from '@/context/AppContext';
import { formatCurrency } from '@/lib/utils';
import {
  FileSpreadsheet,
  Loader2,
  Lock,
  Calculator,
  FileText,
  Receipt,
  Banknote,
} from 'lucide-react';

export function BatchInvoicingView() {
  const { empresaSelecionada } = useApp();
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [marketplaces, setMarketplaces] = useState<Marketplace[]>([]);

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [empresaId, setEmpresaId] = useState<number | ''>('');
  const [marketplaceId, setMarketplaceId] = useState<number | ''>('');
  const [serieFaturas, setSerieFaturas] = useState('FT');
  const [serieNc, setSerieNc] = useState('NC');

  const [simulating, setSimulating] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [simulation, setSimulation] = useState<SimulationResponse | null>(null);
  const [simulateError, setSimulateError] = useState<string | null>(null);
  const [executeModalOpen, setExecuteModalOpen] = useState(false);
  const [executeSuccess, setExecuteSuccess] = useState<string | null>(null);

  useEffect(() => {
    empresasApi.getAll().then((data) => {
      if (Array.isArray(data)) setEmpresas(data.filter((e: Empresa) => e.ativo));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const id = empresaId === '' ? empresaSelecionada?.id : Number(empresaId);
    if (id) {
      marketplacesApi.getByEmpresa(id).then(setMarketplaces).catch(() => setMarketplaces([]));
    } else {
      setMarketplaces([]);
    }
  }, [empresaId, empresaSelecionada?.id]);

  useEffect(() => {
    if (empresaSelecionada && empresaId === '') {
      setEmpresaId(empresaSelecionada.id);
    }
  }, [empresaSelecionada]);

  const payload = () => ({
    date_from: dateFrom || new Date().toISOString().slice(0, 10),
    date_to: dateTo || new Date().toISOString().slice(0, 10),
    empresa_id: empresaId === '' ? undefined : Number(empresaId),
    marketplace_id: marketplaceId === '' ? undefined : Number(marketplaceId),
    serie_faturas: serieFaturas || undefined,
    serie_nc: serieNc || undefined,
  });

  const handleSimulate = async () => {
    setSimulateError(null);
    setSimulation(null);
    setSimulating(true);
    try {
      const res = await billingApi.simulateBatch(payload());
      setSimulation(res);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      setSimulateError(err?.response?.data?.detail || 'Erro ao simular.');
    } finally {
      setSimulating(false);
    }
  };

  const handleExportExcel = () => {
    if (!simulation?.items?.length) return;
    // Simula exportação para Excel (apenas feedback visual)
    const blob = new Blob(
      [
        'Tipo Documento\tReferência\tValor Base\tIVA\tTotal\n' +
        simulation.items
          .map(
            (i) =>
              `${i.tipo_documento}\t${i.referencia_encomenda}\t${i.valor_base}\t${i.iva}\t${i.total}`
          )
          .join('\n'),
      ],
      { type: 'text/tab-separated-values;charset=utf-8' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `simulacao_faturacao_${dateFrom}_${dateTo}.tsv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExecuteConfirm = async () => {
    setExecuting(true);
    setExecuteSuccess(null);
    try {
      const res = await billingApi.executeBatch(payload());
      setExecuteSuccess(res.message || 'Faturação definitiva concluída.');
      setExecuteModalOpen(false);
      setSimulation(null);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      setExecuteSuccess(null);
      setSimulateError(err?.response?.data?.detail || 'Erro ao executar.');
    } finally {
      setExecuting(false);
    }
  };

  const canSimulate = dateFrom && dateTo;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-slate-200">
        <Calculator className="w-6 h-6 text-amber-400" />
        <h2 className="text-xl font-bold">Processamento de Faturação Mensal</h2>
      </div>

      {/* 1. Zona de Parâmetros */}
      <Card className="border-slate-700 bg-slate-800/50">
        <CardHeader>
          <CardTitle className="text-lg text-slate-200">Parâmetros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Data início</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Data fim</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Cliente / Marketplace</label>
              <select
                value={marketplaceId}
                onChange={(e) => setMarketplaceId(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
              >
                <option value="">Todos</option>
                {marketplaces.map((m) => (
                  <option key={m.id} value={m.id}>{m.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Empresa</label>
              <select
                value={empresaId}
                onChange={(e) => setEmpresaId(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
              >
                <option value="">Todas</option>
                {empresas.map((e) => (
                  <option key={e.id} value={e.id}>{e.nome}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Série Faturas</label>
              <input
                type="text"
                value={serieFaturas}
                onChange={(e) => setSerieFaturas(e.target.value)}
                placeholder="ex: FT"
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Série Notas de Crédito</label>
              <input
                type="text"
                value={serieNc}
                onChange={(e) => setSerieNc(e.target.value)}
                placeholder="ex: NC"
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>
          {simulateError && (
            <div className="text-sm text-red-400 bg-red-900/30 border border-red-700 rounded-lg px-3 py-2">
              {simulateError}
            </div>
          )}
          <Button
            onClick={handleSimulate}
            disabled={!canSimulate || simulating}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {simulating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                A simular...
              </>
            ) : (
              <>
                <Calculator className="w-4 h-4 mr-2" />
                Simular Processamento
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* 2. Zona de Simulação (após simular) */}
      {simulation && (
        <>
          <Card className="border-slate-700 bg-slate-800/50">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg text-slate-200">Simulação / Auditoria</CardTitle>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleExportExcel}
                className="text-slate-300"
              >
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Exportar para Excel
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-3 p-4 rounded-lg bg-slate-800 border border-slate-600">
                  <FileText className="w-8 h-8 text-emerald-400" />
                  <div>
                    <p className="text-xs text-slate-400">Total Faturas (€)</p>
                    <p className="text-xl font-bold text-emerald-400">
                      {formatCurrency(simulation.total_faturas)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 rounded-lg bg-slate-800 border border-slate-600">
                  <Receipt className="w-8 h-8 text-amber-400" />
                  <div>
                    <p className="text-xs text-slate-400">Total Notas de Crédito (€)</p>
                    <p className="text-xl font-bold text-amber-400">
                      {formatCurrency(simulation.total_nc)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 rounded-lg bg-slate-800 border border-slate-600">
                  <Banknote className="w-8 h-8 text-sky-400" />
                  <div>
                    <p className="text-xs text-slate-400">Saldo Líquido do Mês (€)</p>
                    <p className="text-xl font-bold text-sky-400">
                      {formatCurrency(simulation.saldo_liquido)}
                    </p>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-600">
                      <th className="text-left py-2 px-2 font-semibold">Tipo Documento</th>
                      <th className="text-left py-2 px-2 font-semibold">Referência Encomenda</th>
                      <th className="text-right py-2 px-2 font-semibold">Valor Base</th>
                      <th className="text-right py-2 px-2 font-semibold">IVA</th>
                      <th className="text-right py-2 px-2 font-semibold">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {simulation.items.map((row: SimulationDocumentItem, idx: number) => (
                      <tr key={idx} className="border-b border-slate-800 hover:bg-slate-800/50">
                        <td className="py-2 px-2 text-slate-200">{row.tipo_documento}</td>
                        <td className="py-2 px-2 text-slate-300 font-mono">{row.referencia_encomenda}</td>
                        <td className="py-2 px-2 text-right text-slate-300">
                          {formatCurrency(row.valor_base)}
                        </td>
                        <td className="py-2 px-2 text-right text-slate-300">
                          {formatCurrency(row.iva)}
                        </td>
                        <td className="py-2 px-2 text-right font-medium text-emerald-400">
                          {formatCurrency(row.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* 3. Zona de Execução */}
          <Card className="border-slate-700 bg-slate-800/50 border-l-4 border-l-amber-500">
            <CardHeader>
              <CardTitle className="text-lg text-slate-200">Execução Definitiva</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-400 text-sm mb-4">
                Ao gerar a faturação definitiva, serão criados documentos Fatura e Notas de Crédito
                e as encomendas ficarão bloqueadas para nova faturação. Esta ação é irreversível.
              </p>
              <Button
                onClick={() => setExecuteModalOpen(true)}
                disabled={executing || simulation.items.length === 0}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                <Lock className="w-4 h-4 mr-2" />
                Gerar Faturação Definitiva
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      {executeSuccess && (
        <div className="text-sm text-emerald-400 bg-emerald-900/30 border border-emerald-700 rounded-lg px-4 py-3">
          {executeSuccess}
        </div>
      )}

      {/* Modal de confirmação */}
      {executeModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => !executing && setExecuteModalOpen(false)}
        >
          <div
            className="bg-slate-800 border border-slate-600 rounded-xl shadow-xl max-w-md w-full mx-4 p-6 text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
              <Lock className="w-5 h-5 text-amber-400" />
              Confirmar execução
            </h3>
            <p className="text-slate-300 text-sm mb-6">
              A faturação definitiva é <strong>irreversível</strong> e bloqueará as encomendas
              processadas. Deseja continuar?
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="secondary" onClick={() => setExecuteModalOpen(false)} disabled={executing}>
                Cancelar
              </Button>
              <Button
                onClick={handleExecuteConfirm}
                disabled={executing}
                className="bg-amber-600 hover:bg-amber-700"
              >
                {executing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    A processar...
                  </>
                ) : (
                  'Confirmar'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
