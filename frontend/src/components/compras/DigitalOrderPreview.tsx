'use client';

import React, { useRef } from 'react';
import type { CheckoutDetail } from '@/lib/api/purchases';
import { formatCurrency } from '@/lib/utils';

interface DigitalOrderPreviewProps {
  data: CheckoutDetail;
  observacoes?: string;
  onObservacoesChange?: (value: string) => void;
  className?: string;
}

/** v3.5: Visualização tipo “nota de encomenda” A4 para impressão/PDF */
export function DigitalOrderPreview({
  data,
  observacoes = '',
  onObservacoesChange,
  className = '',
}: DigitalOrderPreviewProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const prevTitle = document.title;
    document.title = `PO-${data.id} ${data.supplier_nome ?? 'Fornecedor'}`;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.print();
      document.title = prevTitle;
      return;
    }
    printWindow.document.write(`
      <!DOCTYPE html><html><head>
        <title>${document.title}</title>
        <style>
          body { font-family: 'Segoe UI', system-ui, sans-serif; font-size: 11pt; color: #1a1a1a; padding: 20px; max-width: 210mm; margin: 0 auto; }
          .p-6{ padding: 1.5rem; }
          .border-b-2{ border-bottom: 2px solid #333; }
          .border-b{ border-bottom: 1px solid #e2e8f0; }
          .border-t{ border-top: 1px solid #e2e8f0; }
          .text-xl{ font-size: 1.25rem; }
          .text-sm{ font-size: 0.875rem; }
          .text-xs{ font-size: 0.75rem; }
          .font-bold{ font-weight: 700; }
          .font-semibold{ font-weight: 600; }
          .font-medium{ font-weight: 500; }
          .text-slate-900{ color: #0f172a; }
          .text-slate-800{ color: #1e293b; }
          .text-slate-700{ color: #334155; }
          .text-slate-600{ color: #475569; }
          .text-slate-500{ color: #64748b; }
          table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 11pt; }
          th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; }
          th { background: #f8fafc; font-weight: 600; }
          .text-right{ text-align: right; }
          .uppercase{ text-transform: uppercase; }
          .tracking-wider{ letter-spacing: 0.05em; }
        </style>
      </head><body>
        ${content.innerHTML}
      </body></html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
    document.title = prevTitle;
  };

  const subtotalItem = (item: CheckoutDetail['items'][0]) =>
    item.quantidade * item.custo_unitario + (item.portes_rateados || 0) + (item.impostos_rateados || 0);

  return (
    <div className={className}>
      <div
        ref={printRef}
        className="bg-white text-slate-800 rounded-lg border border-slate-200 shadow-sm overflow-hidden"
        style={{ maxWidth: '210mm', minHeight: '297mm' }}
      >
        {/* Cabeçalho: Empresa */}
        <div className="p-6 border-b-2 border-slate-300">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-xl font-bold text-slate-900">{data.empresa_nome ?? '—'}</h1>
              <p className="text-sm text-slate-600 mt-1">NIF: {data.empresa_nif ?? '—'}</p>
              <p className="text-sm text-slate-600">{data.empresa_morada ?? '—'}</p>
              <p className="text-sm text-slate-600">{data.empresa_pais ?? ''}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-slate-700">NOTA DE ENCOMENDA</p>
              <p className="text-sm text-slate-600">PO #{data.id}</p>
              <p className="text-xs text-slate-500 mt-1">{data.supplier_order_id ? `Ref. Fornec.: ${data.supplier_order_id}` : '—'}</p>
            </div>
          </div>
        </div>

        {/* Fornecedor */}
        <div className="p-6 border-b border-slate-200">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Fornecedor</h3>
          <p className="font-semibold text-slate-800">{(data.supplier_designacao || data.supplier_nome) ?? '—'}</p>
          <p className="text-sm text-slate-600">NIF/CIF: {data.supplier_nif ?? '—'}</p>
          <p className="text-sm text-slate-600">
            {[data.supplier_morada, data.supplier_cp, data.supplier_localidade, data.supplier_pais]
              .filter(Boolean)
              .join(', ') || '—'}
          </p>
        </div>

        {/* Morada de envio */}
        <div className="p-6 border-b border-slate-200">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Morada de envio</h3>
          <p className="font-medium text-slate-800">{data.shipping_address?.tipo ?? '—'}: {data.shipping_address?.designacao ?? '—'}</p>
          {data.shipping_address?.morada && data.shipping_address.morada !== '—' && (
            <p className="text-sm text-slate-600">
              {[data.shipping_address.morada, data.shipping_address.codigo_postal, data.shipping_address.localidade, data.shipping_address.pais]
                .filter(Boolean)
                .join(', ')}
            </p>
          )}
          {data.shipping_address?.tipo === 'Dropshipping' && (
            <p className="text-sm italic text-slate-500">{data.shipping_address?.morada ?? 'Ver dados da encomenda de venda'}</p>
          )}
        </div>

        {/* Tabela */}
        <div className="p-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-slate-300 bg-slate-50">
                <th className="text-left py-2 px-3 font-semibold text-slate-700">Ref. Fornecedor</th>
                <th className="text-left py-2 px-3 font-semibold text-slate-700">Descrição SKU</th>
                <th className="text-right py-2 px-3 font-semibold text-slate-700">Qtd</th>
                <th className="text-right py-2 px-3 font-semibold text-slate-700">Preço un.</th>
                <th className="text-right py-2 px-3 font-semibold text-slate-700">IVA</th>
                <th className="text-right py-2 px-3 font-semibold text-slate-700">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {data.items?.map((item) => (
                <tr key={item.id} className="border-b border-slate-200">
                  <td className="py-2 px-3 text-slate-800">{item.sku_fornecedor ?? item.sku_marketplace ?? '—'}</td>
                  <td className="py-2 px-3 text-slate-600">{item.sku_marketplace ?? item.sku_fornecedor ?? '—'}</td>
                  <td className="py-2 px-3 text-right text-slate-800">{item.quantidade}</td>
                  <td className="py-2 px-3 text-right text-slate-800">{formatCurrency(item.custo_unitario)}</td>
                  <td className="py-2 px-3 text-right text-slate-600">{formatCurrency(item.impostos_rateados ?? 0)}</td>
                  <td className="py-2 px-3 text-right font-medium text-slate-800">{formatCurrency(subtotalItem(item))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 flex justify-end">
            <table className="w-64 text-sm">
              <tbody>
                <tr className="border-b border-slate-200">
                  <td className="py-1.5 text-slate-600">Base</td>
                  <td className="py-1.5 text-right font-medium">{formatCurrency(data.valor_base_artigos)}</td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="py-1.5 text-slate-600">Portes</td>
                  <td className="py-1.5 text-right font-medium">{formatCurrency(data.custo_portes_fornecedor)}</td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="py-1.5 text-slate-600">Taxas</td>
                  <td className="py-1.5 text-right font-medium">{formatCurrency(data.taxas_pagamento)}</td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="py-1.5 text-slate-600">IVA ({data.taxa_iva_pct}%)</td>
                  <td className="py-1.5 text-right font-medium">{formatCurrency(data.iva_total)}</td>
                </tr>
                <tr className="border-t-2 border-slate-300">
                  <td className="py-2 font-bold text-slate-800">Total</td>
                  <td className="py-2 text-right font-bold text-slate-900">{formatCurrency(data.total_final)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Observações */}
        <div className="p-6 border-t border-slate-200">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Observações / Notas</h3>
          <div className="min-h-[72px] border border-dashed border-slate-300 rounded p-3 text-sm text-slate-600 bg-slate-50/50">
            {data.notas || observacoes || '—'}
          </div>
        </div>
      </div>

      {/* Controles fora da área de impressão */}
      <div className="mt-4 flex flex-wrap gap-3">
        {onObservacoesChange && (
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs text-slate-400 mb-1">Observações (ex: Entregar até às 18h)</label>
            <input
              type="text"
              value={observacoes}
              onChange={(e) => onObservacoesChange(e.target.value)}
              placeholder="Notas para a nota de encomenda..."
              className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white placeholder-slate-500"
            />
          </div>
        )}
        <button
          type="button"
          onClick={handlePrint}
          className="px-4 py-2 rounded-lg bg-slate-700 text-white text-sm font-medium hover:bg-slate-600"
        >
          Guardar como PDF / Imprimir
        </button>
      </div>
    </div>
  );
}
