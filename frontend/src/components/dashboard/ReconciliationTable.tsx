import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { ReconciliationCycle } from '@/types/kpis';

interface ReconciliationTableProps {
  cycles: ReconciliationCycle[];
  loading?: boolean;
}

export function ReconciliationTable({ cycles, loading }: ReconciliationTableProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Conciliação: Net vs TRF (+0/+7 dias)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-slate-400">A carregar...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Conciliação: Net vs TRF (+0/+7 dias)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-slate-400 border-b border-slate-500">
              <tr>
                <th className="text-left py-3 px-4">Ciclo</th>
                <th className="text-right py-3 px-4">Data Fim</th>
                <th className="text-right py-3 px-4">Net</th>
                <th className="text-right py-3 px-4">TRF (0-7 dias)</th>
                <th className="text-right py-3 px-4">Diferença</th>
              </tr>
            </thead>
            <tbody>
              {cycles.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-slate-400">
                    Sem dados de conciliação
                  </td>
                </tr>
              ) : (
                cycles.map((cycle, i) => (
                  <tr key={i} className="border-b border-slate-600 hover:bg-slate-600">
                    <td className="py-3 px-4 font-medium">{cycle.ciclo}</td>
                    <td className="text-right py-3 px-4 text-slate-300">
                      {formatDate(cycle.cycle_end)}
                    </td>
                    <td className="text-right py-3 px-4 text-blue-400 font-semibold">
                      {formatCurrency(cycle.net)}
                    </td>
                    <td className="text-right py-3 px-4 text-green-400 font-semibold">
                      {formatCurrency(cycle.trf_0_7)}
                    </td>
                    <td
                      className={`text-right py-3 px-4 font-semibold ${
                        cycle.diff === 0
                          ? 'text-green-400'
                          : Math.abs(cycle.diff) < 50
                          ? 'text-yellow-400'
                          : 'text-red-400'
                      }`}
                    >
                      {formatCurrency(cycle.diff)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

