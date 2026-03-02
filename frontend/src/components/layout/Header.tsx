'use client';

import React from 'react';
import { useApp } from '@/context/AppContext';

export function Header() {
  const { moduloSelecionado, empresaSelecionada, marketplaceSelecionado } = useApp();

  return (
    <div className="mb-12">
      <h1 className="text-4xl font-bold mb-2">💳 Recebimentos Marketplaces V1.1</h1>
      <p className="text-slate-400">Análise de transações, comissões e conciliação bancária</p>
      
      {(moduloSelecionado || empresaSelecionada || marketplaceSelecionado) && (
        <div className="mt-4 flex items-center gap-4 text-sm flex-wrap">
          {moduloSelecionado && (
            <div className="px-3 py-1 bg-purple-600 rounded-lg">
              <span className="text-white font-medium">{moduloSelecionado.nome}</span>
            </div>
          )}
          {empresaSelecionada && (
            <div className="px-3 py-1 bg-blue-600 rounded-lg">
              <span className="text-white font-medium">{empresaSelecionada.nome}</span>
            </div>
          )}
          {marketplaceSelecionado && (
            <div className="px-3 py-1 bg-green-600 rounded-lg">
              <span className="text-white font-medium">{marketplaceSelecionado.nome}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

