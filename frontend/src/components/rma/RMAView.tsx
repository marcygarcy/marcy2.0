'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { rmaApi, RmaAlert, RmaPendingItem } from '@/lib/api/rma';
import { useApp } from '@/context/AppContext';
import { formatCurrency } from '@/lib/utils';
import { AlertTriangle, Package, Plus, CheckCircle, Clock, RefreshCw } from 'lucide-react';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  Pending:                { label: 'Pendente',             color: 'text-yellow-400 bg-yellow-900/40' },
  Claimed_from_Supplier:  { label: 'NC Recebida',          color: 'text-green-400 bg-green-900/40' },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_LABELS[status] ?? { label: status, color: 'text-slate-400 bg-slate-700' };
  return (
    <span className={`text-xs px-2 py-1 rounded-full font-medium ${s.color}`}>
      {s.label}
    </span>
  );
}

export function RMAView() {
  const { empresaSelecionada } = useApp();
  const [activeTab, setActiveTab] = useState<'alertas' | 'pendentes' | 'registar'>('alertas');

  const [alerts, setAlerts] = useState<RmaAlert[]>([]);
  const [pending, setPending] = useState<RmaPendingItem[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [loadingPending, setLoadingPending] = useState(false);

  // Form de registo
  const [form, setForm] = useState({
    external_order_id: '',
    refund_customer_value: '',
    supplier_id: '',
    reason: '',
  });
  const [registering, setRegistering] = useState(false);
  const [registerMsg, setRegisterMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (activeTab === 'alertas') loadAlerts();
    if (activeTab === 'pendentes') loadPending();
  }, [activeTab, empresaSelecionada?.id]);

  // Carregar alertas ao montar (para o badge no título)
  useEffect(() => {
    loadAlerts();
  }, [empresaSelecionada?.id]);

  const loadAlerts = async () => {
    setLoadingAlerts(true);
    try {
      const data = await rmaApi.getAlerts({ empresa_id: empresaSelecionada?.id ?? undefined });
      setAlerts(data);
    } catch {
      setAlerts([]);
    } finally {
      setLoadingAlerts(false);
    }
  };

  const loadPending = async () => {
    setLoadingPending(true);
    try {
      const data = await rmaApi.getPending(empresaSelecionada?.id ?? undefined);
      setPending(data);
    } catch {
      setPending([]);
    } finally {
      setLoadingPending(false);
    }
  };

  const handleRegister = async () => {
    if (!empresaSelecionada) return;
    if (!form.external_order_id || !form.refund_customer_value) {
      setRegisterMsg({ type: 'error', text: 'Nº de pedido e valor são obrigatórios.' });
      return;
    }
    setRegistering(true);
    setRegisterMsg(null);
    try {
      await rmaApi.registerRefund({
        empresa_id: empresaSelecionada.id,
        external_order_id: form.external_order_id,
        refund_customer_value: parseFloat(form.refund_customer_value),
        supplier_id: form.supplier_id ? parseInt(form.supplier_id) : undefined,
        reason: form.reason || undefined,
      });
      setRegisterMsg({ type: 'success', text: 'Devolução registada com sucesso.' });
      setForm({ external_order_id: '', refund_customer_value: '', supplier_id: '', reason: '' });
      loadAlerts();
      loadPending();
    } catch (e: any) {
      setRegisterMsg({ type: 'error', text: e?.response?.data?.detail || 'Erro ao registar devolução.' });
    } finally {
      setRegistering(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Package className="w-6 h-6 text-orange-400" />
            Devoluções (RMA)
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Gestão de devoluções e reclamações de Nota de Crédito ao fornecedor
          </p>
        </div>
        {alerts.length > 0 && (
          <div className="flex items-center gap-2 bg-red-900/40 border border-red-700 px-4 py-2 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span className="text-red-400 font-medium text-sm">
              {alerts.length} alerta{alerts.length > 1 ? 's' : ''} pendente{alerts.length > 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      {/* KPI summary row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-8 h-8 text-red-400" />
              <div>
                <p className="text-slate-400 text-xs">Alertas (&gt;7 dias s/ NC)</p>
                <p className="text-2xl font-bold text-red-400">{alerts.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <Clock className="w-8 h-8 text-yellow-400" />
              <div>
                <p className="text-slate-400 text-xs">Pendentes Total</p>
                <p className="text-2xl font-bold text-yellow-400">{pending.length || '—'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-8 h-8 text-green-400" />
              <div>
                <p className="text-slate-400 text-xs">Valor Devolvido (alertas)</p>
                <p className="text-2xl font-bold text-orange-400">
                  {formatCurrency(alerts.reduce((s, a) => s + (a.refund_customer_value ?? 0), 0))}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList>
          <TabsTrigger value="alertas" className="data-[state=active]:bg-red-600 data-[state=active]:text-white">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Alertas
            {alerts.length > 0 && (
              <span className="ml-2 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">
                {alerts.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="pendentes" className="data-[state=active]:bg-orange-600 data-[state=active]:text-white">
            <Clock className="w-3 h-3 mr-1" />
            Todos os Pendentes
          </TabsTrigger>
          <TabsTrigger value="registar" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            <Plus className="w-3 h-3 mr-1" />
            Registar Devolução
          </TabsTrigger>
        </TabsList>

        {/* ── ALERTAS ───────────────────────────────────────────────────────── */}
        <TabsContent value="alertas" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-red-400 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Reembolsos sem Nota de Crédito há mais de 7 dias
              </CardTitle>
              <button
                onClick={loadAlerts}
                className="text-slate-400 hover:text-white transition-colors"
                title="Atualizar"
              >
                <RefreshCw className={`w-4 h-4 ${loadingAlerts ? 'animate-spin' : ''}`} />
              </button>
            </CardHeader>
            <CardContent>
              {loadingAlerts ? (
                <div className="text-center py-8 text-slate-400">A carregar alertas...</div>
              ) : alerts.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                  <p className="text-green-400 font-medium">Sem alertas pendentes</p>
                  <p className="text-slate-500 text-sm mt-1">Todas as devoluções têm Nota de Crédito dentro do prazo</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-slate-400 border-b border-slate-700">
                        <th className="text-left py-2 pr-4">Pedido</th>
                        <th className="text-left py-2 pr-4">Fornecedor</th>
                        <th className="text-left py-2 pr-4">Empresa</th>
                        <th className="text-right py-2 pr-4">Reembolso Cliente</th>
                        <th className="text-right py-2 pr-4">NC Fornecedor</th>
                        <th className="text-left py-2 pr-4">Motivo</th>
                        <th className="text-left py-2">Data</th>
                      </tr>
                    </thead>
                    <tbody>
                      {alerts.map((a) => (
                        <tr key={a.id} className="border-b border-slate-800 bg-red-950/20 hover:bg-red-950/40">
                          <td className="py-3 pr-4 font-mono text-red-300">{a.external_order_id ?? `SO#${a.sales_order_id}`}</td>
                          <td className="py-3 pr-4 text-white">{a.supplier_nome}</td>
                          <td className="py-3 pr-4 text-slate-300">{a.empresa_nome}</td>
                          <td className="py-3 pr-4 text-right text-red-400 font-bold">
                            {formatCurrency(a.refund_customer_value)}
                          </td>
                          <td className="py-3 pr-4 text-right text-slate-400">
                            {a.credit_note_supplier_value > 0
                              ? formatCurrency(a.credit_note_supplier_value)
                              : <span className="text-red-500">Em falta</span>}
                          </td>
                          <td className="py-3 pr-4 text-slate-300 text-xs max-w-[180px] truncate">
                            {a.reason ?? '—'}
                          </td>
                          <td className="py-3 text-slate-400 text-xs">
                            {a.created_at ? a.created_at.slice(0, 10) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── PENDENTES ─────────────────────────────────────────────────────── */}
        <TabsContent value="pendentes" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Todas as Devoluções Pendentes</CardTitle>
              <button
                onClick={loadPending}
                className="text-slate-400 hover:text-white transition-colors"
                title="Atualizar"
              >
                <RefreshCw className={`w-4 h-4 ${loadingPending ? 'animate-spin' : ''}`} />
              </button>
            </CardHeader>
            <CardContent>
              {loadingPending ? (
                <div className="text-center py-8 text-slate-400">A carregar devoluções...</div>
              ) : pending.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Package className="w-12 h-12 mx-auto mb-3 opacity-40" />
                  <p>Nenhuma devolução pendente</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-slate-400 border-b border-slate-700">
                        <th className="text-left py-2 pr-4">#</th>
                        <th className="text-left py-2 pr-4">Pedido</th>
                        <th className="text-left py-2 pr-4">Fornecedor</th>
                        <th className="text-right py-2 pr-4">Valor Devolvido</th>
                        <th className="text-left py-2 pr-4">Estado</th>
                        <th className="text-left py-2">Data</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pending.map((p) => (
                        <tr key={p.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                          <td className="py-3 pr-4 text-slate-500">{p.id}</td>
                          <td className="py-3 pr-4 font-mono text-blue-300">{p.external_order_id ?? `SO#${p.sales_order_id}`}</td>
                          <td className="py-3 pr-4 text-white">{p.supplier_nome}</td>
                          <td className="py-3 pr-4 text-right text-orange-400 font-bold">
                            {formatCurrency(p.refund_customer_value)}
                          </td>
                          <td className="py-3 pr-4">
                            <StatusBadge status="Pending" />
                          </td>
                          <td className="py-3 text-slate-400 text-xs">
                            {p.created_at ? p.created_at.slice(0, 10) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── REGISTAR ──────────────────────────────────────────────────────── */}
        <TabsContent value="registar" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Registar Nova Devolução</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-w-lg space-y-4">
                <div>
                  <label className="text-sm text-slate-400 block mb-1">Nº Pedido / Referência *</label>
                  <input
                    type="text"
                    value={form.external_order_id}
                    onChange={(e) => setForm({ ...form, external_order_id: e.target.value })}
                    placeholder="ex: PIX-007"
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400 block mb-1">Valor Devolvido ao Cliente (€) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.refund_customer_value}
                    onChange={(e) => setForm({ ...form, refund_customer_value: e.target.value })}
                    placeholder="ex: 99.99"
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400 block mb-1">ID Fornecedor (opcional)</label>
                  <input
                    type="number"
                    value={form.supplier_id}
                    onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}
                    placeholder="ex: 1"
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400 block mb-1">Motivo</label>
                  <textarea
                    value={form.reason}
                    onChange={(e) => setForm({ ...form, reason: e.target.value })}
                    placeholder="ex: Produto com defeito, cliente devolveu"
                    rows={3}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 resize-none"
                  />
                </div>

                {registerMsg && (
                  <div className={`text-sm px-3 py-2 rounded-lg ${
                    registerMsg.type === 'success'
                      ? 'bg-green-900/40 text-green-400 border border-green-700'
                      : 'bg-red-900/40 text-red-400 border border-red-700'
                  }`}>
                    {registerMsg.text}
                  </div>
                )}

                <button
                  onClick={handleRegister}
                  disabled={registering || !empresaSelecionada}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 rounded-lg transition-colors"
                >
                  {registering ? 'A registar...' : 'Registar Devolução'}
                </button>
                {!empresaSelecionada && (
                  <p className="text-slate-500 text-xs text-center">Seleciona uma empresa na barra lateral</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
