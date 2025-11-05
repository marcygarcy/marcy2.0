'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { empresasApi, Empresa } from '@/lib/api/empresas';
import { marketplacesApi, Marketplace } from '@/lib/api/marketplaces';
import { Building2, ChevronDown, ChevronRight, Store } from 'lucide-react';

// Empresas hardcoded
const EMPRESAS_HARDCODED: Empresa[] = [
  {
    id: 1,
    nome: "teste 369",
    codigo: "BHS",
    ativo: true
  },
  {
    id: 2,
    nome: "Teste 123",
    codigo: "GHS",
    ativo: true
  },
  {
    id: 3,
    nome: "testes xyz",
    codigo: "BHS_SL",
    ativo: true
  },
  {
    id: 4,
    nome: "Teste 123",
    codigo: "BHS_DE",
    ativo: true
  },
  {
    id: 5,
    nome: "testes xyz",
    codigo: "BES",
    ativo: true
  }
];

// Marketplaces hardcoded
const MARKETPLACES_HARDCODED: Record<number, Marketplace[]> = {
  2: [ // Teste 123
    {
      id: 1,
      empresa_id: 2,
      nome: "Pixmania",
      ativo: true
    },
    {
      id: 2,
      empresa_id: 2,
      nome: "Worten",
      ativo: true
    }
  ]
};

export function Sidebar() {
  const { empresaSelecionada, marketplaceSelecionado, setEmpresaSelecionada, setMarketplaceSelecionado } = useApp();
  const [empresas, setEmpresas] = useState<Empresa[]>(EMPRESAS_HARDCODED);
  const [marketplaces, setMarketplaces] = useState<Record<number, Marketplace[]>>(MARKETPLACES_HARDCODED);
  const [expandedEmpresas, setExpandedEmpresas] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Tentar carregar da API, mas usar hardcoded como fallback
    loadEmpresas();
  }, []);

  useEffect(() => {
    if (empresaSelecionada) {
      // Se não tiver marketplaces carregados, usar os hardcoded
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
      // Tentar carregar da API
      const data = await empresasApi.getAll();
      console.log('Empresas carregadas da API:', data);
      if (data && Array.isArray(data) && data.length > 0) {
        setEmpresas(data.filter(e => e.ativo));
      } else {
        // Se não conseguir, usar hardcoded
        console.log('Usando empresas hardcoded');
        setEmpresas(EMPRESAS_HARDCODED);
      }
    } catch (error: any) {
      console.error('Erro ao carregar empresas da API, usando hardcoded:', error);
      // Em caso de erro, usar hardcoded
      setEmpresas(EMPRESAS_HARDCODED);
    }
  };

  const loadMarketplaces = async (empresaId: number) => {
    try {
      // Tentar carregar da API
      const data = await marketplacesApi.getByEmpresa(empresaId);
      if (data && Array.isArray(data) && data.length > 0) {
        setMarketplaces(prev => ({ ...prev, [empresaId]: data.filter(m => m.ativo) }));
      } else if (MARKETPLACES_HARDCODED[empresaId]) {
        // Se não conseguir, usar hardcoded
        setMarketplaces(prev => ({ ...prev, [empresaId]: MARKETPLACES_HARDCODED[empresaId] }));
      }
    } catch (error) {
      console.error('Erro ao carregar marketplaces da API, usando hardcoded:', error);
      // Em caso de erro, usar hardcoded
      if (MARKETPLACES_HARDCODED[empresaId]) {
        setMarketplaces(prev => ({ ...prev, [empresaId]: MARKETPLACES_HARDCODED[empresaId] }));
      }
    }
  };

  const toggleEmpresa = (empresaId: number) => {
    setExpandedEmpresas(prev => {
      const newState = { ...prev, [empresaId]: !prev[empresaId] };
      if (newState[empresaId] && !marketplaces[empresaId]) {
        loadMarketplaces(empresaId);
      }
      return newState;
    });
  };

  const handleEmpresaClick = (empresa: Empresa) => {
    setEmpresaSelecionada(empresa);
    // Se a empresa tem marketplaces, expandir automaticamente
    if (marketplaces[empresa.id] && marketplaces[empresa.id].length > 0) {
      if (!expandedEmpresas[empresa.id]) {
        toggleEmpresa(empresa.id);
      }
    }
  };

  const handleMarketplaceClick = (marketplace: Marketplace) => {
    // Garantir que a empresa está selecionada quando selecionamos um marketplace
    const empresa = empresas.find(e => e.id === marketplace.empresa_id);
    if (empresa) {
      setEmpresaSelecionada(empresa);
    }
    setMarketplaceSelecionado(marketplace);
  };


  return (
    <div className="w-64 bg-slate-900 border-r border-slate-700 p-4 overflow-y-auto">
      <h2 className="text-lg font-bold text-white mb-4 flex items-center">
        <Building2 className="w-5 h-5 mr-2 text-blue-400" />
        Empresas
      </h2>
      
      <div className="space-y-1">
        {empresas.map((empresa) => {
          const isExpanded = expandedEmpresas[empresa.id] || false;
          const isSelected = empresaSelecionada?.id === empresa.id && !marketplaceSelecionado;
          const empresaMarketplaces = marketplaces[empresa.id] || [];
          const hasMarketplaces = empresaMarketplaces.length > 0;

          return (
            <div key={empresa.id} className="mb-1">
              <div
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
                onClick={() => {
                  if (!hasMarketplaces) {
                    handleEmpresaClick(empresa);
                  } else {
                    toggleEmpresa(empresa.id);
                  }
                }}
              >
                <div className="flex items-center flex-1">
                  <Building2 className="w-4 h-4 mr-2" />
                  <span className="truncate">{empresa.nome}</span>
                </div>
                {hasMarketplaces && (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleEmpresa(empresa.id);
                    }}
                    className="ml-2 cursor-pointer flex items-center"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </div>
                )}
              </div>

              {hasMarketplaces && isExpanded && (
                <div className="ml-6 mt-1 space-y-1 border-l-2 border-slate-700 pl-2">
                  {empresaMarketplaces.map((marketplace) => {
                    const isMarketplaceSelected = marketplaceSelecionado?.id === marketplace.id;
                    const isParentSelected = empresaSelecionada?.id === empresa.id;
                    return (
                      <div
                        key={marketplace.id}
                        onClick={() => {
                          handleEmpresaClick(empresa);
                          handleMarketplaceClick(marketplace);
                        }}
                        className={`w-full flex items-center px-3 py-1.5 rounded-md text-xs transition-colors cursor-pointer ${
                          isMarketplaceSelected
                            ? 'bg-green-600 text-white font-medium'
                            : isParentSelected
                            ? 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300'
                        }`}
                      >
                        <Store className="w-3 h-3 mr-2" />
                        <span className="truncate">{marketplace.nome}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {empresas.length === 0 && (
        <div className="text-slate-400 text-sm text-center py-8">
          Nenhuma empresa encontrada
        </div>
      )}
    </div>
  );
}

