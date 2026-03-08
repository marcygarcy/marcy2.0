'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Users, FileText, Building2, ChevronDown, Plus, Loader2, ArrowLeft, BookOpen, Eye, Pencil, Save } from 'lucide-react';
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

const TABELAS_MENU_ITEMS: NestedDropdownItem[] = [
  {
    value: 'diarios',
    label: 'Diários',
    children: [
      { value: 'diarios-inserir', label: 'Inserção' },
      { value: 'diarios-consultar', label: 'Consulta' },
      { value: 'diarios-listar', label: 'Listar' },
    ],
  },
  {
    value: 'plano-contas',
    label: 'Plano de Contas',
    children: [
      { value: 'plano-inserir', label: 'Inserção' },
      { value: 'plano-consultar', label: 'Consulta' },
    ],
  },
  {
    value: 'centros-custo',
    label: 'Centros de Custo',
    children: [
      { value: 'centros-listar', label: 'Listar' },
      { value: 'centros-novo', label: 'Novo' },
    ],
  },
];

const TERCEIROS_MENU_ITEMS: NestedDropdownItem[] = [
  {
    value: 'movimentos',
    label: 'Movimentos',
    children: [
      { value: 'insercao', label: 'Inserção' },
      { value: 'consulta', label: 'Consulta/Manutenção' },
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

/** Pesquisa com wildcard % (ex: %2026%01% → contém "2026" e "01") */
function wildcardMatch(pattern: string, value: string): boolean {
  if (!pattern || pattern === '%') return true;
  const parts = pattern.split('%').map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp('^' + parts.join('.*') + '$', 'i').test(value);
}

/** Formata data no Tab: 20260301 → 2026/03/01 · 2026-03-01 → 2026/03/01 */
function formatDateInput(v: string): string {
  const digits = v.replace(/\D/g, '');
  if (digits.length === 8) {
    return `${digits.slice(0, 4)}/${digits.slice(4, 6)}/${digits.slice(6, 8)}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v.replace(/-/g, '/');
  return v;
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
  const { empresaSelecionada } = useApp();
  const [activeSection, setActiveSection] = useState<string>('visao-geral');
  // Tabelas — Diários
  const [modalDiarios, setModalDiarios] = useState(false);
  const [diariosPos, setDiariosPos] = useState({ x: 0, y: 0 });
  const diariosRef = React.useRef<{ startX: number; startY: number; startPos: { x: number; y: number } } | null>(null);
  type DiarioRow = { id: number; diario: string; descricao: string };
  const [diarioRows, setDiarioRows] = useState<DiarioRow[]>([]);
  const [savedDiarios, setSavedDiarios] = useState<DiarioRow[]>([]);
  // Movimentos guardados localmente (mock enquanto backend não existe)
  type MovLocalItem = { id: number; referencia: string; diario: string; numero: string; data: string; descricao: string; valor: number; grupo_terceiro: string };
  const [movimentosLocais, setMovimentosLocais] = useState<MovLocalItem[]>([]);
  const nextMovLocalId = React.useRef(1);
  const movimentosLocaisRef = React.useRef<MovLocalItem[]>([]);
  React.useEffect(() => { movimentosLocaisRef.current = movimentosLocais; }, [movimentosLocais]);
  const nextDiarioId = React.useRef(1);
  const [modalConsultaTabelas, setModalConsultaTabelas] = useState(false);
  const [consultaTabelasTitle, setConsultaTabelasTitle] = useState('');
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
  const [movimentoConfirmado, setMovimentoConfirmado] = useState(false);
  // Consulta Movimentos — uma linha de critérios, resultados na mesma tabela
  const [consultaFiltro, setConsultaFiltro] = useState({ diario: '', descricao: '', numero: '' });
  const [consultaResultados, setConsultaResultados] = useState<any[]>([]);
  const [consultaSearching, setConsultaSearching] = useState(false);
  const [consultaPos, setConsultaPos] = useState({ x: 0, y: 0 });
  const consultaRef = React.useRef<{ startX: number; startY: number; startPos: { x: number; y: number } } | null>(null);
  const consultaFiltroRef = React.useRef(consultaFiltro);
  React.useEffect(() => { consultaFiltroRef.current = consultaFiltro; }, [consultaFiltro]);

  const getDescricaoDiario = (codigo: string) => {
    if (!codigo.trim()) return '';
    const c = codigo.trim().toUpperCase();
    const found = savedDiarios.find(r => String(r.diario).toUpperCase() === c);
    if (found?.descricao) return found.descricao;
    if (c === 'B001') return 'Bancos';
    return '';
  };
  const [selectedMovimentoVer, setSelectedMovimentoVer] = useState<any>(null);
  const [selectedMovimentoEdit, setSelectedMovimentoEdit] = useState<any>(null);
  const [manutencaoForm, setManutencaoForm] = useState<{ data_mov: string; grupo_terceiro: string; valor: string; conta_contabilidade: string; descricao: string }>({ data_mov: '', grupo_terceiro: '', valor: '', conta_contabilidade: '', descricao: '' });
  const [manutencaoSaving, setManutencaoSaving] = useState(false);
  // Janela Manutenção (igual à Inserção): arrastável, com tabela e Contrapartidas
  const [modalManutencao, setModalManutencao] = useState(false);
  const [manutencaoRows, setManutencaoRows] = useState<MovimentoRow[]>([]);
  const [movimentoIdEmEdicao, setMovimentoIdEmEdicao] = useState<number | null>(null);
  const [manutencaoPos, setManutencaoPos] = useState({ x: 0, y: 0 });
  const manutencaoDragRef = React.useRef<{ startX: number; startY: number; startPos: { x: number; y: number } } | null>(null);
  const nextIdManutencao = React.useRef(1);

  const sections = [
    { id: 'visao-geral', label: 'Visão geral', icon: Users },
    { id: 'fornecedores-servicos', label: 'Fornecedores de serviços', icon: Users },
    { id: 'parceiros', label: 'Parceiros e contratos', icon: Building2 },
    { id: 'documentos', label: 'Documentos', icon: FileText },
  ];

  // ── Drag modal Diários ────────────────────────────────────────────────────
  React.useEffect(() => {
    if (!modalDiarios) return;
    const onMove = (e: MouseEvent) => {
      if (!diariosRef.current) return;
      setDiariosPos({
        x: diariosRef.current.startPos.x + (e.clientX - diariosRef.current.startX),
        y: diariosRef.current.startPos.y + (e.clientY - diariosRef.current.startY),
      });
    };
    const onUp = () => { diariosRef.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [modalDiarios]);

  // ── Drag + F8 modal Consulta Movimentos ───────────────────────────────────
  React.useEffect(() => {
    if (!modalConsulta) return;
    const onMove = (e: MouseEvent) => {
      if (!consultaRef.current) return;
      setConsultaPos({
        x: consultaRef.current.startPos.x + (e.clientX - consultaRef.current.startX),
        y: consultaRef.current.startPos.y + (e.clientY - consultaRef.current.startY),
      });
    };
    const onUp = () => { consultaRef.current = null; };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F8') { e.preventDefault(); handlePesquisarMovimentos(consultaFiltroRef.current); }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('keydown', onKey);
    };
  }, [modalConsulta]);

  const handlePesquisarMovimentos = async (filtro: { diario: string; descricao: string; numero: string }) => {
    setConsultaSearching(true);
    setConsultaResultados([]);

    let ano: number | undefined;
    let mes: number | undefined;
    const num = (filtro.numero || '').trim();
    const matchAnoMes = num.match(/%(\d{4})%(\d{1,2})%/);
    if (matchAnoMes) {
      ano = parseInt(matchAnoMes[1], 10);
      mes = parseInt(matchAnoMes[2], 10);
    }

    try {
      const { items } = await terceirosApi.listMovimentos({
        empresa_id: empresaSelecionada?.id,
        limit: 200,
        offset: 0,
        conta_contabilidade: filtro.diario?.trim() || undefined,
        ano,
        mes,
      });
      const list = items.map((m: { id: number; data_mov: string | null; grupo_terceiro: string | null; valor: number; conta_contabilidade: string | null; descricao: string | null }) => ({
        id: m.id,
        conta_contabilidade: m.conta_contabilidade ?? '',
        numero_documento: String(m.id),
        descricao: m.descricao ?? m.grupo_terceiro ?? '—',
        data: m.data_mov ?? '',
        valor: m.valor,
        grupo_terceiro: m.grupo_terceiro ?? '',
      }));
      setConsultaResultados(list);
    } catch {
      setConsultaResultados([]);
    } finally {
      setConsultaSearching(false);
    }
  };

  const openManutencaoModal = (r: any) => {
    setDiario(r.conta_contabilidade || '');
    setBancos(getDescricaoDiario(r.conta_contabilidade || '') || 'Bancos');
    setDataCtb(r.data || '');
    setNumero(String(r.id ?? ''));
    setManutencaoRows([{
      id: nextIdManutencao.current++,
      cod_grupo: '',
      codigo_entidade: '',
      tipo_doc: '',
      descricao: r.descricao ?? r.grupo_terceiro ?? '',
      numero_documento: '',
      data_documento: r.data ?? '',
      data_lim_pag: r.data ?? '',
      valor: r.valor != null ? String(r.valor) : '',
      dc: '',
    }]);
    setMovimentoIdEmEdicao(r.id);
    setManutencaoPos({ x: 0, y: 0 });
    setSelectedMovimentoEdit(null);
    setModalManutencao(true);
  };

  const updateManutencaoRow = (id: number, field: keyof MovimentoRow, value: string) => {
    setManutencaoRows(prev =>
      prev.map(row => {
        if (row.id !== id) return row;
        const next = { ...row, [field]: value };
        if (field === 'data_documento') next.data_lim_pag = value;
        return next;
      })
    );
  };
  const addManutencaoRow = () => setManutencaoRows(prev => [...prev, createEmptyRow(nextIdManutencao.current++)]);
  const removeManutencaoRow = (id: number) => setManutencaoRows(prev => prev.filter(row => row.id !== id));

  const totalDebitosM = manutencaoRows.reduce((s, r) => s + (r.dc === 'D' ? parseFloat(r.valor) || 0 : 0), 0);
  const totalCreditosM = manutencaoRows.reduce((s, r) => s + (r.dc === 'C' ? parseFloat(r.valor) || 0 : 0), 0);
  const saldoM = Math.abs(totalDebitosM - totalCreditosM);
  const saldoDCM: 'D' | 'C' = totalDebitosM >= totalCreditosM ? 'D' : 'C';

  const handleGuardarManutencao = async () => {
    if (movimentoIdEmEdicao == null || manutencaoRows.length === 0) return;
    const row = manutencaoRows[0];
    setManutencaoSaving(true);
    try {
      const valorNum = parseFloat(row.valor);
      await terceirosApi.updateMovimento(movimentoIdEmEdicao, {
        data_mov: row.data_documento || undefined,
        grupo_terceiro: [row.cod_grupo, row.codigo_entidade].filter(Boolean).join(' / ') || row.descricao || undefined,
        valor: Number.isNaN(valorNum) ? undefined : valorNum,
        conta_contabilidade: diario || undefined,
        descricao: row.descricao || undefined,
      });
      setModalManutencao(false);
      setMovimentoIdEmEdicao(null);
      setManutencaoRows([]);
      await handlePesquisarMovimentos(consultaFiltroRef.current);
      setMsg('Alterações guardadas.');
    } catch {
      setMsg('Erro ao guardar alterações.');
    } finally {
      setManutencaoSaving(false);
    }
  };

  React.useEffect(() => {
    if (!modalManutencao) return;
    const onMove = (e: MouseEvent) => {
      if (!manutencaoDragRef.current) return;
      setManutencaoPos({
        x: manutencaoDragRef.current.startPos.x + (e.clientX - manutencaoDragRef.current.startX),
        y: manutencaoDragRef.current.startPos.y + (e.clientY - manutencaoDragRef.current.startY),
      });
    };
    const onUp = () => { manutencaoDragRef.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [modalManutencao]);

  const handleTabelasSelect = (value: string) => {
    setMsg(null);
    if (value === 'diarios-inserir') {
      setDiarioRows(Array.from({ length: 10 }, () => ({
        id: nextDiarioId.current++,
        diario: '', descricao: '',
      })));
      setDiariosPos({ x: 0, y: 0 });
      setModalDiarios(true);
    } else if (value === 'diarios-consultar') {
      setConsultaTabelasTitle('Diários — Consulta');
      setModalConsultaTabelas(true);
    } else if (value === 'diarios-listar') {
      setConsultaTabelasTitle('Diários — Listagem');
      setModalConsultaTabelas(true);
    } else {
      setMsg(MSG_EM_DESENVOLVIMENTO);
    }
  };

  const handleTerceirosSelect = (value: string) => {
    if (value === 'insercao') {
      const today = new Date();
      setDataCtb(today.toISOString().slice(0, 10));
      setNumero(formatNumeroSequencial(today, seqRef.current));
      setMsg(null);
      setModalPos({ x: 0, y: 0 });
      setRows(Array.from({ length: NUM_LINHAS_TABELA }, (_, i) => createEmptyRow(nextId.current++)));
      setModalInserção(true);
    } else if (value === 'consulta') {
      setConsultaFiltro({ diario: '', descricao: '', numero: '' });
      setConsultaResultados([]);
      setSelectedMovimentoVer(null);
      setSelectedMovimentoEdit(null);
      setConsultaPos({ x: 0, y: 0 });
      setModalConsulta(true);
    }
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
    const referencia = `${diario}/${numero}`;
    const finalizarGuardar = (nLinhas: number, simulado: boolean) => {
      setMovimentosLocais(prev => [
        ...prev,
        ...linhas.map(l => ({
          id: nextMovLocalId.current++,
          referencia,
          diario,
          numero,
          data: l.data || dataCtb,
          descricao: l.descricao || '',
          valor: l.valor,
          grupo_terceiro: l.grupo_terceiro || '',
        })),
      ]);
      setMsg(`Movimento ${referencia} guardado (${nLinhas} linha(s))${simulado ? ' — modo teste' : ''}.`);
      seqRef.current += 1;
      setNumero(formatNumeroSequencial(new Date(), seqRef.current));
      setRows(Array.from({ length: NUM_LINHAS_TABELA }, (_, i) => createEmptyRow(nextId.current++)));
      setMovimentoConfirmado(false);
      setContrapartidasRows([]);
      setTimeout(() => setMsg(null), 3000);
    };

    try {
      const res = await terceirosApi.createMovimentos({
        empresa_id: empresaSelecionada?.id,
        linhas,
      });
      finalizarGuardar(res.created ?? linhas.length, false);
    } catch {
      // Backend não disponível → guarda localmente para continuar a testar
      finalizarGuardar(linhas.length, true);
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

      {/* Abas: Tabelas + Terceiros */}
      <div className="flex items-center gap-2 border-b border-slate-700 pb-4">
        <span className="text-slate-400 text-sm uppercase tracking-wide mr-2">Aba:</span>
        {/* Tabelas (à esquerda) */}
        <NestedDropdown
          trigger={
            <button
              type="button"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 text-white font-medium hover:bg-slate-600 transition-colors"
            >
              <BookOpen className="w-4 h-4" />
              Tabelas
              <ChevronDown className="w-4 h-4" />
            </button>
          }
          items={TABELAS_MENU_ITEMS}
          onSelect={handleTabelasSelect}
        />
        {/* Terceiros (à direita) */}
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
              Movimentos (Inserção ou Consulta/Manutenção), Grupos (GT) e ligação à Contabilidade.
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

      {/* ══ Modal: Tabelas — Diários Inserção ══════════════════════════════ */}
      {modalDiarios && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 p-4">
          <div
            className="absolute left-1/2 top-1/2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-auto"
            style={{
              transform: `translate(calc(-50% + ${diariosPos.x}px), calc(-50% + ${diariosPos.y}px))`,
              width: '580px', height: '360px',
              minWidth: '400px', minHeight: '240px',
              maxWidth: '96vw', maxHeight: '90vh',
              resize: 'both',
            }}
          >
            <div
              className="flex items-center justify-between px-4 py-2 border-b border-slate-700 cursor-move select-none"
              onMouseDown={(e) => {
                if ((e.target as HTMLElement).closest('button')) return;
                diariosRef.current = { startX: e.clientX, startY: e.clientY, startPos: { ...diariosPos } };
              }}
            >
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-amber-400" />
                Diários — Inserção
              </h3>
              <button type="button" onClick={() => { setModalDiarios(false); setDiariosPos({ x: 0, y: 0 }); setMsg(null); }} className="text-slate-400 hover:text-white text-xl leading-none cursor-pointer">&times;</button>
            </div>
            <div className="p-3 space-y-2">
              <div className="flex justify-end mb-1">
                <button type="button" onClick={() => setDiarioRows(r => [...r, { id: nextDiarioId.current++, diario: '', descricao: '' }])} className="flex items-center gap-1 px-2 py-1 rounded bg-slate-700 text-slate-200 hover:bg-slate-600 text-xs">
                  <Plus className="w-3 h-3" /> Adicionar linha
                </button>
              </div>
              <div className="overflow-auto border border-slate-500 rounded bg-slate-700/30" style={{ maxHeight: '200px' }}>
                <table className="w-full text-xs border-collapse table-fixed" style={{ border: '1px solid #475569' }}>
                  <thead className="sticky top-0 bg-slate-700 z-10">
                    <tr>
                      <th className="text-left py-1 px-2 text-slate-300 font-medium border border-slate-500 w-32">Diário</th>
                      <th className="text-left py-1 px-2 text-slate-300 font-medium border border-slate-500">Descrição</th>
                      <th className="w-8 border border-slate-500"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {diarioRows.map((row) => (
                      <tr key={row.id} className={row.diario || row.descricao ? 'bg-amber-950/50' : 'bg-slate-700/50'}>
                        <td className="border border-slate-500 p-0 align-middle">
                          <input value={row.diario} onChange={(e) => setDiarioRows(r => r.map(x => x.id === row.id ? { ...x, diario: e.target.value.toUpperCase() } : x))} placeholder="B001" className="w-full min-w-0 bg-transparent border-0 px-2 py-1 text-white text-xs focus:ring-1 focus:ring-amber-500 focus:bg-slate-600/50 font-mono uppercase" />
                        </td>
                        <td className="border border-slate-500 p-0 align-middle">
                          <input value={row.descricao} onChange={(e) => setDiarioRows(r => r.map(x => x.id === row.id ? { ...x, descricao: e.target.value } : x))} placeholder="Ex: Bancos" className="w-full min-w-0 bg-transparent border-0 px-2 py-1 text-white text-xs focus:ring-1 focus:ring-amber-500 focus:bg-slate-600/50" />
                        </td>
                        <td className="border border-slate-500 px-1 py-0.5 text-center align-middle">
                          <button type="button" onClick={() => setDiarioRows(r => r.filter(x => x.id !== row.id))} className="text-slate-500 hover:text-red-400 text-xs">✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-700">
                <p className="text-xs text-slate-500">{diarioRows.filter(r => r.diario || r.descricao).length} diário(s) preenchido(s)</p>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => { setModalDiarios(false); setDiariosPos({ x: 0, y: 0 }); setMsg(null); }} className="px-3 py-1.5 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 text-xs">Fechar</button>
                  <button type="button" onClick={() => {
                    const novas = diarioRows.filter(r => r.diario || r.descricao);
                    if (!novas.length) return;
                    setSavedDiarios(prev => {
                      const existentes = new Set(prev.map(x => x.diario));
                      const novasUnicas = novas.filter(x => x.diario && !existentes.has(x.diario));
                      return [...prev, ...novasUnicas];
                    });
                    setMsg(`${novas.length} diário(s) guardado(s).`);
                    setTimeout(() => { setModalDiarios(false); setMsg(null); }, 1500);
                  }} className="px-3 py-1.5 rounded bg-amber-600 text-white hover:bg-amber-500 text-xs">Guardar</button>
                </div>
              </div>
              {msg && <p className="text-sm text-emerald-400">{msg}</p>}
            </div>
          </div>
        </div>
      )}

      {/* ══ Modal: Tabelas — Diários Consulta/Listar ══════════════════════ */}
      {modalConsultaTabelas && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 p-4">
          <div
            className="absolute left-1/2 top-1/2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-auto"
            style={{
              transform: 'translate(-50%, -50%)',
              width: '520px', height: '360px',
              minWidth: '360px', minHeight: '240px',
              maxWidth: '96vw', maxHeight: '90vh',
              resize: 'both',
            }}
          >
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700 select-none">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-amber-400" />
                {consultaTabelasTitle}
              </h3>
              <button type="button" onClick={() => setModalConsultaTabelas(false)} className="text-slate-400 hover:text-white text-xl leading-none cursor-pointer">&times;</button>
            </div>
            <div className="p-3 space-y-2">
              {savedDiarios.length === 0 ? (
                <p className="text-slate-400 text-sm py-6 text-center">Nenhum diário criado ainda. Use <strong>Inserção</strong> para adicionar.</p>
              ) : (
                <div className="overflow-auto border border-slate-500 rounded bg-slate-700/30" style={{ maxHeight: '240px' }}>
                  <table className="w-full text-xs border-collapse table-fixed" style={{ border: '1px solid #475569' }}>
                    <thead className="sticky top-0 bg-slate-700 z-10">
                      <tr>
                        <th className="text-left py-1.5 px-2 text-slate-300 font-medium border border-slate-500 w-32">Diário</th>
                        <th className="text-left py-1.5 px-2 text-slate-300 font-medium border border-slate-500">Descrição</th>
                        <th className="w-8 border border-slate-500"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {savedDiarios.map((row) => (
                        <tr key={row.id} className="bg-slate-700/50 hover:bg-slate-600/50">
                          <td className="border border-slate-500 px-2 py-1 align-middle font-mono text-amber-300">{row.diario}</td>
                          <td className="border border-slate-500 px-2 py-1 align-middle text-slate-200">{row.descricao}</td>
                          <td className="border border-slate-500 px-1 py-0.5 text-center align-middle">
                            <button type="button" onClick={() => setSavedDiarios(s => s.filter(x => x.id !== row.id))} className="text-slate-500 hover:text-red-400 text-xs">✕</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="flex items-center justify-between pt-2 border-t border-slate-700">
                <p className="text-xs text-slate-500">{savedDiarios.length} diário(s) registado(s)</p>
                <button type="button" onClick={() => setModalConsultaTabelas(false)} className="px-3 py-1.5 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 text-xs">Fechar</button>
              </div>
            </div>
          </div>
        </div>
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
                  <input type="text" value={dataCtb} onChange={(e) => setDataCtb(e.target.value)} onBlur={(e) => setDataCtb(formatDateInput(e.target.value))} placeholder="AAAAMMDD" className="w-full bg-slate-800 border border-slate-600 rounded px-1.5 py-1 text-white text-xs" />
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
                        <td className="border border-slate-500 p-0 align-middle"><input type="text" value={row.data_documento} onChange={(e) => updateRow(row.id, 'data_documento', e.target.value)} onBlur={(e) => updateRow(row.id, 'data_documento', formatDateInput(e.target.value))} placeholder="AAAAMMDD" className="w-full min-w-0 bg-transparent border-0 rounded-none px-1 py-0.5 text-white text-xs focus:ring-1 focus:ring-amber-500 focus:bg-slate-600/50" /></td>
                        <td className="border border-slate-500 p-0 align-middle"><input type="text" value={row.data_lim_pag} onChange={(e) => updateRow(row.id, 'data_lim_pag', e.target.value)} onBlur={(e) => updateRow(row.id, 'data_lim_pag', formatDateInput(e.target.value))} placeholder="AAAAMMDD" className="w-full min-w-0 bg-transparent border-0 rounded-none px-1 py-0.5 text-white text-xs focus:ring-1 focus:ring-amber-500 focus:bg-slate-600/50" /></td>
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
                  {movimentoConfirmado && (
                    <span className="flex items-center gap-1 px-2 py-1 rounded bg-emerald-900/60 border border-emerald-700 text-emerald-300 text-xs font-medium">
                      ✓ Confirmado
                    </span>
                  )}
                  <button type="button" onClick={() => { setModalInserção(false); setModalPos({ x: 0, y: 0 }); setRows([]); setMsg(null); setMovimentoConfirmado(false); }} className="px-3 py-1.5 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 text-xs">Fechar</button>
                  <button type="button" onClick={handleGuardarInserção} disabled={saving} title="Guardar" className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-white disabled:opacity-50 text-xs font-medium ${movimentoConfirmado ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-amber-600 hover:bg-amber-500'}`}>
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
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

      {/* Modal: Manutenção — janela igual à Inserção (cabeçalho + tabela + Contrapartidas); guardar com ícone */}
      {modalManutencao && movimentoIdEmEdicao != null && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 p-4">
          <div
            className="absolute left-1/2 top-1/2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-auto"
            style={{
              transform: `translate(calc(-50% + ${manutencaoPos.x}px), calc(-50% + ${manutencaoPos.y}px))`,
              width: '720px',
              height: '420px',
              minWidth: '480px',
              minHeight: '280px',
              maxWidth: '96vw',
              maxHeight: '90vh',
              resize: 'both',
            }}
          >
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700 cursor-move select-none" onMouseDown={(e) => { if (!(e.target as HTMLElement).closest('button')) manutencaoDragRef.current = { startX: e.clientX, startY: e.clientY, startPos: { ...manutencaoPos } }; }}>
              <h3 className="text-base font-semibold text-white">Manutenção — Movimento #{movimentoIdEmEdicao}</h3>
              <button type="button" onClick={() => { setModalManutencao(false); setMovimentoIdEmEdicao(null); setManutencaoRows([]); setMsg(null); }} className="text-slate-400 hover:text-white text-xl leading-none">&times;</button>
            </div>
            <div className="p-3 space-y-2">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 pb-2 border-b border-slate-700">
                <div><label className="block text-[10px] text-slate-400 mb-0.5">Tip Ter</label><input type="text" value={tipTer} onChange={(e) => setTipTer(e.target.value)} placeholder="%" className="w-full bg-slate-800 border border-slate-600 rounded px-1.5 py-1 text-white text-xs" /></div>
                <div><label className="block text-[10px] text-slate-400 mb-0.5">Diário</label><input type="text" value={diario} onChange={(e) => { setDiario(e.target.value); setBancos(getDescricaoDiario(e.target.value) || (e.target.value === 'B001' ? 'Bancos' : '')); }} className="w-full bg-slate-800 border border-slate-600 rounded px-1.5 py-1 text-white text-xs" /></div>
                <div><label className="block text-[10px] text-slate-400 mb-0.5">Bancos</label><input type="text" value={bancos} readOnly className="w-full bg-slate-800/60 border border-slate-600 rounded px-1.5 py-1 text-slate-300 text-xs" /></div>
                <div><label className="block text-[10px] text-slate-400 mb-0.5">Data CTB</label><input type="text" value={dataCtb} onChange={(e) => setDataCtb(e.target.value)} placeholder="AAAAMMDD" className="w-full bg-slate-800 border border-slate-600 rounded px-1.5 py-1 text-white text-xs" /></div>
                <div><label className="block text-[10px] text-slate-400 mb-0.5">Número</label><input type="text" value={numero} readOnly className="w-full bg-slate-800/60 border border-slate-600 rounded px-1.5 py-1 text-slate-300 text-xs font-mono" /></div>
              </div>
              <div className="flex justify-end mb-1">
                <button type="button" onClick={addManutencaoRow} className="flex items-center gap-1 px-2 py-1 rounded bg-slate-700 text-slate-200 hover:bg-slate-600 text-xs"><Plus className="w-3 h-3" /> Adicionar linha</button>
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
                    {manutencaoRows.map((row) => (
                      <tr key={row.id} className={rowHasData(row) ? 'bg-amber-950/50' : 'bg-slate-700/50'}>
                        <td className="border border-slate-500 p-0 align-middle"><input value={row.cod_grupo} onChange={(e) => updateManutencaoRow(row.id, 'cod_grupo', e.target.value)} className="w-full min-w-0 bg-transparent border-0 rounded-none px-1 py-0.5 text-white text-xs focus:ring-1 focus:ring-amber-500 focus:bg-slate-600/50" /></td>
                        <td className="border border-slate-500 p-0 align-middle"><input value={row.codigo_entidade} onChange={(e) => updateManutencaoRow(row.id, 'codigo_entidade', e.target.value)} className="w-full min-w-0 bg-transparent border-0 rounded-none px-1 py-0.5 text-white text-xs focus:ring-1 focus:ring-amber-500 focus:bg-slate-600/50" /></td>
                        <td className="border border-slate-500 p-0 align-middle"><input value={row.tipo_doc} onChange={(e) => updateManutencaoRow(row.id, 'tipo_doc', e.target.value)} className="w-full min-w-0 bg-transparent border-0 rounded-none px-1 py-0.5 text-white text-xs focus:ring-1 focus:ring-amber-500 focus:bg-slate-600/50" /></td>
                        <td className="border border-slate-500 p-0 align-middle"><input value={row.descricao} onChange={(e) => updateManutencaoRow(row.id, 'descricao', e.target.value)} className="w-full min-w-0 bg-transparent border-0 rounded-none px-1 py-0.5 text-white text-xs focus:ring-1 focus:ring-amber-500 focus:bg-slate-600/50" /></td>
                        <td className="border border-slate-500 p-0 align-middle"><input value={row.numero_documento} onChange={(e) => updateManutencaoRow(row.id, 'numero_documento', e.target.value)} className="w-full min-w-0 bg-transparent border-0 rounded-none px-1 py-0.5 text-white text-xs focus:ring-1 focus:ring-amber-500 focus:bg-slate-600/50" /></td>
                        <td className="border border-slate-500 p-0 align-middle"><input type="text" value={row.data_documento} onChange={(e) => updateManutencaoRow(row.id, 'data_documento', e.target.value)} placeholder="AAAAMMDD" className="w-full min-w-0 bg-transparent border-0 rounded-none px-1 py-0.5 text-white text-xs focus:ring-1 focus:ring-amber-500 focus:bg-slate-600/50" /></td>
                        <td className="border border-slate-500 p-0 align-middle"><input type="text" value={row.data_lim_pag} onChange={(e) => updateManutencaoRow(row.id, 'data_lim_pag', e.target.value)} placeholder="AAAAMMDD" className="w-full min-w-0 bg-transparent border-0 rounded-none px-1 py-0.5 text-white text-xs focus:ring-1 focus:ring-amber-500 focus:bg-slate-600/50" /></td>
                        <td className="border border-slate-500 p-0 align-middle"><input type="number" step="0.01" value={row.valor} onChange={(e) => updateManutencaoRow(row.id, 'valor', e.target.value)} placeholder="0" className="w-full min-w-0 bg-transparent border-0 rounded-none px-1 py-0.5 text-white text-xs text-right focus:ring-1 focus:ring-amber-500 focus:bg-slate-600/50" /></td>
                        <td className="border border-slate-500 p-0 align-middle"><input type="text" maxLength={1} value={row.dc} onChange={(e) => { const v = e.target.value.toUpperCase().slice(-1); if (v === '' || v === 'D' || v === 'C') updateManutencaoRow(row.id, 'dc', v); }} placeholder="D" className="w-full min-w-0 bg-transparent border-0 rounded-none px-0.5 py-0.5 text-white text-xs text-center uppercase focus:ring-1 focus:ring-amber-500 focus:bg-slate-600/50" /></td>
                        <td className="border border-slate-500 px-0.5 py-0.5 text-center align-middle"><button type="button" onClick={() => removeManutencaoRow(row.id)} className="text-slate-500 hover:text-red-400 text-xs">✕</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-700">
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-slate-500">Total Débitos <span className="text-white font-medium">{totalDebitosM.toFixed(2)} €</span></span>
                  <span className="text-slate-500">Total Créditos <span className="text-white font-medium">{totalCreditosM.toFixed(2)} €</span></span>
                  <span className="text-slate-500">Saldo <span className="text-amber-400 font-medium">{saldoM.toFixed(2)} € ({saldoDCM})</span></span>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  <button type="button" onClick={() => setMsg(MSG_EM_DESENVOLVIMENTO)} className="px-2 py-1 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 text-xs">Extrato</button>
                  <button type="button" onClick={() => setMsg(MSG_EM_DESENVOLVIMENTO)} className="px-2 py-1 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 text-xs">Seleção Mov. Regularizar</button>
                  <button type="button" onClick={openContrapartidas} className="px-2 py-1 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 text-xs">Contrapartidas CTB</button>
                  <button type="button" onClick={() => { setModalManutencao(false); setMovimentoIdEmEdicao(null); setManutencaoRows([]); setMsg(null); }} className="px-3 py-1.5 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 text-xs">Fechar</button>
                  <button type="button" onClick={handleGuardarManutencao} disabled={manutencaoSaving} title="Guardar alterações" className="p-2 rounded bg-amber-600 text-white hover:bg-amber-500 disabled:opacity-50">
                    {manutencaoSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              {msg && <p className={`text-sm ${msg === MSG_EM_DESENVOLVIMENTO ? 'text-amber-400' : 'text-emerald-400'}`}>{msg}</p>}
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

              {/* CTB totais calculados dinamicamente */}
              {(() => {
                const ctbD = totalDebitos + contrapartidasRows.reduce((s, r) => s + (r.dc_valor === 'D' ? parseFloat(r.valor) || 0 : 0), 0);
                const ctbC = totalCreditos + contrapartidasRows.reduce((s, r) => s + (r.dc_valor === 'C' ? parseFloat(r.valor) || 0 : 0), 0);
                const ctbSaldo = Math.abs(ctbD - ctbC);
                const ctbDC = ctbD >= ctbC ? 'D' : 'C';
                const isBalanced = ctbSaldo < 0.005;
                const ctaD = contrapartidasRows.reduce((s, r) => s + (r.dc_valor === 'D' ? parseFloat(r.valor) || 0 : 0), 0);
                const ctaC = contrapartidasRows.reduce((s, r) => s + (r.dc_valor === 'C' ? parseFloat(r.valor) || 0 : 0), 0);
                const ctaSaldo = Math.abs(ctaD - ctaC);
                const ctaDC = ctaD >= ctaC ? 'D' : 'C';
                return (
                  <>
                    <div className="border border-slate-600 rounded bg-slate-800/80 p-2 space-y-1.5 text-xs overflow-x-auto">
                      <div className="flex flex-wrap items-center gap-4">
                        <span className="text-slate-400">CTB Geral (Débito/Crédito/Saldo)</span>
                        <input type="text" readOnly value={ctbD.toFixed(2)} className="w-20 bg-slate-700 border border-slate-600 rounded px-1.5 py-0.5 text-right text-slate-300" />
                        <input type="text" readOnly value={ctbC.toFixed(2)} className="w-20 bg-slate-700 border border-slate-600 rounded px-1.5 py-0.5 text-right text-slate-300" />
                        <input type="text" readOnly value={`${ctbSaldo.toFixed(2)} ${ctbDC}`} className={`w-24 border border-slate-600 rounded px-1.5 py-0.5 text-right font-medium ${isBalanced ? 'bg-emerald-900/60 text-emerald-300' : 'bg-red-900/60 text-red-300'}`} />
                        {isBalanced && <span className="text-emerald-400 font-medium">✓ Balanceado</span>}
                        {!isBalanced && <span className="text-red-400 font-medium">⚠ Desequilibrado</span>}
                      </div>
                      <div className="flex flex-wrap items-center gap-4">
                        <span className="text-slate-400">CTB Analít (Débito/Crédito/Saldo)</span>
                        <input type="text" readOnly value={ctaD.toFixed(2)} className="w-20 bg-slate-700 border border-slate-600 rounded px-1.5 py-0.5 text-right text-slate-300" />
                        <input type="text" readOnly value={ctaC.toFixed(2)} className="w-20 bg-slate-700 border border-slate-600 rounded px-1.5 py-0.5 text-right text-slate-300" />
                        <input type="text" readOnly value={`${ctaSaldo.toFixed(2)} ${ctaDC}`} className="w-24 bg-slate-700 border border-slate-600 rounded px-1.5 py-0.5 text-right text-slate-300" />
                      </div>
                      <div><span className="text-slate-400">Conta/Seg Seg/Subcentro</span></div>
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
                        disabled={!isBalanced}
                        onClick={() => {
                          if (!isBalanced) return;
                          setMovimentoConfirmado(true);
                          setModalContrapartidas(false);
                          setContrapartidasPos({ x: 0, y: 0 });
                          setMsg(`Movimento balanceado. Clique Guardar para registar ${diario}/${numero}.`);
                        }}
                        className={`px-3 py-1.5 rounded text-xs font-medium ${isBalanced ? 'bg-emerald-600 text-white hover:bg-emerald-500' : 'bg-slate-600 text-slate-400 cursor-not-allowed'}`}
                        title={isBalanced ? 'Confirmar movimento' : 'Movimento desequilibrado — verifique os valores'}
                      >
                        Confirmar movimento
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Consulta Movimentos ──────────────────────────────────────── */}
      {modalConsulta && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 p-4">
          <div
            className="absolute left-1/2 top-1/2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl flex flex-col overflow-hidden"
            style={{
              transform: `translate(calc(-50% + ${consultaPos.x}px), calc(-50% + ${consultaPos.y}px))`,
              width: '720px', height: '520px',
              minWidth: '500px', minHeight: '360px',
              maxWidth: '96vw', maxHeight: '92vh',
              resize: 'both',
            }}
          >
            {/* Título */}
            <div
              className="flex items-center justify-between px-4 py-2 border-b border-slate-700 cursor-move select-none shrink-0"
              onMouseDown={(e) => {
                if ((e.target as HTMLElement).closest('button')) return;
                consultaRef.current = { startX: e.clientX, startY: e.clientY, startPos: { ...consultaPos } };
              }}
            >
              <h3 className="text-base font-semibold text-white">Movimentos — Consulta/Manutenção</h3>
              <button type="button" onClick={() => { setModalConsulta(false); setConsultaResultados([]); }} className="text-slate-400 hover:text-white text-xl leading-none cursor-pointer">&times;</button>
            </div>

            <div className="flex flex-col gap-2 p-3 flex-1 min-h-0 overflow-hidden">

              {/* Instrução */}
              <p className="text-[11px] text-slate-500 shrink-0">
                Diário: insira o código (ex: B001) — a descrição preenche-se. Número: use <span className="text-amber-400 font-mono">%AAAA%MM%</span> para ano/mês (ex: <span className="text-amber-400 font-mono">%2026%01%</span>). Prima <kbd className="bg-slate-700 border border-slate-600 px-1.5 py-0.5 rounded text-slate-200 text-[10px]">F8</kbd> ou Pesquisar.
              </p>

              {/* Uma única tabela: 1.ª linha = critérios; linhas seguintes = resultados */}
              <div className="flex-1 overflow-auto border border-slate-500 rounded bg-slate-700/30 min-h-0">
                <table className="w-full text-xs border-collapse" style={{ border: '1px solid #475569' }}>
                  <thead className="sticky top-0 bg-slate-700 z-10">
                    <tr>
                      <th className="text-left py-1.5 px-2 text-slate-300 font-medium border border-slate-500 w-28">Diário</th>
                      <th className="text-left py-1.5 px-2 text-slate-300 font-medium border border-slate-500">Descrição</th>
                      <th className="text-left py-1.5 px-2 text-slate-300 font-medium border border-slate-500 w-32">Nº Transação</th>
                      <th className="text-left py-1.5 px-2 text-slate-300 font-medium border border-slate-500 w-24">Data</th>
                      <th className="text-right py-1.5 px-2 text-slate-300 font-medium border border-slate-500 w-20">Valor</th>
                      <th className="text-center py-1.5 px-2 text-slate-300 font-medium border border-slate-500 w-24">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="bg-amber-950/40 border-b border-slate-600">
                      <td className="border border-slate-500 p-0">
                        <input value={consultaFiltro.diario} onChange={e => { const v = e.target.value.toUpperCase(); setConsultaFiltro(f => ({ ...f, diario: v, descricao: getDescricaoDiario(v) })); }} placeholder="ex: B001" className="w-full bg-transparent border-0 px-2 py-1 text-white text-xs font-mono uppercase focus:ring-1 focus:ring-amber-500 focus:bg-slate-600/50" />
                      </td>
                      <td className="border border-slate-500 px-2 py-1 bg-slate-800/50">
                        <input value={consultaFiltro.descricao} readOnly className="w-full bg-transparent border-0 px-2 py-1 text-slate-300 text-xs" placeholder="—" />
                      </td>
                      <td className="border border-slate-500 p-0">
                        <input value={consultaFiltro.numero} onChange={e => setConsultaFiltro(f => ({ ...f, numero: e.target.value }))} placeholder="%2026%01%" className="w-full bg-transparent border-0 px-2 py-1 text-amber-300 text-xs font-mono focus:ring-1 focus:ring-amber-500 focus:bg-slate-600/50" />
                      </td>
                      <td className="border border-slate-500 px-2 py-1 text-slate-500" colSpan={3}>← critérios</td>
                    </tr>
                    {consultaSearching ? (
                      <tr><td colSpan={6} className="px-2 py-4 text-center text-slate-500">A pesquisar...</td></tr>
                    ) : consultaResultados.length === 0 ? (
                      <tr><td colSpan={6} className="px-2 py-4 text-center text-slate-500">Preencha Diário e/ou Número (ex: %2026%01%) e prima F8.</td></tr>
                    ) : (
                      consultaResultados.map((r: any, i: number) => (
                        <tr key={r.id ?? i} className="hover:bg-slate-700/50 border-b border-slate-700/50">
                          <td className="px-2 py-1 font-mono text-amber-300 border border-slate-600">{r.conta_contabilidade || '—'}</td>
                          <td className="px-2 py-1 text-slate-200 border border-slate-600">{r.descricao || r.grupo_terceiro || '—'}</td>
                          <td className="px-2 py-1 font-mono text-slate-300 border border-slate-600">{r.numero_documento ?? r.id ?? '—'}</td>
                          <td className="px-2 py-1 text-slate-400 border border-slate-600">{r.data || '—'}</td>
                          <td className="px-2 py-1 text-right text-white border border-slate-600">{r.valor != null ? Number(r.valor).toFixed(2) : '—'}</td>
                          <td className="px-2 py-1 border border-slate-600">
                            <div className="flex items-center justify-center gap-1">
                              <button type="button" onClick={() => setSelectedMovimentoVer(r)} className="p-1 rounded text-slate-400 hover:text-amber-400 hover:bg-slate-600" title="Ver"><Eye className="w-3.5 h-3.5" /></button>
                              <button type="button" onClick={() => openManutencaoModal(r)} className="p-1 rounded text-slate-400 hover:text-amber-400 hover:bg-slate-600" title="Manutenção"><Pencil className="w-3.5 h-3.5" /></button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between items-center shrink-0 pt-1">
                <span className="text-xs text-slate-500">{consultaResultados.length} resultado(s)</span>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setConsultaFiltro({ diario: '', descricao: '', numero: '' })} className="px-2 py-1 rounded bg-slate-700 text-slate-400 hover:bg-slate-600 text-xs">Limpar</button>
                  <button type="button" onClick={() => handlePesquisarMovimentos(consultaFiltroRef.current)} disabled={consultaSearching} className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-amber-600 text-white hover:bg-amber-500 disabled:opacity-50 text-xs font-medium">
                    {consultaSearching && <Loader2 className="w-3 h-3 animate-spin" />}
                    Pesquisar (F8)
                  </button>
                </div>
              </div>

              {/* Rodapé */}
              <div className="flex justify-end shrink-0 pt-1 border-t border-slate-700">
                <button type="button" onClick={() => { setModalConsulta(false); setConsultaResultados([]); setSelectedMovimentoVer(null); setSelectedMovimentoEdit(null); }} className="px-3 py-1.5 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 text-xs">Fechar</button>
              </div>
            </div>

            {/* Overlay: Ver movimento (só leitura) */}
            {selectedMovimentoVer && (
              <div className="absolute inset-0 bg-slate-900/95 flex flex-col rounded-xl z-20 p-4">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-sm font-semibold text-white">Ver movimento</h4>
                  <button type="button" onClick={() => setSelectedMovimentoVer(null)} className="text-slate-400 hover:text-white text-lg">&times;</button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <span className="text-slate-500">ID</span><span className="text-white font-mono">{selectedMovimentoVer.id}</span>
                  <span className="text-slate-500">Diário</span><span className="text-amber-300">{selectedMovimentoVer.conta_contabilidade || '—'}</span>
                  <span className="text-slate-500">Data</span><span className="text-slate-200">{selectedMovimentoVer.data || '—'}</span>
                  <span className="text-slate-500">Grupo terceiro</span><span className="text-slate-200">{selectedMovimentoVer.grupo_terceiro || '—'}</span>
                  <span className="text-slate-500">Descrição</span><span className="text-slate-200 col-span-2">{selectedMovimentoVer.descricao || '—'}</span>
                  <span className="text-slate-500">Valor</span><span className="text-white font-medium">{selectedMovimentoVer.valor != null ? Number(selectedMovimentoVer.valor).toFixed(2) + ' €' : '—'}</span>
                </div>
                <div className="mt-4 flex justify-end">
                  <button type="button" onClick={() => setSelectedMovimentoVer(null)} className="px-3 py-1.5 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 text-xs">Fechar</button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
