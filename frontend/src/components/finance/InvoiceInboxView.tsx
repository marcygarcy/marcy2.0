'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  FileText, AlertTriangle, RefreshCw, ClipboardEdit,
  X, ExternalLink,
} from 'lucide-react';
import {
  invoiceValidationApi,
  SupplierInvoice,
  InvoiceComm,
  InvoiceValidationStats,
  InvoiceStatus,
} from '@/lib/api/invoiceValidation';
import InvoiceReviewModal from './InvoiceReviewModal';

// ─── helpers ─────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  pendente_validacao: 'Pendente',
  pending: 'Pendente',
  aprovada: 'Aprovada',
  approved: 'Aprovada',
  aprovada_com_nota: 'Aprovada c/ nota',
  contestada: 'Contestada',
  em_discussao: 'Aguardar',
  anulada: 'Anulada',
};

const STATUS_COLORS: Record<string, string> = {
  pendente_validacao: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
  pending: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
  aprovada: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
  approved: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
  aprovada_com_nota: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
  contestada: 'bg-rose-500/20 text-rose-300 border border-rose-500/30',
  em_discussao: 'bg-sky-500/20 text-sky-300 border border-sky-500/30',
  anulada: 'bg-slate-500/20 text-slate-400 border border-slate-500/30',
};

const STATUS_LABEL_FALLBACK = (s: string) => STATUS_LABELS[s] ?? s;

const STATUS_COLOR_FALLBACK = (s: string) =>
  STATUS_COLORS[s] ?? 'bg-slate-500/20 text-slate-400 border border-slate-500/30';

// Statuses que permitem acções (inclui 'pending' do schema legado)
const IS_ACTIONABLE = (s: string) =>
  s === 'pendente_validacao' || s === 'em_discussao' || s === 'pending';

const fmt = (v: number | null | undefined) =>
  v == null ? '—' : v.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('pt-PT') : '—';

// ─── Drawer (detalhe + comunicações) ─────────────────────────────────────────

function InvoiceDrawer({
  invoice,
  onClose,
  onRefresh,
}: {
  invoice: SupplierInvoice;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [comms, setComms] = useState<InvoiceComm[]>([]);
  const [detail, setDetail] = useState<SupplierInvoice | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    invoiceValidationApi.getDetail(invoice.id).then(setDetail);
    invoiceValidationApi.getComms(invoice.id).then(setComms);
  }, [invoice.id]);

  const addNote = async () => {
    if (!note.trim()) return;
    setSaving(true);
    try {
      await invoiceValidationApi.addNote(invoice.id, note.trim());
      setNote('');
      const updated = await invoiceValidationApi.getComms(invoice.id);
      setComms(updated);
    } finally {
      setSaving(false);
    }
  };

  const d = detail || invoice;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-slate-900 border-l border-slate-700 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <h2 className="font-semibold text-white text-sm">
            Fatura {d.invoice_ref} — {d.supplier_nome ?? '—'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-sm">
          {/* Info fatura */}
          <div className="bg-slate-800 rounded-lg p-4 space-y-2">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Dados da Fatura
            </h3>
            <Row label="Nº Fatura" value={d.invoice_ref} />
            <Row label="Data" value={fmtDate(d.invoice_date)} />
            <Row label="NE Fornecedor" value={d.supplier_order_id ?? '—'} />
            <Row label="Valor Fatura" value={`${fmt(d.valor_fatura)} €`} />
            <Row label="Valor PO" value={`${fmt(d.valor_po)} €`} />
            <Row
              label="Diferença"
              value={`${fmt(d.diferenca)} €`}
              cls={d.flag_divergencia ? 'text-rose-400 font-semibold' : ''}
            />
            <Row label="Estado" value={STATUS_LABELS[d.status]} />
            {d.nota_aprovacao && <Row label="Nota" value={d.nota_aprovacao} />}
            {d.aprovado_por && (
              <Row label="Aprovado por" value={`${d.aprovado_por} em ${fmtDate(d.aprovado_em)}`} />
            )}
          </div>

          {/* Info PO */}
          {d.po_referencia && (
            <div className="bg-slate-800 rounded-lg p-4 space-y-2">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Purchase Order
              </h3>
              <Row label="Referência" value={d.po_referencia} />
              <Row label="Data" value={fmtDate(d.po_data)} />
              <Row label="Total" value={`${fmt(d.po_total)} €`} />
              <Row label="Estado" value={d.po_estado ?? '—'} />
            </div>
          )}

          {/* PDF */}
          {d.invoice_pdf_url && (
            <a
              href={d.invoice_pdf_url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 text-sky-400 hover:text-sky-300 text-xs"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Ver PDF da fatura
            </a>
          )}

          {/* Comunicações */}
          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Histórico de Comunicações
            </h3>
            {comms.length === 0 ? (
              <p className="text-slate-500 text-xs">Nenhuma comunicação registada.</p>
            ) : (
              <div className="space-y-3">
                {comms.map((c) => (
                  <div
                    key={c.id}
                    className="bg-slate-800 rounded p-3 space-y-1 border-l-2 border-slate-600"
                  >
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span className="capitalize">
                        {c.tipo === 'nota_interna' ? 'Nota interna' : c.tipo === 'email_contestacao' ? 'Email de contestação' : c.tipo}
                      </span>
                      <span>{fmtDate(c.data_envio)}</span>
                    </div>
                    {c.para_email && (
                      <p className="text-xs text-slate-400">Para: {c.para_email}</p>
                    )}
                    {c.assunto && (
                      <p className="text-xs font-medium text-slate-300">{c.assunto}</p>
                    )}
                    {c.corpo && (
                      <p className="text-xs text-slate-300 whitespace-pre-wrap">{c.corpo}</p>
                    )}
                    {c.enviado_por && (
                      <p className="text-xs text-slate-500">— {c.enviado_por}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Adicionar nota */}
          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Adicionar Nota Interna
            </h3>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white placeholder-slate-500 resize-none"
              placeholder="Escreve uma nota..."
            />
            <button
              onClick={addNote}
              disabled={saving || !note.trim()}
              className="mt-2 px-4 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white text-xs rounded"
            >
              {saving ? 'A guardar...' : 'Guardar nota'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, cls = '' }: { label: string; value: string; cls?: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-slate-400 shrink-0">{label}</span>
      <span className={`text-white text-right ${cls}`}>{value}</span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  empresaId?: number | null;
}

export default function InvoiceInboxView({ empresaId }: Props) {
  const [items, setItems] = useState<SupplierInvoice[]>([]);
  const [stats, setStats] = useState<InvoiceValidationStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [smtpConfigured, setSmtpConfigured] = useState(false);

  // Filtros — default '' (todos) para que faturas com status legado ('pending') sejam visíveis
  const [filterStatus, setFilterStatus] = useState<InvoiceStatus | ''>('');
  const [apenasDiv, setApenasDiv] = useState(false);

  // Modals
  const [reviewModal, setReviewModal] = useState<SupplierInvoice | null>(null);
  const [drawerInvoice, setDrawerInvoice] = useState<SupplierInvoice | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [inbox, st, smtpSt] = await Promise.all([
        invoiceValidationApi.getInbox({
          empresa_id: empresaId ?? undefined,
          status: filterStatus || undefined,
          apenas_divergencias: apenasDiv,
        }),
        invoiceValidationApi.getStats(empresaId ?? undefined),
        invoiceValidationApi.getSmtpStatus(),
      ]);
      setItems(inbox);
      setStats(st);
      setSmtpConfigured(smtpSt.configured);
    } finally {
      setLoading(false);
    }
  }, [empresaId, filterStatus, apenasDiv]);

  useEffect(() => { load(); }, [load]);

  const handleDone = () => {
    setReviewModal(null);
    load();
  };

  const statsItems = [
    { label: 'Pendentes', value: stats?.pendente_validacao ?? 0, color: 'text-amber-400' },
    { label: 'Contestadas', value: stats?.contestada ?? 0, color: 'text-rose-400' },
    { label: 'Aguardar', value: stats?.em_discussao ?? 0, color: 'text-sky-400' },
    { label: 'Aprovadas', value: (stats?.aprovada ?? 0) + (stats?.aprovada_com_nota ?? 0), color: 'text-emerald-400' },
  ];

  return (
    <div className="p-6 space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {statsItems.map((s) => (
          <div key={s.label} className="bg-slate-800 rounded-lg p-4 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-400 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as InvoiceStatus | '')}
          className="bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-sm text-white"
        >
          <option value="">Todos os estados</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>

        <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={apenasDiv}
            onChange={(e) => setApenasDiv(e.target.checked)}
            className="rounded"
          />
          Apenas divergências
        </label>

        <button
          onClick={load}
          disabled={loading}
          className="ml-auto flex items-center gap-1.5 text-xs text-slate-400 hover:text-white"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto rounded-lg border border-slate-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-800 text-slate-400 text-xs uppercase tracking-wider">
              <th className="px-3 py-3 text-left">Fornecedor</th>
              <th className="px-3 py-3 text-left">NE Forn.</th>
              <th className="px-3 py-3 text-left">Nº Fatura</th>
              <th className="px-3 py-3 text-left">Data</th>
              <th className="px-3 py-3 text-right">Val. Fat.</th>
              <th className="px-3 py-3 text-right">Val. PO</th>
              <th className="px-3 py-3 text-right">Δ</th>
              <th className="px-3 py-3 text-center">PDF</th>
              <th className="px-3 py-3 text-center">Estado</th>
              <th className="px-3 py-3 text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading && items.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-slate-500 text-sm">
                  A carregar...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-slate-500 text-sm">
                  Nenhuma fatura encontrada.
                </td>
              </tr>
            ) : (
              items.map((inv) => (
                <tr
                  key={inv.id}
                  onClick={() => setDrawerInvoice(inv)}
                  className={`border-t border-slate-700/50 hover:bg-slate-800/50 cursor-pointer transition-colors ${
                    inv.flag_divergencia ? 'bg-rose-950/20' : ''
                  }`}
                >
                  <td className="px-3 py-3 text-white font-medium">
                    {inv.supplier_nome ?? `#${inv.supplier_id}`}
                  </td>
                  <td className="px-3 py-3 text-slate-300">{inv.supplier_order_id ?? '—'}</td>
                  <td className="px-3 py-3 text-slate-300">{inv.invoice_ref}</td>
                  <td className="px-3 py-3 text-slate-400">{fmtDate(inv.invoice_date)}</td>
                  <td className="px-3 py-3 text-right text-white font-mono">{fmt(inv.valor_fatura)}</td>
                  <td className="px-3 py-3 text-right text-slate-300 font-mono">{fmt(inv.valor_po)}</td>
                  <td className={`px-3 py-3 text-right font-mono font-semibold ${
                    inv.flag_divergencia ? 'text-rose-400' : 'text-slate-400'
                  }`}>
                    {fmt(inv.diferenca)}
                    {inv.flag_divergencia && <AlertTriangle className="w-3.5 h-3.5 inline ml-1" />}
                  </td>
                  <td className="px-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                    {inv.invoice_pdf_url ? (
                      <a
                        href={inv.invoice_pdf_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sky-400 hover:text-sky-300"
                        title="Ver PDF"
                      >
                        <FileText className="w-4 h-4 mx-auto" />
                      </a>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_COLOR_FALLBACK(inv.status)}`}>
                      {STATUS_LABEL_FALLBACK(inv.status)}
                    </span>
                  </td>
                  <td
                    className="px-3 py-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => setReviewModal(inv)}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs border transition-colors ${
                        IS_ACTIONABLE(inv.status)
                          ? 'bg-sky-800/50 hover:bg-sky-700/60 border-sky-700/50 text-sky-300'
                          : 'bg-slate-700/40 hover:bg-slate-600/50 border-slate-600/50 text-slate-400'
                      }`}
                    >
                      <ClipboardEdit className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Rever</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de revisão unificado */}
      {reviewModal && (
        <InvoiceReviewModal
          invoice={reviewModal}
          smtpConfigured={smtpConfigured}
          onClose={() => setReviewModal(null)}
          onDone={handleDone}
        />
      )}
      {drawerInvoice && (
        <InvoiceDrawer
          invoice={drawerInvoice}
          onClose={() => setDrawerInvoice(null)}
          onRefresh={load}
        />
      )}
    </div>
  );
}

