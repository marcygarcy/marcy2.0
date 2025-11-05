import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import type { CycleBreakdownItem } from '@/types/kpis';

interface CycleBreakdownProps {
  ciclo: string | null;
  dataCiclo: string | null;
  breakdown: CycleBreakdownItem[];
  totalNet: number;
  loading?: boolean;
}

export function CycleBreakdown({ ciclo, dataCiclo, breakdown, totalNet, loading }: CycleBreakdownProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>📋 Resumo Detalhado do Último Ciclo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-slate-400">A carregar...</div>
        </CardContent>
      </Card>
    );
  }

  if (!ciclo || breakdown.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>📋 Resumo Detalhado do Último Ciclo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-slate-400">
            Sem dados disponíveis. Carregue ficheiros de transações primeiro.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>📋 Resumo Detalhado - {ciclo}</CardTitle>
          {dataCiclo && (
            <span className="text-slate-400 text-sm">{new Date(dataCiclo).toLocaleDateString('pt-PT')}</span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Breakdown por tipo */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-slate-400 border-b border-slate-500">
                <tr>
                  <th className="text-left py-3 px-4">Tipo de Transação</th>
                  <th className="text-right py-3 px-4">Quantidade</th>
                  <th className="text-right py-3 px-4">Crédito</th>
                  <th className="text-right py-3 px-4">Débito</th>
                  <th className="text-right py-3 px-4">Real</th>
                </tr>
              </thead>
              <tbody>
                {breakdown.map((item, i) => (
                  <tr key={i} className="border-b border-slate-600 hover:bg-slate-600">
                    <td className="py-3 px-4 font-medium">{item.tipo}</td>
                    <td className="text-right py-3 px-4 text-slate-300">{item.quantidade}</td>
                    <td className="text-right py-3 px-4 text-green-400">
                      {item.credito > 0 ? formatCurrency(item.credito) : '-'}
                    </td>
                    <td className="text-right py-3 px-4 text-red-400">
                      {item.debito > 0 ? formatCurrency(item.debito) : '-'}
                    </td>
                    <td className={`text-right py-3 px-4 font-semibold ${
                      item.real >= 0 ? 'text-blue-400' : 'text-red-400'
                    }`}>
                      {formatCurrency(item.real)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Total Net */}
          <div className="bg-slate-600 p-4 rounded-lg mt-6">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold">Total Net do Ciclo</span>
              <span className={`text-2xl font-bold ${
                totalNet >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {formatCurrency(totalNet)}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

