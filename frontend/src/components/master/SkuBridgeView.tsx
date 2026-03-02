'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Loader2, Plus, Pencil, Trash2, Check, X, Search, Link2 } from 'lucide-react';
import { configApi, type SkuBridgeEntry } from '@/lib/api/config';
import { empresasApi, type Empresa } from '@/lib/api/empresas';

const EMPTY_FORM: Omit<SkuBridgeEntry, 'id' | 'created_at'> = {
  empresa_id: null,
  sku_global: '',
  descricao: null,
  ean: null,
  asin: null,
  ref_fornecedor_1: null,
  ref_fornecedor_2: null,
  marketplace: null,
};

export function SkuBridgeView() {
  const [items, setItems] = useState<SkuBridgeEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);

  // Filtros
  const [q, setQ] = useState('');
  const [empresaFiltro, setEmpresaFiltro] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  // Modo: null = lista, 'new' = form novo, number = id a editar
  const [mode, setMode] = useState<null | 'new' | number>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    empresasApi.getAll()
      .then(d => setEmpresas(Array.isArray(d) ? d : []))
      .catch(() => setEmpresas([]));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await configApi.listSkuBridge({
        empresa_id: empresaFiltro ?? undefined,
        q: q || undefined,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch {
      setMsg({ text: 'Erro ao carregar mapeamentos.', ok: false });
    } finally {
      setLoading(false);
    }
  }, [q, empresaFiltro, page]);

  useEffect(() => { load(); }, [load]);

  const handleSearch = () => { setPage(0); load(); };

  const openNew = () => {
    setForm(EMPTY_FORM);
    setMode('new');
    setMsg(null);
  };

  const openEdit = (item: SkuBridgeEntry) => {
    setForm({
      empresa_id: item.empresa_id,
      sku_global: item.sku_global,
      descricao: item.descricao,
      ean: item.ean,
      asin: item.asin,
      ref_fornecedor_1: item.ref_fornecedor_1,
      ref_fornecedor_2: item.ref_fornecedor_2,
      marketplace: item.marketplace,
    });
    setMode(item.id);
    setMsg(null);
  };

  const cancelForm = () => { setMode(null); setMsg(null); };

  const handleSave = async () => {
    if (!form.sku_global.trim()) {
      setMsg({ text: 'SKU Interno é obrigatório.', ok: false });
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      if (mode === 'new') {
        await configApi.createSkuBridge(form);
        setMsg({ text: 'Mapeamento criado.', ok: true });
      } else if (typeof mode === 'number') {
        await configApi.updateSkuBridge(mode, form);
        setMsg({ text: 'Mapeamento atualizado.', ok: true });
      }
      setMode(null);
      setPage(0);
      load();
    } catch {
      setMsg({ text: 'Erro ao guardar.', ok: false });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number, sku: string) => {
    if (!window.confirm(`Eliminar mapeamento "${sku}"?`)) return;
    setDeleting(id);
    try {
      await configApi.deleteSkuBridge(id);
      setItems(prev => prev.filter(i => i.id !== id));
      setTotal(t => t - 1);
      setMsg({ text: 'Eliminado.', ok: true });
    } catch {
      setMsg({ text: 'Erro ao eliminar.', ok: false });
    } finally {
      setDeleting(null);
    }
  };

  const fld = (
    label: string,
    key: keyof typeof form,
    placeholder?: string,
    required?: boolean
  ) => (
    <div>
      <label className="block text-xs text-slate-400 mb-1">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <input
        type="text"
        value={(form[key] as string) ?? ''}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value || null }))}
        placeholder={placeholder}
        className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm focus:border-amber-500 focus:outline-none"
      />
    </div>
  );

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="mt-8 space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Link2 className="w-6 h-6 text-amber-400" />
          Mapping de Identificadores (Cross-SKU)
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Associa EAN, ASIN e referências de fornecedor ao SKU interno.
          Quando importas um ficheiro da Worten ou Amazon, o sistema usa esta tabela para traduzir os códigos automaticamente.
        </p>
      </div>

      {msg && (
        <div className={`px-4 py-2 rounded text-sm ${msg.ok ? 'bg-emerald-900/30 text-emerald-400' : 'bg-red-900/30 text-red-400'}`}>
          {msg.text}
        </div>
      )}

      {/* Formulário (novo ou editar) */}
      {mode !== null && (
        <Card className="border border-amber-700/40 bg-amber-950/10">
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span>{mode === 'new' ? '+ Novo Mapeamento' : 'Editar Mapeamento'}</span>
              <button type="button" onClick={cancelForm} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              {fld('SKU Interno', 'sku_global', 'Ex: SKU-001', true)}
              {fld('Descrição', 'descricao', 'Nome do produto')}
              {fld('EAN / Cód. de Barras', 'ean', '5601234567890')}
              {fld('ASIN (Amazon)', 'asin', 'B08XXXX')}
              {fld('Ref. Fornecedor 1', 'ref_fornecedor_1', 'Ref interna forn.')}
              {fld('Ref. Fornecedor 2', 'ref_fornecedor_2', 'Ref alternativa')}
              {fld('Marketplace', 'marketplace', 'amazon / worten / all')}
              <div>
                <label className="block text-xs text-slate-400 mb-1">Empresa</label>
                <select
                  value={form.empresa_id ?? ''}
                  onChange={e => setForm(f => ({ ...f, empresa_id: e.target.value ? Number(e.target.value) : null }))}
                  className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm"
                >
                  <option value="">— Global —</option>
                  {empresas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-4">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-amber-600 text-white font-medium disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Gravar
              </button>
              <button type="button" onClick={cancelForm} className="px-4 py-2 rounded-lg bg-slate-700 text-slate-300">
                Cancelar
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Barra de pesquisa + filtro */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-[220px]">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                value={q}
                onChange={e => setQ(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="Pesquisar SKU, EAN, ASIN, descrição..."
                className="flex-1 bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm focus:border-amber-500 focus:outline-none"
              />
            </div>
            <select
              value={empresaFiltro ?? ''}
              onChange={e => { setEmpresaFiltro(e.target.value ? Number(e.target.value) : null); setPage(0); }}
              className="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm"
            >
              <option value="">Todas as empresas</option>
              {empresas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
            <button
              type="button"
              onClick={handleSearch}
              className="px-3 py-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 text-sm"
            >
              Pesquisar
            </button>
            <div className="ml-auto">
              <button
                type="button"
                onClick={openNew}
                className="px-4 py-2 rounded-lg bg-amber-600 text-white font-medium flex items-center gap-2 hover:bg-amber-500"
              >
                <Plus className="w-4 h-4" />
                Novo
              </button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> A carregar...
            </div>
          ) : items.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <Link2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhum mapeamento encontrado.</p>
              <p className="text-xs mt-1">Clique em <strong>+ Novo</strong> para adicionar o primeiro SKU.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700 bg-slate-800/50">
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">SKU Interno</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Descrição</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">EAN</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">ASIN</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Ref. Forn. 1</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Ref. Forn. 2</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Marketplace</th>
                    <th className="text-center px-4 py-3 text-slate-400 font-medium w-20">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr
                      key={item.id}
                      className={`border-b border-slate-800 hover:bg-slate-800/40 ${idx % 2 === 0 ? 'bg-slate-900' : 'bg-slate-900/50'}`}
                    >
                      <td className="px-4 py-2.5">
                        <span className="font-mono text-amber-400 font-semibold text-xs">{item.sku_global}</span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-300 max-w-[180px] truncate" title={item.descricao ?? ''}>
                        {item.descricao || <span className="text-slate-600">—</span>}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-300">
                        {item.ean || <span className="text-slate-600">—</span>}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-sky-400">
                        {item.asin || <span className="text-slate-600">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-300">
                        {item.ref_fornecedor_1 || <span className="text-slate-600">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-300">
                        {item.ref_fornecedor_2 || <span className="text-slate-600">—</span>}
                      </td>
                      <td className="px-4 py-2.5">
                        {item.marketplace
                          ? <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded">{item.marketplace}</span>
                          : <span className="text-slate-600 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(item)}
                            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-700"
                            title="Editar"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(item.id, item.sku_global)}
                            disabled={deleting === item.id}
                            className="p-1 rounded text-slate-400 hover:text-red-400 hover:bg-slate-700 disabled:opacity-40"
                            title="Eliminar"
                          >
                            {deleting === item.id
                              ? <Loader2 className="w-3 h-3 animate-spin" />
                              : <Trash2 className="w-3 h-3" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700">
              <span className="text-xs text-slate-400">{total} resultados — página {page + 1} de {totalPages}</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="px-3 py-1 rounded bg-slate-700 text-slate-300 text-xs disabled:opacity-40"
                >
                  ← Anterior
                </button>
                <button
                  type="button"
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="px-3 py-1 rounded bg-slate-700 text-slate-300 text-xs disabled:opacity-40"
                >
                  Seguinte →
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
