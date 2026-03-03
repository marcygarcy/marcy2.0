'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, Cell,
} from 'recharts';
import { Loader2, TrendingUp, AlertTriangle, DollarSign, Scale, Clock, BookOpen, CheckCircle, Activity, Shield, FileText, ExternalLink, Wallet, CreditCard, Receipt, FileDown, Printer, Inbox } from 'lucide-react';
import { financeApi, type AgingRow, type ProfitabilityData, type CashFlowDay, type CashFlowProjectionDay, type LedgerLine, type LedgerExtractResponse, type DiscrepancyRow, type SupplierHealthRow, type PaymentSuggestionItem, type PaymentHistoricoItem, type ConfirmPaymentRequest, type OpenPoForInvoice, type CreateInvoiceRequest } from '@/lib/api/finance';
import { invoiceValidationApi, type InvoiceValidationStats } from '@/lib/api/invoiceValidation';
import InvoiceInboxView from '@/components/finance/InvoiceInboxView';
import { purchasesApi, type PurchaseOrderWithInvoiceStatus } from '@/lib/api/purchases';
import { empresasApi, type Empresa } from '@/lib/api/empresas';
import { useApp } from '@/context/AppContext';
import { formatCurrency } from '@/lib/utils';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (v: number | null | undefined) => formatCurrency(v ?? 0);
const fmtPct = (v: number) => `${v.toFixed(1)}%`;
const fmtDate = (d: string | null) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('pt-PT'); } catch { return d; }
};

// ─── Aging Report ────────────────────────────────────────────────────────────

function AgingReport({ empresaId }: { empresaId?: number }) {
  const [rows, setRows] = useState<AgingRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    financeApi.getAging(empresaId)
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [empresaId]);

  const totals = rows.reduce(
    (acc, r) => ({
      a_vencer: acc.a_vencer + r.a_vencer,
      vencido_30: acc.vencido_30 + r.vencido_30,
      vencido_mais_30: acc.vencido_mais_30 + r.vencido_mais_30,
      total_divida: acc.total_divida + r.total_divida,
    }),
    { a_vencer: 0, vencido_30: 0, vencido_mais_30: 0, total_divida: 0 }
  );

  return (
    <div className="space-y-4">
      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-5">
          <p className="text-xs text-slate-400 mb-1">Dívida Total</p>
          <p className="text-xl font-bold text-white">{fmt(totals.total_divida)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-5">
          <p className="text-xs text-slate-400 mb-1">A Vencer</p>
          <p className="text-xl font-bold text-emerald-400">{fmt(totals.a_vencer)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-5">
          <p className="text-xs text-slate-400 mb-1">Vencido &lt; 30d</p>
          <p className="text-xl font-bold text-amber-400">{fmt(totals.vencido_30)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-5">
          <p className="text-xs text-slate-400 mb-1">Vencido &gt; 30d</p>
          <p className="text-xl font-bold text-red-400">{fmt(totals.vencido_mais_30)}</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Scale className="w-5 h-5 text-sky-400" />Aging por Fornecedor</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
          ) : rows.length === 0 ? (
            <p className="text-slate-400 text-center py-8">Sem dívidas a fornecedores em aberto.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700 bg-slate-800/40">
                    <th className="text-left py-2 px-3 text-slate-300">Fornecedor</th>
                    <th className="text-left py-2 px-3 text-slate-300">Empresa</th>
                    <th className="text-right py-2 px-3 text-emerald-400">A Vencer</th>
                    <th className="text-right py-2 px-3 text-amber-400">Vencido &lt;30d</th>
                    <th className="text-right py-2 px-3 text-red-400">Vencido &gt;30d</th>
                    <th className="text-right py-2 px-3 text-slate-300">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.supplier_id} className="border-b border-slate-800 hover:bg-slate-800/50">
                      <td className="py-2 px-3 text-slate-200 font-medium">{r.supplier_nome}</td>
                      <td className="py-2 px-3 text-slate-400">{r.empresa_nome ?? '—'}</td>
                      <td className="py-2 px-3 text-right text-emerald-400">{fmt(r.a_vencer)}</td>
                      <td className="py-2 px-3 text-right text-amber-400">{fmt(r.vencido_30)}</td>
                      <td className="py-2 px-3 text-right text-red-400">{fmt(r.vencido_mais_30)}</td>
                      <td className="py-2 px-3 text-right text-white font-semibold">{fmt(r.total_divida)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-600 bg-slate-800/60 font-bold">
                    <td className="py-2 px-3 text-slate-200" colSpan={2}>Total</td>
                    <td className="py-2 px-3 text-right text-emerald-400">{fmt(totals.a_vencer)}</td>
                    <td className="py-2 px-3 text-right text-amber-400">{fmt(totals.vencido_30)}</td>
                    <td className="py-2 px-3 text-right text-red-400">{fmt(totals.vencido_mais_30)}</td>
                    <td className="py-2 px-3 text-right text-white">{fmt(totals.total_divida)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Net Profitability ────────────────────────────────────────────────────────

function NetProfitability({ empresaId }: { empresaId?: number }) {
  const [data, setData] = useState<ProfitabilityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    financeApi.getProfitability({ empresa_id: empresaId, data_inicio: dataInicio || undefined, data_fim: dataFim || undefined })
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [empresaId, dataInicio, dataFim]);

  useEffect(() => { load(); }, [load]);

  // Waterfall data for chart
  const waterfallData = data
    ? [
        { name: 'GMV', value: data.gmv, fill: '#22d3ee' },
        { name: 'Devoluções', value: -data.devolucoes, fill: '#f87171' },
        { name: 'Comissões', value: -data.comissoes, fill: '#fb923c' },
        { name: 'Custo Fornec.', value: -data.custo_base, fill: '#f43f5e' },
        { name: 'Portes', value: -data.portes_reais, fill: '#a78bfa' },
        { name: 'Impostos', value: -data.impostos_po, fill: '#94a3b8' },
        { name: 'Lucro Real', value: data.lucro_real, fill: data.lucro_real >= 0 ? '#4ade80' : '#f87171' },
      ]
    : [];

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card><CardContent className="pt-5">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Data início</label>
            <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)}
              className="bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-sm text-white" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Data fim</label>
            <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)}
              className="bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-sm text-white" />
          </div>
          <button onClick={load} className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-sm">
            Actualizar
          </button>
        </div>
      </CardContent></Card>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-emerald-400" /></div>
      ) : !data ? (
        <p className="text-slate-400 text-center py-10">Sem dados de rentabilidade.</p>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card><CardContent className="pt-5">
              <p className="text-xs text-slate-400 mb-1">GMV</p>
              <p className="text-xl font-bold text-cyan-400">{fmt(data.gmv)}</p>
            </CardContent></Card>
            <Card><CardContent className="pt-5">
              <p className="text-xs text-slate-400 mb-1">Custo Total (POs pagas)</p>
              <p className="text-xl font-bold text-rose-400">{fmt(data.custo_total)}</p>
            </CardContent></Card>
            <Card><CardContent className="pt-5">
              <p className="text-xs text-slate-400 mb-1">Lucro Real</p>
              <p className={`text-xl font-bold ${data.lucro_real >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {fmt(data.lucro_real)}
              </p>
            </CardContent></Card>
            <Card><CardContent className="pt-5">
              <p className="text-xs text-slate-400 mb-1">Margem Real</p>
              <p className={`text-xl font-bold ${data.margem_pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {fmtPct(data.margem_pct)}
              </p>
            </CardContent></Card>
          </div>

          {/* Breakdown chart */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="w-5 h-5 text-emerald-400" />Detalhe de Rentabilidade</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={waterfallData} margin={{ top: 10, right: 20, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }}
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k€`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: 8 }}
                    formatter={(v: number) => [fmt(Math.abs(v)), v >= 0 ? 'Positivo' : 'Negativo']}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {waterfallData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              {/* Detalhe tabular */}
              <div className="mt-4 space-y-1 text-sm">
                {[
                  { label: 'GMV (Vendas brutas)', value: data.gmv, color: 'text-cyan-400' },
                  { label: '− Devoluções', value: -data.devolucoes, color: 'text-red-400' },
                  { label: '− Comissões Marketplace', value: -data.comissoes, color: 'text-orange-400' },
                  { label: '− Custo Fornecedores (faturado)', value: -data.custo_base, color: 'text-rose-400' },
                  { label: '− Portes Reais', value: -data.portes_reais, color: 'text-violet-400' },
                  { label: '− Impostos (POs)', value: -data.impostos_po, color: 'text-slate-400' },
                  { label: '= Lucro Real Final', value: data.lucro_real, color: data.lucro_real >= 0 ? 'text-emerald-400 font-bold text-base' : 'text-red-400 font-bold text-base' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex justify-between border-b border-slate-800 py-1">
                    <span className="text-slate-300">{label}</span>
                    <span className={color}>{fmt(Math.abs(value))}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ─── Cash Flow Forecast ───────────────────────────────────────────────────────

function CashFlowForecast({ empresaId }: { empresaId?: number }) {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<CashFlowDay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    financeApi.getCashFlowForecast({ empresa_id: empresaId, days })
      .then(setData)
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [empresaId, days]);

  const total7 = data.filter(d => {
    const diff = (new Date(d.data_vencimento).getTime() - Date.now()) / 86400000;
    return diff <= 7;
  }).reduce((s, d) => s + d.total_saidas, 0);
  const total15 = data.filter(d => {
    const diff = (new Date(d.data_vencimento).getTime() - Date.now()) / 86400000;
    return diff <= 15;
  }).reduce((s, d) => s + d.total_saidas, 0);
  const totalAll = data.reduce((s, d) => s + d.total_saidas, 0);

  return (
    <div className="space-y-4">
      {/* Horizonte selector */}
      <Card><CardContent className="pt-5">
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-400">Horizonte:</span>
          {[7, 15, 30, 60].map((d) => (
            <button key={d} onClick={() => setDays(d)}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${days === d ? 'bg-sky-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
              {d} dias
            </button>
          ))}
        </div>
      </CardContent></Card>

      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="pt-5">
          <p className="text-xs text-slate-400 mb-1">Próximos 7 dias</p>
          <p className="text-xl font-bold text-red-400">{fmt(total7)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-5">
          <p className="text-xs text-slate-400 mb-1">Próximos 15 dias</p>
          <p className="text-xl font-bold text-amber-400">{fmt(total15)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-5">
          <p className="text-xs text-slate-400 mb-1">Total ({days} dias)</p>
          <p className="text-xl font-bold text-sky-400">{fmt(totalAll)}</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="w-5 h-5 text-sky-400" />Projeção de Saídas de Caixa</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
          ) : data.length === 0 ? (
            <p className="text-slate-400 text-center py-8">Sem vencimentos nos próximos {days} dias.</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={data} margin={{ top: 10, right: 20, left: 20, bottom: 5 }}>
                  <defs>
                    <linearGradient id="cashGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="data_vencimento" tick={{ fill: '#94a3b8', fontSize: 11 }}
                    tickFormatter={(d) => new Date(d).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }}
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k€`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: 8 }}
                    labelFormatter={(d) => new Date(d).toLocaleDateString('pt-PT')}
                    formatter={(v: number) => [fmt(v), 'Saída prevista']}
                  />
                  <Area type="monotone" dataKey="total_saidas" stroke="#38bdf8" fill="url(#cashGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>

              {/* Table */}
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left py-2 px-3 text-slate-300">Vencimento</th>
                      <th className="text-right py-2 px-3 text-slate-300">Total</th>
                      <th className="text-right py-2 px-3 text-slate-300">Nº POs</th>
                      <th className="text-left py-2 px-3 text-slate-300">Detalhe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((row) => (
                      <tr key={row.data_vencimento} className="border-b border-slate-800 hover:bg-slate-800/50">
                        <td className="py-2 px-3 text-slate-200 font-medium">{fmtDate(row.data_vencimento)}</td>
                        <td className="py-2 px-3 text-right text-red-400 font-semibold">{fmt(row.total_saidas)}</td>
                        <td className="py-2 px-3 text-right text-slate-400">{row.num_pos}</td>
                        <td className="py-2 px-3 text-slate-400 text-xs">
                          {row.pos.slice(0, 2).map((p) => `${p.supplier_nome} (${fmt(p.total)})`).join(' · ')}
                          {row.pos.length > 2 && ` +${row.pos.length - 2} mais`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Projeção Saldo (v3.0: entradas - saídas, 30 dias) ────────────────────────

function CashFlowProjection({ empresaId }: { empresaId?: number }) {
  const [data, setData] = useState<CashFlowProjectionDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialBalance, setInitialBalance] = useState(0);
  const [days, setDays] = useState(30);

  useEffect(() => {
    setLoading(true);
    financeApi.getCashFlowProjection({ empresa_id: empresaId, days, initial_balance: initialBalance })
      .then(setData)
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [empresaId, days, initialBalance]);

  const chartData = data.map((d) => ({
    ...d,
    data_short: new Date(d.data).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' }),
  }));

  if (loading) {
    return (
      <div className="space-y-4">
        <Card><CardContent className="pt-5"><div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div></CardContent></Card>
      </div>
    );
  }
  if (chartData.length === 0) {
    return (
      <div className="space-y-4">
        <Card><CardContent className="pt-5"><p className="text-slate-400 text-center py-8">Sem dados de projeção.</p></CardContent></Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card><CardContent className="pt-5">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Saldo inicial (EUR)</label>
            <input type="number" step="0.01" value={initialBalance}
              onChange={(e) => setInitialBalance(parseFloat(e.target.value) || 0)}
              className="bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-sm text-white w-28" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Dias</label>
            <div className="flex gap-1">
              {[14, 30, 60].map((n) => (
                <button key={n} type="button" onClick={() => setDays(n)}
                  className={days === n ? 'px-3 py-1 rounded text-sm font-medium bg-emerald-600 text-white' : 'px-3 py-1 rounded text-sm font-medium bg-slate-700 text-slate-300 hover:bg-slate-600'}>
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>
      </CardContent></Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Activity className="w-5 h-5 text-emerald-400" />Projeção de Saldo (Entradas - Saídas)</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 20, bottom: 5 }}>
              <defs>
                <linearGradient id="saldoGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4ade80" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#4ade80" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="data_short" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(v: number) => (v / 1000).toFixed(0) + 'k' + String.fromCharCode(0x20AC)} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: 8 }}
                formatter={(v: number, name: string) => [fmt(v), name === 'saldo_acumulado' ? 'Saldo' : 'Mov. dia']}
                labelFormatter={(_: unknown, payload: unknown[]) => (payload && payload[0] && (payload[0] as { payload?: { data?: string } }).payload?.data) ? new Date((payload[0] as { payload: { data: string } }).payload.data).toLocaleDateString('pt-PT') : ''}
              />
              <Area type="monotone" dataKey="saldo_acumulado" stroke="#4ade80" fill="url(#saldoGrad)" strokeWidth={2} name="Saldo acumulado" />
            </AreaChart>
          </ResponsiveContainer>
          <p className="text-xs text-slate-500 mt-2">Curva de saldo projetado para os próximos {days} dias.</p>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Supplier Health Score (v3.0) ─────────────────────────────────────────────

function SupplierHealthRanking({ empresaId }: { empresaId?: number }) {
  const [rows, setRows] = useState<SupplierHealthRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    financeApi.getSupplierHealth(empresaId)
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [empresaId]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Shield className="w-5 h-5 text-amber-400" />Ranking de Fornecedores (Health Score)</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
          ) : rows.length === 0 ? (
            <p className="text-slate-400 text-center py-8">Sem fornecedores ou sem dados de score.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700 bg-slate-800/40">
                    <th className="text-left py-2 px-3 text-slate-300">Fornecedor</th>
                    <th className="text-right py-2 px-3 text-slate-300">Score</th>
                    <th className="text-right py-2 px-3 text-slate-300">Lead time (d)</th>
                    <th className="text-right py-2 px-3 text-slate-300">Devoluções %</th>
                    <th className="text-right py-2 px-3 text-slate-300">Alertas margem</th>
                    <th className="text-right py-2 px-3 text-slate-300">Margem média %</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.supplier_id} className="border-b border-slate-800 hover:bg-slate-800/50">
                      <td className="py-2 px-3 text-slate-200 font-medium">{r.supplier_nome}</td>
                      <td className="py-2 px-3 text-right">
                        <span className={`font-semibold ${r.health_score >= 70 ? 'text-emerald-400' : r.health_score >= 40 ? 'text-amber-400' : 'text-red-400'}`}>
                          {r.health_score.toFixed(1)}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right text-slate-400">{r.lead_time_days != null ? r.lead_time_days.toFixed(1) : '—'}</td>
                      <td className="py-2 px-3 text-right text-slate-400">{r.return_rate_pct.toFixed(1)}%</td>
                      <td className="py-2 px-3 text-right">{r.margin_alert_count > 0 ? <span className="text-amber-400">{r.margin_alert_count}</span> : '0'}</td>
                      <td className="py-2 px-3 text-right text-slate-300">{r.avg_margin_pct != null ? `${r.avg_margin_pct.toFixed(1)}%` : '—'}</td>
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

// ─── Conta Corrente (Ledger) — ERP Grade ─────────────────────────────────────

const TIPO_DOC_META: Record<string, { color: string }> = {
  FT: { color: 'bg-red-900/50 text-red-300' },
  NC: { color: 'bg-sky-900/50 text-sky-300' },
  ND: { color: 'bg-orange-900/50 text-orange-300' },
  RE: { color: 'bg-emerald-900/50 text-emerald-300' },
  AJ: { color: 'bg-slate-700 text-slate-300' },
};

const TIPO_DOC_OPTIONS = [
  { code: 'FT', desc: 'FT — Fatura (aumenta dívida)',        tipoBackend: 'Fatura',          isCredito: true },
  { code: 'NC', desc: 'NC — Nota de Crédito (reduz dívida)', tipoBackend: 'Nota de Crédito', isCredito: false },
  { code: 'ND', desc: 'ND — Nota de Débito (aumenta dívida)', tipoBackend: 'Nota de Débito', isCredito: true },
  { code: 'RE', desc: 'RE — Recibo/Pagamento (reduz dívida)', tipoBackend: 'Pagamento',      isCredito: false },
  { code: 'AJ', desc: 'AJ — Ajuste',                         tipoBackend: 'Ajuste',          isCredito: false },
];

function LedgerView({
  empresaId: empresaIdProp,
  preselectSupplierId = null,
  onPreselectConsumed,
}: {
  empresaId?: number;
  preselectSupplierId?: number | null;
  onPreselectConsumed?: () => void;
}) {
  const [empresaFiltro, setEmpresaFiltro] = useState<number | ''>(empresaIdProp ?? '');
  const [supplierId, setSupplierId] = useState<number | ''>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [extract, setExtract] = useState<LedgerExtractResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [supplierList, setSupplierList] = useState<Array<{ id: number; nome: string }>>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [form, setForm] = useState({
    tipoCode: 'FT',
    valor: '',
    num_doc: '',
    data: new Date().toISOString().slice(0, 10),
    notas: '',
  });

  useEffect(() => {
    empresasApi.getAll().then(setEmpresas).catch(() => setEmpresas([]));
  }, []);

  useEffect(() => {
    import('@/lib/api/suppliers').then(m => {
      m.suppliersApi.list(empresaFiltro !== '' ? (empresaFiltro as number) : undefined).then((r) => {
        setSupplierList(
          (r?.items ?? [])
            .map(s => ({ id: s.id ?? 0, nome: (s.nome || s.designacao_social) ?? '—' }))
            .filter(s => s.id > 0)
        );
      });
    }).catch(() => {});
  }, [empresaFiltro]);

  useEffect(() => {
    if (preselectSupplierId != null) {
      setSupplierId(preselectSupplierId);
      onPreselectConsumed?.();
    }
  }, [preselectSupplierId, onPreselectConsumed]);

  const handleGerar = useCallback(() => {
    if (!supplierId) return;
    setLoading(true);
    setMsg(null);
    financeApi.getLedgerExtract(Number(supplierId), {
      empresa_id: empresaFiltro !== '' ? Number(empresaFiltro) : undefined,
      start_date: startDate || undefined,
      end_date: endDate || undefined,
    })
      .then(setExtract)
      .catch(() => setExtract(null))
      .finally(() => setLoading(false));
  }, [supplierId, empresaFiltro, startDate, endDate]);

  useEffect(() => {
    if (supplierId) handleGerar();
    else setExtract(null);
  }, [supplierId]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedTipo = TIPO_DOC_OPTIONS.find(t => t.code === form.tipoCode) ?? TIPO_DOC_OPTIONS[0];

  const handleSaveLancamento = async () => {
    if (!supplierId || empresaFiltro === '') {
      setMsg('Selecione empresa e fornecedor antes de lançar.');
      return;
    }
    const valor = parseFloat(form.valor || '0');
    if (valor <= 0) { setMsg('Valor tem de ser > 0.'); return; }
    setSaving(true);
    setMsg(null);
    try {
      await financeApi.createLedgerEntry({
        empresa_id: Number(empresaFiltro),
        supplier_id: Number(supplierId),
        tipo: selectedTipo.tipoBackend,
        valor_credito: selectedTipo.isCredito ? valor : 0,
        valor_debito:  selectedTipo.isCredito ? 0 : valor,
        documento_ref: form.num_doc || undefined,
        notas: form.notas || undefined,
        data_movimento: form.data || undefined,
      });
      setMsg('Lançamento criado com sucesso.');
      setShowForm(false);
      setForm(f => ({ ...f, valor: '', num_doc: '', notas: '' }));
      handleGerar();
    } catch {
      setMsg('Erro ao criar lançamento.');
    } finally {
      setSaving(false);
    }
  };

  const handleExportCSV = () => {
    if (!extract) return;
    const rows = [
      ['Data', 'Nº Doc', 'Tipo', 'Descrição', 'Débito', 'Crédito', 'Saldo'],
      ...(extract.saldo_inicial !== 0
        ? [['', '', '', 'Saldo Inicial', '', '', String(extract.saldo_inicial)]]
        : []),
      ...extract.movimentos.map(m => [
        m.data_movimento ?? '',
        m.num_doc ?? '',
        m.tipo_doc,
        m.descricao ?? m.tipo,
        m.valor_debito > 0 ? String(m.valor_debito) : '',
        m.valor_credito > 0 ? String(m.valor_credito) : '',
        String(m.saldo_corrente),
      ]),
      ['TOTAL', '', '', '', String(extract.total_debitos), String(extract.total_creditos), String(extract.saldo_final)],
    ];
    const csv = rows.map(r => r.join(';')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `extrato_${extract.supplier_nome}_${startDate || 'total'}.csv`;
    a.click();
  };

  return (
    <div className="space-y-4">
      {/* ── Filtros ── */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Empresa</label>
              <select
                value={empresaFiltro}
                onChange={e => setEmpresaFiltro(e.target.value ? Number(e.target.value) : '')}
                className="bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-sm text-white min-w-[180px]"
              >
                <option value="">Todas as empresas</option>
                {empresas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Entidade (Fornecedor)</label>
              <select
                value={supplierId}
                onChange={e => setSupplierId(e.target.value ? Number(e.target.value) : '')}
                className="bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-sm text-white min-w-[220px]"
              >
                <option value="">Selecionar fornecedor…</option>
                {supplierList.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Data início</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-sm text-white" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Data fim</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                className="bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-sm text-white" />
            </div>
            <button onClick={handleGerar} disabled={!supplierId || loading}
              className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded text-sm disabled:opacity-50">
              {loading ? 'A calcular…' : 'Gerar Extrato'}
            </button>
            {extract && (
              <button onClick={handleExportCSV}
                className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm flex items-center gap-1">
                <FileText className="w-3.5 h-3.5" /> CSV
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── KPI Sumário ── */}
      {extract && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardContent className="pt-5">
            <p className="text-xs text-slate-400 mb-1">Saldo Inicial</p>
            <p className={`text-xl font-bold ${extract.saldo_inicial > 0 ? 'text-red-400' : extract.saldo_inicial < 0 ? 'text-emerald-400' : 'text-slate-300'}`}>
              {fmt(extract.saldo_inicial)}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">antes do período</p>
          </CardContent></Card>
          <Card><CardContent className="pt-5">
            <p className="text-xs text-red-400 mb-1">Total Créditos (C)</p>
            <p className="text-xl font-bold text-red-400">{fmt(extract.total_creditos)}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">FT + ND no período</p>
          </CardContent></Card>
          <Card><CardContent className="pt-5">
            <p className="text-xs text-emerald-400 mb-1">Total Débitos (D)</p>
            <p className="text-xl font-bold text-emerald-400">{fmt(extract.total_debitos)}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">RE + NC no período</p>
          </CardContent></Card>
          <Card><CardContent className="pt-5">
            <p className="text-xs text-slate-400 mb-1">Saldo Final</p>
            <p className={`text-xl font-bold ${extract.saldo_final > 0 ? 'text-red-400' : extract.saldo_final < 0 ? 'text-emerald-400' : 'text-slate-300'}`}>
              {fmt(extract.saldo_final)}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {extract.saldo_final > 0 ? 'devemos ao fornecedor' : extract.saldo_final < 0 ? 'fornecedor tem crédito' : 'saldo nulo'}
            </p>
          </CardContent></Card>
        </div>
      )}

      {/* ── Tabela de Extrato ── */}
      {extract && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-sky-400" />
                Extrato — {extract.supplier_nome}
                {extract.empresa_nome && (
                  <span className="text-slate-400 font-normal text-sm">· {extract.empresa_nome}</span>
                )}
              </CardTitle>
              <button onClick={() => setShowForm(!showForm)}
                className="px-3 py-1.5 bg-sky-700 hover:bg-sky-600 text-white rounded text-sm">
                + Novo Lançamento
              </button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Form Novo Lançamento */}
            {showForm && (
              <div className="mb-4 p-4 bg-slate-800 rounded-lg border border-slate-600 space-y-3">
                <p className="text-sm font-medium text-slate-200">Novo Lançamento Manual</p>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Tipo Doc.</label>
                    <select value={form.tipoCode}
                      onChange={e => setForm(f => ({ ...f, tipoCode: e.target.value }))}
                      className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-sm text-white">
                      {TIPO_DOC_OPTIONS.map(t => <option key={t.code} value={t.code}>{t.desc}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Nº Documento</label>
                    <input type="text" value={form.num_doc}
                      onChange={e => setForm(f => ({ ...f, num_doc: e.target.value }))}
                      placeholder="Ex: FT 2026/001"
                      className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-sm text-white" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">
                      {selectedTipo.isCredito ? 'Valor Crédito (€)' : 'Valor Débito (€)'}
                      <span className={`ml-1 text-[10px] ${selectedTipo.isCredito ? 'text-red-400' : 'text-emerald-400'}`}>
                        ({selectedTipo.isCredito ? 'C' : 'D'})
                      </span>
                    </label>
                    <input type="number" step="0.01" min="0" value={form.valor}
                      onChange={e => setForm(f => ({ ...f, valor: e.target.value }))}
                      className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-sm text-white" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Data</label>
                    <input type="date" value={form.data}
                      onChange={e => setForm(f => ({ ...f, data: e.target.value }))}
                      className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-sm text-white" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Notas</label>
                    <input type="text" value={form.notas}
                      onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
                      className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-sm text-white" />
                  </div>
                </div>
                <div className="flex gap-2 items-center">
                  <button onClick={handleSaveLancamento} disabled={saving}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-sm disabled:opacity-50">
                    {saving ? 'A guardar…' : 'Guardar'}
                  </button>
                  <button onClick={() => setShowForm(false)}
                    className="px-4 py-1.5 bg-slate-600 hover:bg-slate-500 text-white rounded text-sm">
                    Cancelar
                  </button>
                  {msg && (
                    <p className={`text-sm ${msg.includes('Erro') || msg.includes('Selecione') ? 'text-red-400' : 'text-emerald-400'}`}>
                      {msg}
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700 bg-slate-800/40">
                    <th className="text-left py-2 px-3 text-slate-300 w-24">Data</th>
                    <th className="text-left py-2 px-3 text-slate-300">Nº Doc</th>
                    <th className="text-center py-2 px-2 text-slate-300 w-14">Tipo</th>
                    <th className="text-left py-2 px-3 text-slate-300">Descrição</th>
                    <th className="text-right py-2 px-3 text-emerald-400 w-28">Débito (D)</th>
                    <th className="text-right py-2 px-3 text-red-400 w-28">Crédito (C)</th>
                    <th className="text-right py-2 px-3 text-slate-300 w-28">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Linha de Saldo Inicial */}
                  {extract.saldo_inicial !== 0 && (
                    <tr className="border-b border-slate-800 bg-slate-800/20">
                      <td className="py-1.5 px-3 text-slate-500 text-xs italic" colSpan={3}>
                        {startDate ? `Antes de ${fmtDate(startDate)}` : 'Saldo Anterior'}
                      </td>
                      <td className="py-1.5 px-3 text-slate-400 text-xs italic">Saldo Inicial</td>
                      <td className="py-1.5 px-3" />
                      <td className="py-1.5 px-3" />
                      <td className={`py-1.5 px-3 text-right font-semibold text-xs ${extract.saldo_inicial > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {fmt(extract.saldo_inicial)}
                      </td>
                    </tr>
                  )}
                  {extract.movimentos.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-slate-400">
                        Sem movimentos no período selecionado.
                      </td>
                    </tr>
                  ) : (
                    extract.movimentos.map(m => {
                      const meta = TIPO_DOC_META[m.tipo_doc] ?? TIPO_DOC_META['AJ'];
                      return (
                        <tr key={m.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                          <td className="py-2 px-3 text-slate-400 text-xs">{fmtDate(m.data_movimento)}</td>
                          <td className="py-2 px-3 text-slate-300 font-mono text-xs">{m.num_doc ?? '—'}</td>
                          <td className="py-2 px-2 text-center">
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${meta.color}`}>
                              {m.tipo_doc}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-slate-300 text-xs max-w-[200px] truncate">
                            {m.descricao ?? m.tipo}
                            {m.purchase_order_id != null && (
                              <span className="ml-2 text-amber-500 text-[10px]">PO#{m.purchase_order_id}</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right text-emerald-400 font-mono text-xs">
                            {m.valor_debito > 0 ? fmt(m.valor_debito) : ''}
                          </td>
                          <td className="py-2 px-3 text-right text-red-400 font-mono text-xs">
                            {m.valor_credito > 0 ? fmt(m.valor_credito) : ''}
                          </td>
                          <td className={`py-2 px-3 text-right font-semibold text-xs ${m.saldo_corrente > 0 ? 'text-red-400' : m.saldo_corrente < 0 ? 'text-emerald-400' : 'text-slate-300'}`}>
                            {fmt(m.saldo_corrente)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-600 bg-slate-800/60 font-bold">
                    <td className="py-2 px-3 text-slate-200 text-xs" colSpan={4}>TOTAL PERÍODO</td>
                    <td className="py-2 px-3 text-right text-emerald-400 font-mono text-xs">{fmt(extract.total_debitos)}</td>
                    <td className="py-2 px-3 text-right text-red-400 font-mono text-xs">{fmt(extract.total_creditos)}</td>
                    <td className={`py-2 px-3 text-right text-sm font-bold ${extract.saldo_final > 0 ? 'text-red-400' : extract.saldo_final < 0 ? 'text-emerald-400' : 'text-slate-300'}`}>
                      {fmt(extract.saldo_final)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {!supplierId && (
        <div className="flex flex-col items-center justify-center py-16 text-slate-500">
          <BookOpen className="w-12 h-12 mb-3 opacity-30" />
          <p className="text-sm">Selecione uma entidade (fornecedor) para gerar o extrato de conta corrente.</p>
          <p className="text-xs mt-1 opacity-70">Legenda: C = Crédito (aumenta dívida) · D = Débito (reduz dívida)</p>
        </div>
      )}
    </div>
  );
}

// ─── Divergências (Triple-Match) ─────────────────────────────────────────────

function Discrepancies({ empresaId }: { empresaId?: number }) {
  const [rows, setRows] = useState<DiscrepancyRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [matchingId, setMatchingId] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    financeApi.getDiscrepancies({ empresa_id: empresaId })
      .then(r => { setRows(r.items); setTotal(r.total); })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [empresaId]);

  useEffect(() => { load(); }, [load]);

  const handleMatch = async (poId: number) => {
    setMatchingId(poId);
    setMsg(null);
    try {
      const r = await financeApi.runTripleMatch(poId);
      setMsg(`PO #${poId}: ${r.status}${r.discrepancy_amount ? ` (diff: ${fmt(r.discrepancy_amount)})` : ''}`);
      load();
    } catch {
      setMsg(`Erro ao processar PO #${poId}`);
    } finally {
      setMatchingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              Divergências Triple-Match ({total})
            </CardTitle>
            <button onClick={load} className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm">
              Actualizar
            </button>
          </div>
        </CardHeader>
        <CardContent>
          {msg && (
            <div className={`mb-3 px-4 py-2 rounded text-sm ${msg.includes('Erro') ? 'bg-red-900/30 text-red-400' : 'bg-emerald-900/30 text-emerald-400'}`}>
              {msg}
            </div>
          )}
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
          ) : rows.length === 0 ? (
            <div className="text-center py-10">
              <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
              <p className="text-slate-400">Sem divergências. Triple-Match OK!</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700 bg-slate-800/40">
                    <th className="text-left py-2 px-3 text-slate-300">PO #</th>
                    <th className="text-left py-2 px-3 text-slate-300">Fornecedor</th>
                    <th className="text-right py-2 px-3 text-slate-300">Valor PO</th>
                    <th className="text-right py-2 px-3 text-slate-300">Fatura</th>
                    <th className="text-right py-2 px-3 text-slate-300">Banco</th>
                    <th className="text-right py-2 px-3 text-amber-400">Divergência</th>
                    <th className="text-left py-2 px-3 text-slate-300">Status</th>
                    <th className="text-center py-2 px-3 text-slate-300">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                      <td className="py-2 px-3 text-slate-200 font-medium">#{r.purchase_order_id}</td>
                      <td className="py-2 px-3 text-slate-300">{r.supplier_nome ?? '—'}</td>
                      <td className="py-2 px-3 text-right text-slate-300">{fmt(r.po_amount)}</td>
                      <td className="py-2 px-3 text-right text-slate-300">
                        {r.invoice_amount != null ? fmt(r.invoice_amount) : <span className="text-slate-500">—</span>}
                      </td>
                      <td className="py-2 px-3 text-right text-slate-300">
                        {r.bank_amount != null ? fmt(Math.abs(r.bank_amount)) : <span className="text-slate-500">—</span>}
                      </td>
                      <td className={`py-2 px-3 text-right font-semibold ${(r.discrepancy_amount ?? 0) !== 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                        {r.discrepancy_amount ? `${(r.discrepancy_amount ?? 0) > 0 ? '+' : ''}${fmt(r.discrepancy_amount)}` : '—'}
                      </td>
                      <td className="py-2 px-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          r.status === 'Matched' ? 'bg-emerald-900/40 text-emerald-300' :
                          r.status === 'Discrepancy' ? 'bg-red-900/40 text-red-300' :
                          'bg-amber-900/40 text-amber-300'
                        }`}>{r.status}</span>
                      </td>
                      <td className="py-2 px-3 text-center">
                        {r.purchase_order_id && (
                          <button onClick={() => handleMatch(r.purchase_order_id!)}
                            disabled={matchingId === r.purchase_order_id}
                            className="px-2 py-1 bg-sky-700 hover:bg-sky-600 text-white rounded text-xs disabled:opacity-50">
                            {matchingId === r.purchase_order_id ? '…' : 'Match'}
                          </button>
                        )}
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

// ─── POs e Faturas (match PO ↔ Fatura, enviar para conta corrente) ─────────────

function POsEFaturas({
  empresaId,
  onOpenLedger,
}: {
  empresaId?: number;
  onOpenLedger?: (supplierId: number) => void;
}) {
  const [rows, setRows] = useState<PurchaseOrderWithInvoiceStatus[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresaFilter, setEmpresaFilter] = useState<number | ''>('');
  const [statusFilter, setStatusFilter] = useState<string>('Ordered');
  const [invoiceStateFilter, setInvoiceStateFilter] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // ── Novo modal: Registar Fatura (multi-PO) ──────────────────────────────────
  const todayStr = new Date().toISOString().slice(0, 10);
  const [invModal, setInvModal] = useState(false);
  const [invEmpresaId, setInvEmpresaId] = useState<number | ''>('');
  const [invSupplierId, setInvSupplierId] = useState<number | ''>('');
  const [invOpenPos, setInvOpenPos] = useState<OpenPoForInvoice[]>([]);
  const [invLoadingPos, setInvLoadingPos] = useState(false);
  const [invSelectedPos, setInvSelectedPos] = useState<Set<number>>(new Set());
  const [invForm, setInvForm] = useState({ invoice_ref: '', invoice_amount: '', invoice_date: todayStr, notas: '', post_to_ledger: true });
  const [invSaving, setInvSaving] = useState(false);
  const [invMsg, setInvMsg] = useState<string | null>(null);

  // Fornecedores únicos das POs já carregadas (para o dropdown do modal)
  const uniqueModalSuppliers = Array.from(
    new Map(rows.filter((r) => r.supplier_id != null).map((r) => [r.supplier_id, { id: r.supplier_id!, nome: r.supplier_nome || '' }])).values()
  ).sort((a, b) => a.nome.localeCompare(b.nome));

  useEffect(() => {
    empresasApi.getAll().then(setEmpresas).catch(() => setEmpresas([]));
  }, []);

  const effectiveEmpresaId = empresaFilter !== '' ? empresaFilter : empresaId;
  const load = useCallback(() => {
    setLoading(true);
    purchasesApi
      .listPurchaseOrdersWithInvoiceStatus(
        effectiveEmpresaId,
        statusFilter || undefined,
        invoiceStateFilter || undefined,
        200,
        0
      )
      .then((r) => {
        setRows(r.items);
        setTotal(r.total);
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [effectiveEmpresaId, statusFilter, invoiceStateFilter]);

  useEffect(() => {
    load();
  }, [load]);

  // Carrega POs em aberto quando fornecedor muda no modal
  useEffect(() => {
    if (!invModal || invSupplierId === '') { setInvOpenPos([]); return; }
    setInvLoadingPos(true);
    setInvSelectedPos(new Set());
    financeApi.getSupplierOpenPos(Number(invSupplierId), invEmpresaId !== '' ? Number(invEmpresaId) : undefined)
      .then(setInvOpenPos)
      .catch(() => setInvOpenPos([]))
      .finally(() => setInvLoadingPos(false));
  }, [invModal, invSupplierId, invEmpresaId]);

  // Auto-preenche o valor com a soma das POs selecionadas
  useEffect(() => {
    const total = invOpenPos
      .filter((p) => invSelectedPos.has(p.id))
      .reduce((s, p) => s + (p.total_final ?? 0), 0);
    if (total > 0) setInvForm((f) => ({ ...f, invoice_amount: String(total.toFixed(2)) }));
  }, [invSelectedPos, invOpenPos]);

  const openInvoiceModal = (po?: PurchaseOrderWithInvoiceStatus) => {
    setInvMsg(null);
    setInvForm({ invoice_ref: '', invoice_amount: '', invoice_date: todayStr, notas: '', post_to_ledger: true });
    setInvOpenPos([]);
    if (po) {
      setInvEmpresaId(po.empresa_id ?? '');
      setInvSupplierId(po.supplier_id ?? '');
      setInvSelectedPos(new Set([po.id]));
    } else {
      setInvEmpresaId(empresaFilter !== '' ? Number(empresaFilter) : (empresaId ?? ''));
      setInvSupplierId('');
      setInvSelectedPos(new Set());
    }
    setInvModal(true);
  };

  const toggleInvPo = (poId: number) => {
    setInvSelectedPos((prev) => {
      const next = new Set(prev);
      if (next.has(poId)) next.delete(poId); else next.add(poId);
      return next;
    });
  };

  const handleCreateInvoice = async () => {
    if (invEmpresaId === '' || invSupplierId === '' || !invForm.invoice_ref.trim() || !invForm.invoice_amount || invSelectedPos.size === 0) return;
    setInvSaving(true);
    setInvMsg(null);
    try {
      const body: CreateInvoiceRequest = {
        empresa_id: Number(invEmpresaId),
        supplier_id: Number(invSupplierId),
        invoice_ref: invForm.invoice_ref.trim(),
        invoice_amount: Number(invForm.invoice_amount),
        invoice_date: invForm.invoice_date || undefined,
        po_ids: Array.from(invSelectedPos),
        notas: invForm.notas.trim() || undefined,
        post_to_ledger: invForm.post_to_ledger,
      };
      const res = await financeApi.createSupplierInvoice(body);
      const ledgerMsg = res.ledger_created ? ' e lançada na Conta Corrente' : '';
      setInvMsg(`Fatura registada${ledgerMsg} — ${res.po_count} PO(s) associadas.`);
      load();
      setInvModal(false);
    } catch (e: unknown) {
      setInvMsg((e as Error)?.message ?? 'Erro ao registar fatura.');
    } finally {
      setInvSaving(false);
    }
  };

  const handlePostToLedgerOnly = async (po: PurchaseOrderWithInvoiceStatus) => {
    setSaving(true);
    setMsg(null);
    try {
      await purchasesApi.registerPoInvoice(po.id, {
        invoice_ref: po.invoice_ref ?? undefined,
        invoice_amount: po.invoice_amount ?? undefined,
        post_to_ledger: true,
      });
      setMsg('Lançamento criado na conta corrente.');
      load();
    } catch (e: unknown) {
      setMsg((e as Error)?.message ?? 'Erro ao enviar para conta corrente.');
    } finally {
      setSaving(false);
    }
  };

  const invCanSubmit = invEmpresaId !== '' && invSupplierId !== '' && invForm.invoice_ref.trim() !== '' && invForm.invoice_amount !== '' && invSelectedPos.size > 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-400" />
                Match PO ↔ Fatura
              </CardTitle>
              <p className="text-slate-400 text-sm mt-1">
                Registe faturas de fornecedores (uma fatura pode cobrir múltiplas POs). Depois pode conciliar em Divergências.
              </p>
            </div>
            <button
              type="button"
              onClick={() => openInvoiceModal()}
              className="px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-500 flex items-center gap-2 whitespace-nowrap"
            >
              <Receipt className="w-4 h-4" /> Nova Fatura
            </button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4 mb-4">
            <div className="flex items-center gap-2">
              <label className="text-slate-400 text-sm whitespace-nowrap">Empresa</label>
              <select
                value={empresaFilter === '' ? '' : String(empresaFilter)}
                onChange={(e) => setEmpresaFilter(e.target.value === '' ? '' : Number(e.target.value))}
                className="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm min-w-[160px]"
              >
                <option value="">Todas</option>
                {empresas.map((e) => (
                  <option key={e.id} value={e.id}>{e.nome}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-slate-400 text-sm whitespace-nowrap">Estado PO</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm min-w-[140px]"
              >
                <option value="">Todos</option>
                <option value="Draft">Rascunho</option>
                <option value="Ordered">Encomendado</option>
                <option value="Paid">Pago</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-slate-400 text-sm whitespace-nowrap">Estado fatura</label>
              <select
                value={invoiceStateFilter}
                onChange={(e) => setInvoiceStateFilter(e.target.value)}
                className="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm min-w-[180px]"
              >
                <option value="">Todos</option>
                <option value="fatura_em_falta">Fatura em falta</option>
                <option value="por_enviar_cc">Por enviar para C.C.</option>
                <option value="na_conta_corrente">Na conta corrente</option>
                <option value="conciliado">Conciliado</option>
              </select>
            </div>
          </div>
          {msg && (
            <div className="mb-4 px-4 py-2 rounded-lg bg-emerald-900/30 text-emerald-400 text-sm">
              {msg}
            </div>
          )}
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-slate-400 text-center py-8">Nenhuma ordem de compra com o filtro selecionado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700 bg-slate-800/40">
                    <th className="text-left py-2 px-3 text-slate-300">PO #</th>
                    <th className="text-left py-2 px-3 text-slate-300">Empresa</th>
                    <th className="text-left py-2 px-3 text-slate-300">Fornecedor</th>
                    <th className="text-right py-2 px-3 text-slate-300">Total</th>
                    <th className="text-left py-2 px-3 text-slate-300">Data</th>
                    <th className="text-left py-2 px-3 text-slate-300">Ref. fatura</th>
                    <th className="text-right py-2 px-3 text-slate-300">Valor fatura</th>
                    <th className="text-center py-2 px-3 text-slate-300">Na C.C.?</th>
                    <th className="text-center py-2 px-3 text-slate-300">Conciliado</th>
                    <th className="text-right py-2 px-3 text-slate-300">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((po) => (
                    <tr key={po.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                      <td className="py-2 px-3 text-slate-200 font-medium">#{po.id}</td>
                      <td className="py-2 px-3 text-slate-400">{po.empresa_nome ?? '—'}</td>
                      <td className="py-2 px-3 text-slate-400">{po.supplier_nome ?? '—'}</td>
                      <td className="py-2 px-3 text-right text-amber-400">{fmt(po.total_final)}</td>
                      <td className="py-2 px-3 text-slate-400">{fmtDate(po.data_ordered ?? po.data_criacao)}</td>
                      <td className="py-2 px-3 text-slate-400">{po.invoice_ref ?? '—'}</td>
                      <td className="py-2 px-3 text-right text-slate-300">
                        {po.invoice_amount != null ? fmt(po.invoice_amount) : '—'}
                      </td>
                      <td className="py-2 px-3 text-center">
                        {po.has_ledger_entry ? (
                          <span className="text-emerald-400">Sim</span>
                        ) : (
                          <span className="text-slate-500">Não</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-center">
                        {po.is_reconciled ? (
                          <span className="text-emerald-400">Sim</span>
                        ) : (
                          <span className="text-slate-500">Não</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <div className="flex items-center justify-end gap-1 flex-wrap">
                          {po.supplier_id != null && onOpenLedger && (
                            <button
                              type="button"
                              onClick={() => onOpenLedger(po.supplier_id!)}
                              className="px-2 py-1 rounded bg-slate-600 text-slate-200 text-xs hover:bg-slate-500 flex items-center gap-1"
                              title="Ver conta corrente deste fornecedor"
                            >
                              <ExternalLink className="w-3.5 h-3.5" /> Conta corrente
                            </button>
                          )}
                          {po.invoice_status === 'ref_and_amount' && !po.has_ledger_entry && (
                            <button
                              type="button"
                              onClick={() => handlePostToLedgerOnly(po)}
                              disabled={saving}
                              className="px-2 py-1 rounded bg-emerald-700 text-white text-xs hover:bg-emerald-600 disabled:opacity-50"
                            >
                              Enviar para C.C.
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openInvoiceModal(po)}
                            className="px-2 py-1 rounded bg-amber-600 text-white text-xs hover:bg-amber-500 flex items-center gap-1"
                          >
                            <Receipt className="w-3 h-3" /> Registar fatura
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

      {/* ── Modal Nova Fatura (multi-PO) ────────────────────────────────────── */}
      {invModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-8 bg-black/70 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Receipt className="w-5 h-5 text-amber-400" /> Registar Fatura
              </h3>
              <button type="button" onClick={() => setInvModal(false)} className="text-slate-400 hover:text-white text-xl leading-none">&times;</button>
            </div>

            <div className="p-6 space-y-5">
              {/* Secção 1: Empresa + Fornecedor */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-400 uppercase tracking-wide">Empresa</label>
                  <select
                    value={invEmpresaId}
                    onChange={(e) => setInvEmpresaId(e.target.value ? Number(e.target.value) : '')}
                    className="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm"
                  >
                    <option value="">— Selecionar empresa —</option>
                    {empresas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-400 uppercase tracking-wide">Fornecedor</label>
                  <select
                    value={invSupplierId}
                    onChange={(e) => setInvSupplierId(e.target.value ? Number(e.target.value) : '')}
                    className="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm"
                  >
                    <option value="">— Selecionar fornecedor —</option>
                    {uniqueModalSuppliers.map((s) => <option key={s.id} value={s.id}>{s.nome || `Fornecedor #${s.id}`}</option>)}
                  </select>
                </div>
              </div>

              {/* Secção 2: Tabela de POs */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-400 uppercase tracking-wide">POs disponíveis</span>
                  {invSelectedPos.size > 0 && (
                    <span className="text-xs text-amber-300">
                      {invSelectedPos.size} selecionada(s) — Total: {fmt(invOpenPos.filter((p) => invSelectedPos.has(p.id)).reduce((s, p) => s + p.total_final, 0))}
                    </span>
                  )}
                </div>
                {invSupplierId === '' ? (
                  <p className="text-slate-500 text-sm py-4 text-center">Selecione um fornecedor para ver as POs disponíveis.</p>
                ) : invLoadingPos ? (
                  <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
                ) : invOpenPos.length === 0 ? (
                  <p className="text-slate-500 text-sm py-4 text-center">Nenhuma PO em aberto para este fornecedor.</p>
                ) : (
                  <div className="border border-slate-700 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-800/60 border-b border-slate-700">
                          <th className="py-2 px-3 w-8"></th>
                          <th className="text-left py-2 px-3 text-slate-400 font-medium">PO #</th>
                          <th className="text-left py-2 px-3 text-slate-400 font-medium">Empresa</th>
                          <th className="text-left py-2 px-3 text-slate-400 font-medium">Nº Enc. Forn.</th>
                          <th className="text-left py-2 px-3 text-slate-400 font-medium">Data</th>
                          <th className="text-right py-2 px-3 text-slate-400 font-medium">Total</th>
                          <th className="text-left py-2 px-3 text-slate-400 font-medium">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invOpenPos.map((p) => (
                          <tr
                            key={p.id}
                            onClick={() => toggleInvPo(p.id)}
                            className={`border-b border-slate-800 cursor-pointer transition-colors ${invSelectedPos.has(p.id) ? 'bg-amber-900/20' : 'hover:bg-slate-800/40'}`}
                          >
                            <td className="py-2 px-3">
                              <input type="checkbox" checked={invSelectedPos.has(p.id)} onChange={() => toggleInvPo(p.id)} className="rounded" onClick={(e) => e.stopPropagation()} />
                            </td>
                            <td className="py-2 px-3 text-slate-200 font-medium">#{p.id}</td>
                            <td className="py-2 px-3 text-slate-400 text-xs">{p.empresa_nome ?? '—'}</td>
                            <td className="py-2 px-3 font-mono text-xs text-slate-300">{p.supplier_order_id ?? <span className="text-slate-600">—</span>}</td>
                            <td className="py-2 px-3 text-slate-400 text-xs">{p.data_criacao ?? '—'}</td>
                            <td className="py-2 px-3 text-right text-amber-400">{fmt(p.total_final)}</td>
                            <td className="py-2 px-3">
                              <span className={`px-1.5 py-0.5 rounded text-xs ${p.status === 'Ordered' ? 'bg-blue-900/50 text-blue-300' : p.status === 'Draft' ? 'bg-slate-700 text-slate-300' : 'bg-emerald-900/40 text-emerald-300'}`}>{p.status}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Secção 3: Dados da fatura */}
              <div className="border-t border-slate-700 pt-4">
                <span className="text-xs text-slate-400 uppercase tracking-wide block mb-3">Dados da fatura</span>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-slate-400">Nº Fatura *</label>
                    <input
                      type="text"
                      value={invForm.invoice_ref}
                      onChange={(e) => setInvForm((f) => ({ ...f, invoice_ref: e.target.value }))}
                      placeholder="Ex: FT 2026/0042"
                      className="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-slate-400">Valor total (€) *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={invForm.invoice_amount}
                      onChange={(e) => setInvForm((f) => ({ ...f, invoice_amount: e.target.value }))}
                      placeholder="0.00"
                      className="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-slate-400">Data da fatura</label>
                    <input
                      type="date"
                      value={invForm.invoice_date}
                      onChange={(e) => setInvForm((f) => ({ ...f, invoice_date: e.target.value }))}
                      className="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-slate-400">Notas</label>
                    <input
                      type="text"
                      value={invForm.notas}
                      onChange={(e) => setInvForm((f) => ({ ...f, notas: e.target.value }))}
                      placeholder="Observações opcionais"
                      className="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm"
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-slate-300 text-sm mt-3">
                  <input
                    type="checkbox"
                    checked={invForm.post_to_ledger}
                    onChange={(e) => setInvForm((f) => ({ ...f, post_to_ledger: e.target.checked }))}
                    className="rounded"
                  />
                  Lançar na Conta Corrente do fornecedor
                </label>
              </div>

              {invMsg && (
                <div className={`px-4 py-2 rounded-lg text-sm ${invMsg.startsWith('Erro') ? 'bg-red-900/30 text-red-400' : 'bg-emerald-900/30 text-emerald-400'}`}>
                  {invMsg}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-700 bg-slate-900/60 rounded-b-xl">
              <p className="text-xs text-slate-500">* Campos obrigatórios. Selecione pelo menos uma PO.</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setInvModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleCreateInvoice}
                  disabled={invSaving || !invCanSubmit}
                  className="px-4 py-2 rounded-lg bg-amber-600 text-white font-medium hover:bg-amber-500 disabled:opacity-50 text-sm flex items-center gap-2"
                >
                  {invSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> A guardar…</> : 'Registar Fatura'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Pagamentos (Antecipado, Sugestão, Cartão, Débito direto) ────────────────

type PaymentSubTab = 'antecipado' | 'sugestao' | 'cartao' | 'debito';

function PaymentsView({ empresaId }: { empresaId?: number }) {
  const [subTab, setSubTab] = useState<PaymentSubTab>('antecipado');
  const [antecipadoItems, setAntecipadoItems] = useState<PaymentSuggestionItem[]>([]);
  const [antecipadoLoading, setAntecipadoLoading] = useState(false);
  const [sugestaoItems, setSugestaoItems] = useState<PaymentSuggestionItem[]>([]);
  const [sugestaoTotalValor, setSugestaoTotalValor] = useState(0);
  const [sugestaoLoading, setSugestaoLoading] = useState(false);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [confirmDataPagamento, setConfirmDataPagamento] = useState(() => new Date().toISOString().slice(0, 10));
  const [criarMovimentoBanco, setCriarMovimentoBanco] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [historicoDataInicio, setHistoricoDataInicio] = useState('');
  const [historicoDataFim, setHistoricoDataFim] = useState('');
  const [historicoMetodo, setHistoricoMetodo] = useState('');
  const [historicoItems, setHistoricoItems] = useState<PaymentHistoricoItem[]>([]);
  const [historicoLoading, setHistoricoLoading] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);

  const loadAntecipado = useCallback(() => {
    if (empresaId == null) return;
    setAntecipadoLoading(true);
    financeApi.getPaymentsAntecipado(empresaId)
      .then((r) => { setAntecipadoItems(r.items); setSelectedIds(new Set()); })
      .catch(() => setAntecipadoItems([]))
      .finally(() => setAntecipadoLoading(false));
  }, [empresaId]);

  const loadSugestao = useCallback(() => {
    if (!dataInicio || !dataFim) return;
    setSugestaoLoading(true);
    financeApi.getPaymentsSugestao({ empresa_id: empresaId, data_inicio: dataInicio, data_fim: dataFim })
      .then((r) => { setSugestaoItems(r.items); setSugestaoTotalValor(r.total_valor); setSelectedIds(new Set()); })
      .catch(() => { setSugestaoItems([]); setSugestaoTotalValor(0); })
      .finally(() => setSugestaoLoading(false));
  }, [empresaId, dataInicio, dataFim]);

  const loadHistorico = useCallback(() => {
    setHistoricoLoading(true);
    financeApi.getPaymentsHistorico({
      empresa_id: empresaId ?? undefined,
      data_inicio: historicoDataInicio || undefined,
      data_fim: historicoDataFim || undefined,
      metodo: historicoMetodo || undefined,
    })
      .then(setHistoricoItems)
      .catch(() => setHistoricoItems([]))
      .finally(() => setHistoricoLoading(false));
  }, [empresaId, historicoDataInicio, historicoDataFim, historicoMetodo]);

  useEffect(() => {
    if (subTab === 'antecipado' && empresaId != null) loadAntecipado();
  }, [subTab, empresaId, loadAntecipado]);

  useEffect(() => {
    if (subTab === 'cartao' || subTab === 'debito') loadHistorico();
  }, [subTab, historicoMetodo]); // eslint-disable-line react-hooks/exhaustive-deps

  const currentItems = subTab === 'antecipado' ? antecipadoItems : sugestaoItems;
  const toggleSelect = (id: number) => {
    setSelectedIds((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === currentItems.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(currentItems.map((i) => i.purchase_order_id)));
  };

  const handleConfirmar = async () => {
    if (empresaId == null || selectedIds.size === 0) return;
    setConfirming(true);
    try {
      await financeApi.confirmarPagamentos({
        empresa_id: empresaId,
        items: Array.from(selectedIds).map((id) => ({ purchase_order_id: id })),
        data_pagamento: confirmDataPagamento,
        criar_movimento_banco: criarMovimentoBanco,
      });
      setConfirmModalOpen(false);
      setSelectedIds(new Set());
      loadAntecipado();
      if (subTab === 'sugestao') loadSugestao();
    } catch (e) {
      alert((e as Error)?.message ?? 'Erro ao confirmar pagamentos.');
    } finally {
      setConfirming(false);
    }
  };

  const openPrintListagemPorFornecedor = (items: PaymentSuggestionItem[], titulo: string) => {
    const bySupplier = items.reduce<Record<string, PaymentSuggestionItem[]>>((acc, row) => {
      const name = row.supplier_nome ?? 'Sem fornecedor';
      if (!acc[name]) acc[name] = [];
      acc[name].push(row);
      return acc;
    }, {});
    const supplierNames = Object.keys(bySupplier).sort();
    let html = `
<!DOCTYPE html><html><head><meta charset="utf-8"><title>Listagem pagamentos - ${titulo}</title>
<style>
  body { font-family: system-ui, sans-serif; padding: 20px; color: #1e293b; max-width: 900px; margin: 0 auto; }
  h1 { font-size: 1.25rem; margin-bottom: 8px; }
  .meta { color: #64748b; font-size: 0.875rem; margin-bottom: 24px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid #e2e8f0; }
  th { background: #f1f5f9; font-weight: 600; }
  .supplier-block { margin-bottom: 28px; }
  .supplier-name { font-weight: 600; font-size: 1rem; margin-bottom: 8px; color: #0f172a; }
  .total-row { font-weight: 600; }
  @media print { body { padding: 12px; } }
</style></head><body>
  <h1>Listagem para pagamento — ${titulo}</h1>
  <p class="meta">Gerado em ${new Date().toLocaleString('pt-PT')} · ${items.length} linha(s)</p>
`;
    for (const name of supplierNames) {
      const rows = bySupplier[name];
      const total = rows.reduce((s, r) => s + r.total_final, 0);
      html += `<div class="supplier-block"><div class="supplier-name">${escapeHtml(name)}</div><table><thead><tr><th>PO #</th><th>Empresa</th><th>Data ordem</th><th>Vencimento</th><th>Ref. fatura</th><th>Total</th></tr></thead><tbody>`;
      for (const r of rows) {
        html += `<tr><td>#${r.purchase_order_id}</td><td>${escapeHtml(r.empresa_nome ?? '')}</td><td>${r.data_ordered ?? '—'}</td><td>${r.due_date ?? '—'}</td><td>${escapeHtml(r.invoice_ref ?? '')}</td><td>${fmt(r.total_final)}</td></tr>`;
      }
      html += `<tr class="total-row"><td colspan="5">Total fornecedor</td><td>${fmt(total)}</td></tr></tbody></table></div>`;
    }
    html += '</body></html>';
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
      w.focus();
      setTimeout(() => { w.print(); }, 300);
    }
  };
  function escapeHtml(s: string) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  return (
    <div className="space-y-4">
      <Tabs value={subTab} onValueChange={(v) => {
        const t = v as PaymentSubTab;
        setSubTab(t);
        if (t === 'cartao') { setHistoricoMetodo('Cartao'); }
        else if (t === 'debito') { setHistoricoMetodo('DebitoDireto'); }
      }}>
        <TabsList className="bg-slate-800 border border-slate-600 flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="antecipado" className="data-[state=active]:bg-amber-600 data-[state=active]:text-white">
            <Wallet className="w-4 h-4 mr-1.5" />Antecipado / Diário
          </TabsTrigger>
          <TabsTrigger value="sugestao" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
            <Receipt className="w-4 h-4 mr-1.5" />Sugestão de pagamento
          </TabsTrigger>
          <TabsTrigger value="cartao" className="data-[state=active]:bg-sky-600 data-[state=active]:text-white">
            <CreditCard className="w-4 h-4 mr-1.5" />Cartão
          </TabsTrigger>
          <TabsTrigger value="debito" className="data-[state=active]:bg-violet-600 data-[state=active]:text-white">
            <Receipt className="w-4 h-4 mr-1.5" />Débito direto
          </TabsTrigger>
        </TabsList>

        <TabsContent value="antecipado" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg text-slate-200">Pagamento antecipado (diário)</CardTitle>
              <p className="text-slate-400 text-sm">POs de fornecedores com prazo Antecipado ainda não pagas. Selecione e confirme a saída no banco.</p>
            </CardHeader>
            <CardContent>
              {empresaId == null ? (
                <p className="text-slate-400">Selecione uma empresa no topo da aplicação.</p>
              ) : antecipadoLoading ? (
                <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
              ) : antecipadoItems.length === 0 ? (
                <p className="text-slate-400 text-center py-8">Nenhuma PO com prazo Antecipado por pagar.</p>
              ) : (
                <>
                  {selectedIds.size > 0 && (
                    <div className="flex flex-wrap items-center gap-3 mb-4 p-3 rounded-lg bg-amber-950/30 border border-amber-700/50">
                      <span className="text-amber-200 text-sm">{selectedIds.size} selecionada(s)</span>
                      <button
                        type="button"
                        onClick={() => setConfirmModalOpen(true)}
                        className="px-4 py-2 rounded bg-amber-600 text-white text-sm font-medium hover:bg-amber-500"
                      >
                        Confirmar pagamentos no banco
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const selected = antecipadoItems.filter((r) => selectedIds.has(r.purchase_order_id));
                          openPrintListagemPorFornecedor(selected, 'Antecipado');
                        }}
                        className="px-4 py-2 rounded bg-slate-600 text-white text-sm font-medium hover:bg-slate-500 flex items-center gap-1.5"
                      >
                        <Printer className="w-4 h-4" /> Gerar PDF listagem
                      </button>
                      <button type="button" onClick={() => setSelectedIds(new Set())} className="px-3 py-2 rounded bg-slate-700 text-slate-300 text-sm hover:bg-slate-600">Limpar</button>
                    </div>
                  )}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-700">
                          <th className="w-10"><input type="checkbox" checked={currentItems.length > 0 && selectedIds.size === currentItems.length} onChange={toggleSelectAll} className="rounded border-slate-500 bg-slate-800 text-amber-500" /></th>
                          <th className="text-left py-2 px-3 text-slate-300">PO #</th>
                          <th className="text-left py-2 px-3 text-slate-300">Fornecedor</th>
                          <th className="text-left py-2 px-3 text-slate-300">Empresa</th>
                          <th className="text-left py-2 px-3 text-slate-300">Data ordem</th>
                          <th className="text-left py-2 px-3 text-slate-300">Vencimento</th>
                          <th className="text-right py-2 px-3 text-slate-300">Total</th>
                          <th className="text-left py-2 px-3 text-slate-300">Ref. fatura</th>
                        </tr>
                      </thead>
                      <tbody>
                        {antecipadoItems.map((row) => (
                          <tr key={row.purchase_order_id} className="border-b border-slate-800 hover:bg-slate-800/50">
                            <td className="py-2"><input type="checkbox" checked={selectedIds.has(row.purchase_order_id)} onChange={() => toggleSelect(row.purchase_order_id)} className="rounded border-slate-500 bg-slate-800 text-amber-500" /></td>
                            <td className="py-2 px-3 text-slate-200 font-medium">{row.purchase_order_id}</td>
                            <td className="py-2 px-3 text-slate-300">{row.supplier_nome ?? '—'}</td>
                            <td className="py-2 px-3 text-slate-400">{row.empresa_nome ?? '—'}</td>
                            <td className="py-2 px-3 text-slate-400">{fmtDate(row.data_ordered)}</td>
                            <td className="py-2 px-3 text-slate-400">{fmtDate(row.due_date)}</td>
                            <td className="py-2 px-3 text-right text-emerald-400">{fmt(row.total_final)}</td>
                            <td className="py-2 px-3 text-slate-400">{row.invoice_ref ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sugestao" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg text-slate-200">Sugestão de pagamento (por intervalo de vencimento)</CardTitle>
              <p className="text-slate-400 text-sm">Indique o intervalo de datas de vencimento. Todas as POs com vencimento nesse período aparecem na lista. Valide e confirme a saída no banco.</p>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-end gap-4 mb-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Data início (vencimento)</label>
                  <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Data fim (vencimento)</label>
                  <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm" />
                </div>
                <button type="button" onClick={loadSugestao} disabled={!dataInicio || !dataFim || sugestaoLoading} className="px-4 py-2 rounded bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 disabled:opacity-50">
                  {sugestaoLoading ? <Loader2 className="w-4 h-4 animate-spin inline mr-1" /> : null} Gerar sugestão
                </button>
              </div>
              {sugestaoTotalValor > 0 && (
                <p className="text-slate-300 text-sm mb-2">Total a pagar no intervalo: <strong className="text-emerald-400">{fmt(sugestaoTotalValor)}</strong></p>
              )}
              {selectedIds.size > 0 && currentItems.length > 0 && (
                <div className="flex flex-wrap items-center gap-3 mb-4 p-3 rounded-lg bg-amber-950/30 border border-amber-700/50">
                  <span className="text-amber-200 text-sm">{selectedIds.size} selecionada(s)</span>
                  <button type="button" onClick={() => setConfirmModalOpen(true)} className="px-4 py-2 rounded bg-amber-600 text-white text-sm font-medium hover:bg-amber-500">Confirmar pagamentos no banco</button>
                  <button type="button" onClick={() => openPrintListagemPorFornecedor(currentItems.filter((r) => selectedIds.has(r.purchase_order_id)), 'Sugestão')} className="px-4 py-2 rounded bg-slate-600 text-white text-sm font-medium hover:bg-slate-500 flex items-center gap-1.5"><Printer className="w-4 h-4" /> Gerar PDF listagem</button>
                  <button type="button" onClick={() => setSelectedIds(new Set())} className="px-3 py-2 rounded bg-slate-700 text-slate-300 text-sm hover:bg-slate-600">Limpar</button>
                </div>
              )}
              {sugestaoLoading ? (
                <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
              ) : sugestaoItems.length === 0 ? (
                <p className="text-slate-400 text-center py-8">Indique as datas e clique em &quot;Gerar sugestão&quot; ou não há POs a vencer no intervalo.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="w-10"><input type="checkbox" checked={currentItems.length > 0 && selectedIds.size === currentItems.length} onChange={toggleSelectAll} className="rounded border-slate-500 bg-slate-800 text-amber-500" /></th>
                        <th className="text-left py-2 px-3 text-slate-300">PO #</th>
                        <th className="text-left py-2 px-3 text-slate-300">Fornecedor</th>
                        <th className="text-left py-2 px-3 text-slate-300">Data ordem</th>
                        <th className="text-left py-2 px-3 text-slate-300">Vencimento</th>
                        <th className="text-right py-2 px-3 text-slate-300">Total</th>
                        <th className="text-left py-2 px-3 text-slate-300">Ref. fatura</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sugestaoItems.map((row) => (
                        <tr key={row.purchase_order_id} className="border-b border-slate-800 hover:bg-slate-800/50">
                          <td className="py-2"><input type="checkbox" checked={selectedIds.has(row.purchase_order_id)} onChange={() => toggleSelect(row.purchase_order_id)} className="rounded border-slate-500 bg-slate-800 text-amber-500" /></td>
                          <td className="py-2 px-3 text-slate-200 font-medium">{row.purchase_order_id}</td>
                          <td className="py-2 px-3 text-slate-300">{row.supplier_nome ?? '—'}</td>
                          <td className="py-2 px-3 text-slate-400">{fmtDate(row.data_ordered)}</td>
                          <td className="py-2 px-3 text-slate-400">{fmtDate(row.due_date)}</td>
                          <td className="py-2 px-3 text-right text-emerald-400">{fmt(row.total_final)}</td>
                          <td className="py-2 px-3 text-slate-400">{row.invoice_ref ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cartao" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg text-slate-200">Pagamentos por cartão / histórico</CardTitle>
              <p className="text-slate-400 text-sm">Pesquise pagamentos já confirmados por intervalo de datas e método. Exporte para Excel.</p>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-end gap-4 mb-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Data início</label>
                  <input type="date" value={historicoDataInicio} onChange={(e) => setHistoricoDataInicio(e.target.value)} className="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Data fim</label>
                  <input type="date" value={historicoDataFim} onChange={(e) => setHistoricoDataFim(e.target.value)} className="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Método</label>
                  <select value={historicoMetodo} onChange={(e) => setHistoricoMetodo(e.target.value)} className="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm min-w-[140px]">
                    <option value="">Todos</option>
                    <option value="Cartao">Cartão</option>
                    <option value="Transferencia">Transferência</option>
                    <option value="DebitoDireto">Débito direto</option>
                  </select>
                </div>
                <button type="button" onClick={loadHistorico} disabled={historicoLoading} className="px-4 py-2 rounded bg-sky-600 text-white text-sm font-medium hover:bg-sky-500 disabled:opacity-50">
                  {historicoLoading ? <Loader2 className="w-4 h-4 animate-spin inline mr-1" /> : null} Pesquisar
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setExportingExcel(true);
                    try {
                      const blob = await financeApi.getPaymentsHistoricoExport({
                        empresa_id: empresaId ?? undefined,
                        data_inicio: historicoDataInicio || undefined,
                        data_fim: historicoDataFim || undefined,
                        metodo: historicoMetodo || undefined,
                      });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `historico_pagamentos_${historicoDataInicio || 'inicio'}_${historicoDataFim || 'fim'}.xlsx`;
                      a.click();
                      URL.revokeObjectURL(url);
                    } catch (e) {
                      alert((e as Error)?.message ?? 'Erro ao exportar.');
                    } finally {
                      setExportingExcel(false);
                    }
                  }}
                  disabled={exportingExcel}
                  className="px-4 py-2 rounded bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {exportingExcel ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />} Exportar Excel
                </button>
              </div>
              {historicoLoading ? (
                <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
              ) : historicoItems.length === 0 ? (
                <p className="text-slate-400 text-center py-8">Use os filtros e clique em Pesquisar para ver pagamentos confirmados. Para ver pagamentos por cartão, escolha método &quot;Cartão&quot;.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700 bg-slate-800/40">
                        <th className="text-left py-2 px-3 text-slate-300">Data</th>
                        <th className="text-left py-2 px-3 text-slate-300">Empresa</th>
                        <th className="text-left py-2 px-3 text-slate-300">Fornecedor</th>
                        <th className="text-left py-2 px-3 text-slate-300">Método</th>
                        <th className="text-left py-2 px-3 text-slate-300">PO #</th>
                        <th className="text-left py-2 px-3 text-slate-300">Ref. doc</th>
                        <th className="text-right py-2 px-3 text-slate-300">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historicoItems.map((row) => (
                        <tr key={row.ledger_id} className="border-b border-slate-800 hover:bg-slate-800/50">
                          <td className="py-2 px-3 text-slate-300">{fmtDate(row.data_movimento)}</td>
                          <td className="py-2 px-3 text-slate-400">{row.empresa_nome ?? '—'}</td>
                          <td className="py-2 px-3 text-slate-300">{row.supplier_nome ?? '—'}</td>
                          <td className="py-2 px-3 text-slate-400">{row.metodo_pagamento ?? '—'}</td>
                          <td className="py-2 px-3 text-slate-400">{row.purchase_order_id ?? '—'}</td>
                          <td className="py-2 px-3 text-slate-400">{row.documento_ref ?? '—'}</td>
                          <td className="py-2 px-3 text-right text-emerald-400">{fmt(row.valor)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="debito" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-lg text-slate-200">Débito direto</CardTitle></CardHeader>
            <CardContent>
              <p className="text-slate-400 text-center py-8">Em breve: movimentos de débito direto pendentes de conciliação com a saída no banco e associação de fatura.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {confirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-slate-800 rounded-lg shadow-xl border border-slate-600 p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-white mb-4">Confirmar pagamento no banco</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Data do movimento</label>
                <input type="date" value={confirmDataPagamento} onChange={(e) => setConfirmDataPagamento(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white text-sm" />
              </div>
              <label className="flex items-center gap-2 text-slate-300 text-sm">
                <input type="checkbox" checked={criarMovimentoBanco} onChange={(e) => setCriarMovimentoBanco(e.target.checked)} className="rounded border-slate-500 bg-slate-800 text-amber-500" />
                Criar movimento de banco (transferência)
              </label>
              <p className="text-slate-400 text-xs">Serão criados lançamentos na conta corrente (Pagamento), as POs ficarão como Paid e a reconciliação será atualizada.</p>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button type="button" onClick={() => setConfirmModalOpen(false)} className="px-4 py-2 rounded bg-slate-700 text-slate-300 text-sm hover:bg-slate-600">Cancelar</button>
              <button type="button" onClick={handleConfirmar} disabled={confirming} className="px-4 py-2 rounded bg-amber-600 text-white text-sm font-medium hover:bg-amber-500 disabled:opacity-50">
                {confirming ? <Loader2 className="w-4 h-4 animate-spin inline mr-1" /> : null} Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

export function FinanceGlobalView() {
  const { empresaSelecionada, financasNavigation, setFinancasNavigation } = useApp();
  const empresaId = empresaSelecionada?.id ?? undefined;
  const [activeTab, setActiveTab] = useState('aging');
  const [ledgerPreselectSupplierId, setLedgerPreselectSupplierId] = useState<number | null>(null);
  const [invoiceStats, setInvoiceStats] = useState<InvoiceValidationStats | null>(null);

  useEffect(() => {
    invoiceValidationApi.getStats(empresaId).then(setInvoiceStats).catch(() => {});
  }, [empresaId]);

  useEffect(() => {
    if (!financasNavigation) return;
    setActiveTab(financasNavigation.tab);
    if (financasNavigation.tab === 'ledger' && financasNavigation.supplierId != null) {
      setLedgerPreselectSupplierId(financasNavigation.supplierId);
    }
    setFinancasNavigation(null);
  }, [financasNavigation, setFinancasNavigation]);

  const handleOpenLedger = useCallback((supplierId: number) => {
    setLedgerPreselectSupplierId(supplierId);
    setActiveTab('ledger');
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <DollarSign className="w-6 h-6 text-emerald-400" />
        <div>
          <h2 className="text-xl font-bold text-white">Finanças Globais</h2>
          <p className="text-sm text-slate-400">
            {empresaSelecionada ? empresaSelecionada.nome : 'Todas as empresas'} · Fase 5
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-800 border border-slate-600 flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="aging" className="data-[state=active]:bg-sky-600 data-[state=active]:text-white">
            <Scale className="w-4 h-4 mr-1.5" />Aging
          </TabsTrigger>
          <TabsTrigger value="profitability" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
            <TrendingUp className="w-4 h-4 mr-1.5" />Rentabilidade
          </TabsTrigger>
          <TabsTrigger value="cashflow" className="data-[state=active]:bg-violet-600 data-[state=active]:text-white">
            <Clock className="w-4 h-4 mr-1.5" />Tesouraria
          </TabsTrigger>
          <TabsTrigger value="projection" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
            <Activity className="w-4 h-4 mr-1.5" />Projeção Saldo
          </TabsTrigger>
          <TabsTrigger value="health" className="data-[state=active]:bg-amber-600/80 data-[state=active]:text-white">
            <Shield className="w-4 h-4 mr-1.5" />Health Fornecedores
          </TabsTrigger>
          <TabsTrigger value="pofaturas" className="data-[state=active]:bg-amber-600 data-[state=active]:text-white">
            <FileText className="w-4 h-4 mr-1.5" />POs e Faturas
          </TabsTrigger>
          <TabsTrigger value="ledger" className="data-[state=active]:bg-slate-600 data-[state=active]:text-white">
            <BookOpen className="w-4 h-4 mr-1.5" />Conta Corrente
          </TabsTrigger>
          <TabsTrigger value="discrepancies" className="data-[state=active]:bg-amber-600 data-[state=active]:text-white">
            <AlertTriangle className="w-4 h-4 mr-1.5" />Divergências
          </TabsTrigger>
          <TabsTrigger value="pagamentos" className="data-[state=active]:bg-amber-600 data-[state=active]:text-white">
            <Wallet className="w-4 h-4 mr-1.5" />Pagamentos
          </TabsTrigger>
          <TabsTrigger value="faturas_validar" className="data-[state=active]:bg-rose-600 data-[state=active]:text-white">
            <Inbox className="w-4 h-4 mr-1.5" />
            Faturas por Validar
            {invoiceStats && invoiceStats.pendente_validacao > 0 && (
              <span className="ml-1.5 bg-rose-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                {invoiceStats.pendente_validacao}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="aging" className="mt-6">
          <AgingReport empresaId={empresaId} />
        </TabsContent>
        <TabsContent value="profitability" className="mt-6">
          <NetProfitability empresaId={empresaId} />
        </TabsContent>
        <TabsContent value="cashflow" className="mt-6">
          <CashFlowForecast empresaId={empresaId} />
        </TabsContent>
        <TabsContent value="projection" className="mt-6">
          <CashFlowProjection empresaId={empresaId} />
        </TabsContent>
        <TabsContent value="health" className="mt-6">
          <SupplierHealthRanking empresaId={empresaId} />
        </TabsContent>
        <TabsContent value="pofaturas" className="mt-6">
          <POsEFaturas empresaId={empresaId} onOpenLedger={handleOpenLedger} />
        </TabsContent>
        <TabsContent value="ledger" className="mt-6">
          <LedgerView empresaId={empresaId} preselectSupplierId={ledgerPreselectSupplierId} onPreselectConsumed={() => setLedgerPreselectSupplierId(null)} />
        </TabsContent>
        <TabsContent value="discrepancies" className="mt-6">
          <Discrepancies empresaId={empresaId} />
        </TabsContent>
        <TabsContent value="pagamentos" className="mt-6">
          <PaymentsView empresaId={empresaId} />
        </TabsContent>
        <TabsContent value="faturas_validar" className="mt-6">
          <InvoiceInboxView empresaId={empresaId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
