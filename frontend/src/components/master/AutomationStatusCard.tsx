'use client';

import React, { useState, useEffect } from 'react';
import { RefreshCw, Package, TrendingUp } from 'lucide-react';
import { automationApi, type AutomationStatus } from '@/lib/api/automation';

export function AutomationStatusCard() {
  const [status, setStatus] = useState<AutomationStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    automationApi.getStatus().then(setStatus).catch(() => setStatus(null)).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="rounded-lg border border-slate-600 bg-slate-800/50 p-4 flex items-center gap-2 text-slate-400">
        <RefreshCw className="w-4 h-4 animate-spin" />
        A carregar estado da automação…
      </div>
    );
  }

  if (!status || status.error) {
    return (
      <div className="rounded-lg border border-slate-600 bg-slate-800/50 p-4 text-slate-400 text-sm">
        Status de automação indisponível. {status?.error ? `(${status.error})` : ''}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-600 bg-slate-800/50 p-4 space-y-3">
      <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
        <RefreshCw className="w-4 h-4 text-amber-500" />
        Status de Automação (Midnight Sync)
      </h3>
      <p className="text-xs text-slate-400">
        Sincronização automática às 00:00 para fornecedores com automação ativa na aba Acessos.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-900/60 rounded px-3 py-2">
          <div className="text-xs text-slate-500">Fornecedores com automação</div>
          <div className="text-lg font-semibold text-white">{status.suppliers_with_automation}</div>
        </div>
        <div className="bg-slate-900/60 rounded px-3 py-2">
          <div className="text-xs text-slate-500">Sincronizações hoje</div>
          <div className="text-lg font-semibold text-white">{status.syncs_today_count}</div>
        </div>
        <div className="bg-slate-900/60 rounded px-3 py-2">
          <div className="text-xs text-slate-500 flex items-center gap-1">
            <Package size={12} /> Trackings / Faturas hoje
          </div>
          <div className="text-lg font-semibold text-emerald-400">{status.records_updated_today}</div>
        </div>
      </div>
      {(status.last_price_syncs?.length > 0 || status.last_tracking_syncs?.length > 0) && (
        <details className="text-xs text-slate-400">
          <summary className="cursor-pointer text-slate-500 hover:text-slate-300">Últimas sincronizações</summary>
          <ul className="mt-2 space-y-1 pl-2">
            {status.last_price_syncs?.slice(0, 3).map((s, i) => (
              <li key={`p-${i}`}>
                <TrendingUp className="inline w-3 h-3 mr-1" /> Preços: {s.supplier_nome} — {s.finished_at ? new Date(s.finished_at).toLocaleString('pt-PT') : '-'}
              </li>
            ))}
            {status.last_tracking_syncs?.slice(0, 3).map((s, i) => (
              <li key={`t-${i}`}>
                <Package className="inline w-3 h-3 mr-1" /> Trackings: {s.supplier_nome} — {s.finished_at ? new Date(s.finished_at).toLocaleString('pt-PT') : '-'}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
