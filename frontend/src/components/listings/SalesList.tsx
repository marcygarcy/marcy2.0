'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { TrendingUp, ShoppingCart, Loader2, DollarSign, Package, BarChart3, BarChart2, List, ChevronDown, Upload, Globe, CheckCircle, FileText, XCircle, X, ExternalLink, Download, ShoppingBag, Truck, User, TrendingDown, AlertTriangle } from 'lucide-react';
import { salesApi, type OrderWithMargin, type SalesMetrics, type TopProduct, type SalesOrderListItem, type SalesStats, type RecentWithMarginItem, type SalesOrderDetail, type SalesKpisResponse } from '@/lib/api/sales';
import { billingApi, type ProformaData } from '@/lib/api/billing';
import { ProformaPreview } from '@/components/billing/ProformaPreview';
import { ordersApi, type Order } from '@/lib/api/orders';
import { empresasApi, type Empresa } from '@/lib/api/empresas';
import { marketplacesApi, type Marketplace } from '@/lib/api/marketplaces';
import { useApp } from '@/context/AppContext';
import { formatCurrency } from '@/lib/utils';
import { Dropdown } from '@/components/ui/dropdown';
import { EstadoVendasView } from './EstadoVendasView';

const LIMIT = 50;

type ListagemSubTipo = 'vendas-margem' | 'orders';

export function SalesList() {
  const { empresaSelecionada, marketplaceSelecionado } = useApp();
  const [activeTab, setActiveTab] = useState<'kpis' | 'listagens' | 'explorer' | 'estado'>('kpis');
  const [listagemSubTipo, setListagemSubTipo] = useState<ListagemSubTipo>('vendas-margem');
  const [orders, setOrders] = useState<OrderWithMargin[]>([]);
  const [ordersSimples, setOrdersSimples] = useState<Order[]>([]);
  const [totalOrdersSimples, setTotalOrdersSimples] = useState(0);
  const [pageOrders, setPageOrders] = useState(0);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [metrics, setMetrics] = useState<SalesMetrics | null>(null);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [dataInicio, setDataInicio] = useState<string>('');
  const [dataFim, setDataFim] = useState<string>('');

  // KPIs por ano/mês (sales_orders)
  const now = new Date();
  const [kpisAno, setKpisAno] = useState(now.getFullYear());
  const [kpisMes, setKpisMes] = useState(now.getMonth() + 1);
  const [salesKpis, setSalesKpis] = useState<SalesKpisResponse | null>(null);
  const [kpisLoading, setKpisLoading] = useState(false);

  // Sales Explorer (módulo sales_orders: import, list, stats)
  const [salesStats, setSalesStats] = useState<SalesStats | null>(null);
  const [salesListItems, setSalesListItems] = useState<SalesOrderListItem[]>([]);
  const [salesListTotal, setSalesListTotal] = useState(0);
  const [salesListPage, setSalesListPage] = useState(0);
  const [salesListLoading, setSalesListLoading] = useState(false);
  const [explorerCountry, setExplorerCountry] = useState('');
  const [explorerStatus, setExplorerStatus] = useState('');
  const [explorerSemProformaOnly, setExplorerSemProformaOnly] = useState(false);
  const [explorerEmpresaId, setExplorerEmpresaId] = useState<number | ''>('');
  const [explorerMarketplaceId, setExplorerMarketplaceId] = useState<number | ''>('');
  const [explorerDataInicio, setExplorerDataInicio] = useState('');
  const [explorerDataFim, setExplorerDataFim] = useState('');
  const [empresasList, setEmpresasList] = useState<Empresa[]>([]);
  const [explorerMarketplaces, setExplorerMarketplaces] = useState<Marketplace[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [recentWithMargin, setRecentWithMargin] = useState<RecentWithMarginItem[]>([]);
  const [recentWithMarginLoading, setRecentWithMarginLoading] = useState(false);
  const [selectedSalesIds, setSelectedSalesIds] = useState<Set<number>>(new Set());
  const [proformaPreviewData, setProformaPreviewData] = useState<ProformaData | null>(null);
  const [proformaLoadingId, setProformaLoadingId] = useState<number | null>(null);
  const [bulkProformaLoading, setBulkProformaLoading] = useState(false);
  const [cancelModalRow, setCancelModalRow] = useState<SalesOrderListItem | null>(null);
  const [cancelReason, setCancelReason] = useState('Cliente cancelou');
  const [cancelSupplierAcceptsReturn, setCancelSupplierAcceptsReturn] = useState(false);
  const [cancelCreateCreditNote, setCancelCreateCreditNote] = useState(true);
  const [cancelLoading, setCancelLoading] = useState(false);

  // Drawer de detalhe
  const [drawerOrderId, setDrawerOrderId] = useState<number | null>(null);
  const [drawerDetail, setDrawerDetail] = useState<SalesOrderDetail | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);

  // Export Excel
  const [exportingExcel, setExportingExcel] = useState(false);

  const { setModuloSelecionado } = useApp();

  const openDrawer = async (id: number) => {
    setDrawerOrderId(id);
    setDrawerDetail(null);
    setDrawerLoading(true);
    try {
      const d = await salesApi.getOrderDetail(id);
      setDrawerDetail(d);
    } catch {
      setDrawerDetail(null);
    } finally {
      setDrawerLoading(false);
    }
  };

  const handleExport = async () => {
    setExportingExcel(true);
    try {
      const blob = await salesApi.exportSales({
        empresa_id: explorerEmpresaId !== '' ? Number(explorerEmpresaId) : undefined,
        marketplace_id: explorerMarketplaceId !== '' ? Number(explorerMarketplaceId) : undefined,
        customer_country: explorerCountry || undefined,
        status: explorerStatus || undefined,
        data_inicio: explorerDataInicio || undefined,
        data_fim: explorerDataFim || undefined,
        ids: selectedSalesIds.size > 0 ? Array.from(selectedSalesIds) : undefined,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vendas_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Erro ao exportar.');
    } finally {
      setExportingExcel(false);
    }
  };

  const empresaId = empresaSelecionada?.id ?? undefined;
  const marketplaceId = marketplaceSelecionado?.id ?? undefined;

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {
        empresa_id: empresaId,
        marketplace_id: marketplaceId,
        limit: LIMIT,
        offset: page * LIMIT,
      } as { empresa_id?: number; marketplace_id?: number; limit: number; offset: number; data_inicio?: string; data_fim?: string };
      if (dataInicio) params.data_inicio = dataInicio;
      if (dataFim) params.data_fim = dataFim;

      const [listSettled, metricsSettled, topSettled] = await Promise.allSettled([
        salesApi.getOrdersWithMargin(params),
        salesApi.getMetrics({ empresa_id: empresaId, marketplace_id: marketplaceId, data_inicio: dataInicio || undefined, data_fim: dataFim || undefined }),
        salesApi.getTopProducts({ empresa_id: empresaId, marketplace_id: marketplaceId, data_inicio: dataInicio || undefined, data_fim: dataFim || undefined, limit: 10 }),
      ]);
      const listRes = listSettled.status === 'fulfilled' ? listSettled.value : null;
      const metricsRes = metricsSettled.status === 'fulfilled' ? metricsSettled.value : null;
      const topRes = topSettled.status === 'fulfilled' ? topSettled.value : null;
      setOrders(listRes?.orders ?? []);
      setTotal(listRes?.total ?? 0);
      setMetrics(metricsRes ?? null);
      setTopProducts(topRes ?? []);
      setError(
        listSettled.status === 'rejected' && metricsSettled.status === 'rejected' && topSettled.status === 'rejected'
          ? 'Endpoints de vendas (orders/metrics/top-products) indisponíveis. Verifique o backend.'
          : null
      );
    } catch (err: any) {
      setError(err?.message || 'Erro ao carregar vendas.');
      setOrders([]);
      setTotal(0);
      setMetrics(null);
      setTopProducts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [empresaId, marketplaceId, page, dataInicio, dataFim]);

  const loadSalesKpis = async () => {
    setKpisLoading(true);
    try {
      const data = await salesApi.getSalesKpis({
        ano: kpisAno,
        mes: kpisMes,
        empresa_id: empresaId ?? undefined,
      });
      setSalesKpis(data);
    } catch {
      setSalesKpis(null);
    } finally {
      setKpisLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'kpis') loadSalesKpis();
  }, [activeTab, kpisAno, kpisMes, empresaId]);

  const loadOrdersSimples = async () => {
    if (listagemSubTipo !== 'orders') return;
    try {
      setLoadingOrders(true);
      const res = await ordersApi.getAll(empresaId, marketplaceId, LIMIT, pageOrders * LIMIT);
      setOrdersSimples(res.orders);
      setTotalOrdersSimples(res.total);
    } catch (err: any) {
      setError(err?.message || 'Erro ao carregar orders');
    } finally {
      setLoadingOrders(false);
    }
  };

  useEffect(() => {
    loadOrdersSimples();
  }, [listagemSubTipo, empresaId, marketplaceId, pageOrders]);

  const loadRecentWithMargin = async (empresaIdParam?: number | null) => {
    setRecentWithMarginLoading(true);
    try {
      const eid = empresaIdParam ?? empresaId ?? undefined;
      const data = await salesApi.getRecentWithMargin({ empresa_id: eid ?? undefined, limit: 100 });
      setRecentWithMargin(data);
    } catch {
      setRecentWithMargin([]);
    } finally {
      setRecentWithMarginLoading(false);
    }
  };

  const explorerEffectiveEmpresaId = (explorerEmpresaId || empresaSelecionada?.id) ?? null;
  const explorerEffectiveMarketplaceId = (explorerMarketplaceId || marketplaceSelecionado?.id) ?? undefined;
  const explorerEffectiveDataInicio = explorerDataInicio || dataInicio || undefined;
  const explorerEffectiveDataFim = explorerDataFim || dataFim || undefined;

  const loadSalesExplorer = async () => {
    setSalesListLoading(true);
    try {
      const [statsSettled, listSettled] = await Promise.allSettled([
        salesApi.getSalesStats({
          empresa_id: explorerEffectiveEmpresaId ?? undefined,
          marketplace_id: explorerEffectiveMarketplaceId,
          data_inicio: explorerEffectiveDataInicio,
          data_fim: explorerEffectiveDataFim,
        }),
        salesApi.getSalesList({
          empresa_id: explorerEffectiveEmpresaId ?? undefined,
          marketplace_id: explorerEffectiveMarketplaceId,
          customer_country: explorerCountry || undefined,
          status: explorerStatus || undefined,
          data_inicio: explorerEffectiveDataInicio,
          data_fim: explorerEffectiveDataFim,
          only_without_proforma: explorerSemProformaOnly || undefined,
          limit: LIMIT,
          offset: salesListPage * LIMIT,
        }),
      ]);
      const statsRes = statsSettled.status === 'fulfilled' ? statsSettled.value : null;
      const listRes = listSettled.status === 'fulfilled' ? listSettled.value : null;
      setSalesStats(statsRes ?? null);
      setSalesListItems(listRes?.items ?? []);
      setSalesListTotal(listRes?.total ?? 0);
      if (explorerEffectiveEmpresaId != null) {
        loadRecentWithMargin(explorerEffectiveEmpresaId);
      }
    } catch (_) {
      setSalesStats(null);
      setSalesListItems([]);
      setSalesListTotal(0);
    } finally {
      setSalesListLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'explorer') {
      loadSalesExplorer();
    }
  }, [activeTab, explorerEffectiveEmpresaId, explorerEffectiveMarketplaceId, explorerEffectiveDataInicio, explorerEffectiveDataFim, explorerCountry, explorerStatus, explorerSemProformaOnly, salesListPage]);

  useEffect(() => {
    if (activeTab !== 'explorer') return;
    let cancelled = false;
    empresasApi.getAll().then((list) => { if (!cancelled) setEmpresasList(Array.isArray(list) ? list : []); }).catch(() => { if (!cancelled) setEmpresasList([]); });
    return () => { cancelled = true; };
  }, [activeTab]);

  useEffect(() => {
    const eid = explorerEmpresaId || empresaSelecionada?.id;
    if (eid == null || typeof eid !== 'number') {
      setExplorerMarketplaces([]);
      return;
    }
    let cancelled = false;
    marketplacesApi.getByEmpresa(eid).then((list) => { if (!cancelled) setExplorerMarketplaces(Array.isArray(list) ? list : []); }).catch(() => { if (!cancelled) setExplorerMarketplaces([]); });
    return () => { cancelled = true; };
  }, [explorerEmpresaId, empresaSelecionada?.id]);

  const handleImportSales = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const eid = explorerEffectiveEmpresaId ?? empresaId;
    if (!file || eid == null) return;
    setImportLoading(true);
    setImportMessage(null);
    try {
      const res = await salesApi.importSales(file, eid, explorerEffectiveMarketplaceId ?? undefined);
      if (res.success) {
        setImportMessage(`Importados ${res.sales_orders_created} pedidos, ${res.sales_order_items_created} linhas. ${res.orders_trigger_created} itens para compras.`);
        loadSalesExplorer();
      } else {
        setImportMessage(res.error || 'Erro na importação.');
      }
    } catch (err: any) {
      setImportMessage(err?.message || 'Erro na importação.');
    } finally {
      setImportLoading(false);
      e.target.value = '';
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const renderMargem = (val: number | null) => {
    if (val == null) return <span className="text-slate-500">—</span>;
    const isPositive = val >= 0;
    return (
      <span className={isPositive ? 'text-emerald-400 font-medium' : 'text-red-400 font-medium'}>
        {formatCurrency(val)}
      </span>
    );
  };

  if (loading && orders.length === 0) {
    return (
      <div className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              Vendas e Margem (Dropshipping)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
              <span className="ml-3 text-slate-400">A carregar...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-6">
      {/* Filtros (comum a KPIs e Listagens) */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Data início</label>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Data fim</label>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Barra de abas: KPIs | Sales Explorer | Estado das vendas | Listagens */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'kpis' | 'listagens' | 'explorer' | 'estado')}>
        <TabsList className="bg-slate-800 border border-slate-600">
          <TabsTrigger value="kpis" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
            <BarChart3 className="w-4 h-4 mr-2" />
            KPIs
          </TabsTrigger>
          <TabsTrigger value="explorer" className="data-[state=active]:bg-amber-600 data-[state=active]:text-white">
            <Globe className="w-4 h-4 mr-2" />
            Sales Explorer
          </TabsTrigger>
          <TabsTrigger value="estado" className="data-[state=active]:bg-amber-600 data-[state=active]:text-white">
            <BarChart2 className="w-4 h-4 mr-2" />
            Estado das vendas
          </TabsTrigger>
          <div className="relative inline-block">
            <Dropdown
              trigger={
                <button
                  onClick={() => setActiveTab('listagens')}
                  className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                    activeTab === 'listagens'
                      ? 'bg-emerald-600 text-white shadow-lg'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  <List className="w-4 h-4" />
                  <span>Listagens</span>
                  <ChevronDown className="w-4 h-4" />
                </button>
              }
              items={[
                { value: 'orders', label: 'Orders', icon: '🛒' },
                { value: 'vendas-margem', label: 'Vendas com margem', icon: '📊' },
              ]}
              onSelect={(value) => {
                setActiveTab('listagens');
                setListagemSubTipo(value as ListagemSubTipo);
              }}
              selectedValue={listagemSubTipo}
            />
          </div>
        </TabsList>

        {/* Aba KPIs (ano/mês, vendas acumuladas, mês, orders por estado, top 10, marketplaces) */}
        <TabsContent value="kpis" className="mt-6 space-y-6">
          <div className="flex flex-wrap items-center gap-4 mb-4">
            <label className="flex items-center gap-2 text-slate-400 text-sm">
              Ano
              <select
                value={kpisAno}
                onChange={(e) => setKpisAno(Number(e.target.value))}
                className="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm"
              >
                {[now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-slate-400 text-sm">
              Mês
              <select
                value={kpisMes}
                onChange={(e) => setKpisMes(Number(e.target.value))}
                className="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                  <option key={m} value={m}>
                    {new Date(2000, m - 1, 1).toLocaleDateString('pt-PT', { month: 'long' })}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {kpisLoading ? (
            <div className="flex items-center justify-center py-12 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin mr-2" /> A carregar KPIs...
            </div>
          ) : salesKpis ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 text-slate-400 text-sm">
                      <DollarSign className="w-4 h-4" />
                      Vendas acumuladas (ano até fim do mês)
                    </div>
                    <p className="text-xl font-semibold text-white mt-1">{formatCurrency(salesKpis.vendas_acumuladas)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 text-slate-400 text-sm">
                      <TrendingUp className="w-4 h-4" />
                      Vendas do mês
                    </div>
                    <p className="text-xl font-semibold text-emerald-400 mt-1">{formatCurrency(salesKpis.vendas_mes)}</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Orders no mês (por estado)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-600">
                      <p className="text-slate-500 text-xs uppercase">Ativas</p>
                      <p className="text-lg font-semibold text-white">{salesKpis.total_orders_ativas}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-emerald-900/30 border border-emerald-700/50">
                      <p className="text-slate-500 text-xs uppercase">Concluídas</p>
                      <p className="text-lg font-semibold text-emerald-400">{salesKpis.orders_concluidas}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-amber-900/30 border border-amber-700/50">
                      <p className="text-slate-500 text-xs uppercase">Pendentes</p>
                      <p className="text-lg font-semibold text-amber-400">{salesKpis.orders_pendentes}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-red-900/30 border border-red-700/50">
                      <p className="text-slate-500 text-xs uppercase">Canceladas</p>
                      <p className="text-lg font-semibold text-red-400">{salesKpis.orders_canceladas}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-700/50 border border-slate-600">
                      <p className="text-slate-500 text-xs uppercase">Reembolsadas</p>
                      <p className="text-lg font-semibold text-slate-300">{salesKpis.orders_reembolsadas}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Marketplace com maior volume (€)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-lg font-semibold text-white">{salesKpis.marketplace_maior_volume.nome}</p>
                    <p className="text-2xl font-bold text-amber-400 mt-1">{formatCurrency(salesKpis.marketplace_maior_volume.volume ?? 0)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Marketplace com mais orders</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-lg font-semibold text-white">{salesKpis.marketplace_mais_orders.nome}</p>
                    <p className="text-2xl font-bold text-sky-400 mt-1">{salesKpis.marketplace_mais_orders.num_orders ?? 0} orders</p>
                  </CardContent>
                </Card>
              </div>

              {salesKpis.top_10_produtos.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Package className="w-5 h-5 text-emerald-400" />
                      Top 10 produtos mais vendidos (mês)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-700">
                            <th className="text-left py-2 px-2 text-slate-300 font-semibold">SKU</th>
                            <th className="text-left py-2 px-2 text-slate-300 font-semibold">Produto</th>
                            <th className="text-right py-2 px-2 text-slate-300 font-semibold">Qtd vendida</th>
                            <th className="text-right py-2 px-2 text-slate-300 font-semibold">GMV</th>
                          </tr>
                        </thead>
                        <tbody>
                          {salesKpis.top_10_produtos.map((p, i) => (
                            <tr key={p.sku + i} className="border-b border-slate-800">
                              <td className="py-2 px-2 text-slate-300 font-mono text-xs">{p.sku || '—'}</td>
                              <td className="py-2 px-2 text-slate-400 max-w-[200px] truncate">{p.nome_produto || '—'}</td>
                              <td className="py-2 px-2 text-right text-slate-300">{p.quantidade_vendida?.toFixed(0)}</td>
                              <td className="py-2 px-2 text-right text-amber-300">{formatCurrency(p.gmv_produto)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <p className="text-slate-400 text-center py-8">Sem dados de KPIs para o período. Importe vendas no Sales Explorer.</p>
          )}
        </TabsContent>

        {/* Aba Estado das vendas (pipeline) */}
        <TabsContent value="estado" className="mt-6">
          <EstadoVendasView />
        </TabsContent>

        {/* Aba Listagens: conteúdo conforme opção do dropdown (Orders | Vendas com margem) */}
        <TabsContent value="listagens" className="mt-6">
          {listagemSubTipo === 'orders' ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-blue-400" />
                  Orders
                  {totalOrdersSimples > 0 && (
                    <span className="text-sm font-normal text-slate-400 ml-2">
                      ({totalOrdersSimples} {totalOrdersSimples === 1 ? 'registo' : 'registos'})
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {error && (
                  <div className="bg-red-900/20 border border-red-500 text-red-400 px-4 py-3 rounded-lg mb-4">
                    {error}
                  </div>
                )}
                {loadingOrders ? (
                  <div className="flex items-center justify-center py-12 text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mr-2" />
                    A carregar...
                  </div>
                ) : ordersSimples.length === 0 ? (
                  <div className="text-slate-400 text-center py-12">
                    Nenhum order encontrado. Ajuste o filtro empresa/marketplace ou faça upload de ficheiros de orders.
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-700 bg-slate-800/50">
                            <th className="text-left py-3 px-3 text-slate-300 font-semibold">Order ID</th>
                            <th className="text-left py-3 px-3 text-slate-300 font-semibold">Canal</th>
                            <th className="text-right py-3 px-3 text-slate-300 font-semibold">Valor</th>
                            <th className="text-left py-3 px-3 text-slate-300 font-semibold">EAN</th>
                            <th className="text-left py-3 px-3 text-slate-300 font-semibold">Estado</th>
                            <th className="text-left py-3 px-3 text-slate-300 font-semibold">País de Destino</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ordersSimples.map((o) => (
                            <tr key={o.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                              <td className="py-3 px-3 text-slate-200 font-medium">{o.numero_pedido || `#${o.id}`}</td>
                              <td className="py-3 px-3 text-slate-400">{o.canal_vendas || '—'}</td>
                              <td className="py-3 px-3 text-right text-slate-300">
                                {(o.valor_total_com_iva ?? o.valor ?? o.valor_total) != null
                                  ? formatCurrency(Number(o.valor_total_com_iva ?? o.valor ?? o.valor_total))
                                  : '—'}
                              </td>
                              <td className="py-3 px-3 text-slate-400">{o.sku_oferta || '—'}</td>
                              <td className="py-3 px-3 text-slate-400">{o.status || '—'}</td>
                              <td className="py-3 px-3 text-slate-400">{o.pais_faturamento || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {totalOrdersSimples > LIMIT && (
                      <div className="flex items-center justify-between mt-4">
                        <button
                          onClick={() => setPageOrders((p) => Math.max(0, p - 1))}
                          disabled={pageOrders === 0}
                          className="px-3 py-1 rounded bg-slate-700 text-slate-300 disabled:opacity-50"
                        >
                          Anterior
                        </button>
                        <span className="text-slate-400 text-sm">
                          {pageOrders * LIMIT + 1}–{Math.min((pageOrders + 1) * LIMIT, totalOrdersSimples)} de {totalOrdersSimples}
                        </span>
                        <button
                          onClick={() => setPageOrders((p) => p + 1)}
                          disabled={(pageOrders + 1) * LIMIT >= totalOrdersSimples}
                          className="px-3 py-1 rounded bg-slate-700 text-slate-300 disabled:opacity-50"
                        >
                          Seguinte
                        </button>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-blue-400" />
                  Tabela de Vendas com Margem
                  {total > 0 && (
                    <span className="text-sm font-normal text-slate-400 ml-2">
                      ({total} {total === 1 ? 'linha' : 'linhas'})
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {error && (
                  <div className="bg-red-900/20 border border-red-500 text-red-400 px-4 py-3 rounded-lg mb-4">
                    {error}
                  </div>
                )}

                {orders.length === 0 && !loading ? (
                  <div className="text-slate-400 text-center py-12">
                    Nenhuma venda encontrada. Ajuste os filtros ou faça upload de ficheiros de orders.
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm min-w-[900px]">
                        <thead>
                          <tr className="border-b border-slate-700">
                            <th className="text-left py-3 px-2 text-slate-300 font-semibold">Data</th>
                            <th className="text-left py-3 px-2 text-slate-300 font-semibold">N.º pedido</th>
                            <th className="text-left py-3 px-2 text-slate-300 font-semibold">SKU</th>
                            <th className="text-left py-3 px-2 text-slate-300 font-semibold">Produto</th>
                            <th className="text-right py-3 px-2 text-slate-300 font-semibold">Qtd</th>
                            <th className="text-right py-3 px-2 text-slate-300 font-semibold">Valor bruto</th>
                            <th className="text-right py-3 px-2 text-slate-300 font-semibold">Comissão</th>
                            <th className="text-right py-3 px-2 text-slate-300 font-semibold">Custo forn.</th>
                            <th className="text-right py-3 px-2 text-slate-300 font-semibold">Portes</th>
                            <th className="text-right py-3 px-2 text-slate-300 font-semibold">Margem (€)</th>
                            <th className="text-left py-3 px-2 text-slate-300 font-semibold">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {orders.map((o) => (
                            <tr key={o.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                              <td className="py-3 px-2 text-slate-400 whitespace-nowrap">{formatDate(o.data_criacao)}</td>
                              <td className="py-3 px-2 text-slate-200 font-medium">{o.numero_pedido || `#${o.id}`}</td>
                              <td className="py-3 px-2 text-slate-400">{o.sku_oferta || '—'}</td>
                              <td className="py-3 px-2 text-slate-400 max-w-[200px] truncate" title={o.nome_produto || ''}>{o.nome_produto || '—'}</td>
                              <td className="py-3 px-2 text-right text-slate-300">{o.quantidade != null ? Number(o.quantidade).toFixed(0) : '—'}</td>
                              <td className="py-3 px-2 text-right text-slate-300">{o.valor_total_com_iva != null ? formatCurrency(o.valor_total_com_iva) : '—'}</td>
                              <td className="py-3 px-2 text-right text-amber-400/90">{o.comissao_sem_impostos != null ? formatCurrency(o.comissao_sem_impostos) : '—'}</td>
                              <td className="py-3 px-2 text-right text-slate-400">{o.custo_fornecedor != null ? formatCurrency(o.custo_fornecedor) : '—'}</td>
                              <td className="py-3 px-2 text-right text-slate-400">{o.gastos_envio != null ? formatCurrency(o.gastos_envio) : '—'}</td>
                              <td className="py-3 px-2 text-right">{renderMargem(o.margem_total_linha)}</td>
                              <td className="py-3 px-2 text-slate-400">{o.status_operacional || o.status || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {total > LIMIT && (
                      <div className="flex items-center justify-between mt-4">
                        <button
                          onClick={() => setPage((p) => Math.max(0, p - 1))}
                          disabled={page === 0}
                          className="px-3 py-1 rounded bg-slate-700 text-slate-300 disabled:opacity-50"
                        >
                          Anterior
                        </button>
                        <span className="text-slate-400 text-sm">
                          {page * LIMIT + 1}–{Math.min((page + 1) * LIMIT, total)} de {total}
                        </span>
                        <button
                          onClick={() => setPage((p) => p + 1)}
                          disabled={(page + 1) * LIMIT >= total}
                          className="px-3 py-1 rounded bg-slate-700 text-slate-300 disabled:opacity-50"
                        >
                          Seguinte
                        </button>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Aba Sales Explorer: importar + Dashboard + tabela com status e Comprada */}
        <TabsContent value="explorer" className="mt-6 space-y-6">
          {!explorerEffectiveEmpresaId && empresasList.length > 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-slate-400">Selecione uma empresa no filtro abaixo (ou na barra lateral) para importar vendas e ver o Explorer.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="w-5 h-5 text-amber-400" />
                    Importar vendas (Universal Ingestor)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap items-center gap-4">
                    <label className="px-4 py-2 rounded-lg bg-amber-600 text-white font-medium cursor-pointer hover:bg-amber-500 disabled:opacity-50">
                      {importLoading ? (
                        <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> A importar...</span>
                      ) : (
                        'Selecionar ficheiro (Excel/CSV)'
                      )}
                      <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImportSales} disabled={importLoading} />
                    </label>
                    <span className="text-slate-400 text-sm">Normalização por marketplace; gatilho para compras pendentes.</span>
                  </div>
                  {importMessage && (
                    <div className={`mt-3 px-4 py-2 rounded-lg text-sm ${importMessage.startsWith('Importados') ? 'bg-emerald-900/30 text-emerald-400' : 'bg-red-900/30 text-red-400'}`}>
                      {importMessage}
                    </div>
                  )}
                </CardContent>
              </Card>

              {salesStats && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2 text-slate-400 text-sm">GMV</div>
                      <p className="text-xl font-semibold text-white mt-1">{formatCurrency(salesStats.gmv)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2 text-slate-400 text-sm">Taxa comissão média</div>
                      <p className="text-xl font-semibold text-amber-400 mt-1">{salesStats.avg_commission_rate_pct}%</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2 text-slate-400 text-sm">Lucro líquido previsto</div>
                      <p className="text-xl font-semibold text-emerald-400 mt-1">{formatCurrency(salesStats.total_net_value)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2 text-slate-400 text-sm">Lucro Previsto (após custo)</div>
                      <p className="text-xl font-semibold text-emerald-300 mt-1">{formatCurrency(salesStats.lucro_previsto ?? 0)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2 text-slate-400 text-sm">Pedidos</div>
                      <p className="text-xl font-semibold text-white mt-1">{salesStats.num_orders}</p>
                    </CardContent>
                  </Card>
                </div>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <List className="w-5 h-5 text-amber-400" />
                    Vendas Recentes (Lucro Previsto por linha)
                  </CardTitle>
                  <p className="text-xs text-slate-400 mt-1">Lucro Previsto = venda - comissão - custo (sku_mapping). Se o custo subir (ex.: após sync do robô) e o lucro for negativo, a linha fica a vermelho com &quot;Alerta de Prejuízo&quot;. &quot;Mapping em falta&quot; = SKU sem custo mapeado.</p>
                </CardHeader>
                <CardContent>
                  {recentWithMarginLoading ? (
                    <div className="flex items-center justify-center py-8 text-slate-400">
                      <Loader2 className="w-5 h-5 animate-spin mr-2" /> A carregar...
                    </div>
                  ) : recentWithMargin.length === 0 ? (
                    <p className="text-slate-400 text-sm py-4">Nenhuma linha de venda recente. Importe vendas para ver Lucro Previsto e alertas de mapping.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-700">
                            <th className="text-left py-2 px-2 text-slate-300 font-semibold">Pedido</th>
                            <th className="text-left py-2 px-2 text-slate-300 font-semibold">SKU</th>
                            <th className="text-right py-2 px-2 text-slate-300 font-semibold">Qtd</th>
                            <th className="text-right py-2 px-2 text-slate-300 font-semibold">Preço un.</th>
                            <th className="text-right py-2 px-2 text-slate-300 font-semibold">Lucro Previsto</th>
                            <th className="text-left py-2 px-2 text-slate-300 font-semibold">Mapping</th>
                          </tr>
                        </thead>
                        <tbody>
                          {recentWithMargin.map((row, idx) => {
                            const isPrejuizo = row.lucro_previsto_linha != null && row.lucro_previsto_linha < 0;
                            return (
                              <tr
                                key={`${row.sales_order_id}-${row.sales_order_item_id ?? idx}`}
                                className={`border-b border-slate-800 hover:bg-slate-800/50 ${isPrejuizo ? 'bg-red-950/40' : ''}`}
                              >
                                <td className="py-2 px-2 text-slate-200 font-medium">{row.external_order_id ?? `#${row.sales_order_id}`}</td>
                                <td className="py-2 px-2 text-slate-300">{row.sku_marketplace ?? '—'}</td>
                                <td className="py-2 px-2 text-right text-slate-400">{row.qty ?? '—'}</td>
                                <td className="py-2 px-2 text-right text-slate-400">{row.unit_price != null ? formatCurrency(row.unit_price) : '—'}</td>
                                <td className={`py-2 px-2 text-right font-medium ${isPrejuizo ? 'text-red-400' : 'text-emerald-400'}`}>
                                  {row.lucro_previsto_linha != null ? formatCurrency(row.lucro_previsto_linha) : '—'}
                                </td>
                                <td className="py-2 px-2">
                                  {row.mapping_em_falta === 1 ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-amber-900/50 text-amber-400 font-medium">Mapping em falta</span>
                                  ) : isPrejuizo ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-red-900/50 text-red-400 font-medium">Alerta de Prejuízo</span>
                                  ) : (
                                    <span className="text-slate-500 text-xs">OK</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="w-5 h-5 text-amber-400" />
                    Sales Explorer
                    {salesListTotal > 0 && (
                      <span className="text-sm font-normal text-slate-400 ml-2">
                        ({salesListTotal} {salesListTotal === 1 ? 'pedido' : 'pedidos'})
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-4 mb-4">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Empresa</label>
                      <select
                        value={String(explorerEmpresaId !== '' ? explorerEmpresaId : (empresaSelecionada?.id ?? ''))}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === '') {
                            setExplorerEmpresaId('');
                            setExplorerMarketplaceId('');
                          } else {
                            setExplorerEmpresaId(Number(v));
                            setExplorerMarketplaceId('');
                          }
                          setSalesListPage(0);
                        }}
                        className="min-w-[180px] bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-white text-sm"
                      >
                        <option value="">— Selecionar empresa —</option>
                        {(empresasList.length > 0 ? empresasList : (empresaSelecionada ? [empresaSelecionada] : [])).filter((e) => e.ativo !== false).map((e) => (
                          <option key={e.id} value={String(e.id)}>{e.nome}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Marketplace</label>
                      <select
                        value={String(explorerMarketplaceId !== '' ? explorerMarketplaceId : (marketplaceSelecionado?.id ?? ''))}
                        onChange={(e) => {
                          const v = e.target.value;
                          setExplorerMarketplaceId(v === '' ? '' : Number(v));
                          setSalesListPage(0);
                        }}
                        className="min-w-[160px] bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-white text-sm"
                        disabled={!explorerEffectiveEmpresaId}
                      >
                        <option value="">Todos</option>
                        {explorerMarketplaces.filter((m) => m.ativo !== false).map((m) => (
                          <option key={m.id} value={String(m.id)}>{m.nome}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Data início</label>
                      <input
                        type="date"
                        value={explorerDataInicio}
                        onChange={(e) => { setExplorerDataInicio(e.target.value); setSalesListPage(0); }}
                        className="bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Data fim</label>
                      <input
                        type="date"
                        value={explorerDataFim}
                        onChange={(e) => { setExplorerDataFim(e.target.value); setSalesListPage(0); }}
                        className="bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-white text-sm"
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3 mb-4">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">País destino</label>
                      <input
                        type="text"
                        placeholder="ex: PT"
                        value={explorerCountry}
                        onChange={(e) => setExplorerCountry(e.target.value)}
                        className="w-24 bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Estado</label>
                      <select
                        value={explorerStatus}
                        onChange={(e) => setExplorerStatus(e.target.value)}
                        className="bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-white text-sm"
                      >
                        <option value="">Todos</option>
                        <option value="Pending">Pending</option>
                        <option value="Purchased">Purchased</option>
                        <option value="Shipped">Shipped</option>
                        <option value="Paid">Paid</option>
                        <option value="Cancelled">Cancelled</option>
                      </select>
                    </div>
                    <div className="flex items-end">
                      <label className="flex items-center gap-2 cursor-pointer text-slate-300 text-sm">
                        <input
                          type="checkbox"
                          checked={explorerSemProformaOnly}
                          onChange={(e) => { setExplorerSemProformaOnly(e.target.checked); setSalesListPage(0); }}
                          className="rounded border-slate-500 bg-slate-800 text-amber-500"
                        />
                        Apenas sem proforma
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      {selectedSalesIds.size > 0 && (
                        <>
                          <span className="text-amber-200 text-sm">{selectedSalesIds.size} selecionado(s)</span>
                          <button
                            type="button"
                            disabled={bulkProformaLoading}
                            onClick={async () => {
                              setBulkProformaLoading(true);
                              try {
                                await billingApi.bulkCreateProformas(Array.from(selectedSalesIds));
                                loadSalesExplorer();
                                setSelectedSalesIds(new Set());
                              } catch {
                                alert('Erro ao gerar proformas.');
                              } finally {
                                setBulkProformaLoading(false);
                              }
                            }}
                            className="px-3 py-1.5 rounded bg-amber-600 text-white text-xs font-medium hover:bg-amber-500 disabled:opacity-50 flex items-center gap-1.5"
                          >
                            {bulkProformaLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
                            Proformas ({selectedSalesIds.size})
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedSalesIds(new Set())}
                            className="px-3 py-1.5 rounded bg-slate-700 text-slate-300 text-xs hover:bg-slate-600"
                          >
                            Limpar
                          </button>
                        </>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={exportingExcel}
                      onClick={handleExport}
                      className="px-3 py-1.5 rounded bg-emerald-700 text-white text-xs font-medium hover:bg-emerald-600 disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {exportingExcel ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                      {selectedSalesIds.size > 0 ? `Exportar (${selectedSalesIds.size})` : 'Exportar Excel'}
                    </button>
                  </div>
                  {salesListLoading ? (
                    <div className="flex items-center justify-center py-12 text-slate-400">
                      <Loader2 className="w-6 h-6 animate-spin mr-2" />
                      A carregar...
                    </div>
                  ) : salesListItems.length === 0 ? (
                    <p className="text-slate-400 text-center py-12">
                      Nenhum pedido no módulo Sales. Use &quot;Importar vendas&quot; para carregar um ficheiro.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-700">
                            <th className="text-left py-2 px-2 text-slate-300 font-semibold w-10">
                              <input
                                type="checkbox"
                                checked={salesListItems.length > 0 && salesListItems.every((r) => selectedSalesIds.has(r.id))}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedSalesIds(new Set(salesListItems.map((r) => r.id)));
                                  } else {
                                    setSelectedSalesIds(new Set());
                                  }
                                }}
                                className="rounded border-slate-500 bg-slate-800 text-amber-500"
                              />
                            </th>
                            <th className="text-left py-2 px-2 text-slate-300 font-semibold">Pedido</th>
                            <th className="text-left py-2 px-2 text-slate-300 font-semibold">Canal</th>
                            <th className="text-left py-2 px-2 text-slate-300 font-semibold">Data</th>
                            <th className="text-left py-2 px-2 text-slate-300 font-semibold">País</th>
                            <th className="text-right py-2 px-2 text-slate-300 font-semibold">Bruto</th>
                            <th className="text-right py-2 px-2 text-slate-300 font-semibold">Líquido</th>
                            <th className="text-right py-2 px-2 text-slate-300 font-semibold">Margem</th>
                            <th className="text-left py-2 px-2 text-slate-300 font-semibold">Estado</th>
                            <th className="text-left py-2 px-2 text-slate-300 font-semibold">Compra</th>
                            <th className="text-left py-2 px-2 text-slate-300 font-semibold">Estado envio</th>
                            <th className="text-left py-2 px-2 text-slate-300 font-semibold">Transportadora</th>
                            <th className="text-left py-2 px-2 text-slate-300 font-semibold">Tracking</th>
                            <th className="text-left py-2 px-2 text-slate-300 font-semibold">Estado Transp.</th>
                            <th className="text-left py-2 px-2 text-slate-300 font-semibold">Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {salesListItems.map((row) => (
                            <tr key={row.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                              <td className="py-2 px-2 w-10">
                                <input
                                  type="checkbox"
                                  checked={selectedSalesIds.has(row.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedSalesIds((s) => new Set([...s, row.id]));
                                    } else {
                                      setSelectedSalesIds((s) => { const n = new Set(s); n.delete(row.id); return n; });
                                    }
                                  }}
                                  className="rounded border-slate-500 bg-slate-800 text-amber-500"
                                />
                              </td>
                              <td className="py-2 px-2 text-slate-200 font-medium cursor-pointer hover:text-amber-300 transition-colors" onClick={() => openDrawer(row.id)}>{row.external_order_id || `#${row.id}`}</td>
                              <td className="py-2 px-2 text-slate-400">{row.marketplace_nome ?? '—'}</td>
                              <td className="py-2 px-2 text-slate-400">{formatDate(row.order_date)}</td>
                              <td className="py-2 px-2 text-slate-400">{row.customer_country ?? '—'}</td>
                              <td className="py-2 px-2 text-right text-slate-300">{row.total_gross != null ? formatCurrency(row.total_gross) : '—'}</td>
                              <td className="py-2 px-2 text-right text-emerald-400">{row.total_net_value != null ? formatCurrency(row.total_net_value) : '—'}</td>
                              <td className="py-2 px-2 text-right">
                                {row.margem_pct != null ? (
                                  <span className={`text-xs font-medium ${row.margem_pct >= 10 ? 'text-emerald-400' : row.margem_pct >= 0 ? 'text-amber-400' : 'text-red-400'}`}>
                                    {row.margem_pct > 0 ? '+' : ''}{row.margem_pct.toFixed(1)}%
                                  </span>
                                ) : <span className="text-slate-600 text-xs">—</span>}
                              </td>
                              <td className="py-2 px-2">
                                <span className={`px-2 py-0.5 rounded text-xs ${
                                  row.status === 'Paid' ? 'bg-emerald-900/50 text-emerald-400' :
                                  row.status === 'Shipped' ? 'bg-blue-900/50 text-blue-400' :
                                  row.status === 'Purchased' ? 'bg-amber-900/50 text-amber-400' :
                                  row.status === 'Cancelled' ? 'bg-red-900/50 text-red-400' :
                                  'bg-slate-600 text-slate-300'
                                }`}>
                                  {row.status ?? '—'}
                                </span>
                              </td>
                              <td className="py-2 px-2">
                                {row.purchase_order_id ? (
                                  <button
                                    type="button"
                                    onClick={() => openDrawer(row.id)}
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${
                                      row.po_status === 'Paid' || row.po_status === 'Received' ? 'bg-emerald-900/40 text-emerald-300 border-emerald-700/50' :
                                      row.po_status === 'Ordered' ? 'bg-blue-900/40 text-blue-300 border-blue-700/50' :
                                      'bg-slate-700/60 text-slate-300 border-slate-600/50'
                                    }`}
                                    title={`Fornecedor: ${row.supplier_nome ?? '—'} · Estado PO: ${row.po_status ?? '—'}`}
                                  >
                                    <ShoppingBag className="w-3 h-3" />PO#{row.purchase_order_id}
                                  </button>
                                ) : (
                                  <span className="text-slate-500 text-xs">—</span>
                                )}
                              </td>
                              <td className="py-2 px-2">
                                {row.shipping_status ? (
                                  <span className={`px-2 py-0.5 rounded text-xs ${
                                    row.shipping_status === 'In Transit' ? 'bg-blue-900/50 text-blue-400' :
                                    row.shipping_status === 'Delivered'  ? 'bg-emerald-900/50 text-emerald-400' :
                                    row.shipping_status === 'Returned'   ? 'bg-red-900/50 text-red-400' :
                                    'bg-slate-600 text-slate-300'
                                  }`}>
                                    {row.shipping_status}
                                  </span>
                                ) : (
                                  <span className="text-slate-600 text-xs">—</span>
                                )}
                              </td>
                              <td className="py-2 px-2 text-slate-400">{row.carrier_name ?? '—'}</td>
                              <td className="py-2 px-2 font-mono text-xs">
                                {row.tracking_number
                                  ? <span className="text-sky-400">{row.tracking_number}</span>
                                  : <span className="text-slate-600">—</span>}
                              </td>
                              <td className="py-2 px-2">
                                {row.carrier_status ? (
                                  <span className={`px-2 py-0.5 rounded text-xs ${
                                    row.carrier_status === 'In Transit' ? 'bg-blue-900/50 text-blue-400' :
                                    row.carrier_status === 'Delivered'  ? 'bg-emerald-900/50 text-emerald-400' :
                                    row.carrier_status === 'Returned'   ? 'bg-red-900/50 text-red-400' :
                                    'bg-slate-600 text-slate-300'
                                  }`}>
                                    {row.carrier_status}
                                  </span>
                                ) : (
                                  <span className="text-slate-600 text-xs">—</span>
                                )}
                              </td>
                              <td className="py-2 px-2">
                                <div className="flex flex-wrap gap-1">
                                  <button
                                    type="button"
                                    onClick={() => openDrawer(row.id)}
                                    className="px-2 py-1 rounded bg-slate-600/80 text-white text-xs font-medium hover:bg-slate-500 flex items-center gap-1"
                                    title="Ver detalhe"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                  </button>
                                  {row.purchase_order_id && (
                                    <button
                                      type="button"
                                      onClick={() => setModuloSelecionado({ id: 'compras', nome: 'Compras', icone: '🛒' })}
                                      className="px-2 py-1 rounded bg-sky-700/80 text-white text-xs font-medium hover:bg-sky-600 flex items-center gap-1"
                                      title={`Ver PO#${row.purchase_order_id} em Compras`}
                                    >
                                      <ShoppingBag className="w-3 h-3" />
                                    </button>
                                  )}
                                  {row.tracking_number && (
                                    <button
                                      type="button"
                                      onClick={() => openDrawer(row.id)}
                                      className="px-2 py-1 rounded bg-teal-700/80 text-white text-xs font-medium hover:bg-teal-600 flex items-center gap-1"
                                      title={`Tracking: ${row.tracking_number}`}
                                    >
                                      <Truck className="w-3 h-3" />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    disabled={proformaLoadingId === row.id}
                                    onClick={async () => {
                                      setProformaLoadingId(row.id);
                                      try {
                                        const data = await billingApi.createProforma(row.id);
                                        setProformaPreviewData(data);
                                      } catch {
                                        alert('Erro ao gerar proforma. Verifique se a venda existe e tem linhas.');
                                      } finally {
                                        setProformaLoadingId(null);
                                      }
                                    }}
                                    className="px-2 py-1 rounded bg-amber-600/80 text-white text-xs font-medium hover:bg-amber-500 disabled:opacity-50 flex items-center gap-1"
                                  >
                                    {proformaLoadingId === row.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
                                    Proforma
                                  </button>
                                  {row.status !== 'Cancelled' && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setCancelModalRow(row);
                                        setCancelReason('Cliente cancelou');
                                        setCancelSupplierAcceptsReturn(false);
                                        setCancelCreateCreditNote(true);
                                      }}
                                      className="px-2 py-1 rounded bg-red-700/80 text-white text-xs font-medium hover:bg-red-600 flex items-center gap-1"
                                      title="Cancelar venda: emite NC ao cliente e regista RMA; se fornecedor não aceitar devolução, mercadoria fica em stock escritório"
                                    >
                                      <XCircle className="w-3 h-3" /> Cancelar
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
                  {salesListTotal > LIMIT && (
                    <div className="flex items-center justify-between mt-4">
                      <button
                        onClick={() => setSalesListPage((p) => Math.max(0, p - 1))}
                        disabled={salesListPage === 0}
                        className="px-3 py-1 rounded bg-slate-700 text-slate-300 disabled:opacity-50"
                      >
                        Anterior
                      </button>
                      <span className="text-slate-400 text-sm">
                        {salesListPage * LIMIT + 1}–{Math.min((salesListPage + 1) * LIMIT, salesListTotal)} de {salesListTotal}
                      </span>
                      <button
                        onClick={() => setSalesListPage((p) => p + 1)}
                        disabled={(salesListPage + 1) * LIMIT >= salesListTotal}
                        className="px-3 py-1 rounded bg-slate-700 text-slate-300 disabled:opacity-50"
                      >
                        Seguinte
                      </button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>

      {cancelModalRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 print:hidden">
          <div className="bg-slate-800 border border-slate-600 rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-white mb-2">Cancelar venda</h3>
            <p className="text-slate-400 text-sm mb-4">
              Pedido <strong>{cancelModalRow.external_order_id ?? cancelModalRow.id}</strong>. Será emitida Nota de Crédito ao cliente e criado RMA.
              Se o fornecedor não aceitar devolução, a mercadoria no escritório ficará em stock para reutilização.
            </p>
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Motivo</label>
                <input
                  type="text"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white text-sm"
                  placeholder="ex: Cliente cancelou"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={cancelSupplierAcceptsReturn} onChange={(e) => setCancelSupplierAcceptsReturn(e.target.checked)} className="rounded border-slate-500 bg-slate-700 text-amber-500" />
                Fornecedor aceita devolução (mercadoria não fica em stock)
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={cancelCreateCreditNote} onChange={(e) => setCancelCreateCreditNote(e.target.checked)} className="rounded border-slate-500 bg-slate-700 text-amber-500" />
                Emitir Nota de Crédito ao cliente
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setCancelModalRow(null)} className="px-4 py-2 rounded bg-slate-600 text-white text-sm hover:bg-slate-500">Fechar</button>
              <button
                type="button"
                disabled={cancelLoading}
                onClick={async () => {
                  if (!cancelModalRow) return;
                  setCancelLoading(true);
                  try {
                    const res = await salesApi.cancelSale(cancelModalRow.id, {
                      reason: cancelReason,
                      supplier_accepts_return: cancelSupplierAcceptsReturn,
                      create_credit_note: cancelCreateCreditNote,
                    });
                    if (res.credit_note?.document_number) {
                      alert(`Venda cancelada. NC emitida: ${res.credit_note.document_number}. ${(res.office_stock_created as unknown[])?.length ? 'Stock em escritório criado para itens não expedidos.' : ''}`);
                    } else {
                      alert('Venda cancelada.');
                    }
                    setCancelModalRow(null);
                    loadSalesExplorer();
                  } catch (err: unknown) {
                    alert((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Erro ao cancelar venda.');
                  } finally {
                    setCancelLoading(false);
                  }
                }}
                className="px-4 py-2 rounded bg-red-600 text-white text-sm hover:bg-red-500 disabled:opacity-50 flex items-center gap-1"
              >
                {cancelLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Confirmar cancelamento
              </button>
            </div>
          </div>
        </div>
      )}

      {proformaPreviewData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 print:hidden">
          <div className="max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <ProformaPreview
              data={proformaPreviewData}
              showActions
              onClose={() => setProformaPreviewData(null)}
              onPrint={() => window.print()}
            />
          </div>
        </div>
      )}

      {/* ── Drawer de Detalhe da Order ─────────────────────────────────── */}
      {drawerOrderId !== null && (
        <div className="fixed inset-0 z-50 flex print:hidden" onClick={() => setDrawerOrderId(null)}>
          <div className="flex-1 bg-black/50" />
          <div
            className="w-full max-w-2xl bg-slate-900 border-l border-slate-700 shadow-2xl overflow-y-auto flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header do drawer */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 bg-slate-800/80 sticky top-0 z-10">
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide">Detalhe do Pedido</p>
                <h2 className="text-lg font-semibold text-white">
                  {drawerDetail?.external_order_id ?? (drawerLoading ? '…' : `#${drawerOrderId}`)}
                </h2>
              </div>
              <button onClick={() => setDrawerOrderId(null)} className="p-2 rounded hover:bg-slate-700 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {drawerLoading && (
              <div className="flex-1 flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
              </div>
            )}

            {!drawerLoading && !drawerDetail && (
              <div className="flex-1 flex items-center justify-center py-20 text-slate-400">Erro ao carregar detalhe.</div>
            )}

            {!drawerLoading && drawerDetail && (() => {
              const d = drawerDetail;
              const fmt = (v: number | null | undefined) => v != null ? formatCurrency(v) : '—';
              const fmtPct = (v: number | null | undefined) => v != null ? `${v > 0 ? '+' : ''}${v.toFixed(1)}%` : '—';
              const statusColor = (s: string | null) =>
                s === 'Paid' || s === 'Received' ? 'bg-emerald-900/50 text-emerald-300' :
                s === 'Shipped' || s === 'Ordered' ? 'bg-blue-900/50 text-blue-300' :
                s === 'Purchased' ? 'bg-amber-900/50 text-amber-300' :
                s === 'Cancelled' ? 'bg-red-900/50 text-red-300' :
                'bg-slate-700 text-slate-300';

              return (
                <div className="flex-1 px-6 py-4 space-y-6">

                  {/* Badges de estado + margem */}
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColor(d.status)}`}>{d.status ?? '—'}</span>
                    <span className="text-slate-400 text-xs">{d.marketplace_nome ?? '—'}</span>
                    <span className="text-slate-400 text-xs">·</span>
                    <span className="text-slate-400 text-xs">{d.customer_country ?? '—'}</span>
                    <span className="text-slate-400 text-xs">·</span>
                    <span className="text-slate-400 text-xs">{d.order_date ?? '—'}</span>
                    {d.margem_pct != null && (
                      <span className={`ml-auto px-2 py-0.5 rounded text-xs font-semibold flex items-center gap-1 ${d.margem_pct >= 10 ? 'bg-emerald-900/50 text-emerald-300' : d.margem_pct >= 0 ? 'bg-amber-900/50 text-amber-300' : 'bg-red-900/50 text-red-300'}`}>
                        {d.margem_pct < 0 ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                        Margem {fmtPct(d.margem_pct)}
                      </span>
                    )}
                  </div>

                  {/* Secção Financeira */}
                  <section>
                    <h3 className="text-xs uppercase tracking-wide text-slate-400 mb-2 flex items-center gap-1.5">
                      <DollarSign className="w-3.5 h-3.5" /> Decomposição Financeira
                    </h3>
                    <div className="bg-slate-800/60 rounded-lg p-4 space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-slate-400">Valor bruto</span><span className="text-slate-200 font-medium">{fmt(d.total_gross)}</span></div>
                      <div className="flex justify-between"><span className="text-slate-400">Comissão fixa</span><span className="text-red-400">−{fmt(d.total_commission_fixed)}</span></div>
                      <div className="flex justify-between"><span className="text-slate-400">Comissão %</span><span className="text-red-400">−{fmt(d.total_commission_percent)}</span></div>
                      <div className="flex justify-between border-t border-slate-700 pt-2"><span className="text-slate-300 font-medium">Valor líquido</span><span className="text-emerald-400 font-semibold">{fmt(d.total_net_value)}</span></div>
                      {d.custo_previsto != null && (
                        <div className="flex justify-between"><span className="text-slate-400">Custo previsto</span><span className="text-amber-400">−{fmt(d.custo_previsto)}</span></div>
                      )}
                      {d.lucro_previsto != null && (
                        <div className={`flex justify-between border-t border-slate-700 pt-2 ${d.lucro_previsto < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                          <span className="font-medium">Lucro previsto</span>
                          <span className="font-semibold">{fmt(d.lucro_previsto)}</span>
                        </div>
                      )}
                      {(d.items_sem_mapping ?? 0) > 0 && (
                        <p className="text-amber-400 text-xs flex items-center gap-1 pt-1">
                          <AlertTriangle className="w-3 h-3" /> {d.items_sem_mapping} SKU(s) sem mapping — custo não calculado
                        </p>
                      )}
                    </div>
                  </section>

                  {/* Secção Linhas */}
                  {d.items.length > 0 && (
                    <section>
                      <h3 className="text-xs uppercase tracking-wide text-slate-400 mb-2 flex items-center gap-1.5">
                        <Package className="w-3.5 h-3.5" /> Linhas ({d.items.length})
                      </h3>
                      <div className="bg-slate-800/60 rounded-lg overflow-hidden">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-slate-700 bg-slate-800/80">
                              <th className="text-left py-2 px-3 text-slate-400">SKU</th>
                              <th className="text-left py-2 px-3 text-slate-400">Produto</th>
                              <th className="text-right py-2 px-3 text-slate-400">Qty</th>
                              <th className="text-right py-2 px-3 text-slate-400">P.Unit</th>
                              <th className="text-right py-2 px-3 text-slate-400">Total</th>
                              <th className="text-right py-2 px-3 text-slate-400">Custo</th>
                              <th className="text-right py-2 px-3 text-slate-400">VAT</th>
                            </tr>
                          </thead>
                          <tbody>
                            {d.items.map((item) => (
                              <tr key={item.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                                <td className="py-2 px-3 font-mono text-sky-400">{item.sku_marketplace ?? '—'}</td>
                                <td className="py-2 px-3 text-slate-300">{item.nome_produto ?? item.internal_sku ?? '—'}</td>
                                <td className="py-2 px-3 text-right text-slate-300">{item.quantity ?? '—'}</td>
                                <td className="py-2 px-3 text-right text-slate-300">{fmt(item.unit_price)}</td>
                                <td className="py-2 px-3 text-right text-emerald-400">{fmt(item.linha_gross)}</td>
                                <td className="py-2 px-3 text-right text-amber-400">{item.custo_fornecedor != null ? fmt(item.custo_fornecedor) : <span className="text-slate-600">—</span>}</td>
                                <td className="py-2 px-3 text-right text-slate-400">{item.vat_rate != null ? `${item.vat_rate}%` : '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  )}

                  {/* Secção Compras */}
                  {d.purchase_orders.length > 0 && (
                    <section>
                      <h3 className="text-xs uppercase tracking-wide text-slate-400 mb-2 flex items-center gap-1.5">
                        <ShoppingBag className="w-3.5 h-3.5" /> Compra associada
                      </h3>
                      <div className="space-y-2">
                        {d.purchase_orders.map((po) => (
                          <div key={po.id} className="bg-slate-800/60 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <span className="text-white font-semibold">PO #{po.id}</span>
                                <span className={`px-2 py-0.5 rounded text-xs ${statusColor(po.status)}`}>{po.status ?? '—'}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => { setDrawerOrderId(null); setModuloSelecionado({ id: 'compras', nome: 'Compras', icone: '🛒' }); }}
                                className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1"
                              >
                                Ver em Compras <ExternalLink className="w-3 h-3" />
                              </button>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div><span className="text-slate-400 text-xs">Fornecedor</span><p className="text-slate-200">{po.supplier_nome ?? '—'}</p></div>
                              <div><span className="text-slate-400 text-xs">Total PO</span><p className="text-emerald-400 font-medium">{fmt(po.total_final)}</p></div>
                              <div><span className="text-slate-400 text-xs">Fatura</span><p className={po.invoice_ref ? 'text-emerald-400' : 'text-slate-500'}>{po.invoice_ref ?? 'Sem fatura'}</p></div>
                              <div><span className="text-slate-400 text-xs">Vencimento</span><p className="text-slate-300">{po.due_date ?? '—'}</p></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Secção Envio */}
                  {(d.shipping_status || d.carrier_name || d.tracking_number) && (
                    <section>
                      <h3 className="text-xs uppercase tracking-wide text-slate-400 mb-2 flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5" /> Envio
                      </h3>
                      <div className="bg-slate-800/60 rounded-lg p-4 grid grid-cols-2 gap-3 text-sm">
                        <div><span className="text-slate-400 text-xs">Estado envio</span><p className="text-slate-200">{d.shipping_status ?? '—'}</p></div>
                        <div><span className="text-slate-400 text-xs">Transportadora</span><p className="text-slate-200">{d.carrier_name ?? '—'}</p></div>
                        <div className="col-span-2">
                          <span className="text-slate-400 text-xs">Tracking</span>
                          <p className="font-mono text-sky-400 text-sm">{d.tracking_number ?? '—'}</p>
                        </div>
                        {d.carrier_status && (
                          <div><span className="text-slate-400 text-xs">Estado transportadora</span><p className="text-slate-200">{d.carrier_status}</p></div>
                        )}
                        {d.shipped_at && (
                          <div><span className="text-slate-400 text-xs">Data expedição</span><p className="text-slate-200">{d.shipped_at}</p></div>
                        )}
                      </div>
                    </section>
                  )}

                  {/* Secção Cliente */}
                  {(d.customer_name || d.customer_nif || d.customer_address) && (
                    <section>
                      <h3 className="text-xs uppercase tracking-wide text-slate-400 mb-2 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5" /> Cliente
                      </h3>
                      <div className="bg-slate-800/60 rounded-lg p-4 grid grid-cols-2 gap-3 text-sm">
                        {d.customer_name && <div><span className="text-slate-400 text-xs">Nome</span><p className="text-slate-200">{d.customer_name}</p></div>}
                        {d.customer_nif && <div><span className="text-slate-400 text-xs">NIF</span><p className="text-slate-200 font-mono">{d.customer_nif}</p></div>}
                        {d.customer_address && <div className="col-span-2"><span className="text-slate-400 text-xs">Morada</span><p className="text-slate-200">{d.customer_address}</p></div>}
                      </div>
                    </section>
                  )}

                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
