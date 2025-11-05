export interface Prazos {
  prazo_medio_dias: number;
  prazo_min_dias: number;
  prazo_max_dias: number;
}

export interface Comissoes {
  comissoes: number;
  imposto: number;
}

export interface Reembolsos {
  total: number;
}

export interface Reserva {
  saldo: number;
  ultimo_ciclo?: string | null;
}

export interface UltimoCicloPago {
  ciclo: string | null;
  valor: number;
  data_ciclo: string | null;
}

export interface KPIs {
  prazos: Prazos;
  comissoes_acum: Comissoes;
  comissoes_ult: Comissoes;
  reembolsos_acum: Reembolsos;
  reembolsos_ult: Reembolsos;
  reserva_saldo: number;
  reserva_ult_ciclo?: string | null;
  pedidos_recebidos: number;
  produtos_vendidos: number;
  vendas_brutas: number;
  ultimo_ciclo_pago: UltimoCicloPago;
}

export interface ReconciliationCycle {
  ciclo: string;
  cycle_end: string;
  net: number;
  trf_0_7: number;
  diff: number;
}

export interface ReconciliationResponse {
  cycles: ReconciliationCycle[];
}

export interface CycleBreakdownItem {
  tipo: string;
  credito: number;
  debito: number;
  real: number;
  quantidade: number;
}

export interface CycleBreakdownResponse {
  ciclo: string | null;
  data_ciclo: string | null;
  breakdown: CycleBreakdownItem[];
  total_net: number;
}

