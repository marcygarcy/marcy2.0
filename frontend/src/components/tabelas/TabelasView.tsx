'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { BookOpen, Table2, ChevronDown, Plus, Grid3X3 } from 'lucide-react';
import { NestedDropdown, type NestedDropdownItem } from '@/components/ui/nested-dropdown';
import { useApp } from '@/context/AppContext';
import { MSG_EM_DESENVOLVIMENTO } from '@/lib/constants';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type DiarioRow = {
  id: number;
  codigo: string;
  descricao: string;
  tipo: string;
  ativo: string;
};

type PlanoContasRow = {
  id: number;
  conta: string;
  descricao: string;
  natureza: string;
  tipo: string;
  nivel: string;
};

// ─── Constantes ───────────────────────────────────────────────────────────────

const NUM_LINHAS = 10;

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
      { value: 'plano-consultar', label: 'Consulta' },
      { value: 'plano-inserir', label: 'Inserção' },
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

function createEmptyDiario(id: number): DiarioRow {
  return { id, codigo: '', descricao: '', tipo: '', ativo: 'S' };
}

function createEmptyPlanoContas(id: number): PlanoContasRow {
  return { id, conta: '', descricao: '', natureza: '', tipo: '', nivel: '' };
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function TabelasView() {
  const { empresaSelecionada } = useApp();

  // Modal Diários — Inserção
  const [modalDiarios, setModalDiarios] = useState(false);
  const [diariosPos, setDiariosPos] = useState({ x: 0, y: 0 });
  const diariosRef = React.useRef<{ startX: number; startY: number; startPos: { x: number; y: number } } | null>(null);
  const [diarioRows, setDiarioRows] = useState<DiarioRow[]>([]);
  const nextDiarioId = React.useRef(1);

  // Modal Diários — Consulta/Listar
  const [modalConsulta, setModalConsulta] = useState(false);
  const [modalTitle, setModalTitle] = useState('');

  // Modal Plano de Contas
  const [modalPlano, setModalPlano] = useState(false);
  const [planoRows, setPlanoRows] = useState<PlanoContasRow[]>([]);
  const nextPlanoId = React.useRef(1);
  const [planoPos, setPlanoPos] = useState({ x: 0, y: 0 });
  const planoRef = React.useRef<{ startX: number; startY: number; startPos: { x: number; y: number } } | null>(null);

  const [msg, setMsg] = useState<string | null>(null);

  // ── Drag diários modal ────────────────────────────────────────────────────
  const handleDiariosDragStart = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    diariosRef.current = { startX: e.clientX, startY: e.clientY, startPos: { ...diariosPos } };
  };
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

  // ── Drag plano modal ──────────────────────────────────────────────────────
  const handlePlanoDragStart = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    planoRef.current = { startX: e.clientX, startY: e.clientY, startPos: { ...planoPos } };
  };
  React.useEffect(() => {
    if (!modalPlano) return;
    const onMove = (e: MouseEvent) => {
      if (!planoRef.current) return;
      setPlanoPos({
        x: planoRef.current.startPos.x + (e.clientX - planoRef.current.startX),
        y: planoRef.current.startPos.y + (e.clientY - planoRef.current.startY),
      });
    };
    const onUp = () => { planoRef.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [modalPlano]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSelect = (value: string) => {
    setMsg(null);
    if (value === 'diarios-inserir') {
      setDiarioRows(Array.from({ length: NUM_LINHAS }, (_, i) => createEmptyDiario(nextDiarioId.current++)));
      setDiariosPos({ x: 0, y: 0 });
      setModalDiarios(true);
    } else if (value === 'diarios-consultar') {
      setModalTitle('Diários — Consulta');
      setModalConsulta(true);
    } else if (value === 'diarios-listar') {
      setModalTitle('Diários — Listagem');
      setModalConsulta(true);
    } else if (value === 'plano-inserir') {
      setPlanoRows(Array.from({ length: NUM_LINHAS }, (_, i) => createEmptyPlanoContas(nextPlanoId.current++)));
      setPlanoPos({ x: 0, y: 0 });
      setModalPlano(true);
    } else {
      setMsg(MSG_EM_DESENVOLVIMENTO);
    }
  };

  const updateDiario = (id: number, field: keyof DiarioRow, value: string) => {
    setDiarioRows(r => r.map(row => row.id === id ? { ...row, [field]: value } : row));
  };

  const addDiarioRow = () => {
    setDiarioRows(r => [...r, createEmptyDiario(nextDiarioId.current++)]);
  };

  const removeDiarioRow = (id: number) => {
    setDiarioRows(r => r.filter(row => row.id !== id));
  };

  const updatePlano = (id: number, field: keyof PlanoContasRow, value: string) => {
    setPlanoRows(r => r.map(row => row.id === id ? { ...row, [field]: value } : row));
  };

  const addPlanoRow = () => {
    setPlanoRows(r => [...r, createEmptyPlanoContas(nextPlanoId.current++)]);
  };

  const handleGuardarDiarios = () => {
    const linhas = diarioRows.filter(r => r.codigo || r.descricao);
    if (linhas.length === 0) return;
    // Guardar em backend — em desenvolvimento
    setMsg(`${linhas.length} diário(s) guardado(s). (modo desenvolvimento)`);
    setTimeout(() => { setModalDiarios(false); setMsg(null); }, 1500);
  };

  const handleGuardarPlano = () => {
    const linhas = planoRows.filter(r => r.conta || r.descricao);
    if (linhas.length === 0) return;
    setMsg(`${linhas.length} conta(s) guardada(s). (modo desenvolvimento)`);
    setTimeout(() => { setModalPlano(false); setMsg(null); }, 1500);
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3">
        <BookOpen className="w-8 h-8 text-amber-400" />
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">Tabelas</h1>
          <p className="text-slate-400 text-sm">
            Tabelas de configuração contabilística: Diários, Plano de Contas, Centros de Custo.
          </p>
        </div>
      </div>

      {/* Dropdown Tabelas */}
      <div className="flex items-center gap-2 border-b border-slate-700 pb-4">
        <span className="text-slate-400 text-sm uppercase tracking-wide mr-2">Aba:</span>
        <NestedDropdown
          trigger={
            <button
              type="button"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 text-white font-medium hover:bg-amber-500 transition-colors"
            >
              Tabelas
              <ChevronDown className="w-4 h-4" />
            </button>
          }
          items={TABELAS_MENU_ITEMS}
          onSelect={handleSelect}
        />
        {msg && (
          <span className="ml-4 text-sm text-amber-400">{msg}</span>
        )}
      </div>

      {/* Visão geral */}
      <Card className="border-slate-700 bg-slate-900/50">
        <CardHeader>
          <CardTitle className="text-lg text-white flex items-center gap-2">
            <Grid3X3 className="w-5 h-5 text-amber-400" />
            Tabelas de Configuração
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-slate-300 text-sm">
            Gerir as tabelas mestras de contabilidade: Diários (livros de registo por tipo de operação),
            Plano de Contas (SNC/POC) e Centros de Custo. Use o menu <strong>Tabelas</strong> para aceder
            a cada secção.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-slate-800/60 border border-slate-700">
              <BookOpen className="w-6 h-6 text-amber-400 mb-2" />
              <h3 className="font-medium text-white text-sm">Diários</h3>
              <p className="text-xs text-slate-500 mt-1">Bancos, Caixa, Compras, Vendas, Ajustes.</p>
            </div>
            <div className="p-4 rounded-lg bg-slate-800/60 border border-slate-700">
              <Table2 className="w-6 h-6 text-sky-400 mb-2" />
              <h3 className="font-medium text-white text-sm">Plano de Contas</h3>
              <p className="text-xs text-slate-500 mt-1">Estrutura SNC — classes 1 a 8.</p>
            </div>
            <div className="p-4 rounded-lg bg-slate-800/60 border border-slate-700">
              <Grid3X3 className="w-6 h-6 text-emerald-400 mb-2" />
              <h3 className="font-medium text-white text-sm">Centros de Custo</h3>
              <p className="text-xs text-slate-500 mt-1">Segmentação analítica por departamento.</p>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Empresa activa: <span className="text-amber-400 font-medium">{empresaSelecionada?.nome ?? '—'}</span>
          </p>
        </CardContent>
      </Card>

      {/* ══ Modal: Diários — Inserção ══════════════════════════════════════════ */}
      {modalDiarios && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 p-4">
          <div
            className="absolute left-1/2 top-1/2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-auto"
            style={{
              transform: `translate(calc(-50% + ${diariosPos.x}px), calc(-50% + ${diariosPos.y}px))`,
              width: '620px',
              height: '380px',
              minWidth: '420px',
              minHeight: '260px',
              maxWidth: '96vw',
              maxHeight: '90vh',
              resize: 'both',
            }}
          >
            {/* Título arrastável */}
            <div
              className="flex items-center justify-between px-4 py-2 border-b border-slate-700 cursor-move select-none"
              onMouseDown={handleDiariosDragStart}
            >
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-amber-400" />
                Diários — Inserção
              </h3>
              <button
                type="button"
                onClick={() => { setModalDiarios(false); setDiariosPos({ x: 0, y: 0 }); setMsg(null); }}
                className="text-slate-400 hover:text-white text-xl leading-none cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="p-3 space-y-2">
              <div className="flex justify-end mb-1">
                <button type="button" onClick={addDiarioRow} className="flex items-center gap-1 px-2 py-1 rounded bg-slate-700 text-slate-200 hover:bg-slate-600 text-xs">
                  <Plus className="w-3 h-3" />
                  Adicionar linha
                </button>
              </div>

              <div className="overflow-auto border border-slate-500 rounded bg-slate-700/30" style={{ maxHeight: '210px' }}>
                <table className="w-full text-xs border-collapse table-fixed" style={{ border: '1px solid #475569' }}>
                  <thead className="sticky top-0 bg-slate-700 z-10">
                    <tr>
                      <th className="text-left py-1 px-1 text-slate-300 font-medium border border-slate-500 w-20">Código</th>
                      <th className="text-left py-1 px-1 text-slate-300 font-medium border border-slate-500">Descrição</th>
                      <th className="text-left py-1 px-1 text-slate-300 font-medium border border-slate-500 w-28">Tipo</th>
                      <th className="text-center py-1 px-1 text-slate-300 font-medium border border-slate-500 w-12">Ativo</th>
                      <th className="w-8 border border-slate-500"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {diarioRows.map((row) => (
                      <tr key={row.id} className={row.codigo || row.descricao ? 'bg-amber-950/50' : 'bg-slate-700/50'}>
                        <td className="border border-slate-500 p-0 align-middle">
                          <input value={row.codigo} onChange={(e) => updateDiario(row.id, 'codigo', e.target.value)} placeholder="B001" className="w-full min-w-0 bg-transparent border-0 rounded-none px-1 py-0.5 text-white text-xs focus:ring-1 focus:ring-amber-500 focus:bg-slate-600/50 font-mono uppercase" />
                        </td>
                        <td className="border border-slate-500 p-0 align-middle">
                          <input value={row.descricao} onChange={(e) => updateDiario(row.id, 'descricao', e.target.value)} placeholder="Ex: Bancos" className="w-full min-w-0 bg-transparent border-0 rounded-none px-1 py-0.5 text-white text-xs focus:ring-1 focus:ring-amber-500 focus:bg-slate-600/50" />
                        </td>
                        <td className="border border-slate-500 p-0 align-middle">
                          <select value={row.tipo} onChange={(e) => updateDiario(row.id, 'tipo', e.target.value)} className="w-full min-w-0 bg-slate-800 border-0 rounded-none px-1 py-0.5 text-white text-xs focus:ring-1 focus:ring-amber-500">
                            <option value="">— selecione —</option>
                            <option value="Geral">Geral</option>
                            <option value="Caixa">Caixa</option>
                            <option value="Banco">Banco</option>
                            <option value="Compras">Compras</option>
                            <option value="Vendas">Vendas</option>
                            <option value="Ajustes">Ajustes</option>
                          </select>
                        </td>
                        <td className="border border-slate-500 p-0 align-middle">
                          <select value={row.ativo} onChange={(e) => updateDiario(row.id, 'ativo', e.target.value)} className="w-full min-w-0 bg-slate-800 border-0 rounded-none px-0.5 py-0.5 text-white text-xs focus:ring-1 focus:ring-amber-500 text-center">
                            <option value="S">S</option>
                            <option value="N">N</option>
                          </select>
                        </td>
                        <td className="border border-slate-500 px-0.5 py-0.5 text-center align-middle">
                          <button type="button" onClick={() => removeDiarioRow(row.id)} className="text-slate-500 hover:text-red-400 text-xs">✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Rodapé */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-700">
                <p className="text-xs text-slate-500">
                  {diarioRows.filter(r => r.codigo || r.descricao).length} diário(s) preenchido(s)
                </p>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => { setModalDiarios(false); setDiariosPos({ x: 0, y: 0 }); setMsg(null); }} className="px-3 py-1.5 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 text-xs">
                    Fechar
                  </button>
                  <button type="button" onClick={handleGuardarDiarios} className="px-3 py-1.5 rounded bg-amber-600 text-white hover:bg-amber-500 text-xs">
                    Guardar
                  </button>
                </div>
              </div>
              {msg && <p className="text-sm text-emerald-400">{msg}</p>}
            </div>
          </div>
        </div>
      )}

      {/* ══ Modal: Plano de Contas ══════════════════════════════════════════════ */}
      {modalPlano && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 p-4">
          <div
            className="absolute left-1/2 top-1/2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-auto"
            style={{
              transform: `translate(calc(-50% + ${planoPos.x}px), calc(-50% + ${planoPos.y}px))`,
              width: '780px',
              height: '400px',
              minWidth: '480px',
              minHeight: '280px',
              maxWidth: '96vw',
              maxHeight: '90vh',
              resize: 'both',
            }}
          >
            <div
              className="flex items-center justify-between px-4 py-2 border-b border-slate-700 cursor-move select-none"
              onMouseDown={handlePlanoDragStart}
            >
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <Table2 className="w-4 h-4 text-sky-400" />
                Plano de Contas — Inserção
              </h3>
              <button type="button" onClick={() => { setModalPlano(false); setPlanoPos({ x: 0, y: 0 }); setMsg(null); }} className="text-slate-400 hover:text-white text-xl leading-none cursor-pointer">
                &times;
              </button>
            </div>
            <div className="p-3 space-y-2">
              <div className="flex justify-end mb-1">
                <button type="button" onClick={addPlanoRow} className="flex items-center gap-1 px-2 py-1 rounded bg-slate-700 text-slate-200 hover:bg-slate-600 text-xs">
                  <Plus className="w-3 h-3" />
                  Adicionar linha
                </button>
              </div>
              <div className="overflow-auto border border-slate-500 rounded bg-slate-700/30" style={{ maxHeight: '240px' }}>
                <table className="w-full text-xs border-collapse table-fixed" style={{ border: '1px solid #475569' }}>
                  <thead className="sticky top-0 bg-slate-700 z-10">
                    <tr>
                      <th className="text-left py-1 px-1 text-slate-300 font-medium border border-slate-500 w-24">Conta</th>
                      <th className="text-left py-1 px-1 text-slate-300 font-medium border border-slate-500">Descrição</th>
                      <th className="text-left py-1 px-1 text-slate-300 font-medium border border-slate-500 w-20">Natureza</th>
                      <th className="text-left py-1 px-1 text-slate-300 font-medium border border-slate-500 w-24">Tipo</th>
                      <th className="text-center py-1 px-1 text-slate-300 font-medium border border-slate-500 w-12">Nível</th>
                      <th className="w-8 border border-slate-500"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {planoRows.map((row) => (
                      <tr key={row.id} className={row.conta || row.descricao ? 'bg-sky-950/40' : 'bg-slate-700/50'}>
                        <td className="border border-slate-500 p-0 align-middle">
                          <input value={row.conta} onChange={(e) => updatePlano(row.id, 'conta', e.target.value)} placeholder="11" className="w-full min-w-0 bg-transparent border-0 rounded-none px-1 py-0.5 text-white text-xs focus:ring-1 focus:ring-sky-500 focus:bg-slate-600/50 font-mono" />
                        </td>
                        <td className="border border-slate-500 p-0 align-middle">
                          <input value={row.descricao} onChange={(e) => updatePlano(row.id, 'descricao', e.target.value)} placeholder="Ex: Caixa" className="w-full min-w-0 bg-transparent border-0 rounded-none px-1 py-0.5 text-white text-xs focus:ring-1 focus:ring-sky-500 focus:bg-slate-600/50" />
                        </td>
                        <td className="border border-slate-500 p-0 align-middle">
                          <select value={row.natureza} onChange={(e) => updatePlano(row.id, 'natureza', e.target.value)} className="w-full min-w-0 bg-slate-800 border-0 rounded-none px-1 py-0.5 text-white text-xs">
                            <option value="">—</option>
                            <option value="D">Devedora</option>
                            <option value="C">Credora</option>
                          </select>
                        </td>
                        <td className="border border-slate-500 p-0 align-middle">
                          <select value={row.tipo} onChange={(e) => updatePlano(row.id, 'tipo', e.target.value)} className="w-full min-w-0 bg-slate-800 border-0 rounded-none px-1 py-0.5 text-white text-xs">
                            <option value="">—</option>
                            <option value="Movimento">Movimento</option>
                            <option value="Acumulação">Acumulação</option>
                            <option value="Total">Total</option>
                          </select>
                        </td>
                        <td className="border border-slate-500 p-0 align-middle">
                          <input value={row.nivel} onChange={(e) => updatePlano(row.id, 'nivel', e.target.value)} placeholder="1" className="w-full min-w-0 bg-transparent border-0 rounded-none px-1 py-0.5 text-white text-xs text-center focus:ring-1 focus:ring-sky-500 focus:bg-slate-600/50 font-mono" />
                        </td>
                        <td className="border border-slate-500 px-0.5 py-0.5 text-center align-middle">
                          <button type="button" onClick={() => setPlanoRows(r => r.filter(x => x.id !== row.id))} className="text-slate-500 hover:text-red-400 text-xs">✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-700">
                <p className="text-xs text-slate-500">
                  {planoRows.filter(r => r.conta || r.descricao).length} conta(s) preenchida(s)
                </p>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => { setModalPlano(false); setPlanoPos({ x: 0, y: 0 }); setMsg(null); }} className="px-3 py-1.5 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 text-xs">Fechar</button>
                  <button type="button" onClick={handleGuardarPlano} className="px-3 py-1.5 rounded bg-sky-600 text-white hover:bg-sky-500 text-xs">Guardar</button>
                </div>
              </div>
              {msg && <p className="text-sm text-emerald-400">{msg}</p>}
            </div>
          </div>
        </div>
      )}

      {/* ══ Modal: Consulta genérica ══════════════════════════════════════════ */}
      {modalConsulta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">{modalTitle}</h3>
              <button type="button" onClick={() => setModalConsulta(false)} className="text-slate-400 hover:text-white text-xl">&times;</button>
            </div>
            <p className="text-slate-400 text-sm">Em desenvolvimento — ligação à base de dados em curso.</p>
            <div className="mt-4 flex justify-end">
              <button type="button" onClick={() => setModalConsulta(false)} className="px-4 py-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 text-sm">Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
