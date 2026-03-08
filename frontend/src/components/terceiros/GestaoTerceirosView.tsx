'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Users, FileText, Building2, ChevronDown, Plus, Loader2, ArrowLeft } from 'lucide-react';
import { NestedDropdown, type NestedDropdownItem } from '@/components/ui/nested-dropdown';
import { terceirosApi } from '@/lib/api/terceiros';
import { useApp } from '@/context/AppContext';
import { MSG_EM_DESENVOLVIMENTO } from '@/lib/constants';

type MovimentoRow = {
  id: number;
  cod_grupo: string;
  codigo_entidade: string;
  tipo_doc: string;
  descricao: string;
  numero_documento: string;
  data_documento: string;
  data_lim_pag: string;
  valor: string;
  dc: string;
};

const TERCEIROS_MENU_ITEMS: NestedDropdownItem[] = [
  {
    value: 'movimentos',
    label: 'Movimentos',
    children: [
      { value: 'insercao', label: 'Inserção' },
      { value: 'consulta', label: 'Consulta' },
    ],
  },
  {
    value: 'grupos',
    label: 'Grupos (GT)',
    children: [
      { value: 'grupos-listar', label: 'Listar' },
      { value: 'grupos-novo', label: 'Novo' },
    ],
  },
  {
    value: 'contabilidade',
    label: 'Contabilidade',
    children: [
      { value: 'contabilidade-ligacao', label: 'Ligação GT / Contabilidade' },
    ],
  },
];

function formatNumeroSequencial(date: Date, seq: number): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const s = String(seq).padStart(4, '0');
  return `${y}${m}${s}`;
}

const NUM_LINHAS_TABELA = 7;

function createEmptyRow(id: number): MovimentoRow {
  return {
    id,
    cod_grupo: '',
    codigo_entidade: '',
    tipo_doc: '',
    descricao: '',
    numero_documento: '',
    data_documento: '',
    data_lim_pag: '',
    valor: '',
    dc: '',
  };
}

type ContrapartidaRow = {
  id: number;
  cod_mov: string;
  descricao: string;
  conta: string;
  dc_conta: string;
  centro_custo: string;
  dc_centro: string;
  sub_centro: string;
  valor: string;
  dc_valor: string;
};

const NUM_LINHAS_CONTRAPARTIDAS = 7;

function createEmptyContrapartidaRow(id: number): ContrapartidaRow {
  return {
    id,
    cod_mov: '',
    descricao: '',
    conta: '',
    dc_conta: '',
    centro_custo: '',
    dc_centro: '',
    sub_centro: '',
    valor: '',
    dc_valor: '',
  };
}

export function GestaoTerceirosView() {
  const [activeSection, setActiveSection] = useState<string>('visao-geral');
  const [modalInserção, setModalInserção] = useState(false);
  const [modalConsulta, setModalConsulta] = useState(false);
  const [rows, setRows] = useState<MovimentoRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const nextId = React.useRef(1);
  const seqRef = React.useRef(1);
  // Cabeçalho da introdução de movimentos (como no mock-up)
  const [tipTer, setTipTer] = useState('');
  const [diario, setDiario] = useState('B001');
  const [bancos, setBancos] = useState('Bancos');
  const [dataCtb, setDataCtb] = useState(() => new Date().toISOString().slice(0, 10));
  const [numero, setNumero] = useState('');
  // Janela móvel: posição e arrastar
  const [modalPos, setModalPos] = useState({ x: 0, y: 0 });
  const dragRef = React.useRef<{ startX: number; startY: number; startPos: { x: number; y: number } } | null>(null);
  // Contrapartidas CTB (segunda janela)
  const [modalContrapartidas, setModalContrapartidas] = useState(false);
  const [contrapartidasPos, setContrapartidasPos] = useState({ x: 0, y: 0 });
  const contrapartidasDragRef = React.useRef<{ startX: number; startY: number; startPos: { x: number; y: number } } | null>(null);
  const [contrapartidasRows, setContrapartidasRows] = useState<ContrapartidaRow[]>([]);
  const nextIdContrapartidas = React.useRef(1);

  const sections = [
    { id: 'visao-geral', label: 'Visão geral', icon: Users },
    { id: 'fornecedores-servicos', label: 'Fornecedores de serviços', icon: Users },
    { id: 'parceiros', label: 'Parceiros e contratos', icon: Building2 },
    { id: 'documentos', label: 'Documentos', icon: FileText },
  ];

  const handleTerceirosSelect = (value: string) => {
    if (value === 'insercao') {
      const today = new Date();
      setDataCtb(today.toISOString().slice(0, 10));
      setNumero(formatNumeroSequencial(today, seqRef.current));
      setMsg(null);
      setModalPos({ x: 0, y: 0 });
      setRows(Array.from({ length: NUM_LINHAS_TABELA }, (_, i) => createEmptyRow(nextId.current++)));
      setModalInserção(true);
    } else if (value === 'consulta') setModalConsulta(true);
    else if (value === 'grupos-listar' || value === 'grupos-novo' || value === 'contabilidade-ligacao') {
      // Placeholder: poderia abrir outros modais ou navegar
      setActiveSection('visao-geral');
    }
  };

  const addRow = () => {
    setRows((r) => [...r, createEmptyRow(nextId.current++)]);
  };

  const handleDragStart = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, startPos: { ...modalPos } };
  };
  React.useEffect(() => {
    if (!modalInserção) return;
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      setModalPos({
        x: dragRef.current.startPos.x + (e.clientX - dragRef.current.startX),
        y: dragRef.current.startPos.y + (e.clientY - dragRef.current.startY),
      });
    };
    const onUp = () => { dragRef.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [modalInserção]);

  const handleContrapartidasDragStart = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    contrapartidasDragRef.current = { startX: e.clientX, startY: e.clientY, startPos: { ...contrapartidasPos } };
  };
  React.useEffect(() => {
    if (!modalContrapartidas) return;
    const onMove = (e: MouseEvent) => {
      if (!contrapartidasDragRef.current) return;
      setContrapartidasPos({
        x: contrapartidasDragRef.current.startPos.x + (e.clientX - contrapartidasDragRef.current.startX),
        y: contrapartidasDragRef.current.startPos.y + (e.clientY - contrapartidasDragRef.current.startY),
      });
    };
    const onUp = () => { contrapartidasDragRef.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [modalContrapartidas]);

  const updateRow = (id: number, field: keyof MovimentoRow, value: string) => {
    setRows((r) =>
      r.map((row) => {
        if (row.id !== id) return row;
        const next = { ...row, [field]: value };
        if (field === 'data_documento') next.data_lim_pag = value;
        return next;
      })
    );
  };

  const removeRow = (id: number) => {
    setRows((r) => r.filter((row) => row.id !== id));
  };

  const updateContrapartidaRow = (id: number, field: keyof ContrapartidaRow, value: string) => {
    setContrapartidasRows((r) => r.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  };

  const openContrapartidas = () => {
    setContrapartidasPos({ x: 0, y: 0 });
    setContrapartidasRows(Array.from({ length: NUM_LINHAS_CONTRAPARTIDAS }, (_, i) => createEmptyContrapartidaRow(nextIdContrapartidas.current++)));
    setModalContrapartidas(true);
  };

  const totalDebitos = rows.reduce((s, r) => s + (r.dc === 'D' ? parseFloat(r.valor) || 0 : 0), 0);
  const totalCreditos = rows.reduce((s, r) => s + (r.dc === 'C' ? parseFloat(r.valor) || 0 : 0), 0);
  const saldo = Math.abs(totalDebitos - totalCreditos);
  const saldoDC: 'D' | 'C' = totalDebitos >= totalCreditos ? 'D' : 'C';

  const rowHasData = (row: MovimentoRow) =>
    (parseFloat(row.valor) || 0) !== 0 ||
    !!([row.cod_grupo, row.codigo_entidade, row.descricao, row.numero_documento].find(Boolean));

  const handleDcChange = (id: number, raw: string) => {
    const v = raw.toUpperCase().slice(-1);
    if (v === '' || v === 'D' || v === 'C') updateRow(id, 'dc', v);
  };

  const handleGuardarInserção = async () => {
    const linhas = rows
      .filter((r) => (parseFloat(r.valor) || 0) !== 0)
      .map((r) => ({
        data: r.data_documento || dataCtb,
        grupo_terceiro: [r.cod_grupo, r.codigo_entidade].filter(Boolean).join(' / ') || undefined,
        valor: parseFloat(r.valor) || 0,
        conta_contabilidade: diario,
        descricao: r.descricao || r.numero_documento || undefined,
      }));
    if (linhas.length === 0) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await terceirosApi.createMovimentos({
        empresa_id: empresaSelecionada?.id,
        linhas,
      });
      setMsg(`${res.created} movimento(s) guardado(s).`);
      seqRef.current += 1;
      setNumero(formatNumeroSequencial(new Date(), seqRef.current));
      setRows([]);
      setTimeout(() => {
        setModalInserção(false);
        setMsg(null);
      }, 1500);
    } catch {
      setMsg(MSG_EM_DESENVOLVIMENTO);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Users className="w-8 h-8 text-amber-400" />
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">Gestão de Terceiros</h1>
          <p className="text-slate-400 text-sm">
            Central de fornecedores de serviços, parceiros e entidades externas. GT / Contabilidade.
          </p>
        </div>
      </div>

      {/* Aba Terceiros: dropdown com sub-dropdowns */}
      <div className="flex items-center gap-2 border-b border-slate-700 pb-4">
        <span className="text-slate-400 text-sm uppercase tracking-wide mr-2">Aba:</span>
        <NestedDropdown
          trigger={
            <button
              type="button"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 text-white font-medium hover:bg-amber-500 transition-colors"
            >
              Terceiros
              <ChevronDown className="w-4 h-4" />
            </button>
          }
          items={TERCEIROS_MENU_ITEMS}
          onSelect={handleTerceirosSelect}
        />
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-700 pb-4">
        {sections.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveSection(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeSection === id
                ? 'bg-amber-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {activeSection === 'visao-geral' && (
        <Card className="border-slate-700 bg-slate-900/50">
          <CardHeader>
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-400" />
              Visão geral
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-slate-300 text-sm">
              Neste módulo pode gerir entidades externas com as quais a empresa trabalha:
              fornecedores de serviços (transportes, armazenagem, subcontratação), parceiros
              comerciais e documentação associada. Use a aba <strong>Terceiros</strong> para
              Movimentos (Inserção/Consulta), Grupos (GT) e ligação à Contabilidade.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-slate-800/60 border border-slate-700">
                <Users className="w-6 h-6 text-sky-400 mb-2" />
                <h3 className="font-medium text-white text-sm">Fornecedores de serviços</h3>
                <p className="text-xs text-slate-500 mt-1">Transportes, logística, outsourcing.</p>
              </div>
              <div className="p-4 rounded-lg bg-slate-800/60 border border-slate-700">
                <Building2 className="w-6 h-6 text-emerald-400 mb-2" />
                <h3 className="font-medium text-white text-sm">Parceiros</h3>
                <p className="text-xs text-slate-500 mt-1">Contratos e acordos comerciais.</p>
              </div>
              <div className="p-4 rounded-lg bg-slate-800/60 border border-slate-700">
                <FileText className="w-6 h-6 text-amber-400 mb-2" />
                <h3 className="font-medium text-white text-sm">Documentos</h3>
                <p className="text-xs text-slate-500 mt-1">Anexos e referências por terceiro.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {activeSection === 'fornecedores-servicos' && (
        <Card className="border-slate-700 bg-slate-900/50">
          <CardHeader>
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-sky-400" />
              Fornecedores de serviços
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-400 text-sm">
              Listagem e ficha de fornecedores de serviços (transportadoras, armazéns, etc.).
              Em desenvolvimento.
            </p>
          </CardContent>
        </Card>
      )}

      {activeSection === 'parceiros' && (
        <Card className="border-slate-700 bg-slate-900/50">
          <CardHeader>
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-emerald-400" />
              Parceiros e contratos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-400 text-sm">
              Gestão de parceiros e contratos com terceiros. Em desenvolvimento.
            </p>
          </CardContent>
        </Card>
      )}

      {activeSection === 'documentos' && (
        <Card className="border-slate-700 bg-slate-900/50">
          <CardHeader>
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-amber-400" />
              Documentos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-400 text-sm">
              Documentação associada a cada terceiro. Em desenvolvimento.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Modal: Movimentos — Inserção (tabela tipo janela) */}
      {modalInserção && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 p-4">
          <div
            className="absolute left-1/2 top-1/2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-auto"
            style={{
              transform: `translate(calc(-50% + ${modalPos.x}px), calc(-50% + ${modalPos.y}px))`,
              width: '720px',
              height: '420px',
              minWidth: '480px',
              minHeight: '280px',
              maxWidth: '96vw',
              maxHeight: '90vh',
              resize: 'both',
            }}
          >
            <div
              className="flex items-center justify-between px-4 py-2 border-b border-slate-700 cursor-move select-none"
              onMouseDown={handleDragStart}
            >
              <h3 className="text-base font-semibold text-white">Introdução de Movimentos</h3>
              <button
                type="button"
                onClick={() => { setModalInserção(false); setModalPos({ x: 0, y: 0 }); setRows([]); setMsg(null); }}
                className="text-slate-400 hover:text-white text-xl leading-none cursor-pointer"
              >
                &times;
              </button>
            </div>
            <div className="p-3 space-y-2">
              {/* Cabeçalho: Tip Ter, Diário, Bancos, Data CTB, Número */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 pb-2 border-b border-slate-700">
                <div>
                  <label className="block text-[10px] text-slate-400 mb-0.5">Tip Ter</label>
                  <input type="text" value={tipTer} onChange={(e) => setTipTer(e.target.value)} placeholder="%" className="w-full bg-slate-800 border border-slate-600 rounded px-1.5 py-1 text-white text-xs" />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-0.5">Diário</label>
                  <input type="text" value={diario} onChange={(e) => { setDiario(e.target.value); setBancos(e.target.value === 'B001' ? 'Bancos' : e.target.value); }} className="w-full bg-slate-800 border border-slate-600 rounded px-1.5 py-1 text-white text-xs" />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-0.5">Bancos</label>
                  <input type="text" value={bancos} readOnly className="w-full bg-slate-800/60 border border-slate-600 rounded px-1.5 py-1 text-slate-300 text-xs" />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-0.5">Data CTB</label>
                  <input type="text" value={dataCtb} onChange={(e) => setDataCtb(e.target.value)} placeholder="AAAA-MM-DD" className="w-full bg-slate-800 border border-slate-600 rounded px-1.5 py-1 text-white text-xs" />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-0.5">Número</label>
                  <input type="text" value={numero} readOnly className="w-full bg-slate-800/60 border border-slate-600 rounded px-1.5 py-1 text-slate-300 text-xs font-mono" />
                </div>
              </div>

              {/* Tabela de linhas */}
              <div className="flex justify-end mb-1">
                <button type="button" onClick={addRow} className="flex items-center gap-1 px-2 py-1 rounded bg-slate-700 text-slate-200 hover:bg-slate-600 text-xs">
                  <Plus className="w-3 h-3" />
                  Adicionar linha
                </button>
              </div>
              <div className="overflow-auto border border-slate-500 rounded bg-slate-700/30 flex-1 min-h-0" style={{ maxHeight: '180px' }}>
                <table className="w-full text-xs border-collapse table-fixed" style={{ border: '1px solid #475569' }}>
                  <thead className="sticky top-0 bg-slate-700 z-10">
                    <tr>
                      <th className="text-left py-1 px-1 text-slate-300 font-medium border border-slate-500">Cód Grupo</th>
                      <th className="text-left py-1 px-1 text-slate-300 font-medium border border-slate-500">Código Ent.</th>
                      <th className="text-left py-1 px-1 text-slate-300 font-medium border border-slate-500">Tipo Doc</th>
                      <th className="text-left py-1 px-1 text-slate-300 font-medium border border-slate-500">Descrição</th>
                      <th className="text-left py-1 px-1 text-slate-300 font-medium border border-slate-500">Nº Doc.</th>
                      <th className="text-left py-1 px-1 text-slate-300 font-medium w-20 border border-slate-500">Data Doc.</th>
                      <th className="text-left py-1 px-1 text-slate-300 font-medium w-20 border border-slate-500">Data Lim.Pag</th>
                      <th className="text-right py-1 px-1 text-slate-300 font-medium w-16 border border-slate-500">Valor</th>
                      <th className="text-center py-1 px-1 text-slate-300 font-medium w-10 border border-slate-500">D/C</th>
                      <th className="w-8 border border-slate-500"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id} className={rowHasData(row) ? 'bg-amber-950/50' : 'bg-slate-700/50'}>
                        <td className="border border-slate-500 p-0 align-middle"><input value={row.cod_grupo} onChange={(e) => updateRow(row.id, 'cod_grupo', e.target.value)} className="w-full min-w-0 bg-transparent border-0 rounded-none px-1 py-0.5 text-white text-xs focus:ring-1 focus:ring-amber-500 focus:bg-slate-600/50" /></td>
                        <td className="border border-slate-500 p-0 align-middle"><input value={row.codigo_entidade} onChange={(e) => updateRow(row.id, 'codigo_entidade', e.target.value)} className="w-full min-w-0 bg-transparent border-0 rounded-none px-1 py-0.5 text-white text-xs focus:ring-1 focus:ring-amber-500 focus:bg-slate-600/50" /></td>
                        <td className="border border-slate-500 p-0 align-middle"><input value={row.tipo_doc} onChange={(e) => updateRow(row.id, 'tipo_doc', e.target.value)} className="w-full min-w-0 bg-transparent border-0 rounded-none px-1 py-0.5 text-white text-xs focus:ring-1 focus:ring-amber-500 focus:bg-slate-600/50" /></td>
                        <td className="border border-slate-500 p-0 align-middle"><input value={row.descricao} onChange={(e) => updateRow(row.id, 'descricao', e.target.value)} className="w-full min-w-0 bg-transparent border-0 rounded-none px-1 py-0.5 text-white text-xs focus:ring-1 focus:ring-amber-500 focus:bg-slate-600/50" /></td>
                        <td className="border border-slate-500 p-0 align-middle"><input value={row.numero_documento} onChange={(e) => updateRow(row.id, 'numero_documento', e.target.value)} className="w-full min-w-0 bg-transparent border-0 rounded-none px-1 py-0.5 text-white text-xs focus:ring-1 focus:ring-amber-500 focus:bg-slate-600/50" /></td>
                        <td className="border border-slate-500 p-0 align-middle"><input type="text" value={row.data_documento} onChange={(e) => updateRow(row.id, 'data_documento', e.target.value)} placeholder="AAAA-MM-DD" className="w-full min-w-0 bg-transparent border-0 rounded-none px-1 py-0.5 text-white text-xs focus:ring-1 focus:ring-amber-500 focus:bg-slate-600/50" /></td>
                        <td className="border border-slate-500 p-0 align-middle"><input type="text" value={row.data_lim_pag} onChange={(e) => updateRow(row.id, 'data_lim_pag', e.target.value)} placeholder="AAAA-MM-DD" className="w-full min-w-0 bg-transparent border-0 rounded-none px-1 py-0.5 text-white text-xs focus:ring-1 focus:ring-amber-500 focus:bg-slate-600/50" /></td>
                        <td className="border border-slate-500 p-0 align-middle"><input type="number" step="0.01" value={row.valor} onChange={(e) => updateRow(row.id, 'valor', e.target.value)} placeholder="0" className="w-full min-w-0 bg-transparent border-0 rounded-none px-1 py-0.5 text-white text-xs text-right focus:ring-1 focus:ring-amber-500 focus:bg-slate-600/50" /></td>
                        <td className="border border-slate-500 p-0 align-middle"><input type="text" maxLength={1} value={row.dc} onChange={(e) => handleDcChange(row.id, e.target.value)} placeholder="D" className="w-full min-w-0 bg-transparent border-0 rounded-none px-0.5 py-0.5 text-white text-xs text-center focus:ring-1 focus:ring-amber-500 focus:bg-slate-600/50 uppercase" /></td>
                        <td className="border border-slate-500 px-0.5 py-0.5 text-center align-middle"><button type="button" onClick={() => removeRow(row.id)} className="text-slate-500 hover:text-red-400 text-xs">✕</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Rodapé: totais e botões */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-700">
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-slate-500">Total Débitos <span className="text-white font-medium">{totalDebitos.toFixed(2)} €</span></span>
                  <span className="text-slate-500">Total Créditos <span className="text-white font-medium">{totalCreditos.toFixed(2)} €</span></span>
                  <span className="text-slate-500">Saldo <span className="text-amber-400 font-medium">{saldo.toFixed(2)} € ({saldoDC})</span></span>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  <button type="button" onClick={() => setMsg(MSG_EM_DESENVOLVIMENTO)} className="px-2 py-1 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 text-xs">Extrato</button>
                  <button type="button" onClick={() => setMsg(MSG_EM_DESENVOLVIMENTO)} className="px-2 py-1 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 text-xs">Seleção Mov. Regularizar</button>
                  <button type="button" onClick={openContrapartidas} className="px-2 py-1 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 text-xs">Contrapartidas CTB</button>
                  <button type="button" onClick={() => { setModalInserção(false); setModalPos({ x: 0, y: 0 }); setRows([]); setMsg(null); }} className="px-3 py-1.5 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 text-xs">Fechar</button>
                  <button type="button" onClick={handleGuardarInserção} disabled={saving} className="flex items-center gap-1 px-3 py-1.5 rounded bg-amber-600 text-white hover:bg-amber-500 disabled:opacity-50 text-xs">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Guardar
                  </button>
                </div>
              </div>
              {msg && (
                <p className={`text-sm ${msg === MSG_EM_DESENVOLVIMENTO ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {msg}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Contrapartidas CTB (abre ao clicar em Contrapartidas CTB na Introdução) */}
      {modalContrapartidas && (
        <div className="fixed inset-0 z-[60] overflow-y-auto bg-black/70 p-4">
          <div
            className="absolute left-1/2 top-1/2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-auto"
            style={{
              transform: `translate(calc(-50% + ${contrapartidasPos.x}px), calc(-50% + ${contrapartidasPos.y}px))`,
              width: '800px',
              height: '480px',
              minWidth: '520px',
              minHeight: '320px',
              maxWidth: '96vw',
              maxHeight: '90vh',
              resize: 'both',
            }}
          >
            <div
              className="flex items-center justify-between px-4 py-2 bg-blue-700 border-b border-blue-600 cursor-move select-none rounded-t-xl"
              onMouseDown={handleContrapartidasDragStart}
            >
              <h3 className="text-base font-semibold text-white">Contrapartidas CTB</h3>
              <button
                type="button"
                onClick={() => { setModalContrapartidas(false); setContrapartidasPos({ x: 0, y: 0 }); }}
                className="text-slate-200 hover:text-white text-xl leading-none cursor-pointer"
              >
                &times;
              </button>
            </div>
            <div className="p-3 space-y-2">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 pb-2 border-b border-slate-700">
                <div>
                  <label className="block text-[10px] text-slate-400 mb-0.5">Tip Ter</label>
                  <input type="text" value={tipTer} onChange={(e) => setTipTer(e.target.value)} placeholder="%" className="w-full bg-slate-800 border border-slate-600 rounded px-1.5 py-1 text-white text-xs" />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-0.5">Diário</label>
                  <input type="text" value={diario} className="w-full bg-slate-800/80 border border-slate-600 rounded px-1.5 py-1 text-white text-xs" readOnly />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-0.5">Bancos</label>
                  <input type="text" value={bancos} className="w-full bg-slate-800/80 border border-slate-600 rounded px-1.5 py-1 text-slate-300 text-xs" readOnly />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-0.5">Data CTB</label>
                  <input type="text" value={dataCtb} className="w-full bg-slate-800 border border-slate-600 rounded px-1.5 py-1 text-white text-xs" readOnly />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-0.5">Número</label>
                  <input type="text" value={numero} className="w-full bg-slate-800/80 border border-slate-600 rounded px-1.5 py-1 text-slate-300 text-xs font-mono" readOnly />
                </div>
              </div>

              <div className="overflow-auto border border-slate-500 rounded bg-slate-700/30 flex-1 min-h-0" style={{ maxHeight: '200px' }}>
                <table className="w-full text-xs border-collapse table-fixed" style={{ border: '1px solid #475569' }}>
                  <thead className="sticky top-0 bg-slate-700 z-10">
                    <tr>
                      <th className="text-left py-1 px-1 text-slate-300 font-medium border border-slate-500">Cod Mov</th>
                      <th className="text-left py-1 px-1 text-slate-300 font-medium border border-slate-500">Descrição</th>
                      <th className="text-left py-1 px-1 text-slate-300 font-medium border border-slate-500">Conta</th>
                      <th className="text-center py-1 px-1 text-slate-300 font-medium w-10 border border-slate-500">D/C</th>
                      <th className="text-left py-1 px-1 text-slate-300 font-medium border border-slate-500">Centro Custo</th>
                      <th className="text-center py-1 px-1 text-slate-300 font-medium w-10 border border-slate-500">D/C</th>
                      <th className="text-left py-1 px-1 text-slate-300 font-medium border border-slate-500">Sub-Centro</th>
                      <th className="text-right py-1 px-1 text-slate-300 font-medium w-16 border border-slate-500">Valor</th>
                      <th className="text-center py-1 px-1 text-slate-300 font-medium w-10 border border-slate-500">D/C</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contrapartidasRows.map((row) => (
                      <tr key={row.id} className="bg-slate-700/50">
                        <td className="border border-slate-500 p-0 align-middle"><input value={row.cod_mov} onChange={(e) => updateContrapartidaRow(row.id, 'cod_mov', e.target.value)} className="w-full min-w-0 bg-transparent border-0 rounded-none px-1 py-0.5 text-white text-xs focus:ring-1 focus:ring-amber-500 focus:bg-slate-600/50" /></td>
                        <td className="border border-slate-500 p-0 align-middle"><input value={row.descricao} onChange={(e) => updateContrapartidaRow(row.id, 'descricao', e.target.value)} className="w-full min-w-0 bg-transparent border-0 rounded-none px-1 py-0.5 text-white text-xs focus:ring-1 focus:ring-amber-500 focus:bg-slate-600/50" /></td>
                        <td className="border border-slate-500 p-0 align-middle"><input value={row.conta} onChange={(e) => updateContrapartidaRow(row.id, 'conta', e.target.value)} className="w-full min-w-0 bg-transparent border-0 rounded-none px-1 py-0.5 text-white text-xs focus:ring-1 focus:ring-amber-500 focus:bg-slate-600/50" /></td>
                        <td className="border border-slate-500 p-0 align-middle"><input type="text" maxLength={1} value={row.dc_conta} onChange={(e) => { const v = e.target.value.toUpperCase(); if (v === '' || v === 'D' || v === 'C') updateContrapartidaRow(row.id, 'dc_conta', v); }} className="w-full min-w-0 bg-transparent border-0 rounded-none px-0.5 py-0.5 text-white text-xs text-center uppercase" /></td>
                        <td className="border border-slate-500 p-0 align-middle"><input value={row.centro_custo} onChange={(e) => updateContrapartidaRow(row.id, 'centro_custo', e.target.value)} className="w-full min-w-0 bg-transparent border-0 rounded-none px-1 py-0.5 text-white text-xs focus:ring-1 focus:ring-amber-500 focus:bg-slate-600/50" /></td>
                        <td className="border border-slate-500 p-0 align-middle"><input type="text" maxLength={1} value={row.dc_centro} onChange={(e) => { const v = e.target.value.toUpperCase(); if (v === '' || v === 'D' || v === 'C') updateContrapartidaRow(row.id, 'dc_centro', v); }} className="w-full min-w-0 bg-transparent border-0 rounded-none px-0.5 py-0.5 text-white text-xs text-center uppercase" /></td>
                        <td className="border border-slate-500 p-0 align-middle"><input value={row.sub_centro} onChange={(e) => updateContrapartidaRow(row.id, 'sub_centro', e.target.value)} className="w-full min-w-0 bg-transparent border-0 rounded-none px-1 py-0.5 text-white text-xs focus:ring-1 focus:ring-amber-500 focus:bg-slate-600/50" /></td>
                        <td className="border border-slate-500 p-0 align-middle"><input type="number" step="0.01" value={row.valor} onChange={(e) => updateContrapartidaRow(row.id, 'valor', e.target.value)} className="w-full min-w-0 bg-transparent border-0 rounded-none px-1 py-0.5 text-white text-xs text-right focus:ring-1 focus:ring-amber-500 focus:bg-slate-600/50" /></td>
                        <td className="border border-slate-500 p-0 align-middle"><input type="text" maxLength={1} value={row.dc_valor} onChange={(e) => { const v = e.target.value.toUpperCase(); if (v === '' || v === 'D' || v === 'C') updateContrapartidaRow(row.id, 'dc_valor', v); }} className="w-full min-w-0 bg-transparent border-0 rounded-none px-0.5 py-0.5 text-white text-xs text-center uppercase" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="border border-slate-600 rounded bg-slate-800/80 p-2 space-y-1.5 text-xs overflow-x-auto">
                <div className="flex flex-wrap items-center gap-4">
                  <span className="text-slate-400">CTB Geral (Débito/Crédito/Saldo)</span>
                  <input type="text" readOnly value="232.80" className="w-20 bg-slate-700 border border-slate-600 rounded px-1.5 py-0.5 text-right text-slate-300" />
                  <input type="text" readOnly value="10,000.00" className="w-20 bg-slate-700 border border-slate-600 rounded px-1.5 py-0.5 text-right text-slate-300" />
                  <input type="text" readOnly value="9,767.20 C" className="w-24 bg-slate-700 border border-slate-600 rounded px-1.5 py-0.5 text-right text-slate-300" />
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <span className="text-slate-400">CTB Analít (Débito/Crédito/Saldo)</span>
                  <input type="text" readOnly value="232.80" className="w-20 bg-slate-700 border border-slate-600 rounded px-1.5 py-0.5 text-right text-slate-300" />
                  <input type="text" readOnly value="0.00" className="w-20 bg-slate-700 border border-slate-600 rounded px-1.5 py-0.5 text-right text-slate-300" />
                  <input type="text" readOnly value="232.00 D" className="w-24 bg-slate-700 border border-slate-600 rounded px-1.5 py-0.5 text-right text-slate-300" />
                </div>
                <div>
                  <span className="text-slate-400">Conta/Seg Seg/Subcentro</span>
                </div>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-slate-700">
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setMsg(MSG_EM_DESENVOLVIMENTO)} className="px-2 py-1 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 text-xs">Extrato</button>
                  <button
                    type="button"
                    onClick={() => { setModalContrapartidas(false); setContrapartidasPos({ x: 0, y: 0 }); }}
                    className="flex items-center gap-1 px-2 py-1.5 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 text-xs"
                    title="Voltar à Introdução de Movimentos"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Voltar
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setMsg(MSG_EM_DESENVOLVIMENTO)}
                  className="px-3 py-1.5 rounded bg-amber-600 text-white hover:bg-amber-500 text-xs"
                  title="Confirmar movimento"
                >
                  Confirmar movimento
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Consulta (placeholder) */}
      {modalConsulta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Movimentos — Consulta</h3>
              <button type="button" onClick={() => setModalConsulta(false)} className="text-slate-400 hover:text-white text-xl">&times;</button>
            </div>
            <p className="text-slate-400 text-sm">Consulta de movimentos GT. Em desenvolvimento (ligação à base de dados).</p>
            <div className="mt-4 flex justify-end">
              <button type="button" onClick={() => setModalConsulta(false)} className="px-4 py-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 text-sm">Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
