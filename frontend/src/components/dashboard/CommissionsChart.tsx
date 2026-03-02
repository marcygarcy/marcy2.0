'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { kpiApi } from '@/lib/api/kpis';
import { formatCurrency } from '@/lib/utils';
import { useApp } from '@/context/AppContext';

interface CycleComissao {
  ciclo: string;
  data_ciclo: string;
  comissoes: number;
  imposto: number;
  ciclo_short: string;
}

export function CommissionsChart() {
  const { empresaSelecionada, marketplaceSelecionado } = useApp();
  const [data, setData] = useState<CycleComissao[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [empresaSelecionada?.id, marketplaceSelecionado?.id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const empresaId = empresaSelecionada?.id;
      const marketplaceId = marketplaceSelecionado?.id;
      const response = await kpiApi.getComissoesPorCiclo(empresaId, marketplaceId);

      const cycles = response.cycles.slice(-12).map((c) => ({
        ...c,
        ciclo_short: c.ciclo.length > 15 ? c.ciclo.substring(0, 15) + '…' : c.ciclo,
      }));

      setData(cycles);
    } catch (error) {
      console.error('Erro ao carregar comissões por ciclo:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalComissoes = data.reduce((s, c) => s + c.comissoes, 0);
  const totalImposto = data.reduce((s, c) => s + c.imposto, 0);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-800 p-3 border border-slate-600 rounded-lg shadow-lg text-sm">
          <p className="text-slate-300 font-medium mb-2">{`Ciclo: ${label}`}</p>
          {payload.map((entry: any) => (
            <p key={entry.name} style={{ color: entry.color }} className="font-bold">
              {`${entry.name}: ${formatCurrency(entry.value)}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const yFormatter = (value: number) => {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M€`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(0)}k€`;
    return `${value}€`;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader><CardTitle>Comissões por Ciclo</CardTitle></CardHeader>
        <CardContent>
          <div className="text-center py-12 text-slate-400">A carregar dados...</div>
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle>Comissões por Ciclo</CardTitle></CardHeader>
        <CardContent>
          <div className="text-center py-12 text-slate-400">Nenhum dado disponível</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-slate-400 text-sm mb-1">Total Comissões (acumulado)</p>
            <p className="text-3xl font-bold text-blue-400">{formatCurrency(totalComissoes)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-slate-400 text-sm mb-1">Total Imposto s/ Comissões</p>
            <p className="text-3xl font-bold text-orange-400">{formatCurrency(totalImposto)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico */}
      <Card>
        <CardHeader>
          <CardTitle>Evolução de Comissões por Ciclo (últimos {data.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div style={{ width: '100%', height: '400px' }}>
            <ResponsiveContainer>
              <BarChart
                data={data}
                margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                <XAxis
                  dataKey="ciclo_short"
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  stroke="#94a3b8"
                  fontSize={12}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={12}
                  tickFormatter={yFormatter}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar
                  dataKey="comissoes"
                  name="Comissões"
                  fill="#3b82f6"
                  radius={[6, 6, 0, 0]}
                />
                <Bar
                  dataKey="imposto"
                  name="Imposto s/ Comissões"
                  fill="#f97316"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
