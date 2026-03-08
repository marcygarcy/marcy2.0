'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Tag, Upload, TrendingUp, FileText } from 'lucide-react';
import { TabPricing } from './TabPricing';
import { TabSourcing } from './TabSourcing';
import { TabPerformance } from './TabPerformance';
import { TabBatchInvoicing } from './TabBatchInvoicing';

export function ComercialView() {
  const [activeTab, setActiveTab] = useState<string>('pricing');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 border-b border-slate-600 pb-4">
        <div className="p-2 rounded-lg bg-slate-700/80 border border-slate-600">
          <FileText className="w-6 h-6 text-amber-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Gestão Comercial</h1>
          <p className="text-slate-400 text-sm mt-0.5">Catálogo, margens, sourcing e faturação em lote (SAF-T / AT)</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-slate-800/80 border border-slate-600 p-1 h-auto">
          <TabsTrigger value="pricing" className="data-[state=active]:bg-amber-600 data-[state=active]:text-white py-2.5 text-sm">
            <Tag className="w-4 h-4 mr-2 shrink-0" />
            Pricing & Catálogo
          </TabsTrigger>
          <TabsTrigger value="sourcing" className="data-[state=active]:bg-amber-600 data-[state=active]:text-white py-2.5 text-sm">
            <Upload className="w-4 h-4 mr-2 shrink-0" />
            Atualização de Custos
          </TabsTrigger>
          <TabsTrigger value="performance" className="data-[state=active]:bg-amber-600 data-[state=active]:text-white py-2.5 text-sm">
            <TrendingUp className="w-4 h-4 mr-2 shrink-0" />
            Performance & Blacklist
          </TabsTrigger>
          <TabsTrigger value="batch" className="data-[state=active]:bg-amber-600 data-[state=active]:text-white py-2.5 text-sm">
            <FileText className="w-4 h-4 mr-2 shrink-0" />
            Processamento de Faturação
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pricing" className="mt-6">
          <TabPricing />
        </TabsContent>
        <TabsContent value="sourcing" className="mt-6">
          <TabSourcing />
        </TabsContent>
        <TabsContent value="performance" className="mt-6">
          <TabPerformance />
        </TabsContent>
        <TabsContent value="batch" className="mt-6">
          <TabBatchInvoicing />
        </TabsContent>
      </Tabs>
    </div>
  );
}
