'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Store, Loader2, Plus, Pencil, Trash2 } from 'lucide-react';
import { empresasApi, type Empresa } from '@/lib/api/empresas';
import { marketplacesApi, type Marketplace } from '@/lib/api/marketplaces';

export function MarketplacesMasterView() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresaFilterId, setEmpresaFilterId] = useState<number | ''>('');
  const [list, setList] = useState<Marketplace[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState<Partial<Marketplace>>({ ativo: true });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    empresasApi.getAll().then((data) => setEmpresas(Array.isArray(data) ? data : [])).catch(() => setEmpresas([]));
  }, []);

  useEffect(() => {
    if (!empresaFilterId) {
      setList([]);
      setSelectedId(null);
      return;
    }
    setLoading(true);
    marketplacesApi.getByEmpresa(Number(empresaFilterId))
      .then((data) => setList(Array.isArray(data) ? data : []))
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, [empresaFilterId]);

  useEffect(() => {
    if (selectedId != null) {
      marketplacesApi.getById(selectedId).then(setForm).catch(() => setForm({ ativo: true }));
    } else {
      setForm({ empresa_id: empresaFilterId ? Number(empresaFilterId) : undefined, nome: '', ativo: true });
    }
  }, [selectedId, empresaFilterId]);

  const handleSave = async () => {
    if (!form.nome?.trim()) {
      setMessage('Nome é obrigatório.');
      return;
    }
    const empresaId = form.empresa_id ?? (empresaFilterId ? Number(empresaFilterId) : undefined);
    if (!empresaId) {
      setMessage('Selecione uma empresa.');
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      if (selectedId != null) {
        await marketplacesApi.update(selectedId, {
          nome: form.nome,
          codigo: form.codigo,
          descricao: form.descricao,
          ativo: form.ativo,
        });
        setMessage('Marketplace atualizado.');
        setList((prev) => prev.map((m) => (m.id === selectedId ? { ...m, ...form } : m)));
      } else {
        const created = await marketplacesApi.create({
          empresa_id: empresaId,
          nome: form.nome,
          codigo: form.codigo,
          descricao: form.descricao,
        });
        setMessage('Marketplace criado.');
        setSelectedId(created.id);
        setList((prev) => [...prev, { ...created, ativo: true }]);
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } }; message?: string };
      setMessage(err?.response?.data?.detail || err?.message || 'Erro ao gravar.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (selectedId == null) return;
    if (!confirm('Desativar este marketplace?')) return;
    try {
      await marketplacesApi.update(selectedId, { ativo: false });
      setMessage('Marketplace desativado.');
      setList((prev) => prev.map((m) => (m.id === selectedId ? { ...m, ativo: false } : m)));
      setSelectedId(null);
      setForm({ empresa_id: empresaFilterId ? Number(empresaFilterId) : undefined, nome: '', ativo: true });
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } }; message?: string };
      setMessage(err?.response?.data?.detail || err?.message || 'Erro ao desativar.');
    }
  };

  return (
    <div className="mt-8 space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Dados Mestres — Marketplaces</h1>
        <p className="text-slate-400 text-sm mt-1">Canais de venda por empresa. Selecione a empresa e gerir marketplaces.</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Marketplaces</CardTitle>
            <div className="mt-2">
              <label className="block text-xs text-slate-400 mb-1">Empresa</label>
              <select
                value={empresaFilterId === '' ? '' : String(empresaFilterId)}
                onChange={(e) => {
                  setEmpresaFilterId(e.target.value === '' ? '' : Number(e.target.value));
                  setSelectedId(null);
                }}
                className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm"
              >
                <option value="">— Selecionar empresa —</option>
                {empresas.map((e) => (
                  <option key={e.id} value={e.id}>{e.nome}</option>
                ))}
              </select>
            </div>
          </CardHeader>
          <CardContent>
            {!empresaFilterId ? (
              <p className="text-slate-500 text-sm">Selecione uma empresa para listar marketplaces.</p>
            ) : loading ? (
              <div className="flex justify-center py-8 text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : list.length === 0 ? (
              <p className="text-slate-500 text-sm">Nenhum marketplace. Use o painel à direita para criar.</p>
            ) : (
              <ul className="space-y-1">
                {list.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(m.id)}
                      className={`w-full text-left px-3 py-2 rounded text-sm flex items-center gap-2 ${selectedId === m.id ? 'bg-amber-600/20 text-amber-400' : 'text-slate-300 hover:bg-slate-800'} ${!m.ativo ? 'opacity-60' : ''}`}
                    >
                      <Store className="w-3 h-3 opacity-70" />
                      {m.nome}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span>{selectedId != null ? 'Editar marketplace' : 'Novo marketplace'}</span>
              {selectedId != null && (
                <button
                  type="button"
                  onClick={() => { setSelectedId(null); setForm({ empresa_id: empresaFilterId ? Number(empresaFilterId) : undefined, nome: '', ativo: true }); }}
                  className="p-1.5 rounded bg-slate-600 text-white hover:bg-slate-500"
                  title="Novo"
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!empresaFilterId && !form.empresa_id ? (
              <p className="text-slate-500 text-sm">Selecione uma empresa na lista à esquerda.</p>
            ) : (
              <>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Nome</label>
                  <input
                    value={form.nome ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Código</label>
                  <input
                    value={form.codigo ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Descrição</label>
                  <input
                    value={form.descricao ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm"
                  />
                </div>
                <label className="flex items-center gap-2 text-slate-400 text-sm pt-2">
                  <input
                    type="checkbox"
                    checked={form.ativo ?? true}
                    onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked }))}
                    className="rounded"
                  />
                  Ativo
                </label>
                {message && (
                  <div className={`px-4 py-2 rounded text-sm ${message.startsWith('Marketplace') ? 'bg-emerald-900/30 text-emerald-400' : 'bg-red-900/30 text-red-400'}`}>
                    {message}
                  </div>
                )}
                <div className="flex justify-end gap-2 pt-2">
                  {selectedId != null && (
                    <button
                      type="button"
                      onClick={handleDelete}
                      className="px-4 py-2 rounded-lg bg-red-900/50 text-red-300 font-medium hover:bg-red-900/70 flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      Desativar
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 rounded-lg bg-amber-600 text-white font-medium disabled:opacity-50 flex items-center gap-2"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pencil className="w-4 h-4" />}
                    Gravar
                  </button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
