'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { BankStatement } from './BankStatement';
import { useApp } from '@/context/AppContext';

export function BancosView() {
  const { empresaSelecionada } = useApp();

  return (
    <div className="mt-8 space-y-6">
      {empresaSelecionada && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-slate-400 text-sm">
              <span className="text-slate-500">Empresa:</span>{' '}
              <span className="text-sky-400 font-medium">{empresaSelecionada.nome}</span>
            </p>
          </CardContent>
        </Card>
      )}
      <BankStatement />
    </div>
  );
}
