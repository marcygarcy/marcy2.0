"""Models para KPIs."""
from pydantic import BaseModel
from typing import Optional


class PrazosResponse(BaseModel):
    """Resposta de prazos médios."""
    prazo_medio_dias: float
    prazo_min_dias: int
    prazo_max_dias: int


class ComissoesResponse(BaseModel):
    """Resposta de comissões."""
    comissoes: float
    imposto: float


class ReembolsosResponse(BaseModel):
    """Resposta de reembolsos."""
    total: float


class ReservaResponse(BaseModel):
    """Resposta de reserva."""
    saldo: float
    ultimo_ciclo: Optional[str] = None


class UltimoCicloPagoResponse(BaseModel):
    """Resposta do último ciclo pago."""
    ciclo: Optional[str] = None
    valor: float = 0.0
    data_ciclo: Optional[str] = None


class KPIsResponse(BaseModel):
    """Resposta completa de KPIs."""
    prazos: PrazosResponse
    comissoes_acum: ComissoesResponse
    comissoes_ult: ComissoesResponse
    reembolsos_acum: ReembolsosResponse
    reembolsos_ult: ReembolsosResponse
    reserva_saldo: float
    reserva_ult_ciclo: Optional[str]
    pedidos_recebidos: int
    produtos_vendidos: int
    vendas_brutas: float
    ultimo_ciclo_pago: UltimoCicloPagoResponse

