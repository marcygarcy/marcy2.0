import { useState, useEffect } from 'react';
import { kpiApi } from '@/lib/api/kpis';
import { useApp } from '@/context/AppContext';
import type { KPIs } from '@/types/kpis';

export function useKPIs() {
  const { empresaSelecionada, marketplaceSelecionado } = useApp();
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchKPIs = async () => {
    try {
      setLoading(true);
      setError(null);
      const empresaId = empresaSelecionada?.id || 2;
      const marketplaceId = marketplaceSelecionado?.id || 1;
      const data = await kpiApi.getAll(empresaId, marketplaceId);
      setKpis(data);
    } catch (err: any) {
      const errorMessage = err?.response?.data?.detail || err?.message || 'Erro ao carregar KPIs';
      const error = new Error(errorMessage);
      setError(error);
      console.error('Error fetching KPIs:', {
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
    fetchKPIs();
  }, [empresaSelecionada?.id, marketplaceSelecionado?.id]);

  return { kpis, loading, error, refresh: fetchKPIs };
}

