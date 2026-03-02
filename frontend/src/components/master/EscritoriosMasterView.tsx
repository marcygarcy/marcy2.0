'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { MapPin, Loader2 } from 'lucide-react';
import { empresasApi, type Empresa } from '@/lib/api/empresas';
import { suppliersApi, type OfficeLocation } from '@/lib/api/suppliers';

type OfficeRow = OfficeLocation & { contacto_nome?: string | null; contacto_tel?: string | null };

export function EscritoriosMasterView() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresaFilterId, setEmpresaFilterId] = useState<number | ''>('');
  const [list, setList] = useState<OfficeRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    empresasApi.getAll().then((data) => setEmpresas(Array.isArray(data) ? data : [])).catch(() => setEmpresas([]));
  }, []);

  useEffect(() => {
    setLoading(true);
    suppliersApi.listOffices(empresaFilterId === '' ? undefined : Number(empresaFilterId))
      .then((r) => setList((r.items || []) as OfficeRow[]))
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, [empresaFilterId]);

  return (
    <div className="mt-8 space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Dados Mestres — Escritórios</h1>
        <p className="text-slate-400 text-sm mt-1">Listagem de escritórios (Lisboa, Huelva, Frankfurt, Paris e outros). Filtro opcional por empresa.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Escritórios
          </CardTitle>
          <div className="mt-2">
            <label className="block text-xs text-slate-400 mb-1">Filtrar por empresa</label>
            <select
              value={empresaFilterId === '' ? '' : String(empresaFilterId)}
              onChange={(e) => setEmpresaFilterId(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full max-w-xs bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm"
            >
              <option value="">Todas</option>
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>{e.nome}</option>
              ))}
            </select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : list.length === 0 ? (
            <p className="text-slate-500 text-sm py-8">Nenhum escritório encontrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-slate-700 text-slate-400">
                    <th className="py-2 px-3 font-medium">Designação</th>
                    <th className="py-2 px-3 font-medium">Morada</th>
                    <th className="py-2 px-3 font-medium">C.P. / Localidade</th>
                    <th className="py-2 px-3 font-medium">País</th>
                    <th className="py-2 px-3 font-medium">Contacto</th>
                    <th className="py-2 px-3 font-medium">Ativo</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((o) => (
                    <tr key={o.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                      <td className="py-2 px-3 text-white font-medium">{o.designacao}</td>
                      <td className="py-2 px-3 text-slate-300">{o.morada ?? '—'}</td>
                      <td className="py-2 px-3 text-slate-300">
                        {[o.codigo_postal, o.localidade].filter(Boolean).join(' ') || '—'}
                      </td>
                      <td className="py-2 px-3 text-slate-300">{o.pais ?? '—'}</td>
                      <td className="py-2 px-3 text-slate-300">
                        {((o as OfficeRow).contacto_nome || (o as OfficeRow).contacto_tel)
                          ? [(o as OfficeRow).contacto_nome, (o as OfficeRow).contacto_tel].filter(Boolean).join(' · ')
                          : '—'}
                      </td>
                      <td className="py-2 px-3">
                        {o.ativo ? <span className="text-emerald-400">Sim</span> : <span className="text-slate-500">Não</span>}
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
