import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useKPIs } from '@/lib/hooks/useKPIs';
import { formatCurrency } from '@/lib/utils';

export function UploadStats() {
  const { kpis, loading } = useKPIs();

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>📊 Históricos de Dados</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-slate-400">A carregar...</div>
        </CardContent>
      </Card>
    );
  }

  if (!kpis) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>📊 Históricos de Dados</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-800 rounded-lg p-4">
            <p className="text-sm text-slate-400 mb-1">Histórico de Pedidos Acumulados</p>
            <p className="text-2xl font-bold text-blue-400">{kpis.pedidos_recebidos}</p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4">
            <p className="text-sm text-slate-400 mb-1">Total Produtos</p>
            <p className="text-2xl font-bold text-green-400">{kpis.produtos_vendidos}</p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4">
            <p className="text-sm text-slate-400 mb-1">Comissões Totais</p>
            <p className="text-2xl font-bold text-red-400">
              {formatCurrency(kpis.comissoes_acum.comissoes)}
            </p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4">
            <p className="text-sm text-slate-400 mb-1">Reembolsos</p>
            <p className="text-2xl font-bold text-orange-400">
              {formatCurrency(kpis.reembolsos_acum.total)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

