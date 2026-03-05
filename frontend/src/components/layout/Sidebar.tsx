'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { empresasApi, Empresa } from '@/lib/api/empresas';
import { marketplacesApi, Marketplace } from '@/lib/api/marketplaces';
import {
  Building2, ChevronDown, ChevronRight, Store, CreditCard, FolderOpen,
  Users, TrendingUp, ShoppingCart, Landmark, MapPin, Package, RotateCcw,
  Boxes, DollarSign, Zap, Globe, Link2, FileText, BookOpen, Settings2, Receipt,
} from 'lucide-react';
import { invoiceValidationApi } from '@/lib/api/invoiceValidation';

// ─── Hardcoded data ────────────────────────────────────────────────────────────

const EMPRESAS_HARDCODED: Empresa[] = [
  { id: 1, nome: 'teste 369',      codigo: 'BHS',    ativo: true },
  { id: 2, nome: 'Teste 123',  codigo: 'GHS',    ativo: true },
  { id: 3, nome: 'testes xyz',     codigo: 'BHS_SL', ativo: true },
  { id: 4, nome: 'Teste 123',  codigo: 'BHS_DE', ativo: true },
  { id: 5, nome: 'testes xyz',  codigo: 'BES',    ativo: true },
];

const grupoHubSalesMarketplaces: Marketplace[] = [
  { id: 3,  empresa_id: 2, nome: 'Alltricks',          ativo: true },
  { id: 4,  empresa_id: 2, nome: 'Bigbang',            ativo: true },
  { id: 5,  empresa_id: 2, nome: 'Bricodepot',         ativo: true },
  { id: 6,  empresa_id: 2, nome: 'Bulevip',            ativo: true },
  { id: 7,  empresa_id: 2, nome: 'Carrefour',          ativo: true },
  { id: 8,  empresa_id: 2, nome: 'Castorama',          ativo: true },
  { id: 9,  empresa_id: 2, nome: 'Clubefashion',       ativo: true },
  { id: 11, empresa_id: 2, nome: 'Elcorteingles',      ativo: true },
  { id: 12, empresa_id: 2, nome: 'Empik',              ativo: true },
  { id: 10, empresa_id: 2, nome: 'Eprice',             ativo: true },
  { id: 14, empresa_id: 2, nome: 'Leclerc',            ativo: true },
  { id: 13, empresa_id: 2, nome: 'Leroymerlin',        ativo: true },
  { id: 15, empresa_id: 2, nome: 'Mediamarkt DE',      ativo: true },
  { id: 16, empresa_id: 2, nome: 'Mediamarkt ES',      ativo: true },
  { id: 17, empresa_id: 2, nome: 'PC Componentes ES',  ativo: true },
  { id: 18, empresa_id: 2, nome: 'PC Componentes FR',  ativo: true },
  { id: 19, empresa_id: 2, nome: 'PC Componentes IT',  ativo: true },
  { id: 20, empresa_id: 2, nome: 'PC Componentes PT',  ativo: true },
  { id: 21, empresa_id: 2, nome: 'Phonehouse',         ativo: true },
  { id: 1,  empresa_id: 2, nome: 'Pixmania',           ativo: true },
  { id: 22, empresa_id: 2, nome: 'Planetahuerto',      ativo: true },
  { id: 23, empresa_id: 2, nome: 'Rueducommerce',      ativo: true },
  { id: 24, empresa_id: 2, nome: 'Tiendanimal',        ativo: true },
  { id: 25, empresa_id: 2, nome: 'Ventunique',         ativo: true },
  { id: 2,  empresa_id: 2, nome: 'Worten',             ativo: true },
].sort((a, b) => a.nome.localeCompare(b.nome));

const MARKETPLACES_HARDCODED: Record<number, Marketplace[]> = {
  1: [
    { id: 36, empresa_id: 1, nome: 'Conforama Iberia', ativo: true },
    { id: 37, empresa_id: 1, nome: 'Worten',           ativo: true },
  ].sort((a, b) => a.nome.localeCompare(b.nome)),
  2: grupoHubSalesMarketplaces,
  3: [
    { id: 34, empresa_id: 3, nome: 'Carrefour',    ativo: true },
    { id: 35, empresa_id: 3, nome: 'Leroymerlin',  ativo: true },
  ].sort((a, b) => a.nome.localeCompare(b.nome)),
  4: [
    { id: 28, empresa_id: 4, nome: 'Carrefour',       ativo: true },
    { id: 29, empresa_id: 4, nome: 'Conforama',       ativo: true },
    { id: 30, empresa_id: 4, nome: 'Shopapotheke',    ativo: true },
    { id: 31, empresa_id: 4, nome: 'Truffaut',        ativo: true },
    { id: 32, empresa_id: 4, nome: 'Ubaldi',          ativo: true },
    { id: 33, empresa_id: 4, nome: 'Zooplus',         ativo: true },
  ].sort((a, b) => a.nome.localeCompare(b.nome)),
  5: [
    { id: 26, empresa_id: 5, nome: 'Carrefour',       ativo: true },
    { id: 27, empresa_id: 5, nome: 'PC Componentes',  ativo: true },
  ].sort((a, b) => a.nome.localeCompare(b.nome)),
};

// ─── Module definitions ────────────────────────────────────────────────────────

const MODULO_RECEBIMENTOS = { id: 'recebimentos-marketplaces', nome: 'Recebimentos', icone: 'CreditCard' };
const MODULO_VENDAS       = { id: 'vendas-margem',            nome: 'Vendas e Margem',     icone: 'TrendingUp' };
const MODULO_BILLING      = { id: 'billing',                 nome: 'Gestão Comercial',   icone: 'FileText' };
const MODULO_FATURACAO    = { id: 'faturacao',               nome: 'Faturação AT',        icone: 'Receipt' };
const MODULO_COMPRAS      = { id: 'compras',                  nome: 'Compras',             icone: 'ShoppingCart' };
const MODULO_RMA          = { id: 'rma',                      nome: 'Devoluções (RMA)',    icone: 'RotateCcw' };
const MODULO_LOGISTICA    = { id: 'logistics',                nome: 'Gestão de Escritório', icone: 'Package' };
const MODULO_OFFICE_STOCK = { id: 'office-stock',             nome: 'Stock Escritório',     icone: 'Boxes' };
const MODULO_BANCOS       = { id: 'bancos',                   nome: 'Bancos',              icone: 'Landmark' };
const MODULO_FINANCAS     = { id: 'financas',                 nome: 'Finanças Globais',    icone: 'DollarSign' };
const MODULO_DADOS_MESTRES = { id: 'dados-mestres',           nome: 'Dados Mestres',       icone: 'FolderOpen' };
const MODULO_AUTOMATION   = { id: 'automation',              nome: 'Status de Automação', icone: 'Zap' };
const MODULO_SYSTEM_CFG   = { id: 'system-config',           nome: 'Configuração Sistema', icone: 'Settings2' };
const MODULO_DOCS         = { id: 'documentacao',            nome: 'Documentação',        icone: 'BookOpen' };

// ─── Section header component ─────────────────────────────────────────────────

function SectionHeader({
  label, accent, expanded, onToggle,
}: {
  label: string;
  accent: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`w-full flex items-center justify-between px-2 py-1 mb-1 rounded text-[10px] font-bold uppercase tracking-widest transition-colors hover:opacity-80 ${accent}`}
    >
      <span>{label}</span>
      {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
    </button>
  );
}

// ─── Nav item (leaf) ──────────────────────────────────────────────────────────

function NavItem({
  icon, label, active, activeColor, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  activeColor: string;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`w-full flex items-center px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer ${
        active ? activeColor : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
      }`}
    >
      {icon}
      <span className="truncate ml-2">{label}</span>
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export function Sidebar() {
  const {
    moduloSelecionado,
    empresaSelecionada,
    marketplaceSelecionado,
    setModuloSelecionado,
    setEmpresaSelecionada,
    setMarketplaceSelecionado,
  } = useApp();

  const [empresas, setEmpresas] = useState<Empresa[]>(EMPRESAS_HARDCODED);
  const [marketplaces, setMarketplaces] = useState<Record<number, Marketplace[]>>(MARKETPLACES_HARDCODED);
  const [expandedEmpresas, setExpandedEmpresas] = useState<Record<number, boolean>>({});

  // Pillar collapse states
  const [pillarA, setPillarA] = useState(true);   // Vendas & SCM
  const [pillarB, setPillarB] = useState(true);   // Logística
  const [pillarC, setPillarC] = useState(true);   // Financeiro
  const [pillarD, setPillarD] = useState(false);  // Configuração (collapsed by default)

  // Recebimentos sub-tree
  const [expandedRecebimentos, setExpandedRecebimentos] = useState(true);
  // Bancos sub-tree
  const [expandedBancos, setExpandedBancos] = useState(true);
  // Dados Mestres sub-tree
  const [expandedDadosMestres, setExpandedDadosMestres] = useState(true);
  // Badge Finanças Globais (faturas pendentes de validação)
  const [invoiceBadge, setInvoiceBadge] = useState(0);

  useEffect(() => {
    loadEmpresas();
    // Carregar badge de faturas pendentes
    invoiceValidationApi.getStats().then((s) => setInvoiceBadge(s.pendente_validacao)).catch(() => {});
    // Refrescar a cada 5 minutos
    const t = setInterval(() => {
      invoiceValidationApi.getStats().then((s) => setInvoiceBadge(s.pendente_validacao)).catch(() => {});
    }, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (empresaSelecionada) {
      if (!marketplaces[empresaSelecionada.id] && MARKETPLACES_HARDCODED[empresaSelecionada.id]) {
        setMarketplaces(prev => ({ ...prev, [empresaSelecionada.id]: MARKETPLACES_HARDCODED[empresaSelecionada.id] }));
      }
      if (!expandedEmpresas[empresaSelecionada.id]) {
        setExpandedEmpresas(prev => ({ ...prev, [empresaSelecionada.id]: true }));
      }
    }
  }, [empresaSelecionada]);

  const loadEmpresas = async () => {
    try {
      const data = await empresasApi.getAll();
      if (data && Array.isArray(data) && data.length > 0) setEmpresas(data.filter(e => e.ativo));
      else setEmpresas(EMPRESAS_HARDCODED);
    } catch {
      setEmpresas(EMPRESAS_HARDCODED);
    }
  };

  const loadMarketplaces = async (empresaId: number) => {
    try {
      const data = await marketplacesApi.getByEmpresa(empresaId);
      if (data && Array.isArray(data) && data.length > 0) {
        setMarketplaces(prev => ({ ...prev, [empresaId]: data.filter(m => m.ativo) }));
      } else if (MARKETPLACES_HARDCODED[empresaId]) {
        setMarketplaces(prev => ({ ...prev, [empresaId]: MARKETPLACES_HARDCODED[empresaId] }));
      }
    } catch {
      if (MARKETPLACES_HARDCODED[empresaId])
        setMarketplaces(prev => ({ ...prev, [empresaId]: MARKETPLACES_HARDCODED[empresaId] }));
    }
  };

  const toggleEmpresa = (empresaId: number) => {
    setExpandedEmpresas(prev => {
      const newState = { ...prev, [empresaId]: !prev[empresaId] };
      if (newState[empresaId] && !marketplaces[empresaId]) loadMarketplaces(empresaId);
      return newState;
    });
  };

  const handleEmpresaRecebimentosClick = (empresa: Empresa) => {
    setModuloSelecionado(MODULO_RECEBIMENTOS);
    setEmpresaSelecionada(empresa);
    if (marketplaces[empresa.id]?.length && !expandedEmpresas[empresa.id]) toggleEmpresa(empresa.id);
  };

  const handleMarketplaceClick = (marketplace: Marketplace) => {
    setModuloSelecionado(MODULO_RECEBIMENTOS);
    const empresa = empresas.find(e => e.id === marketplace.empresa_id);
    if (empresa) setEmpresaSelecionada(empresa);
    setMarketplaceSelecionado(marketplace);
  };

  const handleModuloBancosEmpresaClick = (empresa: Empresa) => {
    setModuloSelecionado(MODULO_BANCOS);
    setEmpresaSelecionada(empresa);
    setMarketplaceSelecionado(null);
  };

  const isActive = (id: string) => moduloSelecionado?.id === id;

  return (
    <div className="w-64 bg-slate-900 border-r border-slate-700 p-3 overflow-y-auto flex flex-col gap-0">

      {/* Logo / Title */}
      <div className="flex items-center gap-2 px-1 mb-5 pt-1">
        <Boxes className="w-5 h-5 text-amber-400 shrink-0" />
        <span className="text-base font-bold text-white leading-tight">Business Control</span>
      </div>

      {/* ═══ PILAR A: VENDAS & SCM ══════════════════════════════════════════ */}
      <SectionHeader
        label="A · Vendas & SCM"
        accent="text-amber-400/80 bg-amber-950/30 hover:bg-amber-950/50"
        expanded={pillarA}
        onToggle={() => setPillarA(v => !v)}
      />

      {pillarA && (
        <div className="mb-3 space-y-1">

          {/* Recebimentos de Marketplaces (com árvore empresa → marketplace) */}
          <div>
            <div
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer ${
                isActive(MODULO_RECEBIMENTOS.id) ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
              onClick={() => {
                setModuloSelecionado(MODULO_RECEBIMENTOS);
                setExpandedRecebimentos(v => !v);
              }}
            >
              <div className="flex items-center flex-1">
                <CreditCard className="w-4 h-4 mr-2 shrink-0" />
                <span className="truncate">Recebimentos MP</span>
              </div>
              <div onClick={(e) => { e.stopPropagation(); setExpandedRecebimentos(v => !v); }} className="ml-1 cursor-pointer">
                {expandedRecebimentos ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </div>
            </div>

            {expandedRecebimentos && (
              <div className="ml-3 mt-1 space-y-1 border-l-2 border-slate-700 pl-2">
                {empresas.map((empresa) => {
                  const isExpanded = expandedEmpresas[empresa.id] ?? false;
                  const isSelected = empresaSelecionada?.id === empresa.id && !marketplaceSelecionado && isActive(MODULO_RECEBIMENTOS.id);
                  const mps = marketplaces[empresa.id] || [];
                  return (
                    <div key={empresa.id}>
                      <div
                        className={`flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                          isSelected ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                        onClick={() => {
                          if (!mps.length) handleEmpresaRecebimentosClick(empresa);
                          else toggleEmpresa(empresa.id);
                        }}
                      >
                        <div className="flex items-center flex-1">
                          <Building2 className="w-3 h-3 mr-1.5 shrink-0" />
                          <span className="truncate">{empresa.nome}</span>
                        </div>
                        {mps.length > 0 && (
                          <div onClick={(e) => { e.stopPropagation(); toggleEmpresa(empresa.id); }} className="ml-1 cursor-pointer">
                            {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                          </div>
                        )}
                      </div>
                      {mps.length > 0 && isExpanded && (
                        <div className="ml-4 mt-0.5 space-y-0.5 border-l-2 border-slate-600 pl-2">
                          {mps.map((mp) => (
                            <div
                              key={mp.id}
                              onClick={() => { handleEmpresaRecebimentosClick(empresa); handleMarketplaceClick(mp); }}
                              className={`flex items-center px-2 py-1 rounded text-xs cursor-pointer transition-colors ${
                                marketplaceSelecionado?.id === mp.id
                                  ? 'bg-green-600 text-white font-medium'
                                  : empresaSelecionada?.id === empresa.id
                                  ? 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                              }`}
                            >
                              <Store className="w-3 h-3 mr-1.5 shrink-0" />
                              <span className="truncate">{mp.nome}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Vendas e Margem */}
          <NavItem
            icon={<TrendingUp className="w-4 h-4 shrink-0" />}
            label="Vendas e Margem"
            active={isActive(MODULO_VENDAS.id)}
            activeColor="bg-emerald-600 text-white"
            onClick={() => setModuloSelecionado(MODULO_VENDAS)}
          />

          {/* Gestão Comercial (Billing / Proformas) */}
          <NavItem
            icon={<FileText className="w-4 h-4 shrink-0" />}
            label="Gestão Comercial"
            active={isActive(MODULO_BILLING.id)}
            activeColor="bg-amber-600 text-white"
            onClick={() => setModuloSelecionado(MODULO_BILLING)}
          />

          {/* Faturação AT */}
          <NavItem
            icon={<Receipt className="w-4 h-4 shrink-0" />}
            label="Faturação AT"
            active={isActive(MODULO_FATURACAO.id)}
            activeColor="bg-amber-600 text-white"
            onClick={() => setModuloSelecionado(MODULO_FATURACAO)}
          />

          {/* Compras */}
          <NavItem
            icon={<ShoppingCart className="w-4 h-4 shrink-0" />}
            label="Compras"
            active={isActive(MODULO_COMPRAS.id)}
            activeColor="bg-amber-600 text-white"
            onClick={() => setModuloSelecionado(MODULO_COMPRAS)}
          />
        </div>
      )}

      {/* ═══ PILAR B: LOGÍSTICA ═════════════════════════════════════════════ */}
      <SectionHeader
        label="B · Logística"
        accent="text-teal-400/80 bg-teal-950/30 hover:bg-teal-950/50"
        expanded={pillarB}
        onToggle={() => setPillarB(v => !v)}
      />

      {pillarB && (
        <div className="mb-3 space-y-1">
          <NavItem
            icon={<Package className="w-4 h-4 shrink-0" />}
            label="Gestão de Escritório"
            active={isActive(MODULO_LOGISTICA.id)}
            activeColor="bg-teal-600 text-white"
            onClick={() => setModuloSelecionado(MODULO_LOGISTICA)}
          />
          <NavItem
            icon={<RotateCcw className="w-4 h-4 shrink-0" />}
            label="Devoluções (RMA)"
            active={isActive(MODULO_RMA.id)}
            activeColor="bg-orange-600 text-white"
            onClick={() => setModuloSelecionado(MODULO_RMA)}
          />
          <NavItem
            icon={<Boxes className="w-4 h-4 shrink-0" />}
            label="Stock Escritório"
            active={isActive(MODULO_OFFICE_STOCK.id)}
            activeColor="bg-amber-600 text-white"
            onClick={() => setModuloSelecionado(MODULO_OFFICE_STOCK)}
          />
        </div>
      )}

      {/* ═══ PILAR C: FINANCEIRO ════════════════════════════════════════════ */}
      <SectionHeader
        label="C · Financeiro"
        accent="text-sky-400/80 bg-sky-950/30 hover:bg-sky-950/50"
        expanded={pillarC}
        onToggle={() => setPillarC(v => !v)}
      />

      {pillarC && (
        <div className="mb-3 space-y-1">

          {/* Bancos com sub-árvore de empresas */}
          <div>
            <div
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer ${
                isActive(MODULO_BANCOS.id) ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
              onClick={() => {
                setModuloSelecionado(MODULO_BANCOS);
                setExpandedBancos(v => !v);
              }}
            >
              <div className="flex items-center flex-1">
                <Landmark className="w-4 h-4 mr-2 shrink-0" />
                <span className="truncate">Bancos</span>
              </div>
              <div onClick={(e) => { e.stopPropagation(); setExpandedBancos(v => !v); }} className="ml-1 cursor-pointer">
                {expandedBancos ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </div>
            </div>

            {expandedBancos && (
              <div className="ml-3 mt-1 space-y-0.5 border-l-2 border-slate-700 pl-2">
                {empresas.map((empresa) => {
                  const isSelected = isActive(MODULO_BANCOS.id) && empresaSelecionada?.id === empresa.id;
                  return (
                    <div
                      key={`bancos-${empresa.id}`}
                      onClick={() => handleModuloBancosEmpresaClick(empresa)}
                      className={`flex items-center px-2 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                        isSelected ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      <Building2 className="w-3 h-3 mr-1.5 shrink-0" />
                      <span className="truncate">{empresa.nome}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Finanças Globais (com badge de faturas pendentes) */}
          <div
            onClick={() => setModuloSelecionado(MODULO_FINANCAS)}
            className={`w-full flex items-center px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer ${
              isActive(MODULO_FINANCAS.id) ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <DollarSign className="w-4 h-4 shrink-0" />
            <span className="truncate ml-2">Finanças Globais</span>
            {invoiceBadge > 0 && (
              <span className="ml-auto bg-rose-600 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                {invoiceBadge > 99 ? '99+' : invoiceBadge}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ═══ PILAR D: CONFIGURAÇÃO ══════════════════════════════════════════ */}
      <SectionHeader
        label="D · Configuração"
        accent="text-slate-400/70 bg-slate-800/50 hover:bg-slate-700/50"
        expanded={pillarD}
        onToggle={() => setPillarD(v => !v)}
      />

      {pillarD && (
        <div className="mb-3 space-y-1">

          {/* Dados Mestres (expandable) */}
          <div>
            <div
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer ${
                moduloSelecionado?.id?.startsWith('dados-mestres') ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
              onClick={() => setExpandedDadosMestres(v => !v)}
            >
              <div className="flex items-center flex-1">
                <FolderOpen className="w-4 h-4 mr-2 shrink-0" />
                <span className="truncate">Dados Mestres</span>
              </div>
              <div onClick={(e) => { e.stopPropagation(); setExpandedDadosMestres(v => !v); }} className="ml-1 cursor-pointer">
                {expandedDadosMestres ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </div>
            </div>

            {expandedDadosMestres && (
              <div className="ml-3 mt-1 space-y-0.5 border-l-2 border-slate-700 pl-2">
                {[
                  { id: 'dados-mestres-fornecedores', label: 'Fornecedores',      Icon: Users },
                  { id: 'dados-mestres-empresas',     label: 'Empresas',          Icon: Building2 },
                  { id: 'dados-mestres-marketplaces', label: 'Marketplaces',      Icon: Store },
                  { id: 'dados-mestres-escritorios',  label: 'Escritórios',       Icon: MapPin },
                  { id: 'dados-mestres-iva',          label: 'Tabela de IVA',     Icon: Globe },
                  { id: 'dados-mestres-skus',         label: 'Mapping de SKUs',   Icon: Link2 },
                ].map(({ id, label, Icon }) => (
                  <div
                    key={id}
                    onClick={() => setModuloSelecionado({ ...MODULO_DADOS_MESTRES, id })}
                    className={`flex items-center px-2 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                      moduloSelecionado?.id === id ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <Icon className="w-3 h-3 mr-1.5 shrink-0" />
                    <span className="truncate">{label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Automação */}
          <NavItem
            icon={<Zap className="w-4 h-4 shrink-0" />}
            label="Status de Automação"
            active={isActive(MODULO_AUTOMATION.id)}
            activeColor="bg-purple-600 text-white"
            onClick={() => setModuloSelecionado(MODULO_AUTOMATION)}
          />

          {/* Configuração Sistema (SMTP, etc.) */}
          <NavItem
            icon={<Settings2 className="w-4 h-4 shrink-0" />}
            label="Configuração Sistema"
            active={isActive(MODULO_SYSTEM_CFG.id)}
            activeColor="bg-slate-600 text-white"
            onClick={() => setModuloSelecionado(MODULO_SYSTEM_CFG)}
          />
        </div>
      )}

      {/* ═══ DOCUMENTAÇÃO ═══════════════════════════════════════════════════ */}
      <div className="mt-auto pt-3 border-t border-slate-700/60">
        <NavItem
          icon={<BookOpen className="w-4 h-4 shrink-0" />}
          label="Documentação"
          active={isActive(MODULO_DOCS.id)}
          activeColor="bg-violet-600 text-white"
          onClick={() => setModuloSelecionado(MODULO_DOCS)}
        />
      </div>
    </div>
  );
}
