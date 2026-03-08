'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { KPIGrid } from '@/components/dashboard/KPIGrid';
import { ReconciliationTable } from '@/components/dashboard/ReconciliationTable';
import { UploadStats } from '@/components/dashboard/UploadStats';
import { CycleBreakdown } from '@/components/dashboard/CycleBreakdown';
import { FileUpload } from '@/components/upload/FileUpload';
import { InvoiceManager } from '@/components/invoices/InvoiceManager';
import { ListingsContainer } from '@/components/listings/ListingsContainer';
import { SalesList } from '@/components/listings/SalesList';
import { ComprasView } from '@/components/compras/ComprasView';
import { BancosView } from '@/components/bank/BancosView';
import { SupplierMasterView } from '@/components/master/SupplierMasterView';
import { EmpresasMasterView } from '@/components/master/EmpresasMasterView';
import { MarketplacesMasterView } from '@/components/master/MarketplacesMasterView';
import { EscritoriosMasterView } from '@/components/master/EscritoriosMasterView';
import { TaxMatrixView } from '@/components/master/TaxMatrixView';
import { SkuBridgeView } from '@/components/master/SkuBridgeView';
import { SystemConfigView } from '@/components/master/SystemConfigView';
import { AutomationStatusPage } from '@/components/automation/AutomationStatusPage';
import { FinanceGlobalView } from '@/components/finance/FinanceGlobalView';
import { OfficeLogisticsView } from '@/components/logistics/OfficeLogisticsView';
import { ComercialView } from '@/components/comercial/ComercialView';
import FaturacaoView from '@/components/faturacao/FaturacaoView';
import { RMAView } from '@/components/rma/RMAView';
import { OfficeStockView } from '@/components/office/OfficeStockView';
import { DocsView } from '@/components/docs/DocsView';
import { GestaoTerceirosView } from '@/components/terceiros/GestaoTerceirosView';
import { TabelasView } from '@/components/tabelas/TabelasView';
import { BankStatement } from '@/components/bank/BankStatement';
import { SalesChart } from '@/components/dashboard/SalesChart';
import { TopProductsCard } from '@/components/dashboard/TopProductsCard';
import { CommissionsChart } from '@/components/dashboard/CommissionsChart';
import { ReservasList } from '@/components/reservas/ReservasList';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { KPICard } from '@/components/dashboard/KPICard';
import { useKPIs } from '@/lib/hooks/useKPIs';
import { useReconciliation } from '@/lib/hooks/useReconciliation';
import { useCycleBreakdown } from '@/lib/hooks/useCycleBreakdown';
import { formatCurrency } from '@/lib/utils';
import { TrendingUp, Upload, DollarSign, AlertCircle, Lock, Clock, ChevronDown, AlertTriangle } from 'lucide-react';
import { Dropdown } from '@/components/ui/dropdown';
import { useApp } from '@/context/AppContext';
import { rmaApi, type RmaAlert } from '@/lib/api/rma';

function CycleBreakdownWrapper() {
  const [selectedCiclo, setSelectedCiclo] = useState<string | null>(null);
  const { data: cycleBreakdown, loading: breakdownLoading } = useCycleBreakdown(selectedCiclo);

  return (
    <CycleBreakdown
      ciclo={cycleBreakdown?.ciclo || null}
      dataCiclo={cycleBreakdown?.data_ciclo || null}
      breakdown={cycleBreakdown?.breakdown || []}
      totalNet={cycleBreakdown?.total_net || 0}
      loading={breakdownLoading}
      onCicloChange={setSelectedCiclo}
    />
  );
}

export default function Home() {
  const { moduloSelecionado } = useApp();
  const [activeTab, setActiveTab] = useState('kpis');
  const [activeListingType, setActiveListingType] = useState('transacoes');
  const [rmaAlerts, setRmaAlerts] = useState<RmaAlert[]>([]);
  const { kpis, loading: kpisLoading, error: kpisError, refresh: refreshKPIs } = useKPIs();
  const { cycles, loading: reconLoading } = useReconciliation();
  const { data: cycleBreakdown, loading: breakdownLoading, refresh: refreshBreakdown } = useCycleBreakdown();

  useEffect(() => {
    if (activeTab === 'kpis') {
      rmaApi.getAlerts({ days_without_credit_note: 7 }).then(setRmaAlerts).catch(() => setRmaAlerts([]));
    }
  }, [activeTab]);

  const handleUploadSuccess = () => {
    refreshKPIs();
    refreshBreakdown();
  };

  const listingItems = [
    { value: 'transacoes', label: 'Listagem de Transações', icon: '📋' },
    { value: 'pedidos', label: 'Listagem de Pedidos Global', icon: '🛒' },
    { value: 'vendas', label: 'Vendas e Margem (Dropshipping)', icon: '📈' },
    { value: 'pendentes', label: 'Listagem de Pendentes', icon: '⏳' },
  ];

  const handleListingSelect = (value: string) => {
    setActiveListingType(value);
    setActiveTab('listagens');
  };

  if (kpisError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-8">
        <div className="text-center py-12">
          <p className="text-red-400 text-lg">Erro ao carregar dados: {kpisError.message}</p>
        </div>
      </div>
    );
  }

  const isModuloVendas = moduloSelecionado?.id === 'vendas-margem';
  const isModuloCompras = moduloSelecionado?.id === 'compras';
  const isModuloBancos = moduloSelecionado?.id === 'bancos';
  const isDadosMestresFornecedores = moduloSelecionado?.id === 'dados-mestres-fornecedores' || moduloSelecionado?.id === 'dados-mestres';
  const isDadosMestresEmpresas = moduloSelecionado?.id === 'dados-mestres-empresas';
  const isDadosMestresMarketplaces = moduloSelecionado?.id === 'dados-mestres-marketplaces';
  const isDadosMestresEscritorios = moduloSelecionado?.id === 'dados-mestres-escritorios';
  const isDadosMestresIva = moduloSelecionado?.id === 'dados-mestres-iva';
  const isDadosMestresSkus = moduloSelecionado?.id === 'dados-mestres-skus';
  const isModuloAutomation = moduloSelecionado?.id === 'automation';
  const isModuloFinancas = moduloSelecionado?.id === 'financas';
  const isModuloLogistics = moduloSelecionado?.id === 'logistics';
  const isModuloRMA = moduloSelecionado?.id === 'rma';
  const isModuloBilling = moduloSelecionado?.id === 'billing';
  const isModuloFaturacao = moduloSelecionado?.id === 'faturacao';
  const isModuloOfficeStock = moduloSelecionado?.id === 'office-stock';
  const isModuloDocs = moduloSelecionado?.id === 'documentacao';
  const isModuloSystemConfig = moduloSelecionado?.id === 'system-config';
  const isModuloGestaoTerceiros = moduloSelecionado?.id === 'gestao-terceiros';
  const isModuloTabelas = moduloSelecionado?.id === 'tabelas';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex">
      <Sidebar />
      <div className="flex-1 p-8 overflow-y-auto">
        <Header />

        {isModuloVendas ? (
          <SalesList />
        ) : isModuloCompras ? (
          <ComprasView />
        ) : isModuloBancos ? (
          <BancosView />
        ) : isDadosMestresFornecedores ? (
          <SupplierMasterView />
        ) : isDadosMestresEmpresas ? (
          <EmpresasMasterView />
        ) : isDadosMestresMarketplaces ? (
          <MarketplacesMasterView />
        ) : isDadosMestresEscritorios ? (
          <EscritoriosMasterView />
        ) : isDadosMestresIva ? (
          <TaxMatrixView />
        ) : isDadosMestresSkus ? (
          <SkuBridgeView />
        ) : isModuloAutomation ? (
          <AutomationStatusPage />
        ) : isModuloFinancas ? (
          <FinanceGlobalView />
        ) : isModuloLogistics ? (
          <OfficeLogisticsView />
        ) : isModuloRMA ? (
          <RMAView />
        ) : isModuloFaturacao ? (
          <FaturacaoView />
        ) : isModuloBilling ? (
          <ComercialView />
        ) : isModuloOfficeStock ? (
          <OfficeStockView />
        ) : isModuloDocs ? (
          <DocsView />
        ) : isModuloSystemConfig ? (
          <SystemConfigView />
        ) : isModuloGestaoTerceiros ? (
          <GestaoTerceirosView />
        ) : isModuloTabelas ? (
          <TabelasView />
        ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="kpis">📊 KPIs</TabsTrigger>
          <TabsTrigger value="upload">📥 Upload</TabsTrigger>
          <TabsTrigger value="faturas">📄 Faturas</TabsTrigger>
          <div className="relative inline-block">
            <Dropdown
              trigger={
                <button
                  onClick={() => {
                    if (activeTab !== 'listagens') {
                      setActiveTab('listagens');
                    }
                  }}
                  className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                    activeTab === 'listagens'
                      ? 'bg-blue-600 text-white shadow-lg'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  <span>📋 Listagens</span>
                  <ChevronDown className="w-4 h-4" />
                </button>
              }
              items={listingItems}
              onSelect={handleListingSelect}
              selectedValue={activeListingType}
            />
          </div>
          <TabsTrigger value="bancos">🏦 Bancos</TabsTrigger>
          <TabsTrigger value="resumo">📋 Resumo Último Ciclo</TabsTrigger>
          <TabsTrigger value="conciliacao">🔄 Conciliação</TabsTrigger>
          <TabsTrigger value="comissoes">💸 Comissões</TabsTrigger>
          <TabsTrigger value="reservas">🔒 Reservas</TabsTrigger>
          <TabsTrigger value="prazos">⏱️ Prazos</TabsTrigger>
        </TabsList>

        {/* KPIs Tab */}
        <TabsContent value="kpis">
          {rmaAlerts.length > 0 && (
            <Card className="mb-6 border-amber-500/50 bg-amber-950/20">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-amber-400 text-base">
                  <AlertTriangle className="w-5 h-5" />
                  Reembolsos pendentes de Nota de Crédito (RMA)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {rmaAlerts.map((a) => (
                  <div key={a.id} className="flex items-center justify-between py-2 px-3 rounded bg-slate-800/60 text-sm">
                    <span className="text-slate-200">{a.message}</span>
                    <span className="text-amber-400 font-medium">{formatCurrency(a.refund_customer_value)}</span>
                  </div>
                ))}
                <p className="text-xs text-slate-500 mt-2">Reembolso ao cliente há mais de 7 dias sem Nota de Crédito do fornecedor. Risco de perda financeira.</p>
              </CardContent>
            </Card>
          )}
          {kpisLoading ? (
            <div className="text-center py-12 text-slate-400">A carregar KPIs...</div>
          ) : (
            <div className="space-y-8">
              <UploadStats />
              <KPIGrid kpis={kpis} />
              
              {/* Gráfico de Vendas Brutas por Ciclo */}
              <SalesChart />
              
              {/* Produtos Mais Vendidos */}
              <TopProductsCard />

              {/* Detailed KPIs */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Prazos (dias)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {kpis && (
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-slate-300">Média:</span>
                          <span className="text-blue-400 font-bold">
                            {kpis.prazos.prazo_medio_dias.toFixed(1)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-300">Mínimo:</span>
                          <span className="text-green-400 font-bold">
                            {kpis.prazos.prazo_min_dias}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-300">Máximo:</span>
                          <span className="text-red-400 font-bold">
                            {kpis.prazos.prazo_max_dias}
                          </span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Reembolsos (acumulado)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {kpis && (
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-slate-300">Total Incl. Impostos:</span>
                          <span className="text-red-400 font-bold">
                            {formatCurrency(kpis.reembolsos_acum.total)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-300">Último Ciclo:</span>
                          <span className="text-orange-400 font-bold">
                            {formatCurrency(kpis.reembolsos_ult.total)}
                          </span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Comissões */}
              <Card>
                <CardHeader>
                  <CardTitle>Comissões (Acumulado vs Último Ciclo)</CardTitle>
                </CardHeader>
                <CardContent>
                  {kpis && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <p className="text-slate-400 text-sm mb-3">Acumulado</p>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span>Comissões:</span>
                            <span className="font-bold text-blue-400">
                              {formatCurrency(kpis.comissoes_acum.comissoes)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Imposto:</span>
                            <span className="font-bold text-blue-400">
                              {formatCurrency(kpis.comissoes_acum.imposto)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div>
                        <p className="text-slate-400 text-sm mb-3">Último Ciclo</p>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span>Comissões:</span>
                            <span className="font-bold text-green-400">
                              {formatCurrency(kpis.comissoes_ult.comissoes)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Imposto:</span>
                            <span className="font-bold text-green-400">
                              {formatCurrency(kpis.comissoes_ult.imposto)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Upload Tab */}
        <TabsContent value="upload">
          <FileUpload onSuccess={handleUploadSuccess} />
        </TabsContent>

        {/* Faturas Tab */}
        <TabsContent value="faturas">
          <InvoiceManager />
        </TabsContent>

        {/* Listagens Tab */}
        <TabsContent value="listagens">
          <ListingsContainer initialTab={activeListingType} onTabChange={setActiveListingType} />
        </TabsContent>

        {/* Bancos Tab */}
        <TabsContent value="bancos">
          <BankStatement />
        </TabsContent>

        {/* Resumo Último Ciclo Tab */}
        <TabsContent value="resumo">
          <CycleBreakdownWrapper />
        </TabsContent>

        {/* Conciliação Tab */}
        <TabsContent value="conciliacao">
          <ReconciliationTable cycles={cycles} loading={reconLoading} />
        </TabsContent>

        {/* Comissões Tab */}
        <TabsContent value="comissoes">
          <CommissionsChart />
        </TabsContent>

        {/* Reservas Tab */}
        <TabsContent value="reservas">
          <div className="space-y-6">
            {kpis && (
              <Card>
                <CardHeader>
                  <CardTitle>🔒 Resumo de Reservas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-slate-600 p-6 rounded-lg">
                      <p className="text-slate-300 text-sm mb-2">Saldo de Reserva (Estimado)</p>
                      <p className="text-4xl font-bold text-yellow-400">
                        {formatCurrency(kpis.reserva_saldo)}
                      </p>
                    </div>
                    <div className="bg-slate-600 p-6 rounded-lg">
                      <p className="text-slate-300 text-sm mb-2">Último Ciclo de Constituição</p>
                      {kpis.reserva_ult_ciclo ? (
                        <p className="text-2xl font-bold text-purple-400">
                          {kpis.reserva_ult_ciclo}
                        </p>
                      ) : (
                        <p className="text-slate-400">N/A</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            <ReservasList />
          </div>
        </TabsContent>

        {/* Prazos Tab */}
        <TabsContent value="prazos">
              <Card>
                <CardHeader>
                  <CardTitle>⏱️ Análise de Prazos de Recebimento</CardTitle>
                </CardHeader>
                <CardContent>
                  {kpis && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="bg-slate-600 p-6 rounded-lg text-center">
                        <p className="text-slate-400 text-sm mb-2">Prazo Médio</p>
                        <p className="text-4xl font-bold text-blue-400">
                          {kpis.prazos.prazo_medio_dias.toFixed(1)}
                        </p>
                        <p className="text-slate-400 text-sm mt-2">dias</p>
                      </div>
                      <div className="bg-slate-600 p-6 rounded-lg text-center">
                        <p className="text-slate-400 text-sm mb-2">Prazo Mínimo</p>
                        <p className="text-4xl font-bold text-green-400">
                          {kpis.prazos.prazo_min_dias}
                        </p>
                        <p className="text-slate-400 text-sm mt-2">dias</p>
                      </div>
                      <div className="bg-slate-600 p-6 rounded-lg text-center">
                        <p className="text-slate-400 text-sm mb-2">Prazo Máximo</p>
                        <p className="text-4xl font-bold text-red-400">
                          {kpis.prazos.prazo_max_dias}
                        </p>
                        <p className="text-slate-400 text-sm mt-2">dias</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
        </TabsContent>
      </Tabs>
        )}
    </div>
    </div>
  );
}

