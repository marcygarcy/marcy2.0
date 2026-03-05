'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ShoppingCart, Package, Loader2, CheckCircle, Download, Send, Globe, Copy, ChevronRight, AlertTriangle, FileText, Eye, X, Truck, RefreshCw, ExternalLink, BookOpen, Plus, Trash2, Undo2, Pencil } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { purchasesApi, type PendingSale, type PurchaseOrder, type GlobalPendingItem, type PendingPurchaseItem, type CheckoutDetail } from '@/lib/api/purchases';
import { suppliersApi, type SupplierMaster } from '@/lib/api/suppliers';
import { empresasApi, type Empresa } from '@/lib/api/empresas';
import { DigitalOrderPreview } from './DigitalOrderPreview';
import { financeApi } from '@/lib/api/finance';
import { formatCurrency } from '@/lib/utils';

type ActiveTab = 'central' | 'global' | 'pendentes' | 'checkout' | 'tracking';

const LOGISTICS_LABELS: Record<string, { label: string; color: string }> = {
  pending_receipt:       { label: 'Aguarda Receção',    color: 'text-yellow-400 bg-yellow-900/40' },
  received_at_office:    { label: 'No Escritório',       color: 'text-blue-400 bg-blue-900/40' },
  dispatched_to_customer:{ label: 'Expedido ao Cliente', color: 'text-green-400 bg-green-900/40' },
};

const ESTADO_VENDA_COLORS: Record<string, string> = {
  'Vendido': 'text-slate-400',
  'Em Processamento de Compra': 'text-yellow-400',
};

function LogBadge({ status }: { status: string }) {
  const s = LOGISTICS_LABELS[status] ?? { label: status || 'Desconhecido', color: 'text-slate-400 bg-slate-700' };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.color}`}>{s.label}</span>;
}

const MODULO_FINANCAS = { id: 'financas', nome: 'Finanças Globais', icone: 'DollarSign' } as const;

export function ComprasView() {
  const { empresaSelecionada, setModuloSelecionado, setFinancasNavigation } = useApp();
  const [activeTab, setActiveTab] = useState<ActiveTab>('central');

  const [pending, setPending] = useState<PendingSale[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [portes, setPortes] = useState(0);
  const [taxaIva, setTaxaIva] = useState(0);
  const [creating, setCreating] = useState(false);
  const [createMessage, setCreateMessage] = useState<string | null>(null);

  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [totalOrders, setTotalOrders] = useState(0);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [checkoutEmpresaId, setCheckoutEmpresaId] = useState<number | ''>('');
  const [checkoutDataInicio, setCheckoutDataInicio] = useState('');
  const [checkoutDataFim, setCheckoutDataFim] = useState('');
  const [checkoutFornecedorFilter, setCheckoutFornecedorFilter] = useState('');
  const [checkoutSupplierOrderIdFilter, setCheckoutSupplierOrderIdFilter] = useState('');
  const [checkoutPoIdFilter, setCheckoutPoIdFilter] = useState('');
  const [empresasList, setEmpresasList] = useState<Empresa[]>([]);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  // Global Cockpit
  const [globalPending, setGlobalPending] = useState<GlobalPendingItem[]>([]);
  const [loadingGlobal, setLoadingGlobal] = useState(false);
  const [supplierFilter, setSupplierFilter] = useState<number | ''>('');
  const [selectedGlobalIds, setSelectedGlobalIds] = useState<Set<number>>(new Set());
  const [portesGlobal, setPortesGlobal] = useState(0);
  const [taxaIvaGlobal, setTaxaIvaGlobal] = useState(0);
  const [preparing, setPreparing] = useState(false);
  const [prepareMessage, setPrepareMessage] = useState<string | null>(null);
  // Checkout Wizard (após Preparar Compras)
  const [wizardPOIds, setWizardPOIds] = useState<number[]>([]);
  const [wizardStep, setWizardStep] = useState(0);
  const [wizardPODetail, setWizardPODetail] = useState<PurchaseOrder | null>(null);
  const [checkoutDetail, setCheckoutDetail] = useState<CheckoutDetail | null>(null);
  const [wizardLoading, setWizardLoading] = useState(false);
  const [supplierOrderIdInput, setSupplierOrderIdInput] = useState('');
  const [wizardUpdating, setWizardUpdating] = useState(false);
  const [wizardPortes, setWizardPortes] = useState(0);
  const [wizardTaxas, setWizardTaxas] = useState(0);
  const [wizardBaseOverride, setWizardBaseOverride] = useState<number | ''>('');
  const [wizardIvaOverride, setWizardIvaOverride] = useState<number | ''>('');
  const [wizardObservacoes, setWizardObservacoes] = useState('');
  const [checkoutSuppliers, setCheckoutSuppliers] = useState<SupplierMaster[]>([]);
  const [wizardSupplierChanging, setWizardSupplierChanging] = useState(false);
  // Itens editáveis: id → { quantidade, custo_unitario }
  const [itemEdits, setItemEdits] = useState<Record<number, { quantidade: number; custo_unitario: number }>>({});
  // Itens adicionados de outras POs do mesmo fornecedor (consolidação escritório) — linhas âmbar
  const [addedPoItems, setAddedPoItems] = useState<Array<{ poId: number; itemId: number; sku: string; quantidade: number; custo_unitario: number; ean?: string | null }>>([]);
  const [officeOtherPos, setOfficeOtherPos] = useState<PurchaseOrder[]>([]);
  // Picker "Procurar Vendas Pendentes"
  const [pendingPickerOpen, setPendingPickerOpen] = useState(false);
  const [pendingPickerItems, setPendingPickerItems] = useState<PendingPurchaseItem[]>([]);
  const [pendingPickerSelected, setPendingPickerSelected] = useState<Set<number>>(new Set());
  const [pendingPickerLoading, setPendingPickerLoading] = useState(false);
  const [addingItems, setAddingItems] = useState(false);

  // Fase 3: Central de Compras (pending_purchase_items)
  const [centralPending, setCentralPending] = useState<PendingPurchaseItem[]>([]);
  const [loadingCentral, setLoadingCentral] = useState(false);
  const [selectedCentralIds, setSelectedCentralIds] = useState<Set<number>>(new Set());
  const [supplierFilterCentral, setSupplierFilterCentral] = useState<number | ''>('');
  const [portesCentral, setPortesCentral] = useState(0);
  const [taxaIvaCentral, setTaxaIvaCentral] = useState(0);
  const [consolidating, setConsolidating] = useState(false);
  const [consolidateMessage, setConsolidateMessage] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<PurchaseOrder[]>([]);
  const [draftsTotal, setDraftsTotal] = useState(0);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const [supplierHealthMap, setSupplierHealthMap] = useState<Record<number, number>>({});

  // Visualizar PO (nota de encomenda) — modal com opção imprimir/guardar PDF
  const [viewPoId, setViewPoId] = useState<number | null>(null);
  const [viewPoDetail, setViewPoDetail] = useState<CheckoutDetail | null>(null);
  const [viewPoLoading, setViewPoLoading] = useState(false);

  // Tab Tracking
  const [trackingOrders, setTrackingOrders] = useState<PurchaseOrder[]>([]);
  const [loadingTracking, setLoadingTracking] = useState(false);
  const [expandedTrackingPo, setExpandedTrackingPo] = useState<number | null>(null);
  const [trackingDetail, setTrackingDetail] = useState<Record<number, CheckoutDetail>>({});

  // Tab Estado das Vendas

  const empresaId = empresaSelecionada?.id ?? 0;

  const openViewPo = (poId: number) => {
    setViewPoId(poId);
    setViewPoDetail(null);
    setViewPoLoading(true);
    purchasesApi.getCheckoutDetail(poId)
      .then((detail) => setViewPoDetail(detail))
      .catch(() => setViewPoDetail(null))
      .finally(() => setViewPoLoading(false));
  };

  const closeViewPo = () => {
    setViewPoId(null);
    setViewPoDetail(null);
  };

  useEffect(() => {
    if (activeTab === 'pendentes' && empresaId) {
      setLoadingPending(true);
      purchasesApi.getPendingSales(empresaId)
        .then((r) => { setPending(r.items); setSelectedIds(new Set()); })
        .catch(() => setPending([]))
        .finally(() => setLoadingPending(false));
    }
  }, [activeTab, empresaId]);

  useEffect(() => {
    if (activeTab === 'central') {
      setLoadingCentral(true);
      purchasesApi.getPendingForCockpit(supplierFilterCentral === '' ? undefined : Number(supplierFilterCentral))
        .then((r) => { setCentralPending(r.items); setSelectedCentralIds(new Set()); })
        .catch(() => setCentralPending([]))
        .finally(() => setLoadingCentral(false));
      financeApi.getSupplierHealth(empresaId || undefined)
        .then((rows) => setSupplierHealthMap(rows.reduce((acc, r) => ({ ...acc, [r.supplier_id]: r.health_score }), {})))
        .catch(() => setSupplierHealthMap({}));
    }
  }, [activeTab, supplierFilterCentral, empresaId]);

  useEffect(() => {
    if (activeTab === 'global') {
      setLoadingGlobal(true);
      purchasesApi.getGlobalPending(supplierFilter === '' ? undefined : Number(supplierFilter))
        .then((r) => { setGlobalPending(r.items); setSelectedGlobalIds(new Set()); })
        .catch(() => setGlobalPending([]))
        .finally(() => setLoadingGlobal(false));
    }
  }, [activeTab, supplierFilter]);

  useEffect(() => {
    if (activeTab === 'checkout') {
      empresasApi.getAll().then(list => setEmpresasList(Array.isArray(list) ? list : [])).catch(() => {});
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'checkout') {
      const eid = checkoutEmpresaId !== '' ? checkoutEmpresaId : (empresaId || undefined);
      setLoadingOrders(true);
      setLoadingDrafts(true);
      Promise.all([
        purchasesApi.listPurchaseOrders(
          eid, statusFilter || undefined, 100, 0,
          checkoutDataInicio || undefined,
          checkoutDataFim || undefined,
        ),
        purchasesApi.getDrafts(eid, 100, 0),
      ])
        .then(([ordersRes, draftsRes]) => {
          setOrders(ordersRes.items);
          setTotalOrders(ordersRes.total);
          setDrafts(draftsRes.items);
          setDraftsTotal(draftsRes.total);
        })
        .catch(() => { setOrders([]); setDrafts([]); setDraftsTotal(0); })
        .finally(() => { setLoadingOrders(false); setLoadingDrafts(false); });
    }
  }, [activeTab, empresaId, statusFilter, checkoutEmpresaId, checkoutDataInicio, checkoutDataFim]);

  useEffect(() => {
    if (wizardPOIds.length > 0 && wizardStep < wizardPOIds.length) {
      const poId = wizardPOIds[wizardStep];
      setWizardLoading(true);
      Promise.all([
        purchasesApi.getPurchaseOrder(poId),
        purchasesApi.getCheckoutDetail(poId),
      ])
        .then(([po, checkout]) => {
          setWizardPODetail(po);
          setCheckoutDetail(checkout);
          setWizardPortes(checkout.portes_totais ?? 0);
          setWizardTaxas(checkout.taxas_pagamento ?? 0);
          // Pré-preencher base e IVA sempre (não apenas quando fornecedor muda)
          setWizardBaseOverride(checkout.valor_base_artigos ?? 0);
          setWizardIvaOverride(checkout.iva_total ?? 0);
          setItemEdits({});
          setAddedPoItems([]);
          // Envio escritório: carregar outras POs draft do mesmo fornecedor e mostrar itens na tabela (linhas âmbar)
          const tipoEnvio = (checkout.tipo_envio ?? po.tipo_envio ?? '').toLowerCase();
          if (tipoEnvio.includes('escritorio') || tipoEnvio.includes('escritório') || tipoEnvio === 'office') {
            purchasesApi.getDrafts(po.empresa_id, 100)
              .then((r) => {
                const others = r.items.filter(
                  (p) => p.supplier_id === po.supplier_id && p.id !== po.id,
                );
                setOfficeOtherPos(others);
                if (others.length > 0) {
                  Promise.all(others.map((p) => purchasesApi.getCheckoutDetail(p.id)))
                    .then((details) => {
                      const merged = details.flatMap((d) =>
                        (d.items ?? []).map((it) => ({
                          poId: d.id,
                          itemId: it.id,
                          sku: it.sku_fornecedor ?? it.sku_marketplace ?? '—',
                          quantidade: it.quantidade,
                          custo_unitario: it.custo_checkout ?? it.custo_unitario ?? 0,
                        })),
                      );
                      setAddedPoItems(merged);
                    })
                    .catch(() => {});
                }
              })
              .catch(() => setOfficeOtherPos([]));
          } else {
            setOfficeOtherPos([]);
          }
        })
        .catch(() => {
          setWizardPODetail(null);
          setCheckoutDetail(null);
        })
        .finally(() => setWizardLoading(false));
    } else {
      setWizardPODetail(null);
      setCheckoutDetail(null);
    }
  }, [wizardPOIds, wizardStep]);

  useEffect(() => {
    if (!wizardPODetail) {
      setCheckoutSuppliers([]);
      return;
    }
    const eid = wizardPODetail.empresa_id;
    suppliersApi.list(eid != null ? eid : undefined)
      .then((r) => setCheckoutSuppliers(r.items ?? []))
      .catch(() => setCheckoutSuppliers([]));
  }, [wizardPODetail?.id, wizardPODetail?.empresa_id]);

  useEffect(() => {
    if (activeTab === 'tracking') {
      setLoadingTracking(true);
      purchasesApi.listPurchaseOrders(empresaId || undefined, undefined, 100, 0)
        .then((r) => setTrackingOrders(r.items.filter((po) => po.status !== 'Draft')))
        .catch(() => setTrackingOrders([]))
        .finally(() => setLoadingTracking(false));
    }
  }, [activeTab, empresaId]);

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === pending.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(pending.map((p) => p.id)));
  };

  const handleCreateOrder = async () => {
    const idsToAggregate = Array.from(selectedIds);
    if (!empresaId || idsToAggregate.length === 0) {
      setCreateMessage('Selecione pelo menos uma venda.');
      return;
    }
    setCreating(true);
    setCreateMessage(null);
    try {
      const res = await purchasesApi.aggregate({
        empresa_id: empresaId,
        order_ids: idsToAggregate,
        tipo_envio: 'Escritorio',
        portes_totais: portes,
        taxa_iva_pct: taxaIva,
      });
      if (res.success) {
        setCreateMessage(`Ordem de compra #${res.purchase_order_id} criada. Total: ${formatCurrency(res.total_final ?? 0)}`);
        setSelectedIds(new Set());
        setPending((prev) => prev.filter((p) => !idsToAggregate.includes(p.id)));
        setActiveTab('checkout');
      } else {
        setCreateMessage(res.error || 'Erro ao criar ordem.');
      }
    } catch (e: any) {
      setCreateMessage(e?.message || 'Erro ao criar ordem.');
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateStatus = async (poId: number, status: string) => {
    setUpdatingId(poId);
    try {
      await purchasesApi.updateStatus(poId, status);
      setOrders((prev) => prev.map((po) => (po.id === poId ? { ...po, status } : po)));
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeletePo = async (poId: number) => {
    if (!window.confirm('Apagar esta ordem de compra? Os itens da PO são removidos. As vendas não são alteradas (pode criar nova PO depois).')) return;
    try {
      await purchasesApi.deletePurchaseOrder(poId);
      setOrders((prev) => prev.filter((po) => po.id !== poId));
      setTotalOrders((t) => Math.max(0, t - 1));
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'response' in e && (e as { response?: { data?: { detail?: string } } }).response?.data?.detail;
      alert(msg || 'Erro ao apagar a ordem de compra.');
    }
  };

  const handleExport = async (poId: number) => {
    try {
      const po = await purchasesApi.getPurchaseOrder(poId);
      const rows = (po.items || []).map(
        (i) => [i.sku_fornecedor ?? i.sku_marketplace, i.quantidade, i.custo_unitario].join('\t')
      );
      const csv = 'SKU Fornecedor\tQuantidade\tCusto unitário\n' + rows.join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `compra-${poId}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (_) {}
  };

  const formatDate = (s: string | null) => {
    if (!s) return '—';
    try {
      return new Date(s).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return s;
    }
  };

  const uniqueSuppliers = Array.from(new Map(globalPending.filter((p) => p.supplier_id != null).map((p) => [p.supplier_id, { id: p.supplier_id, nome: p.supplier_nome || '' }])).values());

  // Filtros client-side para tab Checkout
  const uniqueCheckoutSuppliers = Array.from(new Map(orders.filter((o) => o.supplier_id != null).map((o) => [o.supplier_id, { id: o.supplier_id!, nome: o.supplier_nome || '' }])).values()).sort((a, b) => a.nome.localeCompare(b.nome));
  const filteredOrders = orders.filter((po) => {
    if (checkoutFornecedorFilter && po.supplier_id !== Number(checkoutFornecedorFilter)) return false;
    if (checkoutSupplierOrderIdFilter && !(po.supplier_order_id ?? '').toLowerCase().includes(checkoutSupplierOrderIdFilter.toLowerCase())) return false;
    if (checkoutPoIdFilter && !String(po.id).includes(checkoutPoIdFilter.trim())) return false;
    return true;
  });

  const toggleGlobalSelect = (id: number) => {
    setSelectedGlobalIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleGlobalSelectAll = () => {
    if (selectedGlobalIds.size === globalPending.length) setSelectedGlobalIds(new Set());
    else setSelectedGlobalIds(new Set(globalPending.map((p) => p.id)));
  };

  const handlePrepareBulk = async () => {
    const ids = Array.from(selectedGlobalIds);
    if (ids.length === 0) {
      setPrepareMessage('Selecione pelo menos uma linha.');
      return;
    }
    setPreparing(true);
    setPrepareMessage(null);
    try {
      const res = await purchasesApi.prepareBulk({
        order_ids: ids,
        portes_totais: portesGlobal,
        taxa_iva_pct: taxaIvaGlobal,
      });
      if (res.success && res.purchase_orders?.length) {
        setWizardPOIds(res.purchase_orders.map((po) => po.purchase_order_id));
        setWizardStep(0);
        setSupplierOrderIdInput('');
        setPrepareMessage(`${res.purchase_orders.length} ordem(ns) de compra criada(s). Conclua o checkout abaixo.`);
      } else {
        setPrepareMessage(res.error || 'Erro ao preparar.');
      }
    } catch (e: any) {
      setPrepareMessage(e?.message || 'Erro ao preparar.');
    } finally {
      setPreparing(false);
    }
  };

  // Fase 3: Número de POs que serão geradas (grupos empresa + fornecedor nos itens selecionados)
  const selectedCentralItems = centralPending.filter((p) => selectedCentralIds.has(p.id));
  const numPosToCreate = selectedCentralItems.length
    ? new Set(selectedCentralItems.map((p) => `${p.empresa_id}-${p.supplier_id}`)).size
    : 0;

  const toggleCentralSelect = (id: number) => {
    setSelectedCentralIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleCentralSelectAll = () => {
    if (selectedCentralIds.size === centralPending.length) setSelectedCentralIds(new Set());
    else setSelectedCentralIds(new Set(centralPending.map((p) => p.id)));
  };

  const handleConsolidate = async () => {
    const ids = Array.from(selectedCentralIds);
    if (ids.length === 0) {
      setConsolidateMessage('Selecione pelo menos um item.');
      return;
    }
    setConsolidating(true);
    setConsolidateMessage(null);
    try {
      const res = await purchasesApi.consolidatePurchases({
        pending_item_ids: ids,
        portes_totais: portesCentral,
        taxa_iva_pct: taxaIvaCentral,
      });
      if (res.success && res.purchase_orders?.length) {
        setWizardPOIds(res.purchase_orders.map((po) => po.purchase_order_id));
        setWizardStep(0);
        setSupplierOrderIdInput('');
        setConsolidateMessage(`${res.num_pos ?? res.purchase_orders.length} ordem(ns) de compra criada(s) para faturação correta. Conclua o checkout abaixo.`);
        setSelectedCentralIds(new Set());
        setCentralPending((prev) => prev.filter((p) => !ids.includes(p.id)));
        setActiveTab('checkout');
      } else {
        setConsolidateMessage(res.error || 'Erro ao gerar compras.');
      }
    } catch (e: any) {
      setConsolidateMessage(e?.message || 'Erro ao gerar compras.');
    } finally {
      setConsolidating(false);
    }
  };

  const uniqueSuppliersCentral = Array.from(new Map(centralPending.filter((p) => p.supplier_id != null).map((p) => [p.supplier_id, { id: p.supplier_id, nome: p.supplier_nome || '' }])).values())
    .sort((a, b) => (supplierHealthMap[Number(b.id)] ?? 0) - (supplierHealthMap[Number(a.id)] ?? 0));

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleWizardMarkOrdered = async () => {
    const poId = wizardPOIds[wizardStep];
    if (!poId) return;
    setWizardUpdating(true);
    try {
      await purchasesApi.updateStatus(poId, 'Ordered');
      if (supplierOrderIdInput.trim()) {
        await purchasesApi.setSupplierOrderId(poId, supplierOrderIdInput.trim());
      }
      setSupplierOrderIdInput('');
      if (wizardStep + 1 >= wizardPOIds.length) {
        setWizardPOIds([]);
        setWizardStep(0);
        setActiveTab('checkout');
      } else {
        setWizardStep((s) => s + 1);
      }
    } finally {
      setWizardUpdating(false);
    }
  };

  /** v3.5: Finalizar PO grava portes/taxas, ID fornecedor e move para Ordered */
  const handleChangeSupplier = async (newSupplierId: number) => {
    const poId = wizardPOIds[wizardStep];
    if (!poId || wizardPODetail?.supplier_id === newSupplierId) return;
    setWizardSupplierChanging(true);
    try {
      await purchasesApi.setPoSupplier(poId, newSupplierId);
      const [po, checkout] = await Promise.all([
        purchasesApi.getPurchaseOrder(poId),
        purchasesApi.getCheckoutDetail(poId, { portes: wizardPortes, taxas_pagamento: wizardTaxas }),
      ]);
      setWizardPODetail(po);
      setCheckoutDetail(checkout);
      setWizardPortes(checkout.portes_totais ?? 0);
      setWizardTaxas(checkout.taxas_pagamento ?? 0);
      setWizardBaseOverride(checkout.valor_base_artigos ?? 0);
      setWizardIvaOverride(checkout.iva_total ?? 0);
    } catch (e: unknown) {
      alert((e as Error)?.message ?? 'Erro ao alterar fornecedor.');
    } finally {
      setWizardSupplierChanging(false);
    }
  };

  const handleWizardFinalizePo = async () => {
    const poId = wizardPOIds[wizardStep];
    if (!poId) return;
    setWizardUpdating(true);
    try {
      const baseVal = wizardBaseOverride === '' ? undefined : Number(wizardBaseOverride);
      const ivaVal  = wizardIvaOverride  === '' ? undefined : Number(wizardIvaOverride);
      await purchasesApi.finalizePo(poId, {
        supplier_order_id: supplierOrderIdInput.trim() || undefined,
        portes_totais: wizardPortes,
        taxas_pagamento: wizardTaxas,
        valor_base_artigos: baseVal,
        iva_total: ivaVal,
      });
      // Se há POs adicionadas (consolidação escritório), finalizar também com a mesma NE
      if (addedPoItems.length > 0) {
        const addedPoIds = [...new Set(addedPoItems.map((i) => i.poId))];
        await Promise.allSettled(
          addedPoIds.map((pid) =>
            purchasesApi.finalizePo(pid, {
              supplier_order_id: supplierOrderIdInput.trim() || undefined,
            }),
          ),
        );
      }
      setSupplierOrderIdInput('');
      if (wizardStep + 1 >= wizardPOIds.length) {
        setWizardPOIds([]);
        setWizardStep(0);
        setActiveTab('checkout');
      } else {
        setWizardStep((s) => s + 1);
      }
    } finally {
      setWizardUpdating(false);
    }
  };

  if (!empresaSelecionada && activeTab !== 'global' && activeTab !== 'central') {
    return (
      <div className="mt-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-slate-400">Selecione uma empresa na barra lateral para gerir compras.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-6">
      {empresaSelecionada && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-slate-400 text-sm">
              <span className="text-slate-500">Empresa:</span>{' '}
              <span className="text-amber-400 font-medium">{empresaSelecionada.nome}</span>
            </p>
          </CardContent>
        </Card>
      )}

      {/* Checkout Wizard: passos sequenciais após Preparar Compras */}
      {wizardPOIds.length > 0 && (
        <Card className="border-amber-500/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="flex items-center gap-2">
              <ChevronRight className="w-5 h-5 text-amber-400" />
              Checkout – Passo {wizardStep + 1} de {wizardPOIds.length}
            </CardTitle>
            <button
              type="button"
              onClick={() => {
                setWizardPOIds([]);
                setWizardStep(0);
                setAddedPoItems([]);
                setItemEdits({});
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 border border-slate-600 hover:border-slate-500 text-sm transition-colors"
              title="Sair do checkout sem concluir"
            >
              <X className="w-4 h-4" />
              Cancelar
            </button>
          </CardHeader>
          <CardContent>
            {wizardLoading ? (
              <div className="flex items-center justify-center py-8 text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                A carregar...
              </div>
            ) : wizardPODetail ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-600">
                    <p className="text-slate-500 text-xs uppercase tracking-wide">Dados fiscais (para fatura no fornecedor)</p>
                    <p className="text-white font-medium mt-1">{wizardPODetail.billing_name ?? '—'}</p>
                    {wizardPODetail.billing_nif && <p className="text-slate-400">NIF: {wizardPODetail.billing_nif}</p>}
                    {wizardPODetail.billing_address && <p className="text-slate-400">{wizardPODetail.billing_address}</p>}
                  </div>
                  <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-600">
                    <p className="text-slate-500 text-xs uppercase tracking-wide mb-2">Fornecedor</p>
                    <select
                      value={String(wizardPODetail.supplier_id ?? '')}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v !== '') {
                          const numId = Number(v);
                          if (numId !== wizardPODetail.supplier_id) handleChangeSupplier(numId);
                        }
                      }}
                      disabled={wizardSupplierChanging}
                      className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white text-sm"
                    >
                      {checkoutSuppliers.length === 0 && (
                        <option value={String(wizardPODetail.supplier_id ?? '')}>{wizardPODetail.supplier_nome ?? '—'}</option>
                      )}
                      {checkoutSuppliers.map((s) => (
                        <option key={s.id} value={String(s.id ?? '')}>{s.nome || `Fornecedor #${s.id}`}</option>
                      ))}
                    </select>
                    {wizardSupplierChanging && <p className="text-slate-400 text-xs mt-1">A atualizar...</p>}
                    <p className="text-slate-400 text-xs mt-2 pt-2 border-t border-slate-600">
                      Tipo de envio: {(wizardPODetail.tipo_envio ?? '').toLowerCase() === 'escritorio'
                        ? <span className="text-emerald-400 font-medium">Escritório</span>
                        : <span className="text-sky-400 font-medium">Ao cliente</span>
                      }
                      {(wizardPODetail.tipo_envio ?? '').toLowerCase() !== 'escritorio' && (
                        <span className="text-slate-500 ml-1">(envio direto ao cliente)</span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Envio para escritório — visível quando o fornecedor envia para escritório */}
                {((checkoutDetail?.tipo_envio ?? wizardPODetail.tipo_envio ?? '').toLowerCase() === 'escritorio' && checkoutDetail?.shipping_address) && (
                  <div className="p-3 rounded-lg bg-emerald-900/30 border border-emerald-700/50 text-sm">
                    <p className="text-emerald-400 text-xs font-semibold uppercase tracking-wide">Envio para escritório</p>
                    <p className="text-white font-medium mt-1">{checkoutDetail.shipping_address.designacao ?? '—'}</p>
                    {checkoutDetail.shipping_address.morada && <p className="text-slate-400">{checkoutDetail.shipping_address.morada}</p>}
                    {(checkoutDetail.shipping_address.codigo_postal || checkoutDetail.shipping_address.localidade) && (
                      <p className="text-slate-400">{[checkoutDetail.shipping_address.codigo_postal, checkoutDetail.shipping_address.localidade].filter(Boolean).join(' ')}</p>
                    )}
                    {checkoutDetail.shipping_address.pais && <p className="text-slate-400">{checkoutDetail.shipping_address.pais}</p>}
                  </div>
                )}

                {/* Painel de totais — sempre editável */}
                {checkoutDetail && (() => {
                  const baseVal  = wizardBaseOverride === '' ? 0 : Number(wizardBaseOverride);
                  const ivaVal   = wizardIvaOverride  === '' ? 0 : Number(wizardIvaOverride);
                  const totalCalc = baseVal + ivaVal + wizardPortes + wizardTaxas;
                  return (
                    <div className="p-4 rounded-lg bg-slate-800/60 border border-slate-600 space-y-3">
                      <p className="text-slate-400 text-xs uppercase tracking-wide">Totais da fatura (editáveis)</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                          { label: 'Valor base (€)', val: wizardBaseOverride, set: setWizardBaseOverride },
                          { label: `IVA ${checkoutDetail.taxa_iva_pct > 0 ? `(${checkoutDetail.taxa_iva_pct}%)` : ''} (€)`, val: wizardIvaOverride, set: setWizardIvaOverride },
                          { label: 'Portes (€)', val: wizardPortes as number | '', set: (v: number | '') => setWizardPortes(v === '' ? 0 : Number(v)) },
                          { label: 'Taxas pagamento (€)', val: wizardTaxas as number | '', set: (v: number | '') => setWizardTaxas(v === '' ? 0 : Number(v)) },
                        ].map(({ label, val, set }) => (
                          <label key={label} className="flex flex-col gap-1">
                            <span className="text-slate-400 text-xs">{label}</span>
                            <input
                              type="number"
                              step="0.01"
                              min={0}
                              value={val === '' ? '' : val}
                              onChange={(e) => {
                                const raw = e.target.value;
                                if (raw === '') (set as (v: number | '') => void)('');
                                else { const v = Number(raw); if (!Number.isNaN(v)) (set as (v: number | '') => void)(v); }
                              }}
                              className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-white text-sm"
                            />
                          </label>
                        ))}
                      </div>
                      <div className="flex items-center justify-between border-t border-slate-700 pt-2">
                        <span className="text-slate-400 text-sm">Total calculado</span>
                        <span className="text-amber-400 font-bold text-lg">{formatCurrency(totalCalc)}</span>
                      </div>
                      <div className={`px-3 py-2 rounded text-sm font-medium ${
                        (checkoutDetail.margin_pct ?? 0) >= 15 ? 'bg-emerald-900/40 text-emerald-300' :
                        (checkoutDetail.margin_pct ?? 0) >= 10 ? 'bg-amber-900/40 text-amber-300' :
                        'bg-red-900/40 text-red-300'
                      }`}>
                        Lucro previsto: {formatCurrency(checkoutDetail.margin_eur ?? 0)} ({(checkoutDetail.margin_pct ?? 0).toFixed(1)}%)
                      </div>
                    </div>
                  );
                })()}

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const lines = (wizardPODetail.items || []).map((i) => {
                        const edit = itemEdits[i.id];
                        const qty = edit ? edit.quantidade : i.quantidade;
                        return `${i.sku_fornecedor ?? i.sku_marketplace ?? ''}\t${qty}`;
                      });
                      copyToClipboard(lines.join('\n'));
                    }}
                    className="px-3 py-2 rounded-lg bg-slate-700 text-slate-200 hover:bg-slate-600 flex items-center gap-2 text-sm"
                  >
                    <Copy className="w-4 h-4" /> Copiar Carrinho
                  </button>
                  <button type="button" onClick={() => handleExport(wizardPOIds[wizardStep])} className="px-3 py-2 rounded-lg bg-slate-700 text-slate-200 hover:bg-slate-600 flex items-center gap-2 text-sm">
                    <Download className="w-4 h-4" /> Exportar CSV
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!wizardPODetail?.supplier_id) return;
                    setPendingPickerOpen(true);
                    setPendingPickerLoading(true);
                    setPendingPickerSelected(new Set());
                    purchasesApi.getPendingForCockpit(wizardPODetail.supplier_id, 500)
                      .then((r) => setPendingPickerItems(r.items ?? []))
                      .catch(() => setPendingPickerItems([]))
                      .finally(() => setPendingPickerLoading(false));
                  }}
                  className="mb-3 px-3 py-2 rounded-lg bg-slate-700 text-slate-200 hover:bg-slate-600 flex items-center gap-2 text-sm"
                >
                  <Plus className="w-4 h-4" /> Procurar Vendas Pendentes
                </button>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left py-2 px-2 text-slate-300 font-semibold">Pedido</th>
                        <th className="text-left py-2 px-2 text-slate-300 font-semibold">EAN</th>
                        <th className="text-left py-2 px-2 text-slate-300 font-semibold">SKU Fornecedor</th>
                        <th className="text-center py-2 px-2 text-slate-300 font-semibold">Qtd</th>
                        <th className="text-center py-2 px-2 text-slate-300 font-semibold">Custo un. (€)</th>
                        <th className="text-right py-2 px-2 text-slate-300 font-semibold">Subtotal</th>
                        <th className="text-right py-2 px-2 text-slate-300 font-semibold">Val.Venda</th>
                        <th className="text-right py-2 px-2 text-slate-300 font-semibold">Margem</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody>
                      {(checkoutDetail?.items ?? []).map((item) => {
                        const edit = itemEdits[item.id];
                        const qty = edit?.quantidade ?? Number(item.quantidade) ?? 0;
                        const cost = edit?.custo_unitario ?? Number(item.custo_checkout ?? item.custo_unitario) ?? 0;
                        const subtotal = qty * cost + (item.portes_rateados ?? 0) + (item.impostos_rateados ?? 0);
                        const margem = item.sale_value != null ? (item.sale_value - subtotal) : item.margem_linha;
                        const pct = item.sale_value != null && item.sale_value > 0 && margem != null ? (margem / item.sale_value) * 100 : null;
                        return (
                          <tr key={item.id} className="border-b border-slate-800">
                            <td className="py-1.5 px-2 text-slate-400 text-xs">{item.numero_pedido ?? '—'}</td>
                            <td className="py-1.5 px-2 text-slate-400 font-mono text-xs">{item.ean ?? '—'}</td>
                            <td className="py-1.5 px-2 text-slate-200">{item.sku_fornecedor ?? item.sku_marketplace ?? '—'}</td>
                            <td className="py-1.5 px-2">
                              <input
                                type="number"
                                min={0}
                                step={1}
                                value={qty}
                                onChange={(e) => {
                                  const v = e.target.value === '' ? 0 : Number(e.target.value);
                                  if (!Number.isNaN(v)) setItemEdits((prev) => ({ ...prev, [item.id]: { quantidade: v, custo_unitario: cost } }));
                                }}
                                onBlur={() => {
                                  purchasesApi.updatePoItem(wizardPOIds[wizardStep], item.id, { quantidade: qty, custo_unitario: cost }).then((r) => {
                                    const items = checkoutDetail?.items ?? [];
                                    const newBase = items.reduce((s, it) => {
                                      const e2 = it.id === item.id ? { quantidade: qty, custo_unitario: cost } : itemEdits[it.id];
                                      const c = e2?.custo_unitario ?? (it.custo_checkout ?? it.custo_unitario);
                                      return s + (e2?.quantidade ?? it.quantidade) * c;
                                    }, 0);
                                    setWizardBaseOverride(Number(newBase.toFixed(2)));
                                    if (checkoutDetail?.taxa_iva_pct != null) setWizardIvaOverride(Number((newBase * (checkoutDetail.taxa_iva_pct / 100)).toFixed(2)));
                                  }).catch(() => {});
                                }}
                                className="w-16 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white text-sm text-center"
                              />
                            </td>
                            <td className="py-1.5 px-2">
                              <input
                                type="number"
                                min={0}
                                step={0.01}
                                value={cost}
                                onChange={(e) => {
                                  const v = e.target.value === '' ? 0 : Number(e.target.value);
                                  if (!Number.isNaN(v)) setItemEdits((prev) => ({ ...prev, [item.id]: { quantidade: qty, custo_unitario: v } }));
                                }}
                                onBlur={(e) => {
                                  const newCost = e.target.value === '' ? 0 : Number((e.target as HTMLInputElement).value);
                                  if (Number.isNaN(newCost)) return;
                                  purchasesApi.updatePoItem(wizardPOIds[wizardStep], item.id, { quantidade: qty, custo_unitario: newCost }).then(() => {
                                    const items = checkoutDetail?.items ?? [];
                                    const newBase = items.reduce((s, it) => {
                                      const e2 = it.id === item.id ? { quantidade: qty, custo_unitario: newCost } : itemEdits[it.id];
                                      const c = (it.id === item.id ? newCost : e2?.custo_unitario) ?? (it.custo_checkout ?? it.custo_unitario);
                                      return s + (e2?.quantidade ?? it.quantidade) * c;
                                    }, 0);
                                    setWizardBaseOverride(Number(newBase.toFixed(2)));
                                    if (checkoutDetail?.taxa_iva_pct != null) setWizardIvaOverride(Number((newBase * (checkoutDetail.taxa_iva_pct / 100)).toFixed(2)));
                                  }).catch(() => {});
                                }}
                                className="w-24 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white text-sm text-center"
                              />
                            </td>
                            <td className="py-1.5 px-2 text-right text-amber-300 font-mono text-xs">{formatCurrency(subtotal)}</td>
                            <td className="py-1.5 px-2 text-right text-sky-300 font-mono text-xs">{item.sale_value != null ? formatCurrency(item.sale_value) : '—'}</td>
                            <td className="py-1.5 px-2 text-right">
                              {margem != null ? (
                                <span className={`text-xs font-medium ${margem >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                  {formatCurrency(margem)}{pct != null ? ` (${pct.toFixed(1)}%)` : ''}
                                </span>
                              ) : (
                                <span className="text-slate-500">—</span>
                              )}
                            </td>
                            <td />
                          </tr>
                        );
                      })}
                      {addedPoItems.map((item, idx) => (
                        <tr key={`added-${item.poId}-${item.itemId}`} className="border-b border-amber-900/30 bg-amber-950/20">
                          <td className="py-1.5 px-2 text-slate-500">—</td>
                          <td className="py-1.5 px-2 text-slate-500 font-mono text-xs">{item.ean ?? '—'}</td>
                          <td className="py-1.5 px-2 text-amber-200">
                            {item.sku}
                            <span className="ml-1.5 text-[10px] text-amber-500">PO#{item.poId}</span>
                          </td>
                          <td className="py-1.5 px-2">
                            <input
                              type="number"
                              min={0}
                              step={1}
                              value={String(item.quantidade)}
                              onChange={(e) => {
                                const v = e.target.value === '' ? 0 : Number(e.target.value);
                                if (!Number.isNaN(v)) setAddedPoItems((prev) => prev.map((p, i) => i === idx ? { ...p, quantidade: v } : p));
                              }}
                              className="w-16 bg-slate-700 border border-amber-700/40 rounded px-2 py-1 text-amber-200 text-sm text-center"
                            />
                          </td>
                          <td className="py-1.5 px-2">
                            <input
                              type="number"
                              min={0}
                              step={0.01}
                              value={String(item.custo_unitario)}
                              onChange={(e) => {
                                const v = e.target.value === '' ? 0 : Number(e.target.value);
                                if (!Number.isNaN(v)) setAddedPoItems((prev) => prev.map((p, i) => i === idx ? { ...p, custo_unitario: v } : p));
                              }}
                              className="w-24 bg-slate-700 border border-amber-700/40 rounded px-2 py-1 text-amber-200 text-sm text-center"
                            />
                          </td>
                          <td className="py-1.5 px-2 text-right text-amber-400 font-mono text-xs">{formatCurrency(item.quantidade * item.custo_unitario)}</td>
                          <td className="py-1.5 px-2 text-right text-slate-500">—</td>
                          <td className="py-1.5 px-2 text-right text-slate-500">—</td>
                          <td className="py-1.5 px-2">
                            <button type="button" onClick={() => setAddedPoItems((prev) => prev.filter((_, i) => i !== idx))} className="p-1 rounded text-slate-400 hover:text-red-400" title="Remover da lista"><X className="w-4 h-4" /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-slate-600 font-semibold bg-slate-900/60">
                        <td colSpan={2} className="py-2 px-2 text-slate-300">TOTAL LOTE</td>
                        <td className="py-2 px-2 text-center text-slate-300">
                          {(checkoutDetail?.items ?? []).reduce((s, i) => s + (itemEdits[i.id]?.quantidade ?? i.quantidade), 0) + addedPoItems.reduce((s, i) => s + i.quantidade, 0)}
                        </td>
                        <td />
                        <td className="py-2 px-2 text-right text-amber-400">{formatCurrency((wizardBaseOverride === '' ? 0 : Number(wizardBaseOverride)) + addedPoItems.reduce((s, i) => s + i.quantidade * i.custo_unitario, 0))}</td>
                        <td className="py-2 px-2 text-right text-sky-300">
                          {(checkoutDetail?.items ?? []).reduce((s, i) => s + (i.sale_value ?? 0), 0) > 0 || (checkoutDetail?.linked_sales_total ?? 0) > 0
                            ? formatCurrency((checkoutDetail?.items ?? []).reduce((s, i) => s + (i.sale_value ?? 0), 0) || (checkoutDetail?.linked_sales_total ?? 0))
                            : '—'}
                        </td>
                        <td className={`py-2 px-2 text-right font-bold ${(() => {
                          const totalVenda = (checkoutDetail?.items ?? []).reduce((s, i) => s + (i.sale_value ?? 0), 0) || (checkoutDetail?.linked_sales_total ?? 0);
                          const totalCusto = (wizardBaseOverride === '' ? 0 : Number(wizardBaseOverride)) + wizardPortes + wizardTaxas + (wizardIvaOverride === '' ? 0 : Number(wizardIvaOverride)) + addedPoItems.reduce((s, i) => s + i.quantidade * i.custo_unitario, 0);
                          const lucro = totalVenda - totalCusto;
                          return totalVenda > 0 ? (lucro >= 0 ? 'text-emerald-400' : 'text-red-400') : '';
                        })()}`}>
                          {(() => {
                            const totalVenda = (checkoutDetail?.items ?? []).reduce((s, i) => s + (i.sale_value ?? 0), 0) || (checkoutDetail?.linked_sales_total ?? 0);
                            const totalCusto = (wizardBaseOverride === '' ? 0 : Number(wizardBaseOverride)) + wizardPortes + wizardTaxas + (wizardIvaOverride === '' ? 0 : Number(wizardIvaOverride)) + addedPoItems.reduce((s, i) => s + i.quantidade * i.custo_unitario, 0);
                            const lucro = totalVenda - totalCusto;
                            const pct = totalVenda > 0 ? (lucro / totalVenda) * 100 : 0;
                            return totalVenda > 0 ? `${formatCurrency(lucro)} (${pct.toFixed(1)}%)` : '—';
                          })()}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {pendingPickerOpen && (
                  <div className="mt-4 p-4 rounded-lg bg-slate-800 border border-slate-600">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-slate-300 font-medium">Vendas pendentes · {wizardPODetail?.supplier_nome ?? 'Fornecedor'}</span>
                      <button type="button" onClick={() => setPendingPickerOpen(false)} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
                    </div>
                    {pendingPickerLoading ? (
                      <p className="text-slate-400 text-sm">A carregar...</p>
                    ) : pendingPickerItems.length === 0 ? (
                      <p className="text-slate-500 text-sm">Nenhum item pendente para este fornecedor.</p>
                    ) : (
                      <>
                        <div className="overflow-x-auto max-h-48 overflow-y-auto mb-3">
                          <table className="w-full text-sm">
                            <thead><tr className="border-b border-slate-600"><th className="text-left py-1 px-2 text-slate-400">☐</th><th className="text-left py-1 px-2 text-slate-400">SKU</th><th className="text-center py-1 px-2 text-slate-400">Qtd</th><th className="text-right py-1 px-2 text-slate-400">Custo base</th><th className="text-right py-1 px-2 text-slate-400">Lucro esperado</th></tr></thead>
                            <tbody>
                              {pendingPickerItems.map((p) => (
                                <tr key={p.id} className="border-b border-slate-700/50">
                                  <td className="py-1 px-2">
                                    <input type="checkbox" checked={pendingPickerSelected.has(p.id)} onChange={(e) => setPendingPickerSelected((prev) => { const next = new Set(prev); if (e.target.checked) next.add(p.id); else next.delete(p.id); return next; })} className="rounded" />
                                  </td>
                                  <td className="py-1 px-2 text-slate-200">{p.sku_marketplace ?? p.sku_supplier ?? '—'}</td>
                                  <td className="py-1 px-2 text-center">{p.quantity}</td>
                                  <td className="py-1 px-2 text-right text-amber-400">{formatCurrency(p.cost_price_base ?? 0)}</td>
                                  <td className="py-1 px-2 text-right text-emerald-400">{p.expected_profit != null ? `+${formatCurrency(p.expected_profit)}` : '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <button
                          type="button"
                          disabled={addingItems || pendingPickerSelected.size === 0}
                          onClick={async () => {
                            const poId = wizardPOIds[wizardStep];
                            if (!poId || pendingPickerSelected.size === 0) return;
                            setAddingItems(true);
                            try {
                              const res = await purchasesApi.addItemsToPo(poId, [...pendingPickerSelected]);
                              if (res.success) {
                                const [po, checkout] = await Promise.all([purchasesApi.getPurchaseOrder(poId), purchasesApi.getCheckoutDetail(poId, { portes: wizardPortes, taxas_pagamento: wizardTaxas })]);
                                setWizardPODetail(po);
                                setCheckoutDetail(checkout);
                                setWizardBaseOverride(checkout.valor_base_artigos ?? 0);
                                setWizardIvaOverride(checkout.iva_total ?? 0);
                                setPendingPickerOpen(false);
                                setPendingPickerSelected(new Set());
                                setPendingPickerItems((prev) => prev.filter((i) => !pendingPickerSelected.has(i.id)));
                              }
                            } finally {
                              setAddingItems(false);
                            }
                          }}
                          className="px-3 py-2 rounded bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-sm"
                        >
                          {addingItems ? 'A adicionar...' : `Adicionar ${pendingPickerSelected.size} item(ns) seleccionado(s)`}
                        </button>
                      </>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap items-end gap-4 pt-4">
                  <label className="flex flex-col gap-1">
                    <span className="text-slate-400 text-sm">Nº NE no fornecedor</span>
                    <input
                      type="text"
                      value={supplierOrderIdInput}
                      onChange={(e) => setSupplierOrderIdInput(e.target.value)}
                      placeholder="Ex: ES-12345"
                      className="w-48 bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm"
                    />
                  </label>
                  <button
                    onClick={handleWizardFinalizePo}
                    disabled={wizardUpdating}
                    className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium disabled:opacity-50 flex items-center gap-2"
                  >
                    {wizardUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    Finalizar PO {wizardStep + 1 < wizardPOIds.length ? 'e próximo' : 'e concluir'}
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-slate-400">Sem detalhe da ordem.</p>
            )}
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ActiveTab)}>
        <TabsList className="bg-slate-800 border border-slate-600 grid grid-cols-6">
          <TabsTrigger value="central" className="data-[state=active]:bg-amber-600 data-[state=active]:text-white">
            <Package className="w-4 h-4 mr-2" />
            Central de Compras
          </TabsTrigger>
          <TabsTrigger value="global" className="data-[state=active]:bg-amber-600 data-[state=active]:text-white">
            <Globe className="w-4 h-4 mr-2" />
            Global Cockpit
          </TabsTrigger>
          <TabsTrigger value="pendentes" className="data-[state=active]:bg-amber-600 data-[state=active]:text-white">
            <Package className="w-4 h-4 mr-2" />
            Compras pendentes
          </TabsTrigger>
          <TabsTrigger value="checkout" className="data-[state=active]:bg-amber-600 data-[state=active]:text-white">
            <ShoppingCart className="w-4 h-4 mr-2" />
            Checkout
          </TabsTrigger>
          <TabsTrigger value="tracking" className="data-[state=active]:bg-amber-600 data-[state=active]:text-white">
            <Truck className="w-4 h-4 mr-2" />
            Tracking
          </TabsTrigger>
        </TabsList>

        <TabsContent value="central" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5 text-amber-400" />
                Central de Compras (Fase 3)
              </CardTitle>
              <p className="text-slate-400 text-sm mt-1">Visão unificada de necessidades de compra (pending_purchase_items). Selecione itens e gere POs separadas por empresa para faturação correta.</p>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4 mb-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Fornecedor</label>
                  <select
                    value={supplierFilterCentral}
                    onChange={(e) => setSupplierFilterCentral(e.target.value === '' ? '' : Number(e.target.value))}
                    className="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm min-w-[180px]"
                  >
                    <option value="">Todos</option>
                    {uniqueSuppliersCentral.map((s) => (
                      <option key={s.id ?? 0} value={String(s.id ?? '')}>{s.nome || `Fornecedor #${s.id}`}</option>
                    ))}
                  </select>
                </div>
                <label className="flex items-center gap-2 text-slate-300 text-sm">
                  Portes (€): <input type="number" step="0.01" value={portesCentral} onChange={(e) => setPortesCentral(Number(e.target.value) || 0)} className="w-20 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white" />
                </label>
                <label className="flex items-center gap-2 text-slate-300 text-sm">
                  IVA (%): <input type="number" step="0.01" value={taxaIvaCentral} onChange={(e) => setTaxaIvaCentral(Number(e.target.value) || 0)} className="w-16 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white" />
                </label>
                <button
                  onClick={handleConsolidate}
                  disabled={consolidating || selectedCentralIds.size === 0}
                  className="px-4 py-2 rounded-lg bg-amber-600 text-white font-medium disabled:opacity-50 flex items-center gap-2"
                >
                  {consolidating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Gerar Compras por Empresa ({selectedCentralIds.size} itens)
                </button>
              </div>
              {numPosToCreate > 0 && selectedCentralIds.size > 0 && (
                <div className="mb-4 px-4 py-2 rounded-lg bg-amber-900/30 text-amber-300 text-sm">
                  Serão geradas <strong>{numPosToCreate}</strong> Ordem(ns) de Compra separadas para faturação correta (uma por empresa + fornecedor).
                </div>
              )}
              {consolidateMessage && (
                <div className={`mb-4 px-4 py-2 rounded-lg text-sm ${consolidateMessage.includes('criada') ? 'bg-emerald-900/30 text-emerald-400' : 'bg-red-900/30 text-red-400'}`}>
                  {consolidateMessage}
                </div>
              )}
              {loadingCentral ? (
                <div className="flex items-center justify-center py-12 text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin mr-2" /> A carregar...
                </div>
              ) : centralPending.length === 0 ? (
                <p className="text-slate-400 text-center py-8">Nenhum item pendente com mapping (pending_purchase_items). Importe vendas para gerar necessidades de compra.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left py-2 px-2"><input type="checkbox" checked={selectedCentralIds.size === centralPending.length} onChange={toggleCentralSelectAll} className="rounded" /></th>
                        <th className="text-left py-2 px-2 text-slate-300 font-semibold">Empresa</th>
                        <th className="text-left py-2 px-2 text-slate-300 font-semibold">Fornecedor</th>
                        <th className="text-right py-2 px-2 text-slate-300 font-semibold">Score</th>
                        <th className="text-left py-2 px-2 text-slate-300 font-semibold">SKU</th>
                        <th className="text-right py-2 px-2 text-slate-300 font-semibold">Qtd</th>
                        <th className="text-right py-2 px-2 text-slate-300 font-semibold">Custo base</th>
                        <th className="text-right py-2 px-2 text-slate-300 font-semibold">Lucro previsto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {centralPending.map((p) => (
                        <tr key={p.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                          <td className="py-2 px-2"><input type="checkbox" checked={selectedCentralIds.has(p.id)} onChange={() => toggleCentralSelect(p.id)} className="rounded" /></td>
                          <td className="py-2 px-2 text-slate-300">{p.empresa_nome ?? '—'}</td>
                          <td className="py-2 px-2 text-slate-400">{p.supplier_nome ?? '—'}</td>
                          <td className="py-2 px-2 text-right">
                            {p.supplier_id != null && supplierHealthMap[p.supplier_id] != null ? (
                              <span className={`font-medium ${supplierHealthMap[p.supplier_id] >= 70 ? 'text-emerald-400' : supplierHealthMap[p.supplier_id] >= 40 ? 'text-amber-400' : 'text-red-400'}`}>
                                {supplierHealthMap[p.supplier_id].toFixed(0)}
                              </span>
                            ) : '—'}
                          </td>
                          <td className="py-2 px-2 text-slate-200">{p.sku_supplier ?? p.sku_marketplace ?? '—'}</td>
                          <td className="py-2 px-2 text-right text-slate-300">{p.quantity}</td>
                          <td className="py-2 px-2 text-right text-slate-400">{formatCurrency(p.cost_price_base)}</td>
                          <td className="py-2 px-2 text-right text-emerald-400">{p.expected_profit != null ? formatCurrency(p.expected_profit) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="global" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-amber-400" />
                Vista de consolidação (todas as empresas)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4 mb-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Fornecedor</label>
                  <select
                    value={supplierFilter}
                    onChange={(e) => setSupplierFilter(e.target.value === '' ? '' : Number(e.target.value))}
                    className="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm min-w-[180px]"
                  >
                    <option value="">Todos</option>
                    {uniqueSuppliers.map((s) => (
                      <option key={s.id ?? 0} value={String(s.id ?? '')}>{s.nome || `Fornecedor #${s.id}`}</option>
                    ))}
                  </select>
                </div>
                <label className="flex items-center gap-2 text-slate-300 text-sm">
                  Portes (€): <input type="number" step="0.01" value={portesGlobal} onChange={(e) => setPortesGlobal(Number(e.target.value) || 0)} className="w-20 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white" />
                </label>
                <label className="flex items-center gap-2 text-slate-300 text-sm">
                  IVA (%): <input type="number" step="0.01" value={taxaIvaGlobal} onChange={(e) => setTaxaIvaGlobal(Number(e.target.value) || 0)} className="w-16 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white" />
                </label>
                <button
                  onClick={handlePrepareBulk}
                  disabled={preparing || selectedGlobalIds.size === 0}
                  className="px-4 py-2 rounded-lg bg-amber-600 text-white font-medium disabled:opacity-50 flex items-center gap-2"
                >
                  {preparing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Preparar Compras ({selectedGlobalIds.size} selecionadas)
                </button>
              </div>
              {prepareMessage && (
                <div className={`mb-4 px-4 py-2 rounded-lg text-sm ${prepareMessage.includes('criada') ? 'bg-emerald-900/30 text-emerald-400' : 'bg-red-900/30 text-red-400'}`}>
                  {prepareMessage}
                </div>
              )}
              {loadingGlobal ? (
                <div className="flex items-center justify-center py-12 text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin mr-2" /> A carregar...
                </div>
              ) : globalPending.length === 0 ? (
                <p className="text-slate-400 text-center py-8">Nenhuma venda pendente com fornecedor mapeado.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left py-2 px-2"><input type="checkbox" checked={selectedGlobalIds.size === globalPending.length} onChange={toggleGlobalSelectAll} className="rounded" /></th>
                        <th className="text-left py-2 px-2 text-slate-300 font-semibold">Empresa</th>
                        <th className="text-left py-2 px-2 text-slate-300 font-semibold">Fornecedor</th>
                        <th className="text-left py-2 px-2 text-slate-300 font-semibold">N.º pedido</th>
                        <th className="text-left py-2 px-2 text-slate-300 font-semibold">SKU</th>
                        <th className="text-right py-2 px-2 text-slate-300 font-semibold">Qtd</th>
                        <th className="text-right py-2 px-2 text-slate-300 font-semibold">Custo</th>
                        <th className="text-right py-2 px-2 text-slate-300 font-semibold">Valor líquido</th>
                      </tr>
                    </thead>
                    <tbody>
                      {globalPending.map((p) => (
                        <tr key={p.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                          <td className="py-2 px-2"><input type="checkbox" checked={selectedGlobalIds.has(p.id)} onChange={() => toggleGlobalSelect(p.id)} className="rounded" /></td>
                          <td className="py-2 px-2 text-slate-300">{p.empresa_nome ?? '—'}</td>
                          <td className="py-2 px-2 text-slate-400">{p.supplier_nome ?? '—'}</td>
                          <td className="py-2 px-2 text-slate-200">{p.numero_pedido ?? `#${p.id}`}</td>
                          <td className="py-2 px-2 text-slate-400">{p.sku_fornecedor ?? p.sku_oferta ?? '—'}</td>
                          <td className="py-2 px-2 text-right text-slate-300">{p.quantidade ?? '—'}</td>
                          <td className="py-2 px-2 text-right text-slate-400">{formatCurrency(p.custo_fornecedor ?? 0)}</td>
                          <td className="py-2 px-2 text-right text-slate-300">{formatCurrency(p.valor_transferido_loja ?? 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pendentes" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5 text-amber-400" />
                Vendas ainda sem ordem de compra
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingPending ? (
                <div className="flex items-center justify-center py-12 text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin mr-2" />
                  A carregar...
                </div>
              ) : pending.length === 0 ? (
                <p className="text-slate-400 text-center py-8">
                  Não há vendas pendentes. Todas as vendas já têm ordem de compra associada ou não existem vendas.
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-4 mb-4">
                    <label className="flex items-center gap-2 text-slate-300 text-sm">
                      Portes totais (€):
                      <input
                        type="number"
                        step="0.01"
                        value={portes}
                        onChange={(e) => setPortes(Number(e.target.value) || 0)}
                        className="w-24 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white"
                      />
                    </label>
                    <label className="flex items-center gap-2 text-slate-300 text-sm">
                      IVA (%):
                      <input
                        type="number"
                        step="0.01"
                        value={taxaIva}
                        onChange={(e) => setTaxaIva(Number(e.target.value) || 0)}
                        className="w-20 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white"
                      />
                    </label>
                    <button
                      onClick={handleCreateOrder}
                      disabled={creating || selectedIds.size === 0}
                      className="px-4 py-2 rounded-lg bg-amber-600 text-white font-medium disabled:opacity-50 flex items-center gap-2"
                    >
                      {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      Criar ordem de compra ({selectedIds.size} selecionadas)
                    </button>
                  </div>
                  {createMessage && (
                    <div className={`mb-4 px-4 py-2 rounded-lg ${createMessage.startsWith('Ordem') ? 'bg-emerald-900/30 text-emerald-400' : 'bg-red-900/30 text-red-400'}`}>
                      {createMessage}
                    </div>
                  )}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-700">
                          <th className="text-left py-2 px-2">
                            <input type="checkbox" checked={selectedIds.size === pending.length} onChange={toggleSelectAll} className="rounded" />
                          </th>
                          <th className="text-left py-2 px-2 text-slate-300 font-semibold">N.º pedido</th>
                          <th className="text-left py-2 px-2 text-slate-300 font-semibold">Data</th>
                          <th className="text-left py-2 px-2 text-slate-300 font-semibold">SKU</th>
                          <th className="text-right py-2 px-2 text-slate-300 font-semibold">Qtd</th>
                          <th className="text-right py-2 px-2 text-slate-300 font-semibold">Valor líquido</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pending.map((p) => (
                          <tr key={p.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                            <td className="py-2 px-2">
                              <input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleSelect(p.id)} className="rounded" />
                            </td>
                            <td className="py-2 px-2 text-slate-200">{p.numero_pedido ?? `#${p.id}`}</td>
                            <td className="py-2 px-2 text-slate-400">{formatDate(p.data_criacao)}</td>
                            <td className="py-2 px-2 text-slate-400">{p.sku_oferta ?? '—'}</td>
                            <td className="py-2 px-2 text-right text-slate-300">{p.quantidade ?? '—'}</td>
                            <td className="py-2 px-2 text-right text-slate-300">{formatCurrency(p.valor_transferido_loja ?? 0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="checkout" className="mt-6">
          {drafts.length > 0 && (
            <Card className="mb-6 border-amber-500/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-400">
                  <ShoppingCart className="w-5 h-5" />
                  POs em Draft — Checkout sequencial
                </CardTitle>
                <p className="text-slate-400 text-sm mt-1">{draftsTotal} ordem(ns) pronta(s) para executar no site do fornecedor. Use o Wizard abaixo para copiar itens e dados fiscais.</p>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto mb-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left py-2 px-2 text-slate-300 font-semibold">PO</th>
                        <th className="text-left py-2 px-2 text-slate-300 font-semibold">Empresa</th>
                        <th className="text-left py-2 px-2 text-slate-300 font-semibold">Fornecedor</th>
                        <th className="text-left py-2 px-2 text-slate-300 font-semibold">NE Fornecedor</th>
                        <th className="text-right py-2 px-2 text-slate-300 font-semibold">Total</th>
                        <th className="text-right py-2 px-2 text-slate-300 font-semibold">Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {drafts.slice(0, 20).map((po) => (
                        <tr key={po.id} className="border-b border-slate-800">
                          <td className="py-2 px-2 text-slate-200 font-medium">#{po.id}</td>
                          <td className="py-2 px-2 text-slate-400">{po.empresa_nome ?? '—'}</td>
                          <td className="py-2 px-2 text-slate-400">{po.supplier_nome ?? '—'}</td>
                          <td className="py-2 px-2">
                            {po.supplier_order_id
                              ? <span className="font-mono text-xs text-amber-300">{po.supplier_order_id}</span>
                              : <span className="text-slate-600 text-xs">—</span>}
                          </td>
                          <td className="py-2 px-2 text-right text-amber-400">{formatCurrency(po.total_final)}</td>
                          <td className="py-2 px-2 text-right">
                            <div className="flex items-center justify-end gap-1 flex-wrap">
                              <button
                                type="button"
                                onClick={() => { setWizardPOIds([po.id]); setWizardStep(0); }}
                                className="px-2 py-1 rounded bg-amber-600 text-white text-xs hover:bg-amber-500"
                              >
                                Abrir Wizard
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button
                  type="button"
                  onClick={() => setWizardPOIds(drafts.map((d) => d.id))}
                  className="px-4 py-2 rounded-lg bg-amber-600 text-white font-medium hover:bg-amber-500 flex items-center gap-2"
                >
                  <ChevronRight className="w-4 h-4" /> Iniciar Wizard (todas as {drafts.length} POs em sequência)
                </button>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-amber-400" />
                Ordens de compra
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-4 items-end">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-400">Empresa</label>
                  <select
                    value={checkoutEmpresaId}
                    onChange={(e) => setCheckoutEmpresaId(e.target.value ? Number(e.target.value) : '')}
                    className="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm"
                  >
                    <option value="">— Todas as empresas —</option>
                    {empresasList.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-400">Estado</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm"
                  >
                    <option value="">Todos os estados</option>
                    <option value="Draft">Rascunho</option>
                    <option value="Ordered">Encomendado</option>
                    <option value="Paid">Pago</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-400">Data início</label>
                  <input
                    type="date"
                    value={checkoutDataInicio}
                    onChange={(e) => setCheckoutDataInicio(e.target.value)}
                    className="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-400">Data fim</label>
                  <input
                    type="date"
                    value={checkoutDataFim}
                    onChange={(e) => setCheckoutDataFim(e.target.value)}
                    className="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-400">Fornecedor</label>
                  <select
                    value={checkoutFornecedorFilter}
                    onChange={(e) => setCheckoutFornecedorFilter(e.target.value)}
                    className="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm"
                  >
                    <option value="">Todos</option>
                    {uniqueCheckoutSuppliers.map((s) => (
                      <option key={s.id} value={String(s.id)}>{s.nome || `Fornecedor #${s.id}`}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-400">Nº encomenda forn.</label>
                  <input
                    type="text"
                    placeholder="Ex: ES-20240112"
                    value={checkoutSupplierOrderIdFilter}
                    onChange={(e) => setCheckoutSupplierOrderIdFilter(e.target.value)}
                    className="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm w-40"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-400">PO ID</label>
                  <input
                    type="text"
                    placeholder="Ex: 42"
                    value={checkoutPoIdFilter}
                    onChange={(e) => setCheckoutPoIdFilter(e.target.value)}
                    className="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm w-24"
                  />
                </div>
                {(checkoutEmpresaId !== '' || statusFilter || checkoutDataInicio || checkoutDataFim || checkoutFornecedorFilter || checkoutSupplierOrderIdFilter || checkoutPoIdFilter) && (
                  <button
                    type="button"
                    onClick={() => { setCheckoutEmpresaId(''); setStatusFilter(''); setCheckoutDataInicio(''); setCheckoutDataFim(''); setCheckoutFornecedorFilter(''); setCheckoutSupplierOrderIdFilter(''); setCheckoutPoIdFilter(''); }}
                    className="px-3 py-2 rounded bg-slate-700 text-slate-400 hover:text-white text-xs self-end"
                  >
                    Limpar filtros
                  </button>
                )}
                <span className="text-xs text-slate-500 self-end pb-2 ml-auto">{filteredOrders.length} / {totalOrders} PO(s)</span>
              </div>
              {loadingOrders ? (
                <div className="flex items-center justify-center py-12 text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin mr-2" />
                  A carregar...
                </div>
              ) : orders.length === 0 ? (
                <p className="text-slate-400 text-center py-8">Nenhuma ordem de compra.</p>
              ) : filteredOrders.length === 0 ? (
                <p className="text-slate-400 text-center py-8">Nenhuma PO corresponde aos filtros.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left py-2 px-2 text-slate-300 font-semibold">ID</th>
                        <th className="text-left py-2 px-2 text-slate-300 font-semibold">Order ID (Venda)</th>
                        <th className="text-left py-2 px-2 text-slate-300 font-semibold">Nº Enc. Forn.</th>
                        <th className="text-left py-2 px-2 text-slate-300 font-semibold">Fornecedor</th>
                        <th className="text-left py-2 px-2 text-slate-300 font-semibold">Estado</th>
                        <th className="text-left py-2 px-2 text-slate-300 font-semibold">Data</th>
                        <th className="text-right py-2 px-2 text-slate-300 font-semibold">Total</th>
                        <th className="text-right py-2 px-2 text-slate-300 font-semibold">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOrders.map((po) => (
                        <tr key={po.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                          <td className="py-2 px-2 text-slate-200 font-medium">#{po.id}</td>
                          <td className="py-2 px-2">
                            {po.order_refs
                              ? <span className="font-mono text-xs text-sky-400">{po.order_refs}</span>
                              : <span className="text-slate-600 text-xs">—</span>}
                          </td>
                          <td className="py-2 px-2">
                            {po.supplier_order_id
                              ? <span className="font-mono text-xs text-amber-300">{po.supplier_order_id}</span>
                              : <span className="text-slate-600 text-xs">—</span>}
                          </td>
                          <td className="py-2 px-2 text-slate-400">{po.supplier_nome ?? '—'}</td>
                          <td className="py-2 px-2">
                            <span className={`px-2 py-0.5 rounded text-xs ${
                              po.status === 'Paid' ? 'bg-emerald-900/50 text-emerald-400' :
                              po.status === 'Ordered' ? 'bg-blue-900/50 text-blue-400' : 'bg-slate-600 text-slate-300'
                            }`}>
                              {po.status}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-slate-400">{formatDate(po.data_criacao)}</td>
                          <td className="py-2 px-2 text-right text-amber-400 font-medium">{formatCurrency(po.total_final)}</td>
                          <td className="py-2 px-2 text-right">
                            <div className="flex items-center justify-end gap-1 flex-wrap">
                              {po.status !== 'Draft' && (
                                <button
                                  type="button"
                                  onClick={() => openViewPo(po.id)}
                                  className="p-1.5 rounded bg-slate-600 text-slate-200 hover:bg-slate-500 flex items-center gap-1 text-xs"
                                  title="Visualizar nota de encomenda (imprimir/guardar PDF)"
                                >
                                  <Eye className="w-4 h-4" /> Visualizar PO
                                </button>
                              )}
                              <button
                                onClick={() => handleExport(po.id)}
                                className="p-1.5 rounded bg-slate-700 text-slate-300 hover:bg-slate-600"
                                title="Exportar CSV"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                              {po.status === 'Draft' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => { setWizardPOIds([po.id]); setWizardStep(0); }}
                                    className="p-1.5 rounded bg-amber-700 text-white hover:bg-amber-600 flex items-center gap-1 text-xs"
                                    title="Abrir para editar (quantidades, custos, fornecedor)"
                                  >
                                    <Pencil className="w-4 h-4" /> Editar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeletePo(po.id)}
                                    className="p-1.5 rounded bg-red-900/60 text-red-300 hover:bg-red-800/60 flex items-center gap-1 text-xs"
                                    title="Apagar PO (itens removidos; vendas não alteradas)"
                                  >
                                    <Trash2 className="w-4 h-4" /> Apagar
                                  </button>
                                  <button
                                    onClick={() => handleUpdateStatus(po.id, 'Ordered')}
                                    disabled={updatingId === po.id}
                                    className="p-1.5 rounded bg-blue-700 text-white hover:bg-blue-600 disabled:opacity-50 flex items-center gap-1 text-xs"
                                    title="Marcar como encomendado (pedido feito ao fornecedor)"
                                  >
                                    {updatingId === po.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                                    Encomendado
                                  </button>
                                </>
                              )}
                              {po.status === 'Ordered' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateStatus(po.id, 'Draft')}
                                    disabled={updatingId === po.id}
                                    className="p-1.5 rounded bg-slate-600 text-slate-200 hover:bg-slate-500 disabled:opacity-50 flex items-center gap-1 text-xs"
                                    title="Reverter para rascunho para editar ou apagar"
                                  >
                                    {updatingId === po.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Undo2 className="w-4 h-4" />}
                                    Reverter para rascunho
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setFinancasNavigation({ tab: 'pagamentos' });
                                      setModuloSelecionado(MODULO_FINANCAS);
                                    }}
                                    className="p-1.5 rounded bg-amber-600 text-white hover:bg-amber-500 flex items-center gap-1 text-xs"
                                    title="Ir para Finanças > Pagamentos (pendentes) para confirmar e conciliar pagamento"
                                  >
                                    <ExternalLink className="w-4 h-4" />
                                    Ir para Pagamentos
                                  </button>
                                </>
                              )}
                              {po.status === 'Paid' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFinancasNavigation({ tab: 'ledger', supplierId: po.supplier_id ?? undefined });
                                    setModuloSelecionado(MODULO_FINANCAS);
                                  }}
                                  className="p-1.5 rounded bg-slate-600 text-white hover:bg-slate-500 flex items-center gap-1 text-xs"
                                  title="Ver conta corrente do fornecedor em Finanças"
                                >
                                  <BookOpen className="w-4 h-4" />
                                  Ver na Conta Corrente
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Tracking ─────────────────────────────────────── */}
        <TabsContent value="tracking" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-amber-400" />
                Tracking de encomendas
              </CardTitle>
              <p className="text-slate-400 text-sm mt-1">
                Ordens de compra com número de rastreio e estado logístico por artigo.
              </p>
            </CardHeader>
            <CardContent>
              {loadingTracking ? (
                <div className="flex items-center justify-center py-12 text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin mr-2" /> A carregar...
                </div>
              ) : trackingOrders.length === 0 ? (
                <p className="text-slate-400 text-center py-8">
                  Nenhuma ordem de compra com tracking disponível.
                </p>
              ) : (
                <div className="space-y-3">
                  {trackingOrders.map((po) => (
                    <div key={po.id} className="rounded-lg border border-slate-700 bg-slate-800/40">
                      <button
                        type="button"
                        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-800/60 transition-colors"
                        onClick={() => {
                          if (expandedTrackingPo === po.id) {
                            setExpandedTrackingPo(null);
                          } else {
                            setExpandedTrackingPo(po.id);
                            if (!trackingDetail[po.id]) {
                              purchasesApi.getCheckoutDetail(po.id)
                                .then((d) => setTrackingDetail((prev) => ({ ...prev, [po.id]: d })))
                                .catch(() => {});
                            }
                          }
                        }}
                      >
                        <div className="flex items-center gap-4 flex-wrap">
                          <span className="text-slate-200 font-medium">PO #{po.id}</span>
                          <span className="text-slate-400">{po.supplier_nome ?? '—'}</span>
                          {po.tracking_number ? (
                            <span className="text-xs font-mono bg-slate-700 px-2 py-0.5 rounded text-amber-300">
                              {po.tracking_number}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-600 italic">sem tracking</span>
                          )}
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            po.status === 'Paid' ? 'bg-emerald-900/50 text-emerald-400' :
                            po.status === 'Ordered' ? 'bg-blue-900/50 text-blue-400' :
                            'bg-slate-600 text-slate-300'
                          }`}>{po.status}</span>
                        </div>
                        <ChevronRight className={`w-4 h-4 text-slate-500 transition-transform ${expandedTrackingPo === po.id ? 'rotate-90' : ''}`} />
                      </button>

                      {expandedTrackingPo === po.id && (
                        <div className="px-4 pb-4 border-t border-slate-700">
                          {!trackingDetail[po.id] ? (
                            <div className="flex items-center py-4 text-slate-400 text-sm gap-2">
                              <Loader2 className="w-4 h-4 animate-spin" /> A carregar artigos...
                            </div>
                          ) : (trackingDetail[po.id].items ?? []).length === 0 ? (
                            <p className="text-slate-400 text-sm py-4">Sem artigos registados nesta PO.</p>
                          ) : (
                            <table className="w-full text-sm mt-3">
                              <thead>
                                <tr className="border-b border-slate-700">
                                  <th className="text-left py-2 px-2 text-slate-400 font-medium">SKU</th>
                                  <th className="text-right py-2 px-2 text-slate-400 font-medium">Qtd pedida</th>
                                  <th className="text-right py-2 px-2 text-slate-400 font-medium">Qtd recebida</th>
                                  <th className="text-left py-2 px-2 text-slate-400 font-medium">Estado logístico</th>
                                  <th className="text-left py-2 px-2 text-slate-400 font-medium">N.º pedido MP</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(trackingDetail[po.id].items ?? []).map((item, idx) => (
                                  <tr key={idx} className="border-b border-slate-800 hover:bg-slate-800/40">
                                    <td className="py-2 px-2 text-slate-200 font-mono text-xs">{item.sku_fornecedor ?? item.sku_marketplace ?? '—'}</td>
                                    <td className="py-2 px-2 text-right text-slate-300">{item.quantidade}</td>
                                    <td className="py-2 px-2 text-right text-slate-300">{(item as any).quantidade_recebida ?? '—'}</td>
                                    <td className="py-2 px-2">
                                      <LogBadge status={(item as any).logistics_status ?? 'pending_receipt'} />
                                    </td>
                                    <td className="py-2 px-2 text-slate-400 text-xs">{(item as any).external_order_id ?? '—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>

      {/* Modal: Visualizar PO / Nota de encomenda (imprimir ou guardar PDF a partir daqui) */}
      {viewPoId != null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={closeViewPo}>
          <div
            className="bg-slate-900 border border-slate-700 rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-slate-900">
              <span className="text-slate-200 font-medium">Nota de encomenda #{viewPoId}</span>
              <button
                type="button"
                onClick={closeViewPo}
                className="p-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              {viewPoLoading ? (
                <div className="flex items-center justify-center py-16 text-slate-400">
                  <Loader2 className="w-8 h-8 animate-spin mr-2" />
                  A carregar...
                </div>
              ) : viewPoDetail ? (
                <DigitalOrderPreview data={viewPoDetail} />
              ) : (
                <p className="py-8 text-center text-slate-400">Não foi possível carregar os detalhes da ordem de compra.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
