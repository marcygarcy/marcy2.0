import { useState, useEffect } from 'react';
import { kpiApi } from '@/lib/api/kpis';
import type { ReconciliationCycle } from '@/types/kpis';
import { useApp } from '@/context/AppContext';

export function useReconciliation() {
  const { empresaSelecionada, marketplaceSelecionado } = useApp();
  const [cycles, setCycles] = useState<ReconciliationCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchReconciliation = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await kpiApi.getReconciliation(
        empresaSelecionada?.id,
        marketplaceSelecionado?.id
      );
      setCycles(data.cycles);
    } catch (err) {
      setError(err as Error);
      console.error('Error fetching reconciliation:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReconciliation();
  }, [empresaSelecionada?.id, marketplaceSelecionado?.id]);

  return { cycles, loading, error, refresh: fetchReconciliation };
}

