'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText, Plus, Download, X, AlertCircle, CheckCircle, Key,
  RefreshCw, ChevronDown, Eye, Trash2, FileX, Shield,
} from 'lucide-react';
import {
  ATDocument, ATDocumentListItem, ATSeries, SAFTHistoryEntry,
  LinhaDocumento, TipoDocAT,
  listDocuments, emitDocument, cancelDocument, getDocument,
  getPdfUrl, listSeries, ensureSeries, updateAtcudCode,
  generateRsaKeys, getRsaStatus,
  exportSAFT, getSAFTHistory,
} from '@/lib/api/atInvoices';
import { useApp } from '@/context/AppContext';

// ── Helpers ─────────────────────────────────────────────────────────────────

const TIPOS: Record<TipoDocAT, string> = {
  FT: 'Fatura', FS: 'Fatura Simplificada', NC: 'Nota de Crédito',
  ND: 'Nota de Débito', RC: 'Recibo',
};
const TIPOS_LIST: TipoDocAT[] = ['FT', 'FS', 'NC', 'ND', 'RC'];

function fmt(v: number) { return v.toFixed(2).replace('.', ','); }
function fmtDate(d: string) { return d ? d.slice(0, 10) : '—'; }

function StatusBadge({ status }: { status: string }) {
  if (status === 'anulado')
    return <span className="px-2 py-0.5 text-xs rounded-full bg-red-900/60 text-red-300">Anulado</span>;
  return <span className="px-2 py-0.5 text-xs rounded-full bg-emerald-900/60 text-emerald-300">Emitido</span>;
}

// ── Tab Documentos ───────────────────────────────────────────────────────────

function TabDocumentos({ empresaId }: { empresaId: number }) {
  const [items, setItems] = useState<ATDocumentListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState({ tipo: '', status: '', dataI: '', dataF: '' });
  const [offset, setOffset] = useState(0);
  const [selectedDoc, setSelectedDoc] = useState<ATDocument | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [cancelModal, setCancelModal] = useState<{ id: number; num: string } | null>(null);
  const [cancelMotivo, setCancelMotivo] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const LIMIT = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listDocuments({
        empresa_id: empresaId,
        tipo_doc: filter.tipo || undefined,
        status: filter.status || undefined,
        data_inicio: filter.dataI || undefined,
        data_fim: filter.dataF || undefined,
        limit: LIMIT,
        offset,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [empresaId, filter, offset]);

  useEffect(() => { load(); }, [load]);

  const openDrawer = async (id: number) => {
    const doc = await getDocument(id);
    setSelectedDoc(doc);
    setDrawerOpen(true);
  };

  const doCancel = async () => {
    if (!cancelModal) return;
    setCancelling(true);
    try {
      await cancelDocument(cancelModal.id, cancelMotivo);
      setCancelModal(null);
      setCancelMotivo('');
      load();
    } catch { /* ignore */ }
    finally { setCancelling(false); }
  };

  return (
    <div className="space-y-3">
      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-end">
        <select
          className="bg-zinc-800 border border-zinc-700 text-sm text-white rounded px-2 py-1.5"
          value={filter.tipo}
          onChange={e => { setFilter(f => ({ ...f, tipo: e.target.value })); setOffset(0); }}
        >
          <option value="">Todos os tipos</option>
          {TIPOS_LIST.map(t => <option key={t} value={t}>{t} – {TIPOS[t]}</option>)}
        </select>
        <select
          className="bg-zinc-800 border border-zinc-700 text-sm text-white rounded px-2 py-1.5"
          value={filter.status}
          onChange={e => { setFilter(f => ({ ...f, status: e.target.value })); setOffset(0); }}
        >
          <option value="">Todos os status</option>
          <option value="emitido">Emitido</option>
          <option value="anulado">Anulado</option>
        </select>
        <input type="date" className="bg-zinc-800 border border-zinc-700 text-sm text-white rounded px-2 py-1.5"
          value={filter.dataI} onChange={e => { setFilter(f => ({ ...f, dataI: e.target.value })); setOffset(0); }} />
        <span className="text-zinc-500 text-sm">→</span>
        <input type="date" className="bg-zinc-800 border border-zinc-700 text-sm text-white rounded px-2 py-1.5"
          value={filter.dataF} onChange={e => { setFilter(f => ({ ...f, dataF: e.target.value })); setOffset(0); }} />
        <button onClick={load} className="flex items-center gap-1 px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white text-sm rounded">
          <RefreshCw className="w-3.5 h-3.5" /> Actualizar
        </button>
        <span className="text-zinc-400 text-sm ml-auto">{total} documento{total !== 1 ? 's' : ''}</span>
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto rounded-lg border border-zinc-800">
        <table className="w-full text-sm text-left text-zinc-300">
          <thead className="text-xs text-zinc-400 uppercase bg-zinc-900">
            <tr>
              <th className="px-3 py-2">Nº Documento</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Data</th>
              <th className="px-3 py-2">Cliente</th>
              <th className="px-3 py-2">ATCUD</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {loading ? (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-zinc-500">A carregar…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-zinc-500">Nenhum documento encontrado.</td></tr>
            ) : items.map(doc => (
              <tr key={doc.id}
                className={`hover:bg-zinc-800/60 cursor-pointer ${doc.status === 'anulado' ? 'opacity-50' : ''}`}
                onClick={() => openDrawer(doc.id)}
              >
                <td className="px-3 py-2 font-mono text-amber-400">{doc.numero_documento}</td>
                <td className="px-3 py-2">
                  <span className="px-2 py-0.5 text-xs rounded bg-zinc-700">{doc.tipo_doc}</span>
                </td>
                <td className="px-3 py-2">{fmtDate(doc.data_emissao)}</td>
                <td className="px-3 py-2">{doc.customer_name || <span className="text-zinc-500">Consumidor Final</span>}</td>
                <td className="px-3 py-2 font-mono text-xs text-zinc-400">{doc.atcud || '—'}</td>
                <td className="px-3 py-2 text-right font-semibold">{fmt(doc.total_liquido)} €</td>
                <td className="px-3 py-2"><StatusBadge status={doc.status} /></td>
                <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center gap-1">
                    <a href={getPdfUrl(doc.id)} target="_blank" rel="noreferrer"
                      className="p-1 rounded hover:bg-amber-800/50 text-amber-400 tooltip" title="Ver PDF">
                      <Download className="w-4 h-4" />
                    </a>
                    {doc.status !== 'anulado' && (
                      <button onClick={() => setCancelModal({ id: doc.id, num: doc.numero_documento })}
                        className="p-1 rounded hover:bg-red-900/50 text-red-400" title="Anular">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      {total > LIMIT && (
        <div className="flex gap-2 justify-center">
          <button disabled={offset === 0}
            onClick={() => setOffset(o => Math.max(0, o - LIMIT))}
            className="px-3 py-1 text-sm bg-zinc-800 hover:bg-zinc-700 rounded disabled:opacity-40">← Anterior</button>
          <span className="text-sm text-zinc-400 py-1">{Math.floor(offset / LIMIT) + 1} / {Math.ceil(total / LIMIT)}</span>
          <button disabled={offset + LIMIT >= total}
            onClick={() => setOffset(o => o + LIMIT)}
            className="px-3 py-1 text-sm bg-zinc-800 hover:bg-zinc-700 rounded disabled:opacity-40">Seguinte →</button>
        </div>
      )}

      {/* Drawer detalhe */}
      {drawerOpen && selectedDoc && (
        <div className="fixed inset-0 z-50 flex" onClick={() => setDrawerOpen(false)}>
          <div className="flex-1 bg-black/50" />
          <div className="w-[480px] bg-zinc-900 border-l border-zinc-700 overflow-y-auto p-5 space-y-4"
            onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start">
              <div>
                <div className="text-lg font-bold text-amber-400">{selectedDoc.numero_documento}</div>
                <div className="text-sm text-zinc-400">{TIPOS[selectedDoc.tipo_doc]} · {fmtDate(selectedDoc.data_emissao)}</div>
              </div>
              <button onClick={() => setDrawerOpen(false)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-zinc-400">ATCUD</div>
              <div className="font-mono text-xs">{selectedDoc.atcud || '—'}</div>
              <div className="text-zinc-400">Hash (4 chars)</div>
              <div className="font-mono text-xs">{selectedDoc.hash_4chars || '—'}</div>
              <div className="text-zinc-400">Status</div>
              <div><StatusBadge status={selectedDoc.status} /></div>
            </div>

            {/* QR Code */}
            {selectedDoc.qrcode_b64 && (
              <div className="flex flex-col items-center gap-2">
                <div className="text-xs text-zinc-400">QR Code AT</div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={selectedDoc.qrcode_b64} alt="QR Code AT" className="w-36 h-36 rounded" />
              </div>
            )}

            {/* Linhas */}
            {Array.isArray(selectedDoc.linhas) && selectedDoc.linhas.length > 0 && (
              <div>
                <div className="text-xs text-zinc-400 mb-1">Linhas</div>
                <table className="w-full text-xs text-zinc-300">
                  <thead><tr className="text-zinc-500">
                    <th className="text-left pb-1">Descrição</th>
                    <th className="text-right pb-1">Qty</th>
                    <th className="text-right pb-1">Pr.</th>
                    <th className="text-right pb-1">IVA</th>
                  </tr></thead>
                  <tbody>
                    {selectedDoc.linhas.map((l, i) => (
                      <tr key={i} className="border-t border-zinc-800">
                        <td className="py-0.5">{l.descricao}</td>
                        <td className="text-right py-0.5">{l.quantidade}</td>
                        <td className="text-right py-0.5">{fmt(l.preco_unitario)} €</td>
                        <td className="text-right py-0.5">{l.taxa_iva}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Totais */}
            <div className="border-t border-zinc-700 pt-3 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-zinc-400">Subtotal</span><span>{fmt(selectedDoc.total_bruto)} €</span></div>
              <div className="flex justify-between"><span className="text-zinc-400">IVA</span><span>{fmt(selectedDoc.total_iva)} €</span></div>
              <div className="flex justify-between font-bold text-base border-t border-zinc-700 pt-1 mt-1">
                <span>Total</span><span className="text-amber-400">{fmt(selectedDoc.total_liquido)} €</span>
              </div>
            </div>

            {/* PDF */}
            <a href={getPdfUrl(selectedDoc.id)} target="_blank" rel="noreferrer"
              className="flex items-center justify-center gap-2 w-full py-2 bg-amber-700 hover:bg-amber-600 text-white rounded text-sm font-medium">
              <Download className="w-4 h-4" /> Download PDF
            </a>
          </div>
        </div>
      )}

      {/* Modal anular */}
      {cancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-5 w-96 space-y-3">
            <div className="flex items-center gap-2 text-red-400">
              <AlertCircle className="w-5 h-5" />
              <span className="font-semibold">Anular {cancelModal.num}</span>
            </div>
            <p className="text-sm text-zinc-400">O documento não será eliminado — será marcado como anulado (conforme AT).</p>
            <textarea
              className="w-full bg-zinc-800 border border-zinc-700 rounded p-2 text-sm text-white resize-none"
              rows={3} placeholder="Motivo de anulação (obrigatório)"
              value={cancelMotivo} onChange={e => setCancelMotivo(e.target.value)}
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setCancelModal(null)} className="px-3 py-1.5 text-sm bg-zinc-700 hover:bg-zinc-600 rounded">Cancelar</button>
              <button
                onClick={doCancel}
                disabled={!cancelMotivo.trim() || cancelling}
                className="px-3 py-1.5 text-sm bg-red-700 hover:bg-red-600 disabled:opacity-50 rounded text-white"
              >
                {cancelling ? 'A anular…' : 'Anular Documento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab Emitir ────────────────────────────────────────────────────────────────

const EMPTY_LINHA: LinhaDocumento = { descricao: '', quantidade: 1, preco_unitario: 0, taxa_iva: 23 };

function TabEmitir({ empresaId }: { empresaId: number }) {
  const [tipoDoc, setTipoDoc] = useState<TipoDocAT>('FT');
  const [cliente, setCliente] = useState({ nome: '', nif: '', pais: 'PT', morada: '' });
  const [linhas, setLinhas] = useState<LinhaDocumento[]>([{ ...EMPTY_LINHA }]);
  const [referenciaDoc, setReferenciaDoc] = useState('');
  const [notas, setNotas] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ numero: string; id: number } | null>(null);
  const [error, setError] = useState('');

  const totals = linhas.reduce(
    (acc, l) => {
      const base = l.quantidade * l.preco_unitario;
      const iva = base * l.taxa_iva / 100;
      return { bruto: acc.bruto + base, iva: acc.iva + iva };
    },
    { bruto: 0, iva: 0 },
  );

  const updateLinha = (i: number, field: keyof LinhaDocumento, val: string | number) => {
    setLinhas(ls => ls.map((l, idx) => idx === i ? { ...l, [field]: val } : l));
  };
  const addLinha = () => setLinhas(ls => [...ls, { ...EMPTY_LINHA }]);
  const removeLinha = (i: number) => setLinhas(ls => ls.filter((_, idx) => idx !== i));

  const submit = async () => {
    if (linhas.some(l => !l.descricao.trim() || l.preco_unitario <= 0)) {
      setError('Preencha a descrição e preço de todas as linhas.'); return;
    }
    setSubmitting(true); setError('');
    try {
      const doc = await emitDocument({
        empresa_id: empresaId,
        tipo_doc: tipoDoc,
        cliente: { nome: cliente.nome || undefined, nif: cliente.nif || undefined, pais: cliente.pais, morada: cliente.morada || undefined },
        linhas,
        referencia_doc: referenciaDoc || undefined,
        notas: notas || undefined,
      });
      setSuccess({ numero: doc.numero_documento, id: doc.id });
      setLinhas([{ ...EMPTY_LINHA }]);
      setCliente({ nome: '', nif: '', pais: 'PT', morada: '' });
    } catch (e: unknown) {
      setError((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Erro ao emitir documento.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-5">
      {success && (
        <div className="flex items-center justify-between gap-3 p-3 bg-emerald-900/30 border border-emerald-700 rounded-lg">
          <div className="flex items-center gap-2 text-emerald-400">
            <CheckCircle className="w-5 h-5" />
            <span className="font-semibold">{success.numero} emitido com sucesso!</span>
          </div>
          <div className="flex gap-2">
            <a href={getPdfUrl(success.id)} target="_blank" rel="noreferrer"
              className="px-3 py-1 text-sm bg-amber-700 hover:bg-amber-600 text-white rounded">
              Ver PDF
            </a>
            <button onClick={() => setSuccess(null)} className="text-zinc-400 hover:text-white"><X className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-900/30 border border-red-700 rounded text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {/* Tipo */}
      <div>
        <label className="text-xs text-zinc-400 uppercase tracking-wide mb-1 block">Tipo de Documento</label>
        <div className="flex flex-wrap gap-2">
          {TIPOS_LIST.map(t => (
            <button key={t}
              onClick={() => setTipoDoc(t)}
              className={`px-3 py-1.5 text-sm rounded border transition-colors ${tipoDoc === t ? 'bg-amber-700 border-amber-600 text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-500'}`}
            >
              {t} — {TIPOS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Cliente */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Nome / Empresa</label>
          <input className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white"
            placeholder="Consumidor Final" value={cliente.nome} onChange={e => setCliente(c => ({ ...c, nome: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs text-zinc-400 mb-1 block">NIF</label>
          <input className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white font-mono"
            placeholder="999999990" value={cliente.nif} onChange={e => setCliente(c => ({ ...c, nif: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs text-zinc-400 mb-1 block">País</label>
          <input className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white"
            placeholder="PT" maxLength={2} value={cliente.pais} onChange={e => setCliente(c => ({ ...c, pais: e.target.value.toUpperCase() }))} />
        </div>
        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Morada</label>
          <input className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white"
            placeholder="Rua, Cidade" value={cliente.morada} onChange={e => setCliente(c => ({ ...c, morada: e.target.value }))} />
        </div>
      </div>

      {/* NC/ND ref */}
      {(tipoDoc === 'NC' || tipoDoc === 'ND') && (
        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Documento de Referência</label>
          <input className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white font-mono"
            placeholder="FT25A/1" value={referenciaDoc} onChange={e => setReferenciaDoc(e.target.value)} />
        </div>
      )}

      {/* Linhas */}
      <div>
        <label className="text-xs text-zinc-400 uppercase tracking-wide mb-2 block">Linhas do Documento</label>
        <table className="w-full text-sm mb-2">
          <thead><tr className="text-xs text-zinc-500">
            <th className="text-left pb-1 pr-2">Descrição</th>
            <th className="text-right pb-1 pr-2 w-16">Qty</th>
            <th className="text-right pb-1 pr-2 w-24">Preço Un.</th>
            <th className="text-right pb-1 pr-2 w-20">IVA %</th>
            <th className="text-right pb-1 w-24">Total</th>
            <th className="w-8"></th>
          </tr></thead>
          <tbody className="space-y-1">
            {linhas.map((l, i) => (
              <tr key={i}>
                <td className="pr-2 pb-1">
                  <input className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-white text-sm"
                    placeholder="Descrição" value={l.descricao} onChange={e => updateLinha(i, 'descricao', e.target.value)} />
                </td>
                <td className="pr-2 pb-1">
                  <input type="number" className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-white text-sm text-right"
                    min={0.01} step="0.01" value={l.quantidade} onChange={e => updateLinha(i, 'quantidade', parseFloat(e.target.value) || 1)} />
                </td>
                <td className="pr-2 pb-1">
                  <input type="number" className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-white text-sm text-right"
                    min={0} step="0.01" value={l.preco_unitario} onChange={e => updateLinha(i, 'preco_unitario', parseFloat(e.target.value) || 0)} />
                </td>
                <td className="pr-2 pb-1">
                  <select className="w-full bg-zinc-800 border border-zinc-700 rounded px-1 py-1.5 text-white text-sm"
                    value={l.taxa_iva} onChange={e => updateLinha(i, 'taxa_iva', parseFloat(e.target.value))}>
                    <option value={0}>0%</option>
                    <option value={6}>6%</option>
                    <option value={13}>13%</option>
                    <option value={23}>23%</option>
                  </select>
                </td>
                <td className="text-right pb-1 text-zinc-300">
                  {fmt(l.quantidade * l.preco_unitario * (1 + l.taxa_iva / 100))} €
                </td>
                <td className="pb-1 pl-1">
                  {linhas.length > 1 && (
                    <button onClick={() => removeLinha(i)} className="text-zinc-600 hover:text-red-400 p-1">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button onClick={addLinha}
          className="flex items-center gap-1 text-sm text-amber-400 hover:text-amber-300">
          <Plus className="w-4 h-4" /> Adicionar linha
        </button>
      </div>

      {/* Preview totais */}
      <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4 space-y-1 text-sm">
        <div className="flex justify-between text-zinc-400"><span>Subtotal (s/IVA)</span><span>{fmt(totals.bruto)} €</span></div>
        <div className="flex justify-between text-zinc-400"><span>IVA</span><span>{fmt(totals.iva)} €</span></div>
        <div className="flex justify-between font-bold text-base border-t border-zinc-600 pt-1 mt-1">
          <span>Total c/IVA</span>
          <span className="text-amber-400">{fmt(totals.bruto + totals.iva)} €</span>
        </div>
      </div>

      {/* Notas */}
      <div>
        <label className="text-xs text-zinc-400 mb-1 block">Notas</label>
        <textarea className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white resize-none"
          rows={2} placeholder="Observações opcionais" value={notas} onChange={e => setNotas(e.target.value)} />
      </div>

      <button
        onClick={submit}
        disabled={submitting}
        className="flex items-center justify-center gap-2 w-full py-3 bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors"
      >
        <FileText className="w-5 h-5" />
        {submitting ? 'A emitir…' : `Emitir ${tipoDoc} — ${TIPOS[tipoDoc]}`}
      </button>
    </div>
  );
}

// ── Tab Séries & Config ──────────────────────────────────────────────────────

function TabSeries({ empresaId }: { empresaId: number }) {
  const [series, setSeries] = useState<ATSeries[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasKeys, setHasKeys] = useState(false);
  const [generatingKeys, setGeneratingKeys] = useState(false);
  const [publicKey, setPublicKey] = useState('');
  const [atcudEdits, setAtcudEdits] = useState<Record<number, string>>({});
  const [savingAtcud, setSavingAtcud] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [s, rsaStatus] = await Promise.all([
        listSeries(empresaId),
        getRsaStatus(empresaId).catch(() => ({ has_keypair: false, empresa_id: empresaId })),
      ]);
      setSeries(s);
      setHasKeys(rsaStatus.has_keypair);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [empresaId]);

  const generateKeys = async () => {
    setGeneratingKeys(true);
    try {
      const res = await generateRsaKeys(empresaId);
      setHasKeys(true);
      setPublicKey(res.public_key_pem);
    } catch { /* ignore */ }
    finally { setGeneratingKeys(false); }
  };

  const ensureAllSeries = async () => {
    const ano = new Date().getFullYear();
    for (const t of TIPOS_LIST) {
      await ensureSeries(empresaId, t, ano).catch(() => {/* ignore */});
    }
    load();
  };

  const saveAtcud = async (serieId: number) => {
    const code = atcudEdits[serieId];
    if (!code) return;
    setSavingAtcud(serieId);
    try {
      await updateAtcudCode(serieId, code);
      setAtcudEdits(e => { const n = { ...e }; delete n[serieId]; return n; });
      load();
    } catch { /* ignore */ }
    finally { setSavingAtcud(null); }
  };

  if (loading) return <div className="text-zinc-500 text-sm">A carregar…</div>;

  return (
    <div className="space-y-5 max-w-2xl">
      {/* RSA */}
      <div className={`p-4 rounded-lg border ${hasKeys ? 'border-emerald-700 bg-emerald-900/20' : 'border-amber-700 bg-amber-900/20'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {hasKeys ? <CheckCircle className="w-5 h-5 text-emerald-400" /> : <Shield className="w-5 h-5 text-amber-400" />}
            <span className={`font-semibold ${hasKeys ? 'text-emerald-400' : 'text-amber-400'}`}>
              {hasKeys ? 'Par RSA Gerado' : 'Par RSA Não Configurado'}
            </span>
          </div>
          <button
            onClick={generateKeys}
            disabled={generatingKeys}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-white rounded"
          >
            <Key className="w-4 h-4" />
            {generatingKeys ? 'A gerar…' : hasKeys ? 'Regenerar Chaves RSA' : 'Gerar Chaves RSA'}
          </button>
        </div>
        {!hasKeys && (
          <p className="text-sm text-amber-300/80 mt-2">
            Sem par RSA, os documentos são emitidos sem hash AT. Gere as chaves antes de emitir documentos.
          </p>
        )}
        {publicKey && (
          <div className="mt-3">
            <div className="text-xs text-zinc-400 mb-1">Chave Pública (submeter à AT para certificação):</div>
            <textarea
              readOnly
              className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-xs font-mono text-zinc-300 resize-none"
              rows={6}
              value={publicKey}
            />
          </div>
        )}
      </div>

      {/* Séries */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-zinc-300">Séries Activas</h3>
          <button onClick={ensureAllSeries} className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" /> Criar todas as séries {new Date().getFullYear()}
          </button>
        </div>
        {series.length === 0 ? (
          <div className="text-sm text-zinc-500">Nenhuma série criada. Clique em "Criar todas as séries" para começar.</div>
        ) : (
          <div className="grid gap-3">
            {series.map(s => (
              <div key={s.id} className="bg-zinc-800/60 border border-zinc-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 text-xs rounded bg-amber-800 text-amber-200 font-mono">{s.doc_type || s.tipo_doc}</span>
                    <span className="font-mono text-sm text-white">{s.prefix}</span>
                    <span className="text-zinc-500 text-xs">· {s.year}</span>
                  </div>
                  <div className="text-sm text-zinc-400">
                    Próximo: <span className="font-mono text-white">{s.proximo_numero}</span>
                    {s.total_docs > 0 && <span className="ml-2 text-zinc-500">({s.total_docs} docs)</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-zinc-400 shrink-0">Código AT (ATCUD):</label>
                  <input
                    className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm font-mono text-white"
                    placeholder={s.codigo_validacao_at || '0'}
                    value={atcudEdits[s.id] ?? s.codigo_validacao_at ?? '0'}
                    onChange={e => setAtcudEdits(ed => ({ ...ed, [s.id]: e.target.value }))}
                  />
                  {atcudEdits[s.id] !== undefined && (
                    <button
                      onClick={() => saveAtcud(s.id)}
                      disabled={savingAtcud === s.id}
                      className="px-2 py-1 text-xs bg-amber-700 hover:bg-amber-600 text-white rounded disabled:opacity-50"
                    >
                      {savingAtcud === s.id ? '…' : 'Guardar'}
                    </button>
                  )}
                </div>
                <p className="text-xs text-zinc-500 mt-1">
                  ATCUD: {s.codigo_validacao_at || '0'} — Em pré-certificação use &quot;0&quot;. Após certificação AT insira o código real.
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tab SAF-T ────────────────────────────────────────────────────────────────

function TabSAFT({ empresaId }: { empresaId: number }) {
  const hoje = new Date();
  const [dataI, setDataI] = useState(`${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`);
  const [dataF, setDataF] = useState(hoje.toISOString().slice(0, 10));
  const [exporting, setExporting] = useState(false);
  const [history, setHistory] = useState<SAFTHistoryEntry[]>([]);

  const loadHistory = async () => {
    try { setHistory(await getSAFTHistory(empresaId)); } catch { /* ignore */ }
  };

  useEffect(() => { loadHistory(); }, [empresaId]);

  const doExport = async () => {
    setExporting(true);
    try {
      const blob = await exportSAFT(empresaId, dataI, dataF);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SAFT_PT_${empresaId}_${dataI}_${dataF}.xml`;
      a.click();
      URL.revokeObjectURL(url);
      loadHistory();
    } catch { /* ignore */ }
    finally { setExporting(false); }
  };

  return (
    <div className="max-w-xl space-y-5">
      <div className="bg-zinc-800/60 border border-zinc-700 rounded-lg p-5 space-y-4">
        <h3 className="font-semibold text-zinc-200 flex items-center gap-2">
          <FileX className="w-5 h-5 text-amber-400" /> Exportar SAF-T PT v1.04
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Data Início</label>
            <input type="date" className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-2 text-sm text-white"
              value={dataI} onChange={e => setDataI(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Data Fim</label>
            <input type="date" className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-2 text-sm text-white"
              value={dataF} onChange={e => setDataF(e.target.value)} />
          </div>
        </div>
        <button
          onClick={doExport}
          disabled={exporting || !dataI || !dataF}
          className="flex items-center justify-center gap-2 w-full py-3 bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold rounded-lg"
        >
          <Download className="w-5 h-5" />
          {exporting ? 'A exportar…' : 'Exportar SAF-T PT XML'}
        </button>
        <p className="text-xs text-zinc-500">
          O ficheiro XML SAF-T v1.04_01 pode ser validado no portal da AT ou importado em software contabilístico.
        </p>
      </div>

      {history.length > 0 && (
        <div>
          <h4 className="text-sm text-zinc-400 mb-2">Histórico de Exportações</h4>
          <div className="space-y-2">
            {history.map(h => (
              <div key={h.id} className="flex items-center justify-between text-sm bg-zinc-800/40 border border-zinc-800 rounded px-3 py-2">
                <div>
                  <span className="text-zinc-300">{h.periodo_inicio} → {h.periodo_fim}</span>
                  <span className="text-zinc-500 ml-2">({h.num_documentos} docs)</span>
                </div>
                <span className="text-zinc-500 text-xs">{fmtDate(h.exported_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main View ────────────────────────────────────────────────────────────────

type Tab = 'documentos' | 'emitir' | 'series' | 'saft';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'documentos', label: 'Documentos', icon: <FileText className="w-4 h-4" /> },
  { id: 'emitir', label: 'Emitir', icon: <Plus className="w-4 h-4" /> },
  { id: 'series', label: 'Séries & Config', icon: <Key className="w-4 h-4" /> },
  { id: 'saft', label: 'SAF-T PT', icon: <Download className="w-4 h-4" /> },
];

export default function FaturacaoView() {
  const { empresaSelecionada } = useApp();
  const [tab, setTab] = useState<Tab>('documentos');

  const empresaId = empresaSelecionada?.id ?? 1;

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-white">
      {/* Header */}
      <div className="px-6 pt-5 pb-0 border-b border-zinc-800">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-amber-700/30">
            <FileText className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Faturação AT</h1>
            <p className="text-xs text-zinc-400">Documentos AT-compliant — Hash RSA · ATCUD · QR Code · SAF-T PT</p>
          </div>
          {empresaSelecionada && (
            <span className="ml-auto text-xs text-zinc-500 bg-zinc-800 px-2 py-1 rounded">{empresaSelecionada.nome}</span>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-0">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-amber-500 text-amber-400'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {tab === 'documentos' && <TabDocumentos empresaId={empresaId} />}
        {tab === 'emitir' && <TabEmitir empresaId={empresaId} />}
        {tab === 'series' && <TabSeries empresaId={empresaId} />}
        {tab === 'saft' && <TabSAFT empresaId={empresaId} />}
      </div>
    </div>
  );
}
