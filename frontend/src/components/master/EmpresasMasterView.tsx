'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Building2, Loader2, Plus, Pencil } from 'lucide-react';
import { empresasApi, type Empresa } from '@/lib/api/empresas';

const EMPTY_FORM: Partial<Empresa> = { nome: '', ativo: true };

export function EmpresasMasterView() {
  const [list, setList] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState<Partial<Empresa>>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    empresasApi.getAll().then((data) => setList(Array.isArray(data) ? data : [])).catch(() => setList([])).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedId != null) {
      empresasApi.getById(selectedId).then(setForm).catch(() => setForm(EMPTY_FORM));
    } else {
      setForm(EMPTY_FORM);
    }
  }, [selectedId]);

  const handleSave = async () => {
    if (!form.nome?.trim()) {
      setMessage('Nome é obrigatório.');
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      if (selectedId != null) {
        await empresasApi.update(selectedId, {
          nome: form.nome,
          codigo: form.codigo,
          nif: form.nif,
          morada: form.morada,
          pais: form.pais,
          email: form.email,
          telefone: form.telefone,
          ativo: form.ativo,
          designacao_social: form.designacao_social,
          morada_fiscal: form.morada_fiscal,
          email_financeiro: form.email_financeiro,
          logotipo_url: form.logotipo_url,
          iban: form.iban,
          moeda_base: form.moeda_base,
        });
        setMessage('Empresa atualizada.');
        setList((prev) => prev.map((e) => (e.id === selectedId ? { ...e, ...form } : e)));
      } else {
        const created = await empresasApi.create({
          nome: form.nome!,
          codigo: form.codigo,
          nif: form.nif,
          morada: form.morada,
          email: form.email,
          telefone: form.telefone,
          pais: form.pais,
          designacao_social: form.designacao_social,
          morada_fiscal: form.morada_fiscal,
          email_financeiro: form.email_financeiro,
          logotipo_url: form.logotipo_url,
          iban: form.iban,
          moeda_base: form.moeda_base,
        });
        setMessage('Empresa criada.');
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

  const renderField = (label: string, key: keyof Empresa, type: string = 'text') => (
    <div>
      <label className="block text-xs text-slate-400 mb-1">{label}</label>
      <input
        type={type}
        value={(form[key] as string | number) ?? ''}
        onChange={(e) => setForm((f) => ({ ...f, [key]: type === 'number' || key === 'ativo' ? (type === 'checkbox' ? e.target.checked : e.target.value) : e.target.value }))}
        className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm"
      />
    </div>
  );

  return (
    <div className="mt-8 space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Dados Mestres — Empresas</h1>
        <p className="text-slate-400 text-sm mt-1">Gerir empresas (entidades legais). Selecione na lista ou crie uma nova.</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span>Empresas</span>
              <button
                type="button"
                onClick={() => { setSelectedId(null); setForm(EMPTY_FORM); }}
                className="p-1.5 rounded bg-amber-600 text-white hover:bg-amber-500"
                title="Nova empresa"
              >
                <Plus className="w-4 h-4" />
              </button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8 text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : list.length === 0 ? (
              <p className="text-slate-500 text-sm">Nenhuma empresa. Clique em + para criar.</p>
            ) : (
              <ul className="space-y-1">
                {list.map((e) => (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(e.id)}
                      className={`w-full text-left px-3 py-2 rounded text-sm flex items-center gap-2 ${selectedId === e.id ? 'bg-amber-600/20 text-amber-400' : 'text-slate-300 hover:bg-slate-800'}`}
                    >
                      <Building2 className="w-3 h-3 opacity-70" />
                      {e.nome}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">
              {selectedId != null ? 'Editar empresa' : 'Nova empresa'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {renderField('Nome', 'nome')}
            {renderField('Código', 'codigo')}
            {renderField('NIF', 'nif')}
            {renderField('País', 'pais')}
            {renderField('Morada', 'morada')}
            {renderField('Email', 'email', 'email')}
            {renderField('Telefone', 'telefone', 'tel')}
            {renderField('Designação social', 'designacao_social')}
            {renderField('Morada fiscal', 'morada_fiscal')}
            {renderField('Email financeiro', 'email_financeiro', 'email')}
            {renderField('IBAN', 'iban')}
            {renderField('Moeda base', 'moeda_base')}
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
              <div className={`px-4 py-2 rounded text-sm ${message.startsWith('Empresa') ? 'bg-emerald-900/30 text-emerald-400' : 'bg-red-900/30 text-red-400'}`}>
                {message}
              </div>
            )}
            <div className="flex justify-end pt-2">
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
