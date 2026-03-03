'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  CheckCircle, XCircle, Mail, Clock, FileText, AlertTriangle,
  RefreshCw, ChevronDown, MessageSquare, ExternalLink, X,
} from 'lucide-react';
import {
  invoiceValidationApi,
  SupplierInvoice,
  InvoiceComm,
  InvoiceValidationStats,
  InvoiceStatus,
} from '@/lib/api/invoiceValidation';

// ─── helpers ─────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  pendente_validacao: 'Pendente',
  aprovada: 'Aprovada',
  aprovada_com_nota: 'Aprovada c/ nota',
  contestada: 'Contestada',
  em_discussao: 'Aguardar',
  anulada: 'Anulada',
};

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  pendente_validacao: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
  aprovada: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
  aprovada_com_nota: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
  contestada: 'bg-rose-500/20 text-rose-300 border border-rose-500/30',
  em_discussao: 'bg-sky-500/20 text-sky-300 border border-sky-500/30',
  anulada: 'bg-slate-500/20 text-slate-400 border border-slate-500/30',
};

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

// ─── Modal Aprovar com Nota ───────────────────────────────────────────────────

function ApproveNoteModal({
  invoice,
  onClose,
  onDone,
}: {
  invoice: SupplierInvoice;
  onClose: () => void;
  onDone: () => void;
}) {
  const [nota, setNota] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!nota.trim()) return;
    setLoading(true);
    try {
      await invoiceValidationApi.approveWithNote(invoice.id, nota.trim());
      onDone();
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalWrapper onClose={onClose} title={`Aprovar com Nota — ${invoice.invoice_ref}`}>
      <p className="text-sm text-slate-400 mb-3">
        A fatura será aprovada e o lançamento será criado na Conta Corrente do fornecedor.
      </p>
      <label className="block text-xs text-slate-400 mb-1">Nota de aprovação *</label>
      <textarea
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        rows={4}
        className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white placeholder-slate-500 resize-none"
        placeholder="Ex: Divergência de 0,50€ aceite por diferença de arredondamento..."
        autoFocus
      />
      <div className="flex justify-end gap-2 mt-4">
        <button onClick={onClose} className="px-4 py-2 text-sm text-slate-300 hover:text-white">
          Cancelar
        </button>
        <button
          onClick={submit}
          disabled={loading || !nota.trim()}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm rounded"
        >
          {loading ? 'A aprovar...' : 'Aprovar'}
        </button>
      </div>
    </ModalWrapper>
  );
}

// ─── Modal Contestar ──────────────────────────────────────────────────────────

function ContestModal({
  invoice,
  smtpConfigured,
  onClose,
  onDone,
}: {
  invoice: SupplierInvoice;
  smtpConfigured: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [emailPara, setEmailPara] = useState(invoice.supplier_email ?? '');
  const [assunto, setAssunto] = useState(
    `Contestação de Fatura ${invoice.invoice_ref} — Hub Sales`
  );
  const [corpo, setCorpo] = useState(
    `Exmo(a) Sr(a),\n\nVimos por este meio contestar a fatura ${invoice.invoice_ref} ` +
    `${invoice.invoice_date ? `de ${fmtDate(invoice.invoice_date)} ` : ''}` +
    `no valor de ${fmt(invoice.valor_fatura)} €.\n\n` +
    (invoice.supplier_order_id ? `Referência NE: ${invoice.supplier_order_id}\n` : '') +
    (invoice.purchase_order_id ? `Purchase Order interna: #${invoice.purchase_order_id}\n` : '') +
    (invoice.flag_divergencia
      ? `\nDetectámos uma diferença de ${fmt(invoice.diferenca)} € entre o valor da fatura ` +
        `e o valor acordado na PO (${fmt(invoice.valor_po)} €).\n`
      : '') +
    `\nSolicitamos a emissão de nota de crédito ou esclarecimento no prazo de 5 dias úteis.\n\n` +
    `Com os melhores cumprimentos,\nEquipa Hub Sales`
  );
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; email_sent?: boolean; email_error?: string } | null>(null);

  const submit = async () => {
    setLoading(true);
    try {
      const res = await invoiceValidationApi.contest(invoice.id, {
        email_para: emailPara,
        assunto,
        corpo,
      });
      setResult(res);
      if (!res.email_error) {
        setTimeout(onDone, 1200);
      }
    } finally {
      setLoading(false);
    }
  };

  const mailtoLink = `mailto:${encodeURIComponent(emailPara)}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;

  return (
    <ModalWrapper onClose={onClose} title={`Contestar — ${invoice.invoice_ref}`} wide>
      {!smtpConfigured && (
        <div className="flex items-start gap-2 bg-amber-900/30 border border-amber-600/40 rounded p-3 mb-4 text-xs text-amber-300">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            SMTP não configurado — o email não será enviado automaticamente.{' '}
            <a href={mailtoLink} className="underline font-medium">
              Clicar aqui para abrir no cliente de email
            </a>{' '}
            com o conteúdo pré-preenchido.
          </span>
        </div>
      )}

      {result && (
        <div
          className={`mb-3 p-3 rounded text-sm flex items-center gap-2 ${
            result.email_sent
              ? 'bg-emerald-900/30 border border-emerald-600/40 text-emerald-300'
              : 'bg-rose-900/30 border border-rose-600/40 text-rose-300'
          }`}
        >
          {result.email_sent ? (
            <><CheckCircle className="w-4 h-4" /> Email enviado e fatura marcada como Contestada.</>
          ) : (
            <>
              <AlertTriangle className="w-4 h-4" />
              Fatura marcada como Contestada, mas o email falhou: {result.email_error}.{' '}
              <a href={mailtoLink} className="underline ml-1">Abrir no cliente de email</a>
            </>
          )}
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Para *</label>
          <input
            value={emailPara}
            onChange={(e) => setEmailPara(e.target.value)}
            className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white"
            placeholder="email@fornecedor.com"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Assunto *</label>
          <input
            value={assunto}
            onChange={(e) => setAssunto(e.target.value)}
            className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Corpo do email</label>
          <textarea
            value={corpo}
            onChange={(e) => setCorpo(e.target.value)}
            rows={10}
            className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white font-mono resize-none"
          />
        </div>
      </div>

      <div className="flex justify-between items-center mt-4">
        {!smtpConfigured && (
          <a
            href={mailtoLink}
            className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Abrir no cliente de email
          </a>
        )}
        <div className="flex gap-2 ml-auto">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-300 hover:text-white">
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={loading || !emailPara.trim() || !!result?.email_sent}
            className="px-4 py-2 bg-rose-700 hover:bg-rose-600 disabled:opacity-40 text-white text-sm rounded flex items-center gap-2"
          >
            <Mail className="w-4 h-4" />
            {loading
              ? 'A enviar...'
              : smtpConfigured
              ? 'Enviar email + Contestar'
              : 'Registar como Contestada'}
          </button>
        </div>
      </div>
    </ModalWrapper>
  );
}

function ModalWrapper({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div
        className={`relative bg-slate-900 border border-slate-700 rounded-xl shadow-2xl ${
          wide ? 'w-full max-w-2xl' : 'w-full max-w-md'
        } max-h-[90vh] overflow-y-auto`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <h3 className="font-semibold text-white text-sm">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
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

  // Filtros
  const [filterStatus, setFilterStatus] = useState<InvoiceStatus | ''>('pendente_validacao');
  const [apenasDiv, setApenasDiv] = useState(false);

  // Modals
  const [approveNoteModal, setApproveNoteModal] = useState<SupplierInvoice | null>(null);
  const [contestModal, setContestModal] = useState<SupplierInvoice | null>(null);
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

  const handleApprove = async (inv: SupplierInvoice) => {
    if (!confirm(`Aprovar fatura ${inv.invoice_ref}?\n\nEsta acção cria um lançamento na Conta Corrente do fornecedor.`)) return;
    await invoiceValidationApi.approve(inv.id);
    load();
  };

  const handleDiscussion = async (inv: SupplierInvoice) => {
    await invoiceValidationApi.setDiscussion(inv.id);
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
                    <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_COLORS[inv.status]}`}>
                      {STATUS_LABELS[inv.status]}
                    </span>
                  </td>
                  <td
                    className="px-3 py-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {inv.status === 'pendente_validacao' || inv.status === 'em_discussao' ? (
                      <div className="flex items-center gap-1">
                        <ActionBtn
                          icon={<CheckCircle className="w-3.5 h-3.5" />}
                          label="Aprovar"
                          color="emerald"
                          onClick={() => handleApprove(inv)}
                        />
                        <ActionBtn
                          icon={<CheckCircle className="w-3.5 h-3.5" />}
                          label="c/ Nota"
                          color="teal"
                          onClick={() => setApproveNoteModal(inv)}
                        />
                        <ActionBtn
                          icon={<Mail className="w-3.5 h-3.5" />}
                          label="Contestar"
                          color="rose"
                          onClick={() => setContestModal(inv)}
                        />
                        {inv.status === 'pendente_validacao' && (
                          <ActionBtn
                            icon={<Clock className="w-3.5 h-3.5" />}
                            label="Aguardar"
                            color="sky"
                            onClick={() => handleDiscussion(inv)}
                          />
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => setDrawerInvoice(inv)}
                        className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        Ver
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      {approveNoteModal && (
        <ApproveNoteModal
          invoice={approveNoteModal}
          onClose={() => setApproveNoteModal(null)}
          onDone={() => { setApproveNoteModal(null); load(); }}
        />
      )}
      {contestModal && (
        <ContestModal
          invoice={contestModal}
          smtpConfigured={smtpConfigured}
          onClose={() => setContestModal(null)}
          onDone={() => { setContestModal(null); load(); }}
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

function ActionBtn({
  icon,
  label,
  color,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  color: 'emerald' | 'teal' | 'rose' | 'sky' | 'slate';
  onClick: () => void;
}) {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-700/50 hover:bg-emerald-600/60 text-emerald-300 border-emerald-600/30',
    teal: 'bg-teal-700/50 hover:bg-teal-600/60 text-teal-300 border-teal-600/30',
    rose: 'bg-rose-700/50 hover:bg-rose-600/60 text-rose-300 border-rose-600/30',
    sky: 'bg-sky-700/50 hover:bg-sky-600/60 text-sky-300 border-sky-600/30',
    slate: 'bg-slate-700/50 hover:bg-slate-600/60 text-slate-300 border-slate-600/30',
  };
  return (
    <button
      onClick={onClick}
      title={label}
      className={`flex items-center gap-1 px-2 py-1 rounded border text-xs ${colors[color]}`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
