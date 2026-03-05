'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  rmaApi,
  RmaAlert,
  RmaPendingItem,
  IncidentItem,
  IncidentPhase,
} from '@/lib/api/rma';
import { useApp } from '@/context/AppContext';
import { formatCurrency } from '@/lib/utils';
import {
  AlertTriangle,
  Package,
  Plus,
  CheckCircle,
  Clock,
  RefreshCw,
  Ban,
  Banknote,
  Truck,
  Lock,
  CreditCard,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  Pending: { label: 'Pendente', color: 'text-yellow-400 bg-yellow-900/40' },
  Claimed_from_Supplier: { label: 'NC Recebida', color: 'text-green-400 bg-green-900/40' },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_LABELS[status] ?? { label: status, color: 'text-slate-400 bg-slate-700' };
  return (
    <span className={`text-xs px-2 py-1 rounded-full font-medium ${s.color}`}>
      {s.label}
    </span>
  );
}

const PHASE_INTERVENCAO: IncidentPhase = 'intervencao_compras';
const PHASE_REEMBOLSOS: IncidentPhase = 'reembolsos_pendentes';
const PHASE_LOGISTICA: IncidentPhase = 'logistica_intercecao';

export function RMAView() {
  const { empresaSelecionada } = useApp();
  const [activeTab, setActiveTab] = useState<string>('intervencao');

  const [alerts, setAlerts] = useState<RmaAlert[]>([]);
  const [pending, setPending] = useState<RmaPendingItem[]>([]);
  const [incidentsIntervencao, setIncidentsIntervencao] = useState<IncidentItem[]>([]);
  const [incidentsReembolsos, setIncidentsReembolsos] = useState<IncidentItem[]>([]);
  const [incidentsLogistica, setIncidentsLogistica] = useState<IncidentItem[]>([]);

  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [loadingPending, setLoadingPending] = useState(false);
  const [loadingIncidents, setLoadingIncidents] = useState<Record<string, boolean>>({});

  const [form, setForm] = useState({
    external_order_id: '',
    refund_customer_value: '',
    supplier_id: '',
    reason: '',
  });
  const [registering, setRegistering] = useState(false);
  const [registerMsg, setRegisterMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modal Nota de Crédito
  const [ncModalOpen, setNcModalOpen] = useState(false);
  const [ncIncidentId, setNcIncidentId] = useState<number | null>(null);
  const [ncForm, setNcForm] = useState({ numero_nc: '', valor: '', tipo: 'credito_conta' as 'transferencia' | 'credito_conta' });
  const [ncSubmitting, setNcSubmitting] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadAlerts = useCallback(async () => {
    setLoadingAlerts(true);
    try {
      const data = await rmaApi.getAlerts({ empresa_id: empresaSelecionada?.id ?? undefined });
      setAlerts(data);
    } catch {
      setAlerts([]);
    } finally {
      setLoadingAlerts(false);
    }
  }, [empresaSelecionada?.id]);

  const loadPending = useCallback(async () => {
    setLoadingPending(true);
    try {
      const data = await rmaApi.getPending(empresaSelecionada?.id ?? undefined);
      setPending(data);
    } catch {
      setPending([]);
    } finally {
      setLoadingPending(false);
    }
  }, [empresaSelecionada?.id]);

  const loadIncidents = useCallback(
    async (phase: IncidentPhase) => {
      setLoadingIncidents((prev) => ({ ...prev, [phase]: true }));
      try {
        const data = await rmaApi.listIncidents(phase, empresaSelecionada?.id ?? undefined);
        if (phase === PHASE_INTERVENCAO) setIncidentsIntervencao(data);
        else if (phase === PHASE_REEMBOLSOS) setIncidentsReembolsos(data);
        else if (phase === PHASE_LOGISTICA) setIncidentsLogistica(data);
      } catch {
        if (phase === PHASE_INTERVENCAO) setIncidentsIntervencao([]);
        else if (phase === PHASE_REEMBOLSOS) setIncidentsReembolsos([]);
        else if (phase === PHASE_LOGISTICA) setIncidentsLogistica([]);
      } finally {
        setLoadingIncidents((prev) => ({ ...prev, [phase]: false }));
      }
    },
    [empresaSelecionada?.id]
  );

  useEffect(() => {
    if (activeTab === 'alertas') loadAlerts();
    if (activeTab === 'pendentes') loadPending();
    if (activeTab === 'intervencao') loadIncidents(PHASE_INTERVENCAO);
    if (activeTab === 'reembolsos') loadIncidents(PHASE_REEMBOLSOS);
    if (activeTab === 'logistica') loadIncidents(PHASE_LOGISTICA);
  }, [activeTab, empresaSelecionada?.id, loadAlerts, loadPending, loadIncidents]);

  useEffect(() => {
    loadAlerts();
  }, [empresaSelecionada?.id, loadAlerts]);

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
      loadIncidents(PHASE_INTERVENCAO);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      setRegisterMsg({ type: 'error', text: err?.response?.data?.detail || 'Erro ao registar devolução.' });
    } finally {
      setRegistering(false);
    }
  };

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setActionFeedback({ type, text });
    setTimeout(() => setActionFeedback(null), 4000);
  };

  const handleFornecedorAceitou = async (id: number, paymentWasMade: boolean) => {
    try {
      const res = await rmaApi.fornecedorAceitou(id, paymentWasMade);
      if (res.success) {
        showFeedback('success', paymentWasMade ? 'Incidência movida para Reembolsos Pendentes.' : 'Cadeado financeiro aplicado. Incidência auto-resolvida.');
        loadIncidents(PHASE_INTERVENCAO);
        loadIncidents(PHASE_REEMBOLSOS);
      } else {
        showFeedback('error', res.error || 'Erro na ação.');
      }
    } catch {
      showFeedback('error', 'Erro de comunicação com o servidor.');
    }
  };

  const handleFornecedorRecusou = async (id: number) => {
    try {
      const res = await rmaApi.fornecedorRecusou(id);
      if (res.success) {
        showFeedback('success', 'Incidência movida para Logística (Interceção).');
        loadIncidents(PHASE_INTERVENCAO);
        loadIncidents(PHASE_LOGISTICA);
      } else {
        showFeedback('error', res.error || 'Erro na ação.');
      }
    } catch {
      showFeedback('error', 'Erro de comunicação com o servidor.');
    }
  };

  const openNcModal = (incidentId: number) => {
    setNcIncidentId(incidentId);
    setNcForm({ numero_nc: '', valor: '', tipo: 'credito_conta' });
    setNcModalOpen(true);
  };

  const submitNc = async () => {
    if (ncIncidentId == null || !ncForm.numero_nc.trim() || !ncForm.valor || parseFloat(ncForm.valor) <= 0) {
      showFeedback('error', 'Número da NC e valor (€) são obrigatórios.');
      return;
    }
    setNcSubmitting(true);
    try {
      const res = await rmaApi.registarNC(ncIncidentId, {
        numero_nc: ncForm.numero_nc.trim(),
        valor: parseFloat(ncForm.valor),
        tipo: ncForm.tipo,
      });
      if (res.success) {
        showFeedback('success', 'Nota de Crédito registada. Crédito em conta será abatido no próximo lote SEPA.');
        setNcModalOpen(false);
        setNcIncidentId(null);
        loadIncidents(PHASE_REEMBOLSOS);
      } else {
        showFeedback('error', res.error || 'Erro ao registar NC.');
      }
    } catch {
      showFeedback('error', 'Erro de comunicação com o servidor.');
    } finally {
      setNcSubmitting(false);
    }
  };

  const handleIntercecaoSucesso = async (id: number) => {
    try {
      const res = await rmaApi.intercecaoSucesso(id);
      if (res.success) {
        showFeedback('success', 'Interceção com sucesso. Incidência resolvida.');
        loadIncidents(PHASE_LOGISTICA);
      } else {
        showFeedback('error', res.error || 'Erro na ação.');
      }
    } catch {
      showFeedback('error', 'Erro de comunicação com o servidor.');
    }
  };

  const handlePerdaAssumida = async (id: number) => {
    try {
      const res = await rmaApi.perdaAssumida(id);
      if (res.success) {
        showFeedback('success', `Perda assumida registada. Imparidade: ${formatCurrency(res.valor_imparidade ?? 0)}.`);
        loadIncidents(PHASE_LOGISTICA);
      } else {
        showFeedback('error', res.error || 'Erro na ação.');
      }
    } catch {
      showFeedback('error', 'Erro de comunicação com o servidor.');
    }
  };

  const renderIncidentRow = (
    inc: IncidentItem,
    phase: string,
    actions: React.ReactNode
  ) => (
    <tr key={inc.id} className="border-b border-slate-800 hover:bg-slate-800/50">
      <td className="py-3 pr-4 text-slate-500">{inc.id}</td>
      <td className="py-3 pr-4 font-mono text-blue-300">
        {inc.external_order_id ?? `SO#${inc.sales_order_id}`}
      </td>
      <td className="py-3 pr-4 text-white">{inc.supplier_nome ?? '—'}</td>
      <td className="py-3 pr-4 text-slate-300">{inc.empresa_nome ?? '—'}</td>
      <td className="py-3 pr-4 text-right text-orange-400 font-medium">
        {formatCurrency(inc.refund_customer_value)}
      </td>
      <td className="py-3 pr-4 text-right text-slate-400">
        {inc.po_total != null ? formatCurrency(inc.po_total) : '—'}
      </td>
      <td className="py-3 pr-4 text-slate-400 text-xs">
        {inc.created_at ? inc.created_at.slice(0, 16) : '—'}
      </td>
      <td className="py-3 pl-2">{actions}</td>
    </tr>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Package className="w-6 h-6 text-orange-400" />
            Incidências (RMA)
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Rastreabilidade contabilística: Intervenção de Compras → Reembolsos Pendentes → Logística
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

      {actionFeedback && (
        <div
          className={`text-sm px-4 py-2 rounded-lg border ${
            actionFeedback.type === 'success'
              ? 'bg-green-900/40 text-green-400 border-green-700'
              : 'bg-red-900/40 text-red-400 border-red-700'
          }`}
        >
          {actionFeedback.text}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap gap-1 bg-slate-800 p-1">
          <TabsTrigger value="intervencao" className="data-[state=active]:bg-amber-600 data-[state=active]:text-white">
            <Ban className="w-3 h-3 mr-1" />
            Intervenção de Compras
          </TabsTrigger>
          <TabsTrigger value="reembolsos" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
            <Banknote className="w-3 h-3 mr-1" />
            Reembolsos Pendentes
          </TabsTrigger>
          <TabsTrigger value="logistica" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            <Truck className="w-3 h-3 mr-1" />
            Logística (Interceção)
          </TabsTrigger>
          <TabsTrigger value="alertas" className="data-[state=active]:bg-red-600 data-[state=active]:text-white">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Alertas
            {alerts.length > 0 && (
              <span className="ml-2 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">
                {alerts.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="pendentes" className="data-[state=active]:bg-slate-600 data-[state=active]:text-white">
            <Clock className="w-3 h-3 mr-1" />
            Todos Pendentes
          </TabsTrigger>
          <TabsTrigger value="registar" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
            <Plus className="w-3 h-3 mr-1" />
            Registar Devolução
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Intervenção de Compras */}
        <TabsContent value="intervencao" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-amber-400 flex items-center gap-2">
                <Ban className="w-5 h-5" />
                Cancelamento solicitado ao fornecedor
              </CardTitle>
              <button
                type="button"
                onClick={() => loadIncidents(PHASE_INTERVENCAO)}
                disabled={loadingIncidents[PHASE_INTERVENCAO]}
                className="p-2 text-slate-400 hover:text-white rounded-lg disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loadingIncidents[PHASE_INTERVENCAO] ? 'animate-spin' : ''}`} />
              </button>
            </CardHeader>
            <CardContent>
              <p className="text-slate-400 text-sm mb-4">
                Se o fornecedor aceitar e o pagamento ainda não foi feito, o sistema aplica o cadeado financeiro e remove a PO do lote SEPA. Se já foi pago, a incidência segue para Reembolsos Pendentes.
              </p>
              {loadingIncidents[PHASE_INTERVENCAO] ? (
                <div className="text-center py-8 text-slate-400">A carregar...</div>
              ) : incidentsIntervencao.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Lock className="w-12 h-12 mx-auto mb-3 opacity-40" />
                  <p>Nenhuma incidência em intervenção de compras</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-slate-400 border-b border-slate-700">
                        <th className="text-left py-2 pr-4">#</th>
                        <th className="text-left py-2 pr-4">Pedido</th>
                        <th className="text-left py-2 pr-4">Fornecedor</th>
                        <th className="text-left py-2 pr-4">Empresa</th>
                        <th className="text-right py-2 pr-4">Reemb. Cliente</th>
                        <th className="text-right py-2 pr-4">Total PO</th>
                        <th className="text-left py-2 pr-4">Data</th>
                        <th className="text-left py-2">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {incidentsIntervencao.map((inc) =>
                        renderIncidentRow(
                          inc,
                          PHASE_INTERVENCAO,
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              className="bg-green-900/40 border-green-600 text-green-300 hover:bg-green-800/60"
                              onClick={() => handleFornecedorAceitou(inc.id, false)}
                            >
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Aceitou (pag. pendente)
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              className="bg-emerald-900/40 border border-emerald-600 text-emerald-300 hover:bg-emerald-800/60"
                              onClick={() => handleFornecedorAceitou(inc.id, true)}
                            >
                              <Banknote className="w-3 h-3 mr-1" />
                              Aceitou (já pago)
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              className="bg-red-900/40 border border-red-600 text-red-300 hover:bg-red-800/60"
                              onClick={() => handleFornecedorRecusou(inc.id)}
                            >
                              Recusou
                            </Button>
                          </div>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Reembolsos Pendentes */}
        <TabsContent value="reembolsos" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-emerald-400 flex items-center gap-2">
                <Banknote className="w-5 h-5" />
                Valores em trânsito – Nota de Crédito
              </CardTitle>
              <button
                type="button"
                onClick={() => loadIncidents(PHASE_REEMBOLSOS)}
                disabled={loadingIncidents[PHASE_REEMBOLSOS]}
                className="p-2 text-slate-400 hover:text-white rounded-lg disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loadingIncidents[PHASE_REEMBOLSOS] ? 'animate-spin' : ''}`} />
              </button>
            </CardHeader>
            <CardContent>
              <p className="text-slate-400 text-sm mb-4">
                Dinheiro já saiu para o fornecedor. Registe a Nota de Crédito (transferência ou crédito em conta). Crédito em conta será abatido no próximo lote SEPA desse fornecedor.
              </p>
              {loadingIncidents[PHASE_REEMBOLSOS] ? (
                <div className="text-center py-8 text-slate-400">A carregar...</div>
              ) : incidentsReembolsos.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-40" />
                  <p>Nenhum reembolso pendente</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-slate-400 border-b border-slate-700">
                        <th className="text-left py-2 pr-4">#</th>
                        <th className="text-left py-2 pr-4">Pedido</th>
                        <th className="text-left py-2 pr-4">Fornecedor</th>
                        <th className="text-left py-2 pr-4">Empresa</th>
                        <th className="text-right py-2 pr-4">Reemb. Cliente</th>
                        <th className="text-right py-2 pr-4">Total PO</th>
                        <th className="text-left py-2 pr-4">Data</th>
                        <th className="text-left py-2">Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {incidentsReembolsos.map((inc) =>
                        renderIncidentRow(
                          inc,
                          PHASE_REEMBOLSOS,
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700"
                            onClick={() => openNcModal(inc.id)}
                          >
                            Registar NC
                          </Button>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Logística (Interceção) */}
        <TabsContent value="logistica" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-blue-400 flex items-center gap-2">
                <Truck className="w-5 h-5" />
                Interceção em trânsito
              </CardTitle>
              <button
                type="button"
                onClick={() => loadIncidents(PHASE_LOGISTICA)}
                disabled={loadingIncidents[PHASE_LOGISTICA]}
                className="p-2 text-slate-400 hover:text-white rounded-lg disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loadingIncidents[PHASE_LOGISTICA] ? 'animate-spin' : ''}`} />
              </button>
            </CardHeader>
            <CardContent>
              <p className="text-slate-400 text-sm mb-4">
                Fornecedor recusou cancelar; encomenda em trânsito. Interceção com sucesso (regresso ao armazém) ou registe perda assumida para imparidade no P&L.
              </p>
              {loadingIncidents[PHASE_LOGISTICA] ? (
                <div className="text-center py-8 text-slate-400">A carregar...</div>
              ) : incidentsLogistica.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Truck className="w-12 h-12 mx-auto mb-3 opacity-40" />
                  <p>Nenhuma incidência em interceção</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-slate-400 border-b border-slate-700">
                        <th className="text-left py-2 pr-4">#</th>
                        <th className="text-left py-2 pr-4">Pedido</th>
                        <th className="text-left py-2 pr-4">Fornecedor</th>
                        <th className="text-left py-2 pr-4">Empresa</th>
                        <th className="text-right py-2 pr-4">Reemb. Cliente</th>
                        <th className="text-right py-2 pr-4">Total PO</th>
                        <th className="text-left py-2 pr-4">Data</th>
                        <th className="text-left py-2">Resolução</th>
                      </tr>
                    </thead>
                    <tbody>
                      {incidentsLogistica.map((inc) =>
                        renderIncidentRow(
                          inc,
                          PHASE_LOGISTICA,
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              className="bg-green-900/40 border border-green-600 text-green-300 hover:bg-green-800/60"
                              onClick={() => handleIntercecaoSucesso(inc.id)}
                            >
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Interceção OK
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              className="bg-red-900/40 border border-red-600 text-red-300 hover:bg-red-800/60"
                              onClick={() => handlePerdaAssumida(inc.id)}
                            >
                              Perda Assumida
                            </Button>
                          </div>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Alertas (existente) */}
        <TabsContent value="alertas" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-red-400 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Reembolsos sem Nota de Crédito há mais de 7 dias
              </CardTitle>
              <button
                type="button"
                onClick={loadAlerts}
                disabled={loadingAlerts}
                className="p-2 text-slate-400 hover:text-white rounded-lg disabled:opacity-50"
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
                        <th className="text-left py-2">Data</th>
                      </tr>
                    </thead>
                    <tbody>
                      {alerts.map((a) => (
                        <tr key={a.id} className="border-b border-slate-800 bg-red-950/20 hover:bg-red-950/40">
                          <td className="py-3 pr-4 font-mono text-red-300">{a.external_order_id ?? `SO#${a.sales_order_id}`}</td>
                          <td className="py-3 pr-4 text-white">{a.supplier_nome}</td>
                          <td className="py-3 pr-4 text-slate-300">{a.empresa_nome}</td>
                          <td className="py-3 pr-4 text-right text-red-400 font-bold">{formatCurrency(a.refund_customer_value)}</td>
                          <td className="py-3 pr-4 text-right text-slate-400">
                            {a.credit_note_supplier_value > 0 ? formatCurrency(a.credit_note_supplier_value) : <span className="text-red-500">Em falta</span>}
                          </td>
                          <td className="py-3 text-slate-400 text-xs">{a.created_at ? a.created_at.slice(0, 10) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Todos os Pendentes (existente) */}
        <TabsContent value="pendentes" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Todas as Devoluções Pendentes</CardTitle>
              <button
                type="button"
                onClick={loadPending}
                disabled={loadingPending}
                className="p-2 text-slate-400 hover:text-white rounded-lg disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loadingPending ? 'animate-spin' : ''}`} />
              </button>
            </CardHeader>
            <CardContent>
              {loadingPending ? (
                <div className="text-center py-8 text-slate-400">A carregar...</div>
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
                        <th className="text-right py-2 pr-4">Valor</th>
                        <th className="text-left py-2">Data</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pending.map((p) => (
                        <tr key={p.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                          <td className="py-3 pr-4 text-slate-500">{p.id}</td>
                          <td className="py-3 pr-4 font-mono text-blue-300">{p.external_order_id ?? `SO#${p.sales_order_id}`}</td>
                          <td className="py-3 pr-4 text-white">{p.supplier_nome}</td>
                          <td className="py-3 pr-4 text-right text-orange-400 font-bold">{formatCurrency(p.refund_customer_value)}</td>
                          <td className="py-3 text-slate-400 text-xs">{p.created_at ? p.created_at.slice(0, 10) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Registar Devolução (existente) */}
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
                    placeholder="ex: Produto com defeito"
                    rows={3}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 resize-none"
                  />
                </div>
                {registerMsg && (
                  <div
                    className={`text-sm px-3 py-2 rounded-lg ${
                      registerMsg.type === 'success' ? 'bg-green-900/40 text-green-400 border border-green-700' : 'bg-red-900/40 text-red-400 border border-red-700'
                    }`}
                  >
                    {registerMsg.text}
                  </div>
                )}
                <Button onClick={handleRegister} disabled={registering || !empresaSelecionada} className="w-full bg-blue-600 hover:bg-blue-700">
                  {registering ? 'A registar...' : 'Registar Devolução'}
                </Button>
                {!empresaSelecionada && <p className="text-slate-500 text-xs text-center">Seleciona uma empresa na barra lateral</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal Registar Nota de Crédito */}
      {ncModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setNcModalOpen(false)}>
          <div
            className="bg-slate-800 border border-slate-600 rounded-xl shadow-xl max-w-md w-full mx-4 p-6 text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-4">Registar Nota de Crédito do Fornecedor</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-slate-400 block mb-1">Número da Nota de Crédito *</label>
                <input
                  value={ncForm.numero_nc}
                  onChange={(e) => setNcForm({ ...ncForm, numero_nc: e.target.value })}
                  placeholder="ex: NC-2024-001"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-sm text-slate-400 block mb-1">Valor (€) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={ncForm.valor}
                  onChange={(e) => setNcForm({ ...ncForm, valor: e.target.value })}
                  placeholder="ex: 99.99"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-sm text-slate-400 block mb-1">Tipo de Reembolso</label>
                <select
                  value={ncForm.tipo}
                  onChange={(e) => setNcForm({ ...ncForm, tipo: e.target.value as 'transferencia' | 'credito_conta' })}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                >
                  <option value="credito_conta">Crédito em Conta (abate no próximo lote SEPA)</option>
                  <option value="transferencia">Transferência Bancária</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-6">
              <Button variant="secondary" onClick={() => setNcModalOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={submitNc} disabled={ncSubmitting || !ncForm.numero_nc.trim() || !ncForm.valor}>
                {ncSubmitting ? 'A registar...' : 'Registar NC'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
