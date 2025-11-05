'use client';

import { useState } from 'react';
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
import { BankStatement } from '@/components/bank/BankStatement';
import { SalesChart } from '@/components/dashboard/SalesChart';
import { TopProductsCard } from '@/components/dashboard/TopProductsCard';
import { ReservasList } from '@/components/reservas/ReservasList';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { KPICard } from '@/components/dashboard/KPICard';
import { useKPIs } from '@/lib/hooks/useKPIs';
import { useReconciliation } from '@/lib/hooks/useReconciliation';
import { useCycleBreakdown } from '@/lib/hooks/useCycleBreakdown';
import { formatCurrency } from '@/lib/utils';
import { TrendingUp, Upload, DollarSign, AlertCircle, Lock, Clock } from 'lucide-react';

export default function Home() {
  const [activeTab, setActiveTab] = useState('kpis');
  const { kpis, loading: kpisLoading, error: kpisError, refresh: refreshKPIs } = useKPIs();
  const { cycles, loading: reconLoading } = useReconciliation();
  const { data: cycleBreakdown, loading: breakdownLoading, refresh: refreshBreakdown } = useCycleBreakdown();

  const handleUploadSuccess = () => {
    refreshKPIs();
    refreshBreakdown();
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex">
      <Sidebar />
      <div className="flex-1 p-8 overflow-y-auto">
        <Header />

        <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="kpis">📊 KPIs</TabsTrigger>
          <TabsTrigger value="upload">📥 Upload</TabsTrigger>
          <TabsTrigger value="faturas">📄 Faturas</TabsTrigger>
          <TabsTrigger value="listagens">📋 Listagens</TabsTrigger>
          <TabsTrigger value="bancos">🏦 Bancos</TabsTrigger>
          <TabsTrigger value="resumo">📋 Resumo Último Ciclo</TabsTrigger>
          <TabsTrigger value="conciliacao">🔄 Conciliação</TabsTrigger>
          <TabsTrigger value="comissoes">💸 Comissões</TabsTrigger>
          <TabsTrigger value="reservas">🔒 Reservas</TabsTrigger>
          <TabsTrigger value="prazos">⏱️ Prazos</TabsTrigger>
        </TabsList>

        {/* KPIs Tab */}
        <TabsContent value="kpis">
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
          <ListingsContainer />
        </TabsContent>

        {/* Bancos Tab */}
        <TabsContent value="bancos">
          <BankStatement />
        </TabsContent>

        {/* Resumo Último Ciclo Tab */}
        <TabsContent value="resumo">
          <CycleBreakdown
            ciclo={cycleBreakdown?.ciclo || null}
            dataCiclo={cycleBreakdown?.data_ciclo || null}
            breakdown={cycleBreakdown?.breakdown || []}
            totalNet={cycleBreakdown?.total_net || 0}
            loading={breakdownLoading}
          />
        </TabsContent>

        {/* Conciliação Tab */}
        <TabsContent value="conciliacao">
          <ReconciliationTable cycles={cycles} loading={reconLoading} />
        </TabsContent>

        {/* Comissões Tab */}
        <TabsContent value="comissoes">
          <Card>
            <CardHeader>
              <CardTitle>Comissões por Ciclo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-slate-400 text-center py-8">
                Gráfico de comissões por ciclo será exibido aqui
              </div>
            </CardContent>
          </Card>
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
              <CardTitle>⏱️ Análise de Prazos</CardTitle>
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
      </div>
    </div>
  );
}

