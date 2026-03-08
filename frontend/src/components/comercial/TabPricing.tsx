'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tag, Calculator, Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { comercialApi, type ProductSKU } from '@/lib/api/comercial';

function MarginBadge({ pct }: { pct: number }) {
  if (pct >= 15) return <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-emerald-900/60 text-emerald-300 border border-emerald-700">{pct.toFixed(1)}%</span>;
  if (pct < 5) return <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-red-900/60 text-red-300 border border-red-700">{pct.toFixed(1)}%</span>;
  return <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-amber-900/50 text-amber-300 border border-amber-700">{pct.toFixed(1)}%</span>;
}

export function TabPricing() {
  const [catalogo, setCatalogo] = useState<ProductSKU[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [simulator, setSimulator] = useState({ custo_base: 50, margem_desejada_pct: 20, comissao_pct: 10, vat_rate: 23 });
  const [result, setResult] = useState<{ pvp_sugerido: number; margem_liquida_pct: number } | null>(null);
  const [simulating, setSimulating] = useState(false);

  useEffect(() => {
    comercialApi.getCatalogo().then(setCatalogo).catch(() => setCatalogo([])).finally(() => setLoading(false));
  }, []);

  const runSimulator = () => {
    setSimulating(true);
    comercialApi.simuladorMargem({
      custo_base: simulator.custo_base,
      margem_desejada_pct: simulator.margem_desejada_pct,
      comissao_marketplace_pct: simulator.comissao_pct,
      vat_rate: simulator.vat_rate,
    }).then((r) => setResult({ pvp_sugerido: r.pvp_sugerido, margem_liquida_pct: r.margem_liquida_pct })).finally(() => setSimulating(false));
  };

  const marketplacesList = catalogo[0]?.marketplaces?.map((m) => m.marketplace_name) || ['Worten', 'Amazon'];

  return (
    <Card className="border border-slate-600 bg-slate-800/50">
      <CardHeader className="border-b border-slate-600 bg-slate-800/80">
        <CardTitle className="text-lg text-slate-100 flex items-center gap-2">
          <Tag className="w-5 h-5 text-amber-400" /> Pricing Engine & Catálogo
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-slate-400"><Loader2 className="w-6 h-6 animate-spin mr-2" /> A carregar...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-700/60 text-slate-200 border-b border-slate-600">
                  <th className="text-left py-3 px-4 font-semibold border-r border-slate-600">SKU Interno</th>
                  <th className="text-left py-3 px-4 font-semibold border-r border-slate-600">Custo Base</th>
                  {marketplacesList.map((name) => (
                    <th key={name} className="text-left py-3 px-4 font-semibold border-r border-slate-600">{name}</th>
                  ))}
                  <th className="text-left py-3 px-4 font-semibold">Ação</th>
                </tr>
              </thead>
              <tbody>
                {catalogo.map((row) => (
                  <tr key={row.sku_interno} className="border-b border-slate-700 hover:bg-slate-700/30">
                    <td className="py-3 px-4 border-r border-slate-700 font-mono text-slate-200">{row.sku_interno}</td>
                    <td className="py-3 px-4 border-r border-slate-700 text-slate-300">{formatCurrency(row.custo_base)}</td>
                    {row.marketplaces.map((m) => (
                      <td key={m.marketplace_id} className="py-3 px-4 border-r border-slate-700">
                        <span className="text-slate-200">{formatCurrency(m.pvp)}</span>
                        <span className="ml-2"><MarginBadge pct={m.margin_net_pct} /></span>
                      </td>
                    ))}
                    <td className="py-3 px-4">
                      <Button size="sm" variant="secondary" onClick={() => { setSimulator({ ...simulator, custo_base: row.custo_base }); setModalOpen(true); setResult(null); }}>
                        <Calculator className="w-3 h-3 mr-1" /> Simular
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setModalOpen(false)}>
          <div className="bg-slate-800 border border-slate-600 rounded-lg shadow-xl max-w-md w-full mx-4 p-6 text-white" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4"><Calculator className="w-5 h-5 text-amber-400 inline mr-2" /> Simulador de Margem</h3>
            <div className="space-y-3">
              <div><label className="block text-xs text-slate-400 mb-1">Custo base (€)</label><input type="number" step="0.01" value={simulator.custo_base} onChange={(e) => setSimulator({ ...simulator, custo_base: Number(e.target.value) })} className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white text-sm" /></div>
              <div><label className="block text-xs text-slate-400 mb-1">Margem desejada (%)</label><input type="number" step="0.1" value={simulator.margem_desejada_pct} onChange={(e) => setSimulator({ ...simulator, margem_desejada_pct: Number(e.target.value) })} className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white text-sm" /></div>
              <div><label className="block text-xs text-slate-400 mb-1">Comissão (%)</label><input type="number" step="0.1" value={simulator.comissao_pct} onChange={(e) => setSimulator({ ...simulator, comissao_pct: Number(e.target.value) })} className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white text-sm" /></div>
              <div><label className="block text-xs text-slate-400 mb-1">IVA (%)</label><input type="number" step="0.1" value={simulator.vat_rate} onChange={(e) => setSimulator({ ...simulator, vat_rate: Number(e.target.value) })} className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white text-sm" /></div>
            </div>
            <Button className="w-full mt-4 bg-amber-600 hover:bg-amber-700" onClick={runSimulator} disabled={simulating}>{simulating ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Calcular PVP'}</Button>
            {result && <div className="mt-4 p-3 rounded bg-slate-700/50 border border-slate-600 text-sm"><p className="text-emerald-400 font-semibold">PVP sugerido: {formatCurrency(result.pvp_sugerido)}</p><p className="text-slate-400 mt-1">Margem líquida: {result.margem_liquida_pct.toFixed(1)}%</p></div>}
            <Button variant="secondary" className="w-full mt-3" onClick={() => setModalOpen(false)}>Fechar</Button>
          </div>
        </div>
      )}
    </Card>
  );
}
