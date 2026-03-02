'use client';

import React, { useRef } from 'react';
import type { ProformaData } from '@/lib/api/billing';
import { formatCurrency } from '@/lib/utils';

interface ProformaPreviewProps {
  data: ProformaData;
  onClose?: () => void;
  onPrint?: () => void;
  showActions?: boolean;
}

export function ProformaPreview({ data, onClose, onPrint, showActions = true }: ProformaPreviewProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const { company, order } = data;

  const handlePrint = () => {
    if (onPrint) {
      onPrint();
      return;
    }
    window.print();
  };

  return (
    <div className="bg-slate-900 rounded-lg overflow-hidden">
      {showActions && (onClose || onPrint !== undefined) && (
        <div className="flex justify-end gap-2 p-3 border-b border-slate-700 print:hidden">
          {onPrint !== undefined && (
            <button
              type="button"
              onClick={onPrint}
              className="px-4 py-2 rounded bg-amber-600 text-white text-sm font-medium hover:bg-amber-500"
            >
              Imprimir / PDF
            </button>
          )}
          {onPrint === undefined && (
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 rounded bg-amber-600 text-white text-sm font-medium hover:bg-amber-500"
            >
              Imprimir / PDF
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded bg-slate-600 text-slate-200 text-sm hover:bg-slate-500"
            >
              Fechar
            </button>
          )}
        </div>
      )}

      <div ref={printRef} className="p-6 bg-white text-black print:p-8">
        <style>{`
          @media print {
            body * { visibility: hidden; }
            .print-area, .print-area * { visibility: visible; }
            .print-area { position: absolute; left: 0; top: 0; width: 100%; }
            .no-print { display: none !important; }
          }
        `}</style>
        <div className="print-area">
          <div className="flex justify-between items-start border-b border-slate-300 pb-4 mb-6">
            <div>
              <h1 className="text-xl font-bold text-slate-800">{company.nome}</h1>
              {company.nif && <p className="text-sm text-slate-600">NIF: {company.nif}</p>}
              {company.morada && <p className="text-sm text-slate-600 whitespace-pre-line">{company.morada}</p>}
            </div>
            <div className="text-right">
              <p className="text-lg font-semibold text-slate-800">PROFORMA</p>
              {order.document_number && (
                <p className="text-sm text-slate-600">Nº {order.document_number}</p>
              )}
              <p className="text-sm text-slate-600">
                Pedido: {order.external_order_id}
                {order.marketplace_nome ? ` · ${order.marketplace_nome}` : ''}
              </p>
              {order.order_date && (
                <p className="text-sm text-slate-600">
                  Data: {new Date(order.order_date).toLocaleDateString('pt-PT')}
                </p>
              )}
            </div>
          </div>

          <div className="mb-6">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Cliente / Destino</p>
            {(order.customer_name || order.customer_address || order.customer_nif) ? (
              <div className="text-slate-700 space-y-0.5">
                {order.customer_name && <p className="font-medium">{order.customer_name}</p>}
                {order.customer_nif && <p className="text-sm">NIF: {order.customer_nif}</p>}
                {order.customer_address && <p className="text-sm whitespace-pre-line">{order.customer_address}</p>}
                {order.customer_country && <p className="text-sm">País: {order.customer_country}</p>}
              </div>
            ) : (
              <p className="text-slate-700">
                Venda marketplace · País: {order.customer_country || '—'}
              </p>
            )}
          </div>

          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-300">
                <th className="text-left py-2 text-slate-700">Designação / SKU</th>
                <th className="text-right py-2 text-slate-700">Qtd</th>
                <th className="text-right py-2 text-slate-700">Preço unit.</th>
                <th className="text-right py-2 text-slate-700">IVA</th>
                <th className="text-right py-2 text-slate-700">Total</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id} className="border-b border-slate-200">
                  <td className="py-2 text-slate-800">
                    {item.internal_sku || item.sku_marketplace || `Linha #${item.id}`}
                  </td>
                  <td className="py-2 text-right">{item.quantity}</td>
                  <td className="py-2 text-right">{formatCurrency(item.unit_price)}</td>
                  <td className="py-2 text-right">
                    {item.vat_rate ? `${item.vat_rate}%` : '—'} {item.vat_amount ? `(${formatCurrency(item.vat_amount)})` : ''}
                  </td>
                  <td className="py-2 text-right font-medium">
                    {formatCurrency((item.line_total ?? item.quantity * item.unit_price))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-6 flex justify-end">
            <div className="w-64 space-y-1 text-sm">
              {order.total_net != null && order.total_net > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-600">Base tributável:</span>
                  <span>{formatCurrency(order.total_net)}</span>
                </div>
              )}
              {order.total_vat != null && order.total_vat > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-600">IVA:</span>
                  <span>{formatCurrency(order.total_vat)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base pt-2 border-t border-slate-300">
                <span>Total:</span>
                <span>{formatCurrency(order.total_gross ?? 0)}</span>
              </div>
            </div>
          </div>

          <p className="mt-8 text-xs text-slate-500">
            Documento gerado electronicamente. Proforma sem valor fiscal.
            {order.customer_country && order.items.some((i) => (i.vat_rate ?? 0) > 0) && (
              <> IVA aplicado conforme país de destino (regime OSS quando aplicável).</>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
