'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Calculator, Lock, Loader2, ChevronDown, ChevronRight, Receipt, Banknote, Percent } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useApp } from '@/context/AppContext';
import { billingApi, type SimulationDetailedResponse, type DocumentPreview } from '@/lib/api/billing';
import { empresasApi, type Empresa } from '@/lib/api/empresas';
import { marketplacesApi, type Marketplace } from '@/lib/api/marketplaces';

export function TabBatchInvoicing() {
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
  const [simulation, setSimulation] = useState<SimulationDetailedResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [executeModalOpen, setExecuteModalOpen] = useState(false);
  const [executeSuccess, setExecuteSuccess] = useState<string | null>(null);

  useEffect(() => {
    empresasApi.getAll().then((d) => setEmpresas(Array.isArray(d) ? d.filter((e: Empresa) => e.ativo) : [])).catch(() => {});
  }, []);
  useEffect(() => {
    const id = empresaId === '' ? empresaSelecionada?.id : Number(empresaId);
    if (id) marketplacesApi.getByEmpresa(id).then(setMarketplaces).catch(() => setMarketplaces([]));
    else setMarketplaces([]);
  }, [empresaId, empresaSelecionada?.id]);
  useEffect(() => {
    if (empresaSelecionada && empresaId === '') setEmpresaId(empresaSelecionada.id);
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
    setError(null);
    setSimulation(null);
    setSimulating(true);
    try {
      const res = await billingApi.simulateBatchDetailed(payload());
      setSimulation(res);
    } catch (e: unknown) {
      setError((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Erro ao simular.');
    } finally {
      setSimulating(false);
    }
  };

  const handleExecute = async () => {
    setExecuting(true);
    setExecuteSuccess(null);
    try {
      const res = await billingApi.executeBatch(payload());
      setExecuteSuccess(res.message || 'Faturação concluída.');
      setExecuteModalOpen(false);
      setSimulation(null);
    } catch (e: unknown) {
      setError((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Erro ao executar.');
    } finally {
      setExecuting(false);
    }
  };

  const docId = (d: DocumentPreview, i: number) => `${d.referencia_encomenda}-${i}`;

  return (
    <div className="space-y-6">
      <Card className="border border-slate-600 bg-slate-800/50 shadow-sm">
        <CardHeader className="border-b border-slate-600 bg-slate-800/80">
          <CardTitle className="text-lg text-slate-100 flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-400" /> Processamento de Faturação (Batch)
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div><label className="block text-xs text-slate-400 mb-1">Data início</label><input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm" /></div>
            <div><label className="block text-xs text-slate-400 mb-1">Data fim</label><input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm" /></div>
            <div><label className="block text-xs text-slate-400 mb-1">Marketplace</label><select value={marketplaceId} onChange={(e) => setMarketplaceId(e.target.value === '' ? '' : Number(e.target.value))} className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm"><option value="">Todos</option>{marketplaces.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}</select></div>
            <div><label className="block text-xs text-slate-400 mb-1">Empresa</label><select value={empresaId} onChange={(e) => setEmpresaId(e.target.value === '' ? '' : Number(e.target.value))} className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm"><option value="">Todas</option>{empresas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}</select></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div><label className="block text-xs text-slate-400 mb-1">Série Faturas</label><input type="text" value={serieFaturas} onChange={(e) => setSerieFaturas(e.target.value)} placeholder="FT" className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm" /></div>
            <div><label className="block text-xs text-slate-400 mb-1">Série NC</label><input type="text" value={serieNc} onChange={(e) => setSerieNc(e.target.value)} placeholder="NC" className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm" /></div>
          </div>
          {error && <div className="text-sm text-red-400 bg-red-900/30 border border-red-700 rounded px-3 py-2 mb-4">{error}</div>}
          <Button onClick={handleSimulate} disabled={simulating || !dateFrom || !dateTo} className="bg-amber-600 hover:bg-amber-700">{simulating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Calculator className="w-4 h-4 mr-2" />} Simular</Button>
        </CardContent>
      </Card>

      {simulation && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="border border-slate-600 bg-slate-800/50">
              <CardContent className="pt-5 pb-5">
                <div className="flex items-center gap-3"><Receipt className="w-8 h-8 text-emerald-400" /><div><p className="text-xs text-slate-400">Total a Faturar</p><p className="text-xl font-bold text-emerald-400">{formatCurrency(simulation.total_faturas)}</p></div></div>
              </CardContent>
            </Card>
            <Card className="border border-slate-600 bg-slate-800/50">
              <CardContent className="pt-5 pb-5">
                <div className="flex items-center gap-3"><FileText className="w-8 h-8 text-amber-400" /><div><p className="text-xs text-slate-400">Total NC</p><p className="text-xl font-bold text-amber-400">{formatCurrency(simulation.total_nc)}</p></div></div>
              </CardContent>
            </Card>
            <Card className="border border-slate-600 bg-slate-800/50">
              <CardContent className="pt-5 pb-5">
                <div className="flex items-center gap-3"><Banknote className="w-8 h-8 text-sky-400" /><div><p className="text-xs text-slate-400">Total Líquido</p><p className="text-xl font-bold text-sky-400">{formatCurrency(simulation.saldo_liquido)}</p></div></div>
              </CardContent>
            </Card>
            <Card className="border border-slate-600 bg-slate-800/50">
              <CardContent className="pt-5 pb-5">
                <div className="flex items-center gap-3"><Percent className="w-8 h-8 text-slate-400" /><div><p className="text-xs text-slate-400">Resumo IVA</p><div className="text-sm text-slate-300 mt-1">{simulation.resumo_iva.map((v) => <div key={v.taxa_iva}>{v.taxa_iva}%: Base {formatCurrency(v.base_tributavel)} / IVA {formatCurrency(v.valor_iva)}</div>)}</div></div></div>
              </CardContent>
            </Card>
          </div>

          <Card className="border border-slate-600 bg-slate-800/50">
            <CardHeader className="border-b border-slate-600"><CardTitle className="text-slate-100">Documentos simulados (expandir para detalhe)</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead><tr className="bg-slate-700/60 text-slate-200 border-b border-slate-600"><th className="w-10 py-3 px-2"></th><th className="text-left py-3 px-4 font-semibold">Tipo</th><th className="text-left py-3 px-4 font-semibold">Ref.</th><th className="text-left py-3 px-4 font-semibold">Cliente/Marketplace</th><th className="text-right py-3 px-4 font-semibold">Base</th><th className="text-right py-3 px-4 font-semibold">IVA</th><th className="text-right py-3 px-4 font-semibold">Total</th></tr></thead>
                  <tbody>
                    {simulation.documentos.map((d, i) => {
                      const id = docId(d, i);
                      const isExpanded = expandedId === id;
                      return (
                        <React.Fragment key={id}>
                          <tr className="border-b border-slate-700 hover:bg-slate-700/30">
                            <td className="py-2 px-2"><button type="button" onClick={() => setExpandedId(isExpanded ? null : id)} className="p-1 rounded text-slate-400 hover:text-white">{isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</button></td>
                            <td className="py-3 px-4 text-slate-200">{d.tipo_documento}</td>
                            <td className="py-3 px-4 font-mono text-slate-300">{d.referencia_encomenda}</td>
                            <td className="py-3 px-4 text-slate-400">{d.marketplace_nome || d.cliente || '—'}</td>
                            <td className="py-3 px-4 text-right text-slate-300">{formatCurrency(d.valor_base)}</td>
                            <td className="py-3 px-4 text-right text-slate-300">{formatCurrency(d.iva)}</td>
                            <td className="py-3 px-4 text-right font-medium text-emerald-400">{formatCurrency(d.total)}</td>
                          </tr>
                          {isExpanded && d.linhas && d.linhas.length > 0 && (
                            <tr className="bg-slate-700/30 border-b border-slate-700">
                              <td colSpan={7} className="p-0">
                                <div className="px-6 py-3 border-l-4 border-amber-600/50 bg-slate-800/80">
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="text-slate-400 border-b border-slate-600">
                                        <th className="text-left py-2 px-2">Artigo</th>
                                        <th className="text-right py-2 px-2">Qtd</th>
                                        <th className="text-right py-2 px-2">Preço</th>
                                        <th className="text-right py-2 px-2">Taxa IVA</th>
                                        <th className="text-right py-2 px-2">Valor IVA</th>
                                        <th className="text-right py-2 px-2">Total Linha</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {d.linhas.map((ln, j) => (
                                        <tr key={j} className="border-b border-slate-700/50">
                                          <td className="py-2 px-2 text-slate-300">{ln.artigo}</td>
                                          <td className="py-2 px-2 text-right text-slate-400">{ln.quantidade}</td>
                                          <td className="py-2 px-2 text-right text-slate-400">{formatCurrency(ln.preco_unitario)}</td>
                                          <td className="py-2 px-2 text-right text-slate-400">{ln.taxa_iva}%</td>
                                          <td className="py-2 px-2 text-right text-slate-400">{formatCurrency(ln.valor_iva)}</td>
                                          <td className="py-2 px-2 text-right text-slate-300">{formatCurrency(ln.total_linha)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-amber-500 border border-slate-600 bg-slate-800/50">
            <CardHeader className="border-b border-slate-600"><CardTitle className="text-slate-100">Execução definitiva</CardTitle></CardHeader>
            <CardContent className="pt-6"><p className="text-slate-400 text-sm mb-4">A faturação definitiva é irreversível e bloqueia as encomendas processadas.</p><Button onClick={() => setExecuteModalOpen(true)} disabled={executing || simulation.documentos.length === 0} className="bg-amber-600 hover:bg-amber-700"><Lock className="w-4 h-4 mr-2" /> Gerar Faturação Definitiva</Button></CardContent>
          </Card>
        </>
      )}

      {executeSuccess && <div className="text-sm text-emerald-400 bg-emerald-900/30 border border-emerald-700 rounded px-4 py-3">{executeSuccess}</div>}

      {executeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => !executing && setExecuteModalOpen(false)}>
          <div className="bg-slate-800 border border-slate-600 rounded-xl shadow-xl max-w-md w-full mx-4 p-6 text-white" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-2 flex items-center gap-2"><Lock className="w-5 h-5 text-amber-400" /> Confirmar execução</h3>
            <p className="text-slate-300 text-sm mb-6">A ação é <strong>irreversível</strong> e bloqueará as encomendas processadas. Deseja continuar?</p>
            <div className="flex gap-3 justify-end">
              <Button variant="secondary" onClick={() => setExecuteModalOpen(false)} disabled={executing}>Cancelar</Button>
              <Button onClick={handleExecute} disabled={executing} className="bg-amber-600 hover:bg-amber-700">{executing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null} Confirmar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
