'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface Empresa {
  id: number;
  nome: string;
  codigo?: string;
  nif?: string;
  morada?: string;
  email?: string;
  telefone?: string;
  ativo: boolean;
}

export interface Marketplace {
  id: number;
  empresa_id: number;
  nome: string;
  codigo?: string;
  descricao?: string;
  ativo: boolean;
}

export interface Modulo {
  id: string;
  nome: string;
  icone?: string;
}

/** Navegação one-shot para Finanças: abrir tab (pagamentos ou ledger) e opcionalmente preselecionar fornecedor na Conta Corrente */
export interface FinancasNavigation {
  tab: 'pagamentos' | 'ledger';
  supplierId?: number;
}

/** Navegação one-shot para Dados Mestres > Fornecedores: abrir ficha do fornecedor e opcionalmente a aba (ex.: acessos) */
export interface DadosMestresNavigation {
  supplierId: number;
  tab?: 'geral' | 'fiscal' | 'logistica' | 'acessos';
}

interface AppContextType {
  moduloSelecionado: Modulo | null;
  empresaSelecionada: Empresa | null;
  marketplaceSelecionado: Marketplace | null;
  financasNavigation: FinancasNavigation | null;
  dadosMestresNavigation: DadosMestresNavigation | null;
  setModuloSelecionado: (modulo: Modulo | null) => void;
  setEmpresaSelecionada: (empresa: Empresa | null) => void;
  setMarketplaceSelecionado: (marketplace: Marketplace | null) => void;
  setFinancasNavigation: (nav: FinancasNavigation | null) => void;
  setDadosMestresNavigation: (nav: DadosMestresNavigation | null) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  // Módulo padrão: Recebimentos de Marketplaces
  const DEFAULT_MODULO: Modulo = {
    id: 'recebimentos-marketplaces',
    nome: 'Recebimentos de Marketplaces',
    icone: '💳'
  };

  // Valores padrão: Teste 123 (ID=2) e Pixmania (ID=1)
  const DEFAULT_EMPRESA: Empresa = {
    id: 2,
    nome: "Teste 123",
    codigo: "GHS",
    ativo: true
  };
  
  const DEFAULT_MARKETPLACE: Marketplace = {
    id: 1,
    empresa_id: 2,
    nome: "Pixmania",
    ativo: true
  };

  const [moduloSelecionado, setModuloSelecionadoState] = useState<Modulo | null>(DEFAULT_MODULO);
  const [empresaSelecionada, setEmpresaSelecionadaState] = useState<Empresa | null>(DEFAULT_EMPRESA);
  const [marketplaceSelecionado, setMarketplaceSelecionadoState] = useState<Marketplace | null>(DEFAULT_MARKETPLACE);
  const [financasNavigation, setFinancasNavigationState] = useState<FinancasNavigation | null>(null);
  const [dadosMestresNavigation, setDadosMestresNavigationState] = useState<DadosMestresNavigation | null>(null);

  // Carregar do localStorage ao inicializar (apenas no browser)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const moduloSaved = localStorage.getItem('moduloSelecionado');
    const empresaSaved = localStorage.getItem('empresaSelecionada');
    const marketplaceSaved = localStorage.getItem('marketplaceSelecionado');
    
    if (moduloSaved) {
      try {
        const modulo = JSON.parse(moduloSaved);
        setModuloSelecionadoState(modulo);
      } catch (e) {
        console.error('Erro ao carregar módulo do localStorage:', e);
        setModuloSelecionadoState(DEFAULT_MODULO);
      }
    } else {
      setModuloSelecionadoState(DEFAULT_MODULO);
      localStorage.setItem('moduloSelecionado', JSON.stringify(DEFAULT_MODULO));
    }
    
    if (empresaSaved) {
      try {
        const empresa = JSON.parse(empresaSaved);
        setEmpresaSelecionadaState(empresa);
      } catch (e) {
        console.error('Erro ao carregar empresa do localStorage:', e);
        setEmpresaSelecionadaState(DEFAULT_EMPRESA);
      }
    } else {
      setEmpresaSelecionadaState(DEFAULT_EMPRESA);
      localStorage.setItem('empresaSelecionada', JSON.stringify(DEFAULT_EMPRESA));
    }
    
    if (marketplaceSaved) {
      try {
        const marketplace = JSON.parse(marketplaceSaved);
        setMarketplaceSelecionadoState(marketplace);
      } catch (e) {
        console.error('Erro ao carregar marketplace do localStorage:', e);
        setMarketplaceSelecionadoState(DEFAULT_MARKETPLACE);
      }
    } else {
      setMarketplaceSelecionadoState(DEFAULT_MARKETPLACE);
      localStorage.setItem('marketplaceSelecionado', JSON.stringify(DEFAULT_MARKETPLACE));
    }
  }, []);

  const setModuloSelecionado = (modulo: Modulo | null) => {
    const moduloToUse = modulo || DEFAULT_MODULO;
    setModuloSelecionadoState(moduloToUse);
    localStorage.setItem('moduloSelecionado', JSON.stringify(moduloToUse));
  };

  const setEmpresaSelecionada = (empresa: Empresa | null) => {
    const empresaToUse = empresa || DEFAULT_EMPRESA;
    setEmpresaSelecionadaState(empresaToUse);
    localStorage.setItem('empresaSelecionada', JSON.stringify(empresaToUse));
    
    // Ao mudar empresa, verificar se o marketplace ainda é válido
    if (marketplaceSelecionado && marketplaceSelecionado.empresa_id !== empresaToUse.id) {
      // Se o marketplace não pertence à nova empresa, usar o primeiro marketplace da empresa ou Pixmania
      if (empresaToUse.id === 2) {
        // Se voltar para Teste 123, usar Pixmania
        setMarketplaceSelecionadoState(DEFAULT_MARKETPLACE);
        localStorage.setItem('marketplaceSelecionado', JSON.stringify(DEFAULT_MARKETPLACE));
      } else {
        // Para outras empresas, limpar marketplace (pode ser selecionado depois)
        setMarketplaceSelecionadoState(null);
        localStorage.removeItem('marketplaceSelecionado');
      }
    }
  };

  const setMarketplaceSelecionado = (marketplace: Marketplace | null) => {
    const marketplaceToUse = marketplace || DEFAULT_MARKETPLACE;
    setMarketplaceSelecionadoState(marketplaceToUse);
    localStorage.setItem('marketplaceSelecionado', JSON.stringify(marketplaceToUse));
    
    // Garantir que a empresa correspondente está selecionada
    if (marketplaceToUse && (!empresaSelecionada || empresaSelecionada.id !== marketplaceToUse.empresa_id)) {
      // Não fazer nada aqui, pois a empresa já deve estar selecionada
      // Mas podemos garantir que está sincronizado
    }
  };

  const setFinancasNavigation = (nav: FinancasNavigation | null) => {
    setFinancasNavigationState(nav);
  };

  const setDadosMestresNavigation = (nav: DadosMestresNavigation | null) => {
    setDadosMestresNavigationState(nav);
  };

  return (
    <AppContext.Provider
      value={{
        moduloSelecionado,
        empresaSelecionada,
        marketplaceSelecionado,
        financasNavigation,
        dadosMestresNavigation,
        setModuloSelecionado,
        setEmpresaSelecionada,
        setMarketplaceSelecionado,
        setFinancasNavigation,
        setDadosMestresNavigation,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp deve ser usado dentro de AppProvider');
  }
  return context;
}

