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

interface AppContextType {
  empresaSelecionada: Empresa | null;
  marketplaceSelecionado: Marketplace | null;
  setEmpresaSelecionada: (empresa: Empresa | null) => void;
  setMarketplaceSelecionado: (marketplace: Marketplace | null) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
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

  const [empresaSelecionada, setEmpresaSelecionadaState] = useState<Empresa | null>(DEFAULT_EMPRESA);
  const [marketplaceSelecionado, setMarketplaceSelecionadoState] = useState<Marketplace | null>(DEFAULT_MARKETPLACE);

  // Carregar do localStorage ao inicializar, ou usar padrão
  useEffect(() => {
    const empresaSaved = localStorage.getItem('empresaSelecionada');
    const marketplaceSaved = localStorage.getItem('marketplaceSelecionado');
    
    if (empresaSaved) {
      try {
        const empresa = JSON.parse(empresaSaved);
        setEmpresaSelecionadaState(empresa);
      } catch (e) {
        console.error('Erro ao carregar empresa do localStorage:', e);
        setEmpresaSelecionadaState(DEFAULT_EMPRESA);
      }
    } else {
      // Se não houver no localStorage, usar padrão
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
      // Se não houver no localStorage, usar padrão
      setMarketplaceSelecionadoState(DEFAULT_MARKETPLACE);
      localStorage.setItem('marketplaceSelecionado', JSON.stringify(DEFAULT_MARKETPLACE));
    }
  }, []);

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

  return (
    <AppContext.Provider
      value={{
        empresaSelecionada,
        marketplaceSelecionado,
        setEmpresaSelecionada,
        setMarketplaceSelecionado,
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

