import React from 'react';
import { KPICard } from './KPICard';
import { TrendingUp, DollarSign, ShoppingCart, Lock, Clock, Receipt, Calendar } from 'lucide-react';
import type { KPIs } from '@/types/kpis';

interface KPIGridProps {
  kpis: KPIs | null;
}

export function KPIGrid({ kpis }: KPIGridProps) {
  if (!kpis) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
      <KPICard
        title="Vendas Brutas"
        value={kpis.vendas_brutas}
        format="currency"
        icon={<Receipt className="w-5 h-5 text-slate-400" />}
        color="blue"
      />
      <KPICard
        title="Nº Pedidos Acumulado"
        value={kpis.pedidos_recebidos}
        icon={<ShoppingCart className="w-5 h-5 text-slate-400" />}
        color="green"
      />
      <KPICard
        title="Total de Produtos Vendidos no Último Ciclo"
        value={kpis.produtos_vendidos}
        icon={<ShoppingCart className="w-5 h-5 text-slate-400" />}
        color="green"
      />
      <KPICard
        title="Comissões Acumuladas"
        value={kpis.comissoes_acum.comissoes}
        format="currency"
        icon={<DollarSign className="w-5 h-5 text-slate-400" />}
        color="red"
      />
      <KPICard
        title="Comissões Último Ciclo"
        value={kpis.comissoes_ult.comissoes}
        format="currency"
        icon={<DollarSign className="w-5 h-5 text-slate-400" />}
        color="red"
      />
      <KPICard
        title="Reserva Presa"
        value={kpis.reserva_saldo}
        format="currency"
        icon={<Lock className="w-5 h-5 text-slate-400" />}
        color="yellow"
      />
      <KPICard
        title="Prazo Médio"
        value={kpis.prazos.prazo_medio_dias}
        format="days"
        icon={<Clock className="w-5 h-5 text-slate-400" />}
        color="purple"
      />
      <KPICard
        title="Último Ciclo Pago"
        value={kpis.ultimo_ciclo_pago.valor}
        format="currency"
        subtitle={kpis.ultimo_ciclo_pago.ciclo || 'N/A'}
        icon={<Calendar className="w-5 h-5 text-slate-400" />}
        color="blue"
      />
    </div>
  );
}

