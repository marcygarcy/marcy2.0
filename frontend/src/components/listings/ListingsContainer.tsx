'use client';

import React, { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { TransactionsList } from './TransactionsList';
import { OrdersList } from './OrdersList';

export function ListingsContainer() {
  const [activeSubTab, setActiveSubTab] = useState('transacoes');

  return (
    <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="w-full">
      <TabsList>
        <TabsTrigger value="transacoes">📋 Listagem de Transações</TabsTrigger>
        <TabsTrigger value="pedidos">🛒 Listagem de Pedidos Global</TabsTrigger>
      </TabsList>
      
      <TabsContent value="transacoes">
        <TransactionsList />
      </TabsContent>
      
      <TabsContent value="pedidos">
        <OrdersList />
      </TabsContent>
    </Tabs>
  );
}

