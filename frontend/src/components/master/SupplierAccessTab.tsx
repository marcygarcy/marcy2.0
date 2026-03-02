'use client';

import React, { useState, useEffect } from 'react';
import { Lock, Globe, User, Key, RefreshCw } from 'lucide-react';
import { suppliersApi } from '@/lib/api/suppliers';

interface SupplierAccessTabProps {
  supplierId: number | null;
  onSyncComplete?: () => void;
}

export function SupplierAccessTab({ supplierId, onSyncComplete }: SupplierAccessTabProps) {
  const [access, setAccess] = useState({
    url: '',
    user: '',
    password: '',
    api_key: '',
  });
  const [autoSync, setAutoSync] = useState({
    auto_sync_prices: false,
    auto_sync_trackings: false,
    auto_sync_invoices: false,
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingAccess, setLoadingAccess] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (supplierId == null) {
      setMessage(null);
      return;
    }
    setLoadingAccess(true);
    setMessage(null);
    suppliersApi
      .getAccess(supplierId)
      .then((data) => {
        if (data.has_access) {
          setAccess({
            url: data.url_site ?? '',
            user: data.login_user ?? '',
            password: '',
            api_key: data.api_key ?? '',
          });
          setAutoSync({
            auto_sync_prices: data.auto_sync_prices ?? false,
            auto_sync_trackings: data.auto_sync_trackings ?? false,
            auto_sync_invoices: data.auto_sync_invoices ?? false,
          });
        }
        // Se não tem acessos gravados, mantemos o que está no formulário (ex.: preencheu antes de gravar o fornecedor)
      })
      .catch(() => {
        setMessage('Erro ao carregar acessos. Verifique se o backend está a correr.');
      })
      .finally(() => setLoadingAccess(false));
  }, [supplierId]);

  const handleSave = async () => {
    if (supplierId == null) return;
    setSaving(true);
    setMessage(null);
    try {
      await suppliersApi.putAccess(supplierId, {
        url_site: access.url || undefined,
        login_user: access.user || undefined,
        login_password: access.password || undefined,
        api_key: access.api_key || undefined,
        auto_sync_prices: autoSync.auto_sync_prices,
        auto_sync_trackings: autoSync.auto_sync_trackings,
        auto_sync_invoices: autoSync.auto_sync_invoices,
      });
      setMessage('Acessos guardados com encriptação (AES-256).');
      setAccess((a) => ({ ...a, password: '' }));
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } }; message?: string };
      setMessage(err?.response?.data?.detail || err?.message || 'Erro ao guardar.');
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
    if (supplierId == null) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await suppliersApi.syncProfile(supplierId);
      if (res.success) {
        setMessage(res.message ?? 'Ficha de fornecedor atualizada com dados do site.');
        onSyncComplete?.();
      } else {
        setMessage(res.error ?? 'Erro na sincronização.');
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } }; message?: string };
      setMessage(err?.response?.data?.detail || err?.message || 'Erro ao sincronizar.');
    } finally {
      setLoading(false);
    }
  };

  const hasSupplier = supplierId != null;
  const canSaveAccess = hasSupplier;

  if (hasSupplier && loadingAccess) {
    return (
      <div className="p-6 text-slate-400 text-sm rounded-b-lg border border-slate-700 border-t-0 bg-slate-900/50 flex items-center gap-2">
        <RefreshCw className="w-4 h-4 animate-spin" />
        A carregar acessos…
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 rounded-b-lg border border-slate-700 border-t-0 bg-slate-900/50">
      {!hasSupplier && (
        <p className="text-sm text-amber-400/90 bg-amber-900/20 border border-amber-700/50 rounded-lg px-3 py-2">
          Pode preencher URL, utilizador e senha já. Depois de gravar o fornecedor (botão <strong>Gravar</strong> no final do formulário), volte aqui e clique em <strong>Guardar Acessos</strong>.
        </p>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2 text-slate-300">
            <Globe size={16} className="text-amber-500" /> URL do Site/Portal
          </label>
          <input
            className="w-full p-2 border border-slate-600 rounded bg-slate-800 text-white placeholder-slate-500"
            placeholder="https://fornecedor.com/login"
            value={access.url}
            onChange={(e) => setAccess({ ...access, url: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2 text-slate-300">
            <User size={16} className="text-amber-500" /> Utilizador / Email
          </label>
          <input
            className="w-full p-2 border border-slate-600 rounded bg-slate-800 text-white placeholder-slate-500"
            value={access.user}
            onChange={(e) => setAccess({ ...access, user: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2 text-slate-300">
            <Lock size={16} className="text-amber-500" /> Senha
          </label>
          <input
            type="password"
            className="w-full p-2 border border-slate-600 rounded bg-slate-800 text-white placeholder-slate-500"
            placeholder="••••••••"
            value={access.password}
            onChange={(e) => setAccess({ ...access, password: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2 text-slate-300">
            <Key size={16} className="text-amber-500" /> API Key (Opcional)
          </label>
          <input
            type="password"
            className="w-full p-2 border border-slate-600 rounded bg-slate-800 text-white placeholder-slate-500"
            value={access.api_key}
            onChange={(e) => setAccess({ ...access, api_key: e.target.value })}
            placeholder="Token ou chave de API"
          />
        </div>
      </div>

      <div className="mt-4 p-4 bg-slate-800/50 rounded-lg border border-slate-600">
        <h4 className="text-sm font-bold text-slate-200 mb-3">Configurações de Automação (Midnight Sync)</h4>
        <p className="text-xs text-slate-400 mb-3">Todas as noites às 00:00 o servidor executa as sincronizações ativas para este fornecedor.</p>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-slate-300 text-sm cursor-pointer">
            <input
              type="checkbox"
              className="rounded"
              checked={autoSync.auto_sync_prices}
              onChange={(e) => setAutoSync((a) => ({ ...a, auto_sync_prices: e.target.checked }))}
            />
            <span>Sincronizar Tabela de Preços (Atualiza SKU Mapping)</span>
          </label>
          <label className="flex items-center gap-2 text-slate-300 text-sm cursor-pointer">
            <input
              type="checkbox"
              className="rounded"
              checked={autoSync.auto_sync_trackings}
              onChange={(e) => setAutoSync((a) => ({ ...a, auto_sync_trackings: e.target.checked }))}
            />
            <span>Sincronizar Trackings (Atualiza Vendas)</span>
          </label>
          <label className="flex items-center gap-2 text-slate-300 text-sm cursor-pointer">
            <input
              type="checkbox"
              className="rounded"
              checked={autoSync.auto_sync_invoices}
              onChange={(e) => setAutoSync((a) => ({ ...a, auto_sync_invoices: e.target.checked }))}
            />
            <span>Sincronizar Faturas (Download automático de PDFs)</span>
          </label>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 pt-4 border-t border-slate-700">
        <button
          type="button"
          onClick={() => handleSave()}
          disabled={saving || !canSaveAccess}
          title={!canSaveAccess ? 'Grave primeiro o fornecedor (botão Gravar) para guardar os acessos' : undefined}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
        >
          {saving ? <RefreshCw className="animate-spin" size={16} /> : null}
          Guardar Acessos
        </button>

        <button
          type="button"
          onClick={() => handleSync()}
          disabled={loading || !canSaveAccess}
          title={!canSaveAccess ? 'Grave primeiro o fornecedor para poder sincronizar' : undefined}
          className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded hover:bg-emerald-700 disabled:opacity-50"
        >
          {loading ? <RefreshCw className="animate-spin" size={16} /> : <RefreshCw size={16} />}
          Sincronizar Dados da Ficha
        </button>
      </div>

      {message && (
        <p className={`text-sm ${message.startsWith('Erro') ? 'text-red-400' : 'text-emerald-400'}`}>
          {message}
        </p>
      )}

      <p className="text-xs text-slate-500 italic">
        * As senhas são encriptadas no servidor com Fernet (AES-256) antes de serem gravadas. Configure ENCRYPTION_KEY no .env do backend.
      </p>
    </div>
  );
}
