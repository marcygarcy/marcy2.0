'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Loader2, Pencil, Check, X, Globe, Filter, Info } from 'lucide-react';
import { configApi, type TaxMatrixEntry } from '@/lib/api/config';

type FilterMode = 'all' | 'eu' | 'non_eu';

interface EditState {
  standard_rate: string;
  reduced_rate: string;
  reduced_rate_2: string;
  super_reduced_rate: string;
}

function RateCell({ value, className }: { value: number | null; className?: string }) {
  if (value == null) return <span className="text-slate-600 text-xs">—</span>;
  return <span className={className}>{value}%</span>;
}

export function TaxMatrixView() {
  const [items, setItems] = useState<TaxMatrixEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterMode>('all');
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditState>({ standard_rate: '', reduced_rate: '', reduced_rate_2: '', super_reduced_rate: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      setItems(await configApi.listTaxMatrix());
    } catch {
      setMsg({ text: 'Erro ao carregar tabela de IVA.', ok: false });
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (item: TaxMatrixEntry) => {
    setEditingCode(item.country_code);
    setEdit({
      standard_rate:     String(item.standard_rate ?? ''),
      reduced_rate:      item.reduced_rate != null ? String(item.reduced_rate) : '',
      reduced_rate_2:    item.reduced_rate_2 != null ? String(item.reduced_rate_2) : '',
      super_reduced_rate: item.super_reduced_rate != null ? String(item.super_reduced_rate) : '',
    });
    setMsg(null);
  };

  const saveEdit = async (code: string) => {
    const std = parseFloat(edit.standard_rate);
    if (isNaN(std) || std < 0) { setMsg({ text: 'Taxa Normal inválida.', ok: false }); return; }
    setSaving(true);
    try {
      await configApi.updateTaxMatrix(code, {
        standard_rate:     std,
        reduced_rate:      edit.reduced_rate     !== '' ? parseFloat(edit.reduced_rate)     : null,
        reduced_rate_2:    edit.reduced_rate_2   !== '' ? parseFloat(edit.reduced_rate_2)   : null,
        super_reduced_rate: edit.super_reduced_rate !== '' ? parseFloat(edit.super_reduced_rate) : null,
      });
      setItems(prev => prev.map(i => i.country_code === code ? {
        ...i,
        standard_rate:     std,
        reduced_rate:      edit.reduced_rate     !== '' ? parseFloat(edit.reduced_rate)     : null,
        reduced_rate_2:    edit.reduced_rate_2   !== '' ? parseFloat(edit.reduced_rate_2)   : null,
        super_reduced_rate: edit.super_reduced_rate !== '' ? parseFloat(edit.super_reduced_rate) : null,
      } : i));
      setEditingCode(null);
      setMsg({ text: `${code} guardado.`, ok: true });
    } catch {
      setMsg({ text: 'Erro ao guardar.', ok: false });
    } finally {
      setSaving(false);
    }
  };

  const rateInput = (key: keyof EditState, placeholder: string) => (
    <input
      type="number"
      value={edit[key]}
      onChange={e => setEdit(prev => ({ ...prev, [key]: e.target.value }))}
      placeholder={placeholder}
      step="0.1"
      min="0"
      className="w-16 text-right bg-slate-700 border border-sky-500 rounded px-1.5 py-1 text-white text-xs focus:outline-none"
    />
  );

  const filtered = items.filter(i => {
    if (filter === 'eu') return i.is_eu;
    if (filter === 'non_eu') return !i.is_eu;
    return true;
  });

  const euCount = items.filter(i => i.is_eu).length;

  return (
    <div className="mt-8 space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Globe className="w-6 h-6 text-sky-400" />
          Tabela de IVA / OSS — 2025
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Taxas oficiais actualizadas da Comissão Europeia. Fonte: Tax Foundation / European Commission TEDB.
          Clique em <Pencil className="inline w-3 h-3" /> para corrigir uma taxa.
        </p>
      </div>

      {msg && (
        <div className={`px-4 py-2 rounded text-sm flex items-center gap-2 ${msg.ok ? 'bg-emerald-900/30 text-emerald-400' : 'bg-red-900/30 text-red-400'}`}>
          {msg.ok ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
          {msg.text}
        </div>
      )}

      {/* KPI cards */}
      {(() => {
        const euItems = items.filter(i => i.is_eu);
        const rates = euItems.map(i => i.standard_rate);
        const maxRate = rates.length > 0 ? Math.max(...rates) : null;
        const minRate = rates.length > 0 ? Math.min(...rates) : null;
        const kpis = [
          { label: 'Países UE', value: euCount > 0 ? String(euCount) : '—', color: 'text-emerald-400' },
          { label: 'Fora UE', value: items.length > 0 ? String(items.length - euCount) : '—', color: 'text-slate-400' },
          { label: 'Taxa mais alta (UE)', value: maxRate != null ? `${maxRate}%` : '—', color: 'text-red-400' },
          { label: 'Taxa mais baixa (UE)', value: minRate != null ? `${minRate}%` : '—', color: 'text-emerald-400' },
        ];
        return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map(k => (
          <Card key={k.label} className="bg-slate-800/50">
            <CardContent className="pt-4">
              <p className="text-xs text-slate-400 mb-1">{k.label}</p>
              <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
        );
      })()}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="w-4 h-4" />
              {filtered.length} países
            </CardTitle>
            <div className="flex items-center gap-1">
              {(['all', 'eu', 'non_eu'] as FilterMode[]).map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                    filter === f ? 'bg-sky-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {f === 'all' ? 'Todos' : f === 'eu' ? '🇪🇺 UE (OSS)' : 'Fora UE'}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin mr-2" /> A carregar...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700 bg-slate-800/60">
                    <th className="text-left px-4 py-3 text-slate-400 font-medium w-16">Cód.</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">País</th>
                    <th className="text-right px-4 py-3 text-slate-400 font-medium">Normal</th>
                    <th className="text-right px-4 py-3 text-slate-400 font-medium">Reduzida 1</th>
                    <th className="text-right px-4 py-3 text-slate-400 font-medium">Reduzida 2</th>
                    <th className="text-right px-4 py-3 text-slate-400 font-medium">Super-Red.</th>
                    <th className="text-center px-4 py-3 text-slate-400 font-medium">UE</th>
                    <th className="text-center px-4 py-3 text-slate-400 font-medium w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item, idx) => {
                    const isEditing = editingCode === item.country_code;
                    return (
                      <tr
                        key={item.country_code}
                        className={`border-b border-slate-800 transition-colors ${
                          isEditing
                            ? 'bg-sky-950/40 border-sky-800'
                            : idx % 2 === 0 ? 'bg-slate-900' : 'bg-slate-900/40'
                        } hover:bg-slate-800/30`}
                      >
                        {/* Código */}
                        <td className="px-4 py-2.5">
                          <span className="font-mono font-bold text-sky-400 text-xs bg-sky-950/60 px-2 py-0.5 rounded">
                            {item.country_code}
                          </span>
                        </td>

                        {/* Nome */}
                        <td className="px-4 py-2.5 text-slate-200 font-medium">{item.country_name}</td>

                        {/* Taxa Normal */}
                        <td className="px-4 py-2.5 text-right">
                          {isEditing
                            ? rateInput('standard_rate', '0')
                            : <span className="text-amber-400 font-bold">{item.standard_rate}%</span>}
                        </td>

                        {/* Reduzida 1 */}
                        <td className="px-4 py-2.5 text-right">
                          {isEditing
                            ? rateInput('reduced_rate', '—')
                            : <RateCell value={item.reduced_rate} className="text-emerald-400" />}
                        </td>

                        {/* Reduzida 2 */}
                        <td className="px-4 py-2.5 text-right">
                          {isEditing
                            ? rateInput('reduced_rate_2', '—')
                            : <RateCell value={item.reduced_rate_2} className="text-teal-400" />}
                        </td>

                        {/* Super-reduzida */}
                        <td className="px-4 py-2.5 text-right">
                          {isEditing
                            ? rateInput('super_reduced_rate', '—')
                            : <RateCell value={item.super_reduced_rate} className="text-purple-400" />}
                        </td>

                        {/* UE badge */}
                        <td className="px-4 py-2.5 text-center">
                          {item.is_eu
                            ? <span className="text-xs bg-emerald-900/50 text-emerald-400 px-2 py-0.5 rounded font-medium">OSS</span>
                            : <span className="text-xs text-slate-600">—</span>}
                        </td>

                        {/* Ações */}
                        <td className="px-4 py-2.5 text-center">
                          {isEditing ? (
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => saveEdit(item.country_code)}
                                disabled={saving}
                                className="p-1.5 rounded bg-emerald-700 text-white hover:bg-emerald-600 disabled:opacity-40"
                                title="Guardar"
                              >
                                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingCode(null)}
                                className="p-1.5 rounded bg-slate-600 text-white hover:bg-slate-500"
                                title="Cancelar"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => startEdit(item)}
                              className="p-1 rounded text-slate-500 hover:text-sky-400 hover:bg-slate-700 transition-colors"
                              title="Editar taxas"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Legenda */}
      <Card className="bg-slate-800/20 border-slate-700/50">
        <CardContent className="pt-4 flex gap-4 flex-wrap text-xs text-slate-500">
          <div className="flex items-center gap-1.5"><Info className="w-3.5 h-3.5 text-sky-400" /><span className="text-sky-400 font-medium">OSS</span> = One Stop Shop (declaração única de IVA para vendas B2C noutros países UE)</div>
          <div className="flex items-center gap-1.5"><span className="text-amber-400 font-bold">Normal</span> = aplicável à maioria dos produtos electrónicos</div>
          <div className="flex items-center gap-1.5"><span className="text-emerald-400">Reduzida 1</span> = bens essenciais (alimentos, medicamentos, livros)</div>
          <div className="flex items-center gap-1.5"><span className="text-purple-400">Super-Red.</span> = apenas em categorias muito específicas (impressa, alguns alimentos)</div>
        </CardContent>
      </Card>
    </div>
  );
}
