import { useState, useEffect } from 'react';
import { kpiApi } from '@/lib/api/kpis';
import type { ReconciliationCycle } from '@/types/kpis';

export function useReconciliation() {
  const [cycles, setCycles] = useState<ReconciliationCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchReconciliation = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await kpiApi.getReconciliation();
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
  }, []);

  return { cycles, loading, error, refresh: fetchReconciliation };
}

