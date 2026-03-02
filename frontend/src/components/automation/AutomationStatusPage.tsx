'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { automationApi, type AutomationStats, type SyncHistoryItem } from '@/lib/api/automation';
import { RefreshCw, Play, AlertCircle, CheckCircle, Clock, Package, FileText, TrendingUp, Loader2 } from 'lucide-react';

export function AutomationStatusPage() {
  const [stats, setStats] = useState<AutomationStats | null>(null);
  const [history, setHistory] = useState<SyncHistoryItem[]>([]);
  const [suppliersWithAccess, setSuppliersWithAccess] = useState<Array<{ supplier_id: number; supplier_nome: string }>>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [syncingId, setSyncingId] = useState<number | null>(null);
  const [filterSupplierId, setFilterSupplierId] = useState<number | undefined>();
  const [filterSyncType, setFilterSyncType] = useState<string | undefined>();

  const loadStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const s = await automationApi.getStats();
      setStats(s);
    } catch {
      setStats({ prices_updated_today: 0, trackings_captured_today: 0, invoices_downloaded_today: 0 });
    } finally {
      setLoadingStats(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await automationApi.getHistory({
        supplier_id: filterSupplierId,
        sync_type: filterSyncType,
        limit: 100,
      });
      setHistory(res.items || []);
    } catch {
      setHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  }, [filterSupplierId, filterSyncType]);

  const loadStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const st = await automationApi.getStatus();
      setSuppliersWithAccess(st.suppliers_with_access || []);
    } catch {
      setSuppliersWithAccess([]);
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleSyncNow = async (supplierId: number) => {
    setSyncingId(supplierId);
    try {
      await automationApi.syncNow(supplierId);
      await Promise.all([loadStats(), loadHistory(), loadStatus()]);
    } finally {
      setSyncingId(null);
    }
  };

  const refreshAll = () => {
    loadStats();
    loadHistory();
    loadStatus();
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <RefreshCw className="w-7 h-7 text-amber-400" />
          Status de Automação
        </h1>
        <button
          onClick={refreshAll}
          disabled={loadingStats || loadingHistory || loadingStatus}
          className="px-4 py-2 rounded-lg bg-slate-700 text-slate-200 hover:bg-slate-600 flex items-center gap-2 text-sm disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loadingStats || loadingHistory ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {/* KPIs do dia */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              Preços atualizados hoje
            </div>
            <p className="text-2xl font-semibold text-white mt-1">
              {loadingStats ? '—' : (stats?.prices_updated_today ?? 0)}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <Package className="w-4 h-4 text-blue-400" />
              Trackings capturados hoje
            </div>
            <p className="text-2xl font-semibold text-white mt-1">
              {loadingStats ? '—' : (stats?.trackings_captured_today ?? 0)}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <FileText className="w-4 h-4 text-amber-400" />
              Faturas descarregadas hoje
            </div>
            <p className="text-2xl font-semibold text-white mt-1">
              {loadingStats ? '—' : (stats?.invoices_downloaded_today ?? 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Forçar Sincronização Agora */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-white">
            <Play className="w-5 h-5 text-amber-400" />
            Teste de Sincronização
          </CardTitle>
          <p className="text-slate-400 text-sm mt-1">
            Forçar sincronização manual para um fornecedor (Prices, Tracking, Invoices). Executa em background.
          </p>
        </CardHeader>
        <CardContent>
          {loadingStatus ? (
            <div className="flex items-center gap-2 text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin" /> A carregar...
            </div>
          ) : suppliersWithAccess.length === 0 ? (
            <p className="text-slate-500 text-sm">Nenhum fornecedor com acessos preenchidos (URL, user, password).</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {suppliersWithAccess.map((s) => (
                <button
                  key={s.supplier_id}
                  onClick={() => handleSyncNow(s.supplier_id)}
                  disabled={syncingId !== null}
                  className="px-3 py-2 rounded-lg bg-amber-600/80 text-white hover:bg-amber-600 disabled:opacity-50 flex items-center gap-2 text-sm"
                >
                  {syncingId === s.supplier_id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  {s.supplier_nome}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabela de Logs */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-white">
            <Clock className="w-5 h-5 text-slate-400" />
            Histórico de Sincronização
          </CardTitle>
          <p className="text-slate-400 text-sm mt-1">
            Logs de sucesso e erro por fornecedor. Filtre por fornecedor ou tipo (Prices, Tracking, Invoices).
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <select
              value={filterSupplierId ?? ''}
              onChange={(e) => setFilterSupplierId(e.target.value ? Number(e.target.value) : undefined)}
              className="rounded-lg bg-slate-700 border border-slate-600 text-slate-200 text-sm px-3 py-1.5"
            >
              <option value="">Todos os fornecedores</option>
              {suppliersWithAccess.map((s) => (
                <option key={s.supplier_id} value={s.supplier_id}>{s.supplier_nome}</option>
              ))}
            </select>
            <select
              value={filterSyncType ?? ''}
              onChange={(e) => setFilterSyncType(e.target.value || undefined)}
              className="rounded-lg bg-slate-700 border border-slate-600 text-slate-200 text-sm px-3 py-1.5"
            >
              <option value="">Todos os tipos</option>
              <option value="Prices">Prices</option>
              <option value="Tracking">Tracking</option>
              <option value="Invoices">Invoices</option>
              <option value="prices">prices (legado)</option>
              <option value="trackings_invoices">trackings_invoices (legado)</option>
            </select>
          </div>
        </CardHeader>
        <CardContent>
          {loadingHistory ? (
            <div className="flex items-center gap-2 text-slate-400 py-8">
              <Loader2 className="w-5 h-5 animate-spin" /> A carregar histórico...
            </div>
          ) : history.length === 0 ? (
            <p className="text-slate-500 py-8">Nenhum registo de sincronização.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-600 text-left text-slate-400">
                    <th className="py-2 px-2">Data</th>
                    <th className="py-2 px-2">Fornecedor</th>
                    <th className="py-2 px-2">Tipo</th>
                    <th className="py-2 px-2">Estado</th>
                    <th className="py-2 px-2">Mensagem</th>
                    <th className="py-2 px-2 text-right">Registos</th>
                    <th className="py-2 px-2 text-right">Duração (s)</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((row) => (
                    <tr key={row.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                      <td className="py-2 px-2 text-slate-300">
                        {row.started_at ? new Date(row.started_at).toLocaleString('pt-PT') : '—'}
                      </td>
                      <td className="py-2 px-2 text-slate-200 font-medium">{row.supplier_nome ?? `#${row.supplier_id}`}</td>
                      <td className="py-2 px-2 text-slate-300">{row.sync_type ?? '—'}</td>
                      <td className="py-2 px-2">
                        {row.status === 'success' ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400 text-xs">
                            <CheckCircle className="w-3.5 h-3.5" /> Success
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-400 text-xs">
                            <AlertCircle className="w-3.5 h-3.5" /> {row.status || 'Error'}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-slate-400 max-w-xs truncate" title={row.message ?? undefined}>
                        {row.message || '—'}
                      </td>
                      <td className="py-2 px-2 text-right text-slate-300">{row.records_updated ?? '—'}</td>
                      <td className="py-2 px-2 text-right text-slate-400">{row.duration_seconds ?? '—'}</td>
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
