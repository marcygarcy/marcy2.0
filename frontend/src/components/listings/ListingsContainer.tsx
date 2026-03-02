'use client';

import React, { useState, useEffect } from 'react';
import { TransactionsList } from './TransactionsList';
import { OrdersList } from './OrdersList';
import { PendentesList } from './PendentesList';
import { SalesList } from './SalesList';

interface ListingsContainerProps {
  initialTab?: string;
  onTabChange?: (tab: string) => void;
}

export function ListingsContainer({ initialTab = 'transacoes', onTabChange }: ListingsContainerProps) {
  const [activeSubTab, setActiveSubTab] = useState(initialTab);

  useEffect(() => {
    setActiveSubTab(initialTab);
  }, [initialTab]);

  const handleTabChange = (tab: string) => {
    setActiveSubTab(tab);
    if (onTabChange) {
      onTabChange(tab);
    }
  };

  return (
    <div className="w-full">
      {activeSubTab === 'transacoes' && <TransactionsList />}
      {activeSubTab === 'pedidos' && <OrdersList />}
      {activeSubTab === 'vendas' && <SalesList />}
      {activeSubTab === 'pendentes' && <PendentesList />}
    </div>
  );
}

