'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { kpiApi } from '@/lib/api/kpis';
import { formatCurrency } from '@/lib/utils';
import { useApp } from '@/context/AppContext';

interface CycleData {
  ciclo: string;
  data_ciclo: string;
  vendas_brutas: number;
}

export function SalesChart() {
  const { empresaSelecionada, marketplaceSelecionado } = useApp();
  const [data, setData] = useState<CycleData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [empresaSelecionada?.id, marketplaceSelecionado?.id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const empresaId = empresaSelecionada?.id || 2;
      const marketplaceId = marketplaceSelecionado?.id || 1;
      const response = await kpiApi.getVendasBrutasPorCiclo(empresaId, marketplaceId);
      
      // Formatar dados para o gráfico - usar apenas os últimos 12 ciclos para melhor visualização
      const cycles = response.cycles.slice(-12).map((cycle) => ({
        ...cycle,
        // Formatar o ciclo para exibição mais curta (primeiros 15 caracteres)
        ciclo_short: cycle.ciclo.length > 15 ? cycle.ciclo.substring(0, 15) + '...' : cycle.ciclo
      }));
      
      setData(cycles);
    } catch (error) {
      console.error('Erro ao carregar dados do gráfico:', error);
    } finally {
      setLoading(false);
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-800 p-3 border border-slate-600 rounded-lg shadow-lg">
          <p className="text-slate-300 font-medium mb-2">{`Ciclo: ${label}`}</p>
          <p className="text-green-400 font-bold">
            {`Vendas Brutas: ${formatCurrency(payload[0].value)}`}
          </p>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Evolução das Vendas Brutas por Ciclo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-slate-400">A carregar dados...</div>
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Evolução das Vendas Brutas por Ciclo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-slate-400">Nenhum dado disponível</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Evolução das Vendas Brutas por Ciclo</CardTitle>
      </CardHeader>
      <CardContent>
        <div style={{ width: '100%', height: '400px' }}>
          <ResponsiveContainer>
            <BarChart
              data={data}
              margin={{
                top: 20,
                right: 30,
                left: 20,
                bottom: 60,
              }}
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
                tickFormatter={(value) => {
                  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M€`;
                  if (value >= 1000) return `${(value / 1000).toFixed(0)}k€`;
                  return `${value}€`;
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar
                dataKey="vendas_brutas"
                name="Vendas Brutas"
                fill="#3b82f6"
                radius={[8, 8, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

