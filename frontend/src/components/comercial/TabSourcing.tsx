'use client';

import React, { useState, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, AlertTriangle, Loader2, FileSpreadsheet } from 'lucide-react';
import { comercialApi, type SourcingUploadResult } from '@/lib/api/comercial';

export function TabSourcing() {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<SourcingUploadResult | null>(null);

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) return;
    setUploading(true);
    setResult(null);
    try {
      const res = await comercialApi.uploadSourcing(file);
      setResult(res);
    } catch {
      setResult({ total_linhas: 0, skus_atualizados: 0, skus_aumento_custo: 0, skus_margem_negativa_worten: 0, skus_margem_negativa_amazon: 0, alertas: ['Erro no processamento do ficheiro.'] });
    } finally {
      setUploading(false);
    }
  }, []);

  return (
    <Card className="border border-slate-600 bg-slate-800/50">
      <CardHeader className="border-b border-slate-600 bg-slate-800/80">
        <CardTitle className="text-lg text-slate-100 flex items-center gap-2">
          <Upload className="w-5 h-5 text-amber-400" /> Atualização de Custos (Sourcing)
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <div
          className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${dragging ? 'border-amber-500 bg-amber-500/10' : 'border-slate-600 bg-slate-800/30 hover:border-slate-500'}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        >
          <input type="file" accept=".csv" className="hidden" id="sourcing-csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          <label htmlFor="sourcing-csv" className="cursor-pointer flex flex-col items-center gap-2">
            <FileSpreadsheet className="w-10 h-10 text-slate-400" />
            <span className="text-slate-300">Arraste um CSV ou clique para selecionar</span>
          </label>
        </div>
        {uploading && <div className="flex items-center justify-center py-6 text-slate-400"><Loader2 className="w-6 h-6 animate-spin mr-2" /> A processar...</div>}
        {result && !uploading && (
          <div className="mt-6 p-4 rounded-lg border border-amber-700 bg-amber-950/30">
            <h4 className="flex items-center gap-2 text-amber-400 font-semibold mb-2"><AlertTriangle className="w-4 h-4" /> Análise pós-upload</h4>
            <p className="text-slate-300 text-sm mb-2">{result.skus_atualizados} SKUs atualizados. {result.skus_aumento_custo > 0 && `${result.skus_aumento_custo} SKUs sofreram aumento de custo.`} {result.skus_margem_negativa_worten > 0 && `${result.skus_margem_negativa_worten} SKUs entraram em Margem Negativa na Worten.`}</p>
            <ul className="list-disc list-inside text-sm text-slate-400 space-y-1">{result.alertas.map((a, i) => <li key={i}>{a}</li>)}</ul>
            <Button size="sm" className="mt-3 bg-amber-600 hover:bg-amber-700">Rever Preços</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
