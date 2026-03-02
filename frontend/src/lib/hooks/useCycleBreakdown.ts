import { useState, useEffect } from 'react';
import { kpiApi } from '@/lib/api/kpis';
import type { CycleBreakdownResponse } from '@/types/kpis';
import { useApp } from '@/context/AppContext';

export function useCycleBreakdown(selectedCiclo?: string | null) {
  const { empresaSelecionada, marketplaceSelecionado } = useApp();
  const empresaId = empresaSelecionada?.id;
  const marketplaceId = marketplaceSelecionado?.id;
  const [data, setData] = useState<CycleBreakdownResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchBreakdown = async (ciclo?: string | null) => {
    try {
      setLoading(true);
      setError(null);
      const breakdown = await kpiApi.getUltimoCicloDetalhes(
        ciclo || undefined,
        empresaId || undefined,
        marketplaceId || undefined
      );
      setData(breakdown);
    } catch (err: any) {
      const errorMessage = err?.response?.data?.detail || err?.message || 'Erro ao carregar breakdown do ciclo';
      const error = new Error(errorMessage);
      setError(error);
      console.error('Error fetching cycle breakdown:', {
        message: errorMessage,
        status: err?.response?.status,
        url: err?.config?.url,
        fullError: err
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBreakdown(selectedCiclo);
  }, [selectedCiclo, empresaId, marketplaceId]);

  return { data, loading, error, refresh: () => fetchBreakdown(selectedCiclo) };
}

