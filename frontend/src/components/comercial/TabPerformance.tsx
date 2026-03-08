'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { TrendingUp, AlertTriangle, Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { comercialApi, type TopPerformerItem, type BlacklistItem } from '@/lib/api/comercial';

export function TabPerformance() {
  const [topPerformers, setTopPerformers] = useState<TopPerformerItem[]>([]);
  const [blacklist, setBlacklist] = useState<BlacklistItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([comercialApi.getTopPerformers(), comercialApi.getBlacklist()])
      .then(([top, bl]) => { setTopPerformers(top); setBlacklist(bl); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> A carregar...
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="border border-slate-600 bg-slate-800/50 shadow-sm">
        <CardHeader className="border-b border-slate-600 bg-slate-800/80">
          <CardTitle className="text-lg text-slate-100 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            Top Performers (Lucro Líquido Real)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-700/60 text-slate-200 border-b border-slate-600">
                  <th className="text-left py-3 px-4 font-semibold border-r border-slate-600">SKU</th>
                  <th className="text-left py-3 px-4 font-semibold border-r border-slate-600">Unid. vendidas</th>
                  <th className="text-right py-3 px-4 font-semibold border-r border-slate-600">Lucro Líquido</th>
                  <th className="text-right py-3 px-4 font-semibold">Margem %</th>
                </tr>
              </thead>
              <tbody>
                {topPerformers.map((r) => (
                  <tr key={r.sku_interno} className="border-b border-slate-700 hover:bg-slate-700/30">
                    <td className="py-3 px-4 border-r border-slate-700 font-mono text-slate-200">{r.sku_interno}</td>
                    <td className="py-3 px-4 border-r border-slate-700 text-slate-300">{r.unidades_vendidas}</td>
                    <td className="py-3 px-4 border-r border-slate-700 text-right text-emerald-400">{formatCurrency(r.lucro_liquido_real)}</td>
                    <td className="py-3 px-4 text-right text-slate-300">{r.margem_pct.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-slate-600 bg-slate-800/50 shadow-sm">
        <CardHeader className="border-b border-slate-600 bg-slate-800/80">
          <CardTitle className="text-lg text-slate-100 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            Blacklist Recomendada
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-700/60 text-slate-200 border-b border-slate-600">
                  <th className="text-left py-3 px-4 font-semibold border-r border-slate-600">SKU</th>
                  <th className="text-left py-3 px-4 font-semibold border-r border-slate-600">Devoluções</th>
                  <th className="text-right py-3 px-4 font-semibold border-r border-slate-600">Custo dev.</th>
                  <th className="text-right py-3 px-4 font-semibold border-r border-slate-600">Margem op.%</th>
                  <th className="text-left py-3 px-4 font-semibold">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {blacklist.map((r) => (
                  <tr key={r.sku_interno} className="border-b border-slate-700 hover:bg-slate-700/30">
                    <td className="py-3 px-4 border-r border-slate-700 font-mono text-slate-200">{r.sku_interno}</td>
                    <td className="py-3 px-4 border-r border-slate-700 text-slate-300">{r.unidades_devolvidas}</td>
                    <td className="py-3 px-4 border-r border-slate-700 text-right text-red-400">{formatCurrency(r.custo_devolucoes)}</td>
                    <td className="py-3 px-4 border-r border-slate-700 text-right text-slate-300">{r.margem_operacional_pct.toFixed(1)}%</td>
                    <td className="py-3 px-4 text-slate-400 text-xs">{r.motivo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
