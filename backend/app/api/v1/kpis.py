"""Endpoints de KPIs."""
from fastapi import APIRouter, Depends, Query
from typing import Optional
from app.services.kpi_service import KPIService
from app.services.cache_service import CacheService
from app.api.deps import get_kpi_service
from app.models.kpis import (
    PrazosResponse,
    ComissoesResponse,
    ReembolsosResponse,
    ReservaResponse,
    KPIsResponse,
    UltimoCicloPagoResponse
)
from app.models.schemas import ReconciliationResponse, CycleBreakdownResponse
from app.config.settings import get_settings

router = APIRouter(prefix="/kpis", tags=["kpis"])


@router.get("/prazos", response_model=PrazosResponse)
async def get_prazos(service: KPIService = Depends(get_kpi_service)):
    """Obtém prazos médios de pagamento."""
    try:
        return service.calculate_prazos()
    finally:
        service.close()


@router.get("/comissoes/acum", response_model=ComissoesResponse)
async def get_comissoes_acum(service: KPIService = Depends(get_kpi_service)):
    """Obtém comissões acumuladas."""
    try:
        return service.calculate_comissoes_acum()
    finally:
        service.close()


@router.get("/comissoes/ult", response_model=ComissoesResponse)
async def get_comissoes_ult(service: KPIService = Depends(get_kpi_service)):
    """Obtém comissões do último ciclo."""
    try:
        return service.calculate_comissoes_ult()
    finally:
        service.close()


@router.get("/reembolsos/acum", response_model=ReembolsosResponse)
async def get_reembolsos_acum(service: KPIService = Depends(get_kpi_service)):
    """Obtém reembolsos acumulados."""
    try:
        return service.calculate_reembolsos_acum()
    finally:
        service.close()


@router.get("/reembolsos/ult", response_model=ReembolsosResponse)
async def get_reembolsos_ult(service: KPIService = Depends(get_kpi_service)):
    """Obtém reembolsos do último ciclo."""
    try:
        return service.calculate_reembolsos_ult()
    finally:
        service.close()


@router.get("/reserva/saldo", response_model=ReservaResponse)
async def get_reserva_saldo(service: KPIService = Depends(get_kpi_service)):
    """Obtém saldo de reserva estimado."""
    try:
        return service.calculate_reserva_saldo()
    finally:
        service.close()


@router.get("/reserva/ult-ciclo")
async def get_reserva_ult_ciclo(service: KPIService = Depends(get_kpi_service)):
    """Obtém último ciclo de constituição de reserva."""
    try:
        result = service.calculate_reserva_saldo()
        return {"ultimo_ciclo": result.ultimo_ciclo}
    finally:
        service.close()


@router.get("/all", response_model=KPIsResponse)
async def get_all_kpis(
    empresa_id: Optional[int] = Query(None, description="ID da empresa"),
    marketplace_id: Optional[int] = Query(None, description="ID do marketplace"),
    service: KPIService = Depends(get_kpi_service)
):
    """Obtém todos os KPIs."""
    # Verificar cache (cache válido por 2 minutos)
    cache_key = f"kpis_all_{empresa_id}_{marketplace_id}"
    cached = CacheService.get(cache_key, max_age_seconds=120)
    if cached is not None:
        return cached
    
    try:
        # Tentar calcular cada KPI individualmente para evitar que um erro pare tudo
        try:
            prazos = service.calculate_prazos(empresa_id=empresa_id, marketplace_id=marketplace_id)
        except Exception as e:
            print(f"Erro ao calcular prazos: {e}")
            from app.models.kpis import PrazosResponse
            prazos = PrazosResponse(prazo_medio_dias=0.0, prazo_min_dias=0, prazo_max_dias=0)
        
        try:
            comissoes_acum = service.calculate_comissoes_acum(empresa_id=empresa_id, marketplace_id=marketplace_id)
        except Exception as e:
            print(f"Erro ao calcular comissões acum: {e}")
            from app.models.kpis import ComissoesResponse
            comissoes_acum = ComissoesResponse(comissoes=0.0, imposto=0.0)
        
        try:
            comissoes_ult = service.calculate_comissoes_ult(empresa_id=empresa_id, marketplace_id=marketplace_id)
        except Exception as e:
            print(f"Erro ao calcular comissões ult: {e}")
            from app.models.kpis import ComissoesResponse
            comissoes_ult = ComissoesResponse(comissoes=0.0, imposto=0.0)
        
        try:
            reembolsos_acum = service.calculate_reembolsos_acum(empresa_id=empresa_id, marketplace_id=marketplace_id)
        except Exception as e:
            print(f"Erro ao calcular reembolsos acum: {e}")
            from app.models.kpis import ReembolsosResponse
            reembolsos_acum = ReembolsosResponse(total=0.0)
        
        try:
            reembolsos_ult = service.calculate_reembolsos_ult(empresa_id=empresa_id, marketplace_id=marketplace_id)
        except Exception as e:
            print(f"Erro ao calcular reembolsos ult: {e}")
            from app.models.kpis import ReembolsosResponse
            reembolsos_ult = ReembolsosResponse(total=0.0)
        
        try:
            reserva = service.calculate_reserva_saldo(empresa_id=empresa_id, marketplace_id=marketplace_id)
        except Exception as e:
            print(f"Erro ao calcular reserva: {e}")
            from app.models.kpis import ReservaResponse
            reserva = ReservaResponse(saldo=0.0, ultimo_ciclo=None)
        
        try:
            pedidos = service.count_pedidos_recebidos(empresa_id=empresa_id, marketplace_id=marketplace_id)
        except Exception as e:
            print(f"Erro ao contar pedidos: {e}")
            pedidos = 0
        
        try:
            produtos = service.count_produtos_vendidos_ultimo_ciclo(empresa_id=empresa_id, marketplace_id=marketplace_id)
        except Exception as e:
            print(f"Erro ao contar produtos do último ciclo: {e}")
            produtos = 0
        
        try:
            vendas_brutas = service.calculate_vendas_brutas(empresa_id=empresa_id, marketplace_id=marketplace_id)
        except Exception as e:
            print(f"Erro ao calcular vendas brutas: {e}")
            vendas_brutas = 0.0
        
        try:
            ultimo_ciclo_pago_data = service.get_ultimo_ciclo_pago(empresa_id=empresa_id, marketplace_id=marketplace_id)
            ultimo_ciclo_pago = UltimoCicloPagoResponse(**ultimo_ciclo_pago_data)
        except Exception as e:
            print(f"Erro ao obter último ciclo pago: {e}")
            ultimo_ciclo_pago = UltimoCicloPagoResponse(ciclo=None, valor=0.0, data_ciclo=None)
        
        result = KPIsResponse(
            prazos=prazos,
            comissoes_acum=comissoes_acum,
            comissoes_ult=comissoes_ult,
            reembolsos_acum=reembolsos_acum,
            reembolsos_ult=reembolsos_ult,
            reserva_saldo=reserva.saldo,
            reserva_ult_ciclo=reserva.ultimo_ciclo,
            pedidos_recebidos=pedidos,
            produtos_vendidos=produtos,
            vendas_brutas=vendas_brutas,
            ultimo_ciclo_pago=ultimo_ciclo_pago
        )
        
        # Guardar no cache
        CacheService.set(cache_key, result)
        
        return result
    except Exception as e:
        from fastapi import HTTPException
        import traceback
        error_detail = f"Erro ao calcular KPIs: {str(e)}\n{traceback.format_exc()}"
        print(error_detail)
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")
    finally:
        service.close()


@router.get("/reconciliation", response_model=ReconciliationResponse)
async def get_reconciliation(
    empresa_id: Optional[int] = Query(None, description="ID da empresa"),
    marketplace_id: Optional[int] = Query(None, description="ID do marketplace"),
    service: KPIService = Depends(get_kpi_service)
):
    """Obtém conciliação Net vs TRF."""
    try:
        settings = get_settings()
        cycles = service.get_reconciliation(settings.trf_window_days, empresa_id=empresa_id, marketplace_id=marketplace_id)
        return ReconciliationResponse(cycles=cycles)
    finally:
        service.close()


@router.get("/ultimo-ciclo/detalhes", response_model=CycleBreakdownResponse)
async def get_ultimo_ciclo_detalhes(
    empresa_id: Optional[int] = Query(None, description="ID da empresa"),
    marketplace_id: Optional[int] = Query(None, description="ID do marketplace"),
    ciclo: Optional[str] = Query(None, description="Ciclo específico (opcional, se não fornecido usa o último)"),
    service: KPIService = Depends(get_kpi_service)
):
    """Obtém breakdown detalhado de um ciclo por tipo de transação."""
    try:
        if ciclo:
            # Obter breakdown do ciclo específico
            breakdown = service.get_cycle_breakdown(ciclo, empresa_id=empresa_id, marketplace_id=marketplace_id)
        else:
            # Obter breakdown do último ciclo
            breakdown = service.get_last_cycle_breakdown(empresa_id=empresa_id, marketplace_id=marketplace_id)
        return CycleBreakdownResponse(**breakdown)
    finally:
        service.close()


@router.get("/cycles")
async def get_available_cycles(
    empresa_id: Optional[int] = Query(None, description="ID da empresa"),
    marketplace_id: Optional[int] = Query(None, description="ID do marketplace"),
    service: KPIService = Depends(get_kpi_service)
):
    """Obtém lista de ciclos disponíveis ordenados por data."""
    try:
        cycles = service.get_available_cycles(empresa_id=empresa_id, marketplace_id=marketplace_id)
        return {"cycles": cycles}
    finally:
        service.close()


@router.get("/vendas-brutas-por-ciclo")
async def get_vendas_brutas_por_ciclo(
    empresa_id: Optional[int] = Query(None, description="ID da empresa"),
    marketplace_id: Optional[int] = Query(None, description="ID do marketplace"),
    service: KPIService = Depends(get_kpi_service)
):
    """Obtém vendas brutas agrupadas por ciclo para gráfico."""
    try:
        cycles = service.get_vendas_brutas_por_ciclo(empresa_id=empresa_id, marketplace_id=marketplace_id)
        return {"cycles": cycles}
    except Exception as e:
        from fastapi import HTTPException
        import traceback
        print(f"Erro ao obter vendas brutas por ciclo: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Erro ao obter vendas brutas por ciclo: {str(e)}")
    finally:
        service.close()


@router.get("/comissoes-por-ciclo")
async def get_comissoes_por_ciclo(
    empresa_id: Optional[int] = Query(None, description="ID da empresa"),
    marketplace_id: Optional[int] = Query(None, description="ID do marketplace"),
    service: KPIService = Depends(get_kpi_service)
):
    """Obtém comissões e impostos agrupados por ciclo para gráfico."""
    try:
        cycles = service.get_comissoes_por_ciclo(empresa_id=empresa_id, marketplace_id=marketplace_id)
        return {"cycles": cycles}
    except Exception as e:
        from fastapi import HTTPException
        import traceback
        print(f"Erro ao obter comissões por ciclo: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Erro ao obter comissões por ciclo: {str(e)}")
    finally:
        service.close()


@router.get("/produtos-mais-vendidos")
async def get_produtos_mais_vendidos(
    empresa_id: Optional[int] = Query(None, description="ID da empresa"),
    marketplace_id: Optional[int] = Query(None, description="ID do marketplace"),
    service: KPIService = Depends(get_kpi_service)
):
    """Obtém produtos mais vendidos (histórico e últimos 60 dias)."""
    try:
        historico = service.get_produto_mais_vendido_historico(empresa_id=empresa_id, marketplace_id=marketplace_id)
        ultimos_60_dias = service.get_produto_mais_vendido_ultimos_60_dias(empresa_id=empresa_id, marketplace_id=marketplace_id)
        return {
            "historico": historico,
            "ultimos_60_dias": ultimos_60_dias
        }
    except Exception as e:
        from fastapi import HTTPException
        import traceback
        print(f"Erro ao obter produtos mais vendidos: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Erro ao obter produtos mais vendidos: {str(e)}")
    finally:
        service.close()


@router.get("/reservas")
async def get_reservas_list(
    empresa_id: Optional[int] = Query(None, description="ID da empresa"),
    marketplace_id: Optional[int] = Query(None, description="ID do marketplace"),
    service: KPIService = Depends(get_kpi_service)
):
    """Obtém lista de todas as reservas."""
    try:
        reservas = service.get_reservas_list(empresa_id=empresa_id, marketplace_id=marketplace_id)
        return {
            "reservas": reservas,
            "count": len(reservas)
        }
    except Exception as e:
        from fastapi import HTTPException
        import traceback
        print(f"Erro ao obter lista de reservas: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Erro ao obter lista de reservas: {str(e)}")
    finally:
        service.close()


@router.delete("/reservas")
async def delete_reserva(
    numero_transacao: str = Query(..., description="Número da transação"),
    numero_fatura: str = Query(..., description="Número da fatura"),
    data_criacao: str = Query(..., description="Data de criação"),
    tipo: str = Query(..., description="Tipo de transação"),
    service: KPIService = Depends(get_kpi_service)
):
    """Elimina uma reserva específica."""
    try:
        success = service.delete_reserva(numero_transacao, numero_fatura, data_criacao, tipo)
        if success:
            return {"success": True, "message": "Reserva eliminada com sucesso"}
        else:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Reserva não encontrada")
    except Exception as e:
        from fastapi import HTTPException
        import traceback
        print(f"Erro ao eliminar reserva: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Erro ao eliminar reserva: {str(e)}")
    finally:
        service.close()

