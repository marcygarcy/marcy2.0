'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Package, Truck, Loader2, CheckCircle, MapPin } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { logisticsApi, type PoItemForOffice } from '@/lib/api/logistics';
import { suppliersApi, type OfficeLocation } from '@/lib/api/suppliers';

export function OfficeLogisticsView() {
  const { empresaSelecionada } = useApp();
  const [offices, setOffices] = useState<OfficeLocation[]>([]);
  const [officeId, setOfficeId] = useState<number | ''>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [items, setItems] = useState<PoItemForOffice[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'conferencia' | 'expedicao'>('conferencia');

  // Conferência: por item, valores a enviar na receção
  const [receiveQty, setReceiveQty] = useState<Record<number, number>>({});
  const [receiveSerial, setReceiveSerial] = useState<Record<number, string>>({});
  const [receiveImei, setReceiveImei] = useState<Record<number, string>>({});
  const [submittingReceive, setSubmittingReceive] = useState(false);
  const [receiveMessage, setReceiveMessage] = useState<string | null>(null);

  // Expedição: item selecionado e modal
  const [dispatchItem, setDispatchItem] = useState<PoItemForOffice | null>(null);
  const [dispatchQty, setDispatchQty] = useState(0);
  const [dispatchTracking, setDispatchTracking] = useState('');
  const [dispatchCarrierName, setDispatchCarrierName] = useState('');
  const [dispatchCarrierStatus, setDispatchCarrierStatus] = useState('');
  const [submittingDispatch, setSubmittingDispatch] = useState(false);

  const empresaId = empresaSelecionada?.id ?? undefined;

  useEffect(() => {
    suppliersApi.listOffices(empresaId).then((r) => setOffices(r.items || [])).catch(() => setOffices([]));
  }, [empresaId]);

  useEffect(() => {
    if (officeId === '') {
      setItems([]);
      return;
    }
    setLoading(true);
    logisticsApi
      .getPoForOffice(Number(officeId), empresaId, statusFilter || undefined)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [officeId, empresaId, statusFilter]);

  const handleReceive = (poId: number) => {
    const poItems = items.filter((i) => i.purchase_order_id === poId);
    const payload = poItems
      .map((i) => ({
        purchase_order_item_id: i.id,
        quantity_received: receiveQty[i.id] ?? 0,
        serial_number: (receiveSerial[i.id] || '').trim() || undefined,
        imei: (receiveImei[i.id] || '').trim() || undefined,
      }))
      .filter((x) => x.quantity_received > 0);
    if (payload.length === 0) {
      setReceiveMessage('Indique pelo menos uma quantidade a receber.');
      return;
    }
    setSubmittingReceive(true);
    setReceiveMessage(null);
    logisticsApi
      .receiveItems({
        purchase_order_id: poId,
        office_id: Number(officeId),
        items: payload,
      })
      .then((r) => {
        setReceiveMessage(r.errors?.length ? r.errors.join(' ') : `${r.events_created?.length ?? 0} receção(ões) registada(s).`);
        if (r.success && !r.errors?.length) {
          setReceiveQty((prev) => {
            const next = { ...prev };
            payload.forEach((p) => delete next[p.purchase_order_item_id]);
            return next;
          });
          setReceiveSerial((prev) => {
            const next = { ...prev };
            payload.forEach((p) => delete next[p.purchase_order_item_id]);
            return next;
          });
          setReceiveImei((prev) => {
            const next = { ...prev };
            payload.forEach((p) => delete next[p.purchase_order_item_id]);
            return next;
          });
          logisticsApi.getPoForOffice(Number(officeId), empresaId, statusFilter || undefined).then(setItems);
        }
      })
      .catch((e) => setReceiveMessage(e?.response?.data?.detail || 'Erro ao registar receção.'))
      .finally(() => setSubmittingReceive(false));
  };

  const handleDispatch = () => {
    if (!dispatchItem || officeId === '') return;
    const qty = dispatchQty || dispatchItem.quantidade_recebida;
    setSubmittingDispatch(true);
    logisticsApi
      .dispatchItem({
        purchase_order_item_id: dispatchItem.id,
        office_id: Number(officeId),
        quantity: qty,
        tracking_number: dispatchTracking.trim() || undefined,
        carrier_name: dispatchCarrierName.trim() || undefined,
        carrier_status: dispatchCarrierStatus.trim() || undefined,
      })
      .then(() => {
        setDispatchItem(null);
        setDispatchQty(0);
        setDispatchTracking('');
        setDispatchCarrierName('');
        setDispatchCarrierStatus('');
        logisticsApi.getPoForOffice(Number(officeId), empresaId, statusFilter || undefined).then(setItems);
      })
      .catch(() => {})
      .finally(() => setSubmittingDispatch(false));
  };

  const poIds = Array.from(new Set(items.map((i) => i.purchase_order_id)));

  return (
    <div className="space-y-6">
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <MapPin className="h-5 w-5" />
            Gestão de Escritório (Logística)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Escritório</label>
              <select
                className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white min-w-[180px]"
                value={officeId}
                onChange={(e) => setOfficeId(e.target.value === '' ? '' : Number(e.target.value))}
              >
                <option value="">Selecionar...</option>
                {offices.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.designacao} {o.pais ? `(${o.pais})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Estado</label>
              <select
                className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white min-w-[180px]"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">Todos</option>
                <option value="pending_receipt">À espera de receção</option>
                <option value="received_at_office">No escritório</option>
                <option value="dispatched_to_customer">Expedido</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'conferencia' | 'expedicao')}>
        <TabsList className="bg-slate-800">
          <TabsTrigger value="conferencia" className="data-[state=active]:bg-slate-600">
            Conferência (receção)
          </TabsTrigger>
          <TabsTrigger value="expedicao" className="data-[state=active]:bg-slate-600">
            Expedição
          </TabsTrigger>
        </TabsList>

        <TabsContent value="conferencia" className="mt-4">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Package className="h-5 w-5" />
                Interface de conferência – marcar o que recebeu do fornecedor
              </CardTitle>
            </CardHeader>
            <CardContent>
              {receiveMessage && (
                <p className={`text-sm mb-4 ${receiveMessage.includes('registada') ? 'text-green-400' : 'text-amber-400'}`}>
                  {receiveMessage}
                </p>
              )}
              {loading ? (
                <div className="flex items-center gap-2 text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  A carregar...
                </div>
              ) : !officeId ? (
                <p className="text-slate-400">Selecione um escritório.</p>
              ) : items.length === 0 ? (
                <p className="text-slate-400">Nenhum item pendente para este escritório/estado.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead>
                      <tr className="text-slate-400 border-b border-slate-600">
                        <th className="py-2 pr-4">PO#</th>
                        <th className="py-2 pr-4">SKU</th>
                        <th className="py-2 pr-4">Qtd. pedida</th>
                        <th className="py-2 pr-4">Qtd. recebida</th>
                        <th className="py-2 pr-4">Qtd. a registar</th>
                        <th className="py-2 pr-4">Nº Série</th>
                        <th className="py-2 pr-4">IMEI</th>
                        <th className="py-2 pr-4">Estado</th>
                        <th className="py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {poIds.map((poId) => {
                        const poItems = items.filter((i) => i.purchase_order_id === poId);
                        return poItems.map((row) => (
                          <tr key={row.id} className="border-b border-slate-700">
                            <td className="py-2 pr-4 text-white">{row.purchase_order_id}</td>
                            <td className="py-2 pr-4 text-slate-300">{row.sku_marketplace || row.sku_fornecedor || '-'}</td>
                            <td className="py-2 pr-4 text-slate-300">{row.quantidade}</td>
                            <td className="py-2 pr-4 text-slate-300">{row.quantidade_recebida}</td>
                            <td className="py-2 pr-4">
                              {row.logistics_status === 'dispatched_to_customer' ? (
                                <span className="text-slate-500">-</span>
                              ) : (
                                <input
                                  type="number"
                                  min={0}
                                  max={row.quantidade - row.quantidade_recebida}
                                  className="w-20 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white"
                                  value={receiveQty[row.id] ?? ''}
                                  onChange={(e) => setReceiveQty((prev) => ({ ...prev, [row.id]: parseFloat(e.target.value) || 0 }))}
                                />
                              )}
                            </td>
                            <td className="py-2 pr-4">
                              {row.logistics_status !== 'dispatched_to_customer' && (
                                <input
                                  type="text"
                                  placeholder="Série"
                                  className="w-28 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white"
                                  value={receiveSerial[row.id] ?? ''}
                                  onChange={(e) => setReceiveSerial((prev) => ({ ...prev, [row.id]: e.target.value }))}
                                />
                              )}
                            </td>
                            <td className="py-2 pr-4">
                              {row.logistics_status !== 'dispatched_to_customer' && (
                                <input
                                  type="text"
                                  placeholder="IMEI"
                                  className="w-28 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white"
                                  value={receiveImei[row.id] ?? ''}
                                  onChange={(e) => setReceiveImei((prev) => ({ ...prev, [row.id]: e.target.value }))}
                                />
                              )}
                            </td>
                            <td className="py-2 pr-4 text-slate-400">{row.logistics_status || 'pending_receipt'}</td>
                            <td className="py-2">
                              {row.logistics_status !== 'dispatched_to_customer' && poItems[0]?.id === row.id && (
                                <button
                                  type="button"
                                  className="text-blue-400 hover:underline"
                                  onClick={() => handleReceive(poId)}
                                  disabled={submittingReceive}
                                >
                                  {submittingReceive ? 'A registar...' : 'Registar receção'}
                                </button>
                              )}
                            </td>
                          </tr>
                        ));
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expedicao" className="mt-4">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Expedir para o cliente
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center gap-2 text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  A carregar...
                </div>
              ) : !officeId ? (
                <p className="text-slate-400">Selecione um escritório.</p>
              ) : (
                <div className="space-y-2">
                  {items.filter((i) => i.logistics_status === 'received_at_office').length === 0 ? (
                    <p className="text-slate-400">Nenhum item no escritório para expedir.</p>
                  ) : (
                    <ul className="space-y-2">
                      {items
                        .filter((i) => i.logistics_status === 'received_at_office')
                        .map((row) => (
                          <li key={row.id} className="flex items-center justify-between py-2 border-b border-slate-700">
                            <span className="text-slate-300">
                              PO#{row.purchase_order_id} – {row.sku_marketplace || row.sku_fornecedor || 'Item'} (qtd. recebida: {row.quantidade_recebida})
                            </span>
                            <button
                              type="button"
                              className="px-3 py-1 rounded bg-blue-600 text-white text-sm hover:bg-blue-500"
                              onClick={() => {
                                setDispatchItem(row);
                                setDispatchQty(row.quantidade_recebida);
                                setDispatchTracking('');
                              }}
                            >
                              Expedir
                            </button>
                          </li>
                        ))}
                    </ul>
                  )}
                </div>
              )}

              {dispatchItem && (
                <div
                className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
                onClick={() => {
                  if (!submittingDispatch) {
                    setDispatchItem(null);
                    setDispatchTracking('');
                    setDispatchCarrierName('');
                    setDispatchCarrierStatus('');
                  }
                }}
              >
                  <div className="bg-slate-800 border border-slate-600 rounded-lg p-6 max-w-md w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
                    <h3 className="text-white font-medium mb-4">Expedir item</h3>
                    <p className="text-slate-400 text-sm mb-4">
                      PO#{dispatchItem.purchase_order_id} – {dispatchItem.sku_marketplace || dispatchItem.sku_fornecedor}
                    </p>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm text-slate-400 mb-1">Quantidade</label>
                        <input
                          type="number"
                          min={1}
                          max={dispatchItem.quantidade_recebida}
                          className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
                          value={dispatchQty}
                          onChange={(e) => setDispatchQty(parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-slate-400 mb-1">Tracking</label>
                        <input
                          type="text"
                          placeholder="Número de rastreio"
                          className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
                          value={dispatchTracking}
                          onChange={(e) => setDispatchTracking(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-slate-400 mb-1">Transportadora</label>
                        <input
                          type="text"
                          placeholder="ex.: CTT, MRW, DHL"
                          className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
                          value={dispatchCarrierName}
                          onChange={(e) => setDispatchCarrierName(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-slate-400 mb-1">Estado transportadora</label>
                        <select
                          className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
                          value={dispatchCarrierStatus}
                          onChange={(e) => setDispatchCarrierStatus(e.target.value)}
                        >
                          <option value="">—</option>
                          <option value="pending">Pendente</option>
                          <option value="collected">Recolhido</option>
                          <option value="in_transit">Em trânsito</option>
                          <option value="out_for_delivery">Em entrega</option>
                          <option value="delivered">Entregue</option>
                          <option value="exception">Exceção</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-6">
                      <button
                        type="button"
                        className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50"
                        onClick={handleDispatch}
                        disabled={submittingDispatch}
                      >
                        {submittingDispatch ? <Loader2 className="h-4 w-4 animate-spin inline" /> : 'Confirmar expedição'}
                      </button>
                      <button
                        type="button"
                        className="px-4 py-2 rounded bg-slate-600 text-white hover:bg-slate-500"
                        onClick={() => {
                          setDispatchItem(null);
                          setDispatchTracking('');
                          setDispatchCarrierName('');
                          setDispatchCarrierStatus('');
                        }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
