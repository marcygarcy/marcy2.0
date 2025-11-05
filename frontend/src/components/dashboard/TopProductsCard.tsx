'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { kpiApi } from '@/lib/api/kpis';
import { formatCurrency } from '@/lib/utils';
import { Trophy } from 'lucide-react';
import { useApp } from '@/context/AppContext';

interface ProductData {
  sku: string;
  categoria: string;
  quantidade: number;
  valor_total: number;
  preco_unitario: number;
}

export function TopProductsCard() {
  const { empresaSelecionada, marketplaceSelecionado } = useApp();
  const [historico, setHistorico] = useState<ProductData | null>(null);
  const [ultimos60dias, setUltimos60dias] = useState<ProductData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [empresaSelecionada?.id, marketplaceSelecionado?.id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const empresaId = empresaSelecionada?.id || 2; // Default: Teste 123
      const marketplaceId = marketplaceSelecionado?.id || 1; // Default: Pixmania
      const response = await kpiApi.getProdutosMaisVendidos(empresaId, marketplaceId);
      setHistorico(response.historico);
      setUltimos60dias(response.ultimos_60_dias);
    } catch (error) {
      console.error('Erro ao carregar produtos mais vendidos:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-400" />
            Produtos Mais Vendidos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-slate-400">A carregar dados...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-400" />
          Produtos Mais Vendidos
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Histórico */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-300 border-b border-slate-700 pb-2">
              Histórico:
            </h3>
            {historico ? (
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-slate-400">SKU:</p>
                  <p className="text-lg font-mono text-blue-300">{historico.sku}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Categoria:</p>
                  <p className="text-slate-300">{historico.categoria}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Quantidade:</p>
                  <p className="text-xl font-bold text-green-400">{historico.quantidade}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Valor Total:</p>
                  <p className="text-xl font-bold text-white">{formatCurrency(historico.valor_total)}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Preço Unitário:</p>
                  <p className="text-lg font-semibold text-yellow-400">{formatCurrency(historico.preco_unitario)}</p>
                </div>
              </div>
            ) : (
              <div className="text-slate-400 text-center py-8">Nenhum dado disponível</div>
            )}
          </div>

          {/* Últimos 60 Dias */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-300 border-b border-slate-700 pb-2">
              Último Ciclo (60 dias):
            </h3>
            {ultimos60dias ? (
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-slate-400">SKU:</p>
                  <p className="text-lg font-mono text-blue-300">{ultimos60dias.sku}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Categoria:</p>
                  <p className="text-slate-300">{ultimos60dias.categoria}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Quantidade:</p>
                  <p className="text-xl font-bold text-green-400">{ultimos60dias.quantidade}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Valor Total:</p>
                  <p className="text-xl font-bold text-white">{formatCurrency(ultimos60dias.valor_total)}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Preço Unitário:</p>
                  <p className="text-lg font-semibold text-yellow-400">{formatCurrency(ultimos60dias.preco_unitario)}</p>
                </div>
              </div>
            ) : (
              <div className="text-slate-400 text-center py-8">Nenhum dado disponível</div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

