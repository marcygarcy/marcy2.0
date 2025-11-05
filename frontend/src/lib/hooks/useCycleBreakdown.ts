import { useState, useEffect } from 'react';
import { kpiApi } from '@/lib/api/kpis';
import type { CycleBreakdownResponse } from '@/types/kpis';

export function useCycleBreakdown() {
  const [data, setData] = useState<CycleBreakdownResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchBreakdown = async () => {
    try {
      setLoading(true);
      setError(null);
      const breakdown = await kpiApi.getUltimoCicloDetalhes();
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
    fetchBreakdown();
  }, []);

  return { data, loading, error, refresh: fetchBreakdown };
}

