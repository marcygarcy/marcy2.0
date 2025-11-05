import { useState, useEffect } from 'react';
import { invoicesApi } from '@/lib/api/invoices';
import type { Invoice } from '@/types/invoices';

export function useInvoices() {
  const [cycles, setCycles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCycles();
  }, []);

  const loadCycles = async () => {
    try {
      setLoading(true);
      setError(null);
      const cycleList = await invoicesApi.getCycles();
      setCycles(cycleList);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar ciclos');
      console.error('Erro ao carregar ciclos:', err);
    } finally {
      setLoading(false);
    }
  };

  return {
    cycles,
    loading,
    error,
    refresh: loadCycles,
  };
}

export function useInvoicesByCycle(cicloPagamento: string | null) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cicloPagamento) {
      loadInvoices();
    } else {
      setInvoices([]);
    }
  }, [cicloPagamento]);

  const loadInvoices = async () => {
    if (!cicloPagamento) return;
    
    try {
      setLoading(true);
      setError(null);
      const invoiceList = await invoicesApi.getInvoicesByCycle(cicloPagamento);
      setInvoices(invoiceList);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar faturas');
      console.error('Erro ao carregar faturas:', err);
    } finally {
      setLoading(false);
    }
  };

  return {
    invoices,
    loading,
    error,
    refresh: loadInvoices,
  };
}

