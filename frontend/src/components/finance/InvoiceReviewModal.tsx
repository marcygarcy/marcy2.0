'use client';

/**
 * Fase 7 — Modal de Revisão de Fatura (split-screen).
 *
 * Painel esquerdo : campos editáveis da fatura (fornecedor, datas, decomposição de valor)
 * Painel direito  : POs associadas + pesquisa + divergência + NCs + acções
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import {
  X, Plus, Trash2, Search, CheckCircle, Mail, Clock,
  AlertTriangle, FileText, ExternalLink, ChevronDown, ChevronUp,
} from 'lucide-react';
import {
  invoiceValidationApi,
  SupplierInvoice,
  LinkedPO,
  CreditNote,
  UpdateInvoiceFields,
  ContestBody,
} from '@/lib/api/invoiceValidation';
import { suppliersApi, SupplierMaster } from '@/lib/api/suppliers';

// ─── Constantes ───────────────────────────────────────────────────────────────

const DIVERGENCE_CODES: { code: string; label: string; action: string }[] = [
  { code: 'ARRED',          label: 'Arredondamento',               action: 'Aprovar' },
  { code: 'PORTES',         label: 'Portes incluídos na fatura',   action: 'Aprovar' },
  { code: 'DESC_COMERC',    label: 'Desconto comercial acordado',  action: 'Aprovar' },
  { code: 'PRECO_ALTERADO', label: 'Preço alterado desde a PO',    action: 'Aprovar c/ nota' },
  { code: 'ERRO_FATURA',    label: 'Erro na fatura do fornecedor', action: 'Contestar' },
  { code: 'NC_PENDENTE',    label: 'Nota de crédito a aguardar',   action: 'Aguardar' },
];

const fmt = (v: number | null | undefined) =>
  v == null ? '—' : v.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('pt-PT') : '';

const toInput = (d: string | null | undefined) =>
  d ? d.slice(0, 10) : '';

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function Field({
  label, value, onChange, type = 'text', placeholder, readOnly = false,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  type?: string;
  placeholder?: string;
  readOnly?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs text-slate-400 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        placeholder={placeholder}
        readOnly={readOnly}
        className={`w-full bg-slate-900 border rounded px-2.5 py-1.5 text-sm text-white placeholder-slate-600 ${
          readOnly
            ? 'border-slate-700 text-slate-300 cursor-default'
            : 'border-slate-600 focus:border-sky-500 outline-none'
        }`}
      />
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-2 mt-4 first:mt-0">
      {children}
    </p>
  );
}

// ─── Pesquisa de fornecedor ───────────────────────────────────────────────────

function SupplierSearchField({
  supplierId,
  supplierName,
  suppliers,
  onChange,
}: {
  supplierId: number | null;
  supplierName: string;
  suppliers: SupplierMaster[];
  onChange: (id: number, nome: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = query.trim()
    ? suppliers.filter(
        (s) =>
          s.nome.toLowerCase().includes(query.toLowerCase()) ||
          (s.codigo ?? '').toLowerCase().includes(query.toLowerCase()),
      )
    : suppliers;

  return (
    <div ref={ref} className="relative">
      <label className="block text-xs text-slate-400 mb-1">Fornecedor</label>
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); setQuery(''); }}
        className="w-full bg-slate-900 border border-slate-600 rounded px-2.5 py-1.5 text-sm text-left flex items-center justify-between focus:border-sky-500 outline-none hover:border-slate-500 transition-colors"
      >
        <span className={supplierId ? 'text-white truncate' : 'text-slate-500'}>
          {supplierName || 'Seleccionar fornecedor...'}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-2" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-slate-800 border border-slate-600 rounded shadow-2xl">
          <div className="p-1.5 border-b border-slate-700">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" />
              <input
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Pesquisar por nome ou código..."
                className="w-full bg-slate-900 border border-slate-700 rounded pl-7 pr-2 py-1 text-xs text-white placeholder-slate-500 outline-none focus:border-sky-500"
              />
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-xs text-slate-500">Sem resultados.</p>
            ) : (
              filtered.slice(0, 60).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => { onChange(s.id!, s.nome); setOpen(false); setQuery(''); }}
                  className={`w-full px-3 py-2 text-xs text-left hover:bg-slate-700 transition-colors flex items-center justify-between ${
                    s.id === supplierId ? 'text-sky-400 bg-slate-700/50' : 'text-white'
                  }`}
                >
                  <span className="truncate">{s.nome}</span>
                  {s.codigo && <span className="text-slate-500 ml-2 shrink-0">{s.codigo}</span>}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Listagem/pesquisa de POs ─────────────────────────────────────────────────

const PO_STATUS_COLORS: Record<string, string> = {
  pendente:              'bg-amber-500/20 text-amber-300',
  confirmada:            'bg-sky-500/20 text-sky-300',
  em_transito:           'bg-violet-500/20 text-violet-300',
  parcialmente_entregue: 'bg-orange-500/20 text-orange-300',
  entregue:              'bg-emerald-500/20 text-emerald-300',
  concluida:             'bg-emerald-500/20 text-emerald-300',
  cancelada:             'bg-slate-500/20 text-slate-400',
  anulada:               'bg-slate-500/20 text-slate-400',
};

function POSearchBox({
  supplierId,
  empresaId,
  linkedIds,
  onAddMany,
}: {
  supplierId: number;
  empresaId: number;
  linkedIds: Set<number>;
  onAddMany: (pos: LinkedPO[]) => void;
}) {
  const [q, setQ] = useState('');
  const [allPos, setAllPos] = useState<LinkedPO[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // Carrega todas as POs abertas do fornecedor ao montar
  useEffect(() => {
    setLoading(true);
    invoiceValidationApi
      .searchPos({ supplier_id: supplierId, empresa_id: empresaId })
      .then(setAllPos)
      .finally(() => setLoading(false));
  }, [supplierId, empresaId]);

  // Filtra localmente enquanto o utilizador digita
  const visible = allPos.filter((po) => {
    if (linkedIds.has(po.id)) return false;
    if (!q.trim()) return true;
    const ql = q.toLowerCase();
    return (
      String(po.id).includes(ql) ||
      (po.supplier_order_id ?? '').toLowerCase().includes(ql)
    );
  });

  const toggleAll = () => {
    if (selected.size === visible.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(visible.map((p) => p.id)));
    }
  };

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const confirm = () => {
    const toAdd = allPos.filter((p) => selected.has(p.id));
    onAddMany(toAdd);
    setSelected(new Set());
  };

  const allChecked = visible.length > 0 && selected.size === visible.length;
  const someChecked = selected.size > 0 && selected.size < visible.length;

  return (
    <div className="mt-2 border border-slate-700 rounded overflow-hidden">
      {/* Filtro inline */}
      <div className="relative border-b border-slate-700">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" />
        <input
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filtrar por PO# ou NE..."
          className="w-full bg-slate-800 pl-7 pr-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none"
        />
      </div>

      {/* Cabeçalho seleccionar todos */}
      {!loading && visible.length > 1 && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/60 border-b border-slate-700">
          <input
            type="checkbox"
            checked={allChecked}
            ref={(el) => { if (el) el.indeterminate = someChecked; }}
            onChange={toggleAll}
            className="accent-sky-500 w-3.5 h-3.5 cursor-pointer"
          />
          <span className="text-[10px] text-slate-400">
            {selected.size > 0 ? `${selected.size} seleccionada(s)` : 'Seleccionar todas'}
          </span>
        </div>
      )}

      {/* Lista com checkboxes */}
      <div className="max-h-48 overflow-y-auto">
        {loading ? (
          <p className="px-3 py-3 text-xs text-slate-500">A carregar...</p>
        ) : visible.length === 0 ? (
          <p className="px-3 py-3 text-xs text-slate-500">
            {q ? 'Sem resultados para esse filtro.' : 'Sem POs em aberto para este fornecedor.'}
          </p>
        ) : (
          visible.map((po) => {
            const isChecked = selected.has(po.id);
            const statusColor = PO_STATUS_COLORS[po.status ?? ''] ?? 'bg-slate-500/20 text-slate-400';
            return (
              <label
                key={po.id}
                className={`flex items-center gap-2 px-3 py-2 text-xs cursor-pointer border-b border-slate-700/40 last:border-0 transition-colors ${
                  isChecked ? 'bg-sky-900/30' : 'hover:bg-slate-700/50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggle(po.id)}
                  className="accent-sky-500 w-3.5 h-3.5 shrink-0 cursor-pointer"
                />
                <span className="text-sky-400 font-mono shrink-0">PO#{po.id}</span>
                <span className="text-slate-300 truncate flex-1">{po.supplier_order_id ?? '—'}</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] shrink-0 ${statusColor}`}>
                  {po.status ?? '—'}
                </span>
                <span className="text-white font-mono shrink-0">{fmt(po.total_final)} €</span>
              </label>
            );
          })
        )}
      </div>

      {/* Rodapé com botão confirmar */}
      {selected.size > 0 && (
        <div className="flex items-center justify-between px-3 py-2 bg-slate-800 border-t border-slate-700">
          <span className="text-xs text-slate-400">{selected.size} PO(s) seleccionada(s)</span>
          <button
            onClick={confirm}
            className="px-3 py-1 bg-sky-700 hover:bg-sky-600 text-white text-xs rounded flex items-center gap-1.5"
          >
            <Plus className="w-3 h-3" />
            Adicionar seleção
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Secção de email (contestação integrada) ──────────────────────────────────

function ContestSection({
  invoice,
  smtpConfigured,
  onContested,
}: {
  invoice: SupplierInvoice;
  smtpConfigured: boolean;
  onContested: () => void;
}) {
  const [emailPara, setEmailPara] = useState(invoice.supplier_email ?? '');
  const [assunto, setAssunto] = useState(
    `Contestação de Fatura ${invoice.invoice_ref} — Hub Sales`,
  );
  const [corpo, setCorpo] = useState(
    `Exmo(a) Sr(a),\n\nVimos por este meio contestar a fatura ${invoice.invoice_ref}` +
    (invoice.invoice_date ? ` de ${fmtDate(invoice.invoice_date)}` : '') +
    ` no valor de ${fmt(invoice.valor_fatura)} €.\n\n` +
    (invoice.supplier_order_id ? `Referência NE: ${invoice.supplier_order_id}\n` : '') +
    (invoice.purchase_order_id ? `Purchase Order interna: #${invoice.purchase_order_id}\n` : '') +
    (invoice.flag_divergencia
      ? `\nDetectámos uma diferença de ${fmt(invoice.diferenca)} € entre o valor da fatura e o valor acordado na PO (${fmt(invoice.valor_po)} €).\n`
      : '') +
    `\nSolicitamos esclarecimento ou nota de crédito no prazo de 5 dias úteis.\n\nCom os melhores cumprimentos,\nEquipa Hub Sales`,
  );
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; email_sent?: boolean; email_error?: string } | null>(null);

  const mailtoLink = `mailto:${encodeURIComponent(emailPara)}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;

  const send = async () => {
    setSending(true);
    try {
      const body: ContestBody = { email_para: emailPara, assunto, corpo };
      const res = await invoiceValidationApi.contest(invoice.id, body);
      setResult(res);
      if (res.ok) setTimeout(onContested, 1500);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-2">
      {!smtpConfigured && (
        <div className="flex items-start gap-2 bg-amber-900/20 border border-amber-600/30 rounded p-2 text-xs text-amber-300">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            SMTP não configurado.{' '}
            <a href={mailtoLink} className="underline">Abrir no cliente de email</a>{' '}
            com o conteúdo pré-preenchido.
          </span>
        </div>
      )}
      {result && (
        <div className={`flex items-center gap-2 p-2 rounded text-xs ${result.email_sent ? 'bg-emerald-900/30 text-emerald-300' : 'bg-rose-900/30 text-rose-300'}`}>
          {result.email_sent
            ? <><CheckCircle className="w-3.5 h-3.5" /> Email enviado e fatura contestada.</>
            : <><AlertTriangle className="w-3.5 h-3.5" /> Fatura contestada, mas email falhou: {result.email_error}. <a href={mailtoLink} className="underline ml-1">Abrir cliente</a></>
          }
        </div>
      )}
      <Field label="Para" value={emailPara} onChange={setEmailPara} placeholder="email@fornecedor.com" />
      <Field label="Assunto" value={assunto} onChange={setAssunto} />
      <div>
        <label className="block text-xs text-slate-400 mb-1">Corpo do email</label>
        <textarea
          value={corpo}
          onChange={(e) => setCorpo(e.target.value)}
          rows={7}
          className="w-full bg-slate-900 border border-slate-600 rounded px-2.5 py-1.5 text-xs text-white font-mono resize-none outline-none focus:border-sky-500"
        />
      </div>
      <div className="flex justify-between items-center">
        {!smtpConfigured && (
          <a href={mailtoLink} className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1">
            <ExternalLink className="w-3 h-3" /> Abrir no cliente de email
          </a>
        )}
        <button
          onClick={send}
          disabled={sending || !emailPara.trim() || !!result?.email_sent}
          className="ml-auto px-3 py-1.5 bg-rose-700 hover:bg-rose-600 disabled:opacity-40 text-white text-xs rounded flex items-center gap-1.5"
        >
          <Mail className="w-3.5 h-3.5" />
          {sending ? 'A enviar...' : smtpConfigured ? 'Enviar + Contestar' : 'Registar Contestação'}
        </button>
      </div>
    </div>
  );
}

// ─── Modal principal ──────────────────────────────────────────────────────────

interface Props {
  invoice: SupplierInvoice;
  smtpConfigured: boolean;
  onClose: () => void;
  onDone: () => void;
}

export default function InvoiceReviewModal({ invoice, smtpConfigured, onClose, onDone }: Props) {
  // ── Estado painel esquerdo ────────────────────────────────────────────────
  const [fields, setFields] = useState<UpdateInvoiceFields>({
    supplier_id:     invoice.supplier_id,
    invoice_ref:     invoice.invoice_ref,
    invoice_date:    toInput(invoice.invoice_date),
    data_vencimento: toInput(invoice.data_vencimento),
    valor_base:      invoice.valor_base ?? undefined,
    valor_iva:       invoice.valor_iva ?? undefined,
    valor_portes:    invoice.valor_portes ?? undefined,
    divergence_code: invoice.divergence_code ?? undefined,
  });
  const [supplierName, setSupplierName] = useState(invoice.supplier_nome ?? '');
  const [suppliers, setSuppliers] = useState<SupplierMaster[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  // ── Estado painel direito — POs ───────────────────────────────────────────
  const [linkedPos, setLinkedPos] = useState<LinkedPO[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [savingPos, setSavingPos] = useState(false);

  // ── Estado painel direito — NCs ───────────────────────────────────────────
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
  const [showAddNc, setShowAddNc] = useState(false);
  const [ncForm, setNcForm] = useState({ nc_ref: '', valor: '', nc_date: '', notas: '' });
  const [savingNc, setSavingNc] = useState(false);

  // ── Estado contestação ────────────────────────────────────────────────────
  const [showContest, setShowContest] = useState(false);

  // ── Carregamento inicial ──────────────────────────────────────────────────
  useEffect(() => {
    invoiceValidationApi.getLinkedPos(invoice.id).then(setLinkedPos);
    invoiceValidationApi.getCreditNotes(invoice.id).then(setCreditNotes);
    suppliersApi.list(invoice.empresa_id).then((r) => setSuppliers(r.items));
  }, [invoice.id, invoice.empresa_id]);

  // ── Cálculos derivados ────────────────────────────────────────────────────
  const valorFaturaCalc =
    (fields.valor_base ?? 0) + (fields.valor_iva ?? 0) + (fields.valor_portes ?? 0);
  const valorPoTotal = linkedPos.reduce((s, p) => s + (p.total_final ?? 0), 0);
  const somaNcs = creditNotes.reduce((s, nc) => s + nc.valor, 0);
  const liquido = valorFaturaCalc - somaNcs;
  const diferenca = liquido - valorPoTotal;
  const hasDivergencia = Math.abs(diferenca) > 0.01;

  const divergenceLabel =
    DIVERGENCE_CODES.find((c) => c.code === fields.divergence_code)?.label ?? '';

  // ── Acções ────────────────────────────────────────────────────────────────
  const handleSaveFields = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      await invoiceValidationApi.updateInvoice(invoice.id, fields);
      setSaveMsg('Guardado.');
      setTimeout(() => setSaveMsg(null), 2000);
    } finally {
      setSaving(false);
    }
  };

  const handleSavePos = async () => {
    setSavingPos(true);
    try {
      await invoiceValidationApi.setLinkedPos(invoice.id, linkedPos.map((p) => p.id));
    } finally {
      setSavingPos(false);
    }
  };

  const handleAddMany = (pos: LinkedPO[]) => {
    setLinkedPos((prev) => {
      const ids = new Set(prev.map((p) => p.id));
      return [...prev, ...pos.filter((p) => !ids.has(p.id))];
    });
    setShowSearch(false);
  };

  const handleRemovePo = (poId: number) => {
    setLinkedPos((prev) => prev.filter((p) => p.id !== poId));
  };

  const handleAddNc = async () => {
    if (!ncForm.nc_ref || !ncForm.valor) return;
    setSavingNc(true);
    try {
      await invoiceValidationApi.addCreditNote(invoice.id, {
        nc_ref: ncForm.nc_ref,
        valor: parseFloat(ncForm.valor),
        nc_date: ncForm.nc_date || undefined,
        notas: ncForm.notas || undefined,
      });
      const updated = await invoiceValidationApi.getCreditNotes(invoice.id);
      setCreditNotes(updated);
      setNcForm({ nc_ref: '', valor: '', nc_date: '', notas: '' });
      setShowAddNc(false);
    } finally {
      setSavingNc(false);
    }
  };

  const handleDeleteNc = async (ncId: number) => {
    await invoiceValidationApi.deleteCreditNote(invoice.id, ncId);
    setCreditNotes((prev) => prev.filter((nc) => nc.id !== ncId));
  };

  const handleApprove = async (withNote?: string) => {
    if (withNote !== undefined) {
      await invoiceValidationApi.approveWithNote(invoice.id, withNote || divergenceLabel || 'Aprovado');
    } else {
      await invoiceValidationApi.approve(invoice.id);
    }
    onDone();
  };

  const handleDiscussion = async () => {
    await invoiceValidationApi.setDiscussion(invoice.id);
    onDone();
  };

  const linkedIdsSet = new Set(linkedPos.map((p) => p.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="absolute inset-0 bg-black/75" onClick={onClose} />

      <div className="relative w-full max-w-5xl max-h-[95vh] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700 shrink-0">
          <div>
            <h2 className="font-semibold text-white text-sm">
              Revisão — Fatura {invoice.invoice_ref}
            </h2>
            <p className="text-xs text-slate-400">{invoice.supplier_nome ?? `Fornecedor #${invoice.supplier_id}`}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body — split */}
        <div className="flex flex-1 overflow-hidden divide-x divide-slate-700">

          {/* ── Painel esquerdo: campos da fatura ── */}
          <div className="w-80 shrink-0 overflow-y-auto p-4 space-y-1">
            <SectionTitle>Identificação</SectionTitle>
            <SupplierSearchField
              supplierId={fields.supplier_id ?? null}
              supplierName={supplierName}
              suppliers={suppliers}
              onChange={(id, nome) => {
                setFields((f) => ({ ...f, supplier_id: id }));
                setSupplierName(nome);
              }}
            />
            <Field label="Nº Fatura" value={fields.invoice_ref ?? ''} onChange={(v) => setFields((f) => ({ ...f, invoice_ref: v }))} />
            <Field label="Data da fatura" value={fields.invoice_date ?? ''} onChange={(v) => setFields((f) => ({ ...f, invoice_date: v }))} type="date" />
            <Field label="Data de vencimento" value={fields.data_vencimento ?? ''} onChange={(v) => setFields((f) => ({ ...f, data_vencimento: v }))} type="date" />

            <SectionTitle>Decomposição de valor</SectionTitle>
            <Field
              label="Valor base (s/ IVA)"
              value={fields.valor_base != null ? String(fields.valor_base) : ''}
              onChange={(v) => setFields((f) => ({ ...f, valor_base: v === '' ? undefined : parseFloat(v) }))}
              type="number"
              placeholder="0.00"
            />
            <Field
              label="IVA"
              value={fields.valor_iva != null ? String(fields.valor_iva) : ''}
              onChange={(v) => setFields((f) => ({ ...f, valor_iva: v === '' ? undefined : parseFloat(v) }))}
              type="number"
              placeholder="0.00"
            />
            <Field
              label="Portes / Fretes"
              value={fields.valor_portes != null ? String(fields.valor_portes) : ''}
              onChange={(v) => setFields((f) => ({ ...f, valor_portes: v === '' ? undefined : parseFloat(v) }))}
              type="number"
              placeholder="0.00"
            />
            <div className="flex justify-between items-center py-1.5 border-t border-slate-700 mt-2">
              <span className="text-xs text-slate-400">Total calculado</span>
              <span className="text-sm font-bold text-white font-mono">{fmt(valorFaturaCalc)} €</span>
            </div>

            {invoice.invoice_pdf_url && (
              <a
                href={invoice.invoice_pdf_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 mt-3"
              >
                <FileText className="w-3.5 h-3.5" />
                Ver PDF da fatura
                <ExternalLink className="w-3 h-3 ml-auto" />
              </a>
            )}

            <div className="pt-3 flex items-center gap-2">
              <button
                onClick={handleSaveFields}
                disabled={saving}
                className="flex-1 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white text-xs rounded"
              >
                {saving ? 'A guardar...' : 'Guardar campos'}
              </button>
              {saveMsg && <span className="text-xs text-emerald-400">{saveMsg}</span>}
            </div>
          </div>

          {/* ── Painel direito: POs + divergência + NCs + acções ── */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">

            {/* POs associadas */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <SectionTitle>POs associadas</SectionTitle>
                <button
                  onClick={() => setShowSearch((s) => !s)}
                  className="flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar PO
                </button>
              </div>

              {linkedPos.length === 0 ? (
                <p className="text-xs text-slate-500">Nenhuma PO associada.</p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-500 border-b border-slate-700">
                      <th className="text-left py-1">PO#</th>
                      <th className="text-left py-1">NE Forn.</th>
                      <th className="text-right py-1">Valor</th>
                      <th className="text-left py-1 pl-2">Estado</th>
                      <th className="py-1"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {linkedPos.map((po) => (
                      <tr key={po.id} className="border-b border-slate-700/40">
                        <td className="py-1.5 text-sky-400 font-mono">PO#{po.id}</td>
                        <td className="py-1.5 text-slate-300">{po.supplier_order_id ?? '—'}</td>
                        <td className="py-1.5 text-right text-white font-mono">{fmt(po.total_final)}</td>
                        <td className="py-1.5 pl-2 text-slate-400">{po.status ?? '—'}</td>
                        <td className="py-1.5 text-right">
                          <button onClick={() => handleRemovePo(po.id)} className="text-slate-500 hover:text-rose-400">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    <tr className="font-semibold text-xs">
                      <td colSpan={2} className="pt-2 text-slate-400">Total POs</td>
                      <td className="pt-2 text-right text-white font-mono">{fmt(valorPoTotal)}</td>
                      <td colSpan={2}></td>
                    </tr>
                  </tbody>
                </table>
              )}

              {showSearch && (
                <POSearchBox
                  supplierId={invoice.supplier_id}
                  empresaId={invoice.empresa_id}
                  linkedIds={linkedIdsSet}
                  onAddMany={handleAddMany}
                />
              )}

              {linkedPos.length > 0 && (
                <button
                  onClick={handleSavePos}
                  disabled={savingPos}
                  className="mt-2 text-xs px-3 py-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white rounded"
                >
                  {savingPos ? 'A guardar...' : 'Guardar POs'}
                </button>
              )}
            </div>

            {/* Totalizador */}
            <div className="bg-slate-800 rounded-lg p-3 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Valor Fatura</span>
                <span className="text-white font-mono">{fmt(valorFaturaCalc)} €</span>
              </div>
              {somaNcs > 0 && (
                <div className="flex justify-between text-emerald-400">
                  <span>NCs associadas</span>
                  <span className="font-mono">-{fmt(somaNcs)} €</span>
                </div>
              )}
              {somaNcs > 0 && (
                <div className="flex justify-between border-t border-slate-700 pt-1">
                  <span className="text-slate-400">Líquido</span>
                  <span className="text-white font-mono">{fmt(liquido)} €</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-400">Total POs</span>
                <span className="text-slate-300 font-mono">{fmt(valorPoTotal)} €</span>
              </div>
              <div className={`flex justify-between border-t border-slate-700 pt-1.5 font-semibold ${hasDivergencia ? 'text-rose-400' : 'text-emerald-400'}`}>
                <span className="flex items-center gap-1">
                  {hasDivergencia && <AlertTriangle className="w-3.5 h-3.5" />}
                  Diferença
                </span>
                <span className="font-mono">{diferenca >= 0 ? '+' : ''}{fmt(diferenca)} €</span>
              </div>
            </div>

            {/* Código de divergência */}
            {hasDivergencia && (
              <div className="space-y-2">
                <SectionTitle>Justificação da divergência</SectionTitle>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Código</label>
                  <select
                    value={fields.divergence_code ?? ''}
                    onChange={(e) => setFields((f) => ({ ...f, divergence_code: e.target.value || undefined }))}
                    className="w-full bg-slate-900 border border-slate-600 rounded px-2.5 py-1.5 text-sm text-white outline-none focus:border-sky-500"
                  >
                    <option value="">— Seleccionar código —</option>
                    {DIVERGENCE_CODES.map((c) => (
                      <option key={c.code} value={c.code}>{c.label}</option>
                    ))}
                  </select>
                  {fields.divergence_code && (
                    <p className="text-xs text-slate-500 mt-1">
                      Acção sugerida: <span className="text-slate-300">{DIVERGENCE_CODES.find(c => c.code === fields.divergence_code)?.action}</span>
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Notas de crédito */}
            {(fields.divergence_code === 'NC_PENDENTE' || creditNotes.length > 0) && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <SectionTitle>Notas de Crédito</SectionTitle>
                  <button
                    onClick={() => setShowAddNc((s) => !s)}
                    className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Adicionar NC
                  </button>
                </div>

                {creditNotes.length > 0 && (
                  <table className="w-full text-xs mb-2">
                    <thead>
                      <tr className="text-slate-500 border-b border-slate-700">
                        <th className="text-left py-1">NC Ref</th>
                        <th className="text-left py-1">Data</th>
                        <th className="text-right py-1">Valor</th>
                        <th className="py-1"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {creditNotes.map((nc) => (
                        <tr key={nc.id} className="border-b border-slate-700/40">
                          <td className="py-1.5 text-emerald-400">{nc.nc_ref}</td>
                          <td className="py-1.5 text-slate-400">{fmtDate(nc.nc_date)}</td>
                          <td className="py-1.5 text-right text-white font-mono">{fmt(nc.valor)}</td>
                          <td className="py-1.5 text-right">
                            <button onClick={() => handleDeleteNc(nc.id)} className="text-slate-500 hover:text-rose-400">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {showAddNc && (
                  <div className="bg-slate-800 rounded p-3 space-y-2 text-xs">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-slate-400 mb-1">Nº NC *</label>
                        <input
                          value={ncForm.nc_ref}
                          onChange={(e) => setNcForm((f) => ({ ...f, nc_ref: e.target.value }))}
                          className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-white outline-none"
                          placeholder="NC/2024/001"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1">Valor *</label>
                        <input
                          type="number"
                          value={ncForm.valor}
                          onChange={(e) => setNcForm((f) => ({ ...f, valor: e.target.value }))}
                          className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-white outline-none"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1">Data</label>
                        <input
                          type="date"
                          value={ncForm.nc_date}
                          onChange={(e) => setNcForm((f) => ({ ...f, nc_date: e.target.value }))}
                          className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-white outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1">Notas</label>
                        <input
                          value={ncForm.notas}
                          onChange={(e) => setNcForm((f) => ({ ...f, notas: e.target.value }))}
                          className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-white outline-none"
                          placeholder="opcional"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setShowAddNc(false)} className="px-3 py-1 text-slate-400 hover:text-white">Cancelar</button>
                      <button
                        onClick={handleAddNc}
                        disabled={savingNc || !ncForm.nc_ref || !ncForm.valor}
                        className="px-3 py-1 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 text-white rounded"
                      >
                        {savingNc ? 'A guardar...' : 'Adicionar'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Contestação expandida */}
            {showContest && (
              <div>
                <SectionTitle>Contestar por email</SectionTitle>
                <ContestSection
                  invoice={invoice}
                  smtpConfigured={smtpConfigured}
                  onContested={onDone}
                />
              </div>
            )}

            {/* Acções */}
            <div className="border-t border-slate-700 pt-4 flex flex-wrap gap-2 justify-end">
              <button
                onClick={() => setShowContest((s) => !s)}
                className="flex items-center gap-1.5 px-3 py-2 bg-rose-800/60 hover:bg-rose-700/60 border border-rose-700/50 text-rose-300 text-xs rounded"
              >
                <Mail className="w-3.5 h-3.5" />
                {showContest ? 'Fechar email' : 'Contestar'}
              </button>

              <button
                onClick={handleDiscussion}
                className="flex items-center gap-1.5 px-3 py-2 bg-sky-800/60 hover:bg-sky-700/60 border border-sky-700/50 text-sky-300 text-xs rounded"
              >
                <Clock className="w-3.5 h-3.5" />
                Aguardar
              </button>

              <button
                onClick={() =>
                  hasDivergencia && fields.divergence_code
                    ? handleApprove(divergenceLabel)
                    : handleApprove()
                }
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-xs rounded font-medium"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                Aprovar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
