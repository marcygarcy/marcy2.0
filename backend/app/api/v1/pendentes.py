"""Endpoints para listagem de pendentes (transações e pedidos sem pagamento)."""
from fastapi import APIRouter, Query
from typing import List, Optional
from pydantic import BaseModel
from app.config.database import get_db_connection

router = APIRouter(prefix="/pendentes", tags=["pendentes"])


class PendenteTransaction(BaseModel):
    """Modelo de transação pendente."""
    ciclo_pagamento: Optional[str] = None
    data_ciclo_faturamento: Optional[str] = None
    data_criacao: Optional[str] = None
    canal_vendas: Optional[str] = None
    tipo: Optional[str] = None
    credito: float = 0.0
    debito: float = 0.0
    real: float = 0.0
    valor: Optional[float] = None
    descricao: Optional[str] = None
    numero_pedido: Optional[str] = None
    numero_fatura: Optional[str] = None
    numero_transacao: Optional[str] = None
    rotulo_categoria: Optional[str] = None
    sku_oferta: Optional[str] = None
    moeda: Optional[str] = None


class PendenteOrder(BaseModel):
    """Modelo de pedido pendente."""
    id: int
    numero_pedido: str
    data_criacao: Optional[str] = None
    data_pagamento: Optional[str] = None
    ciclo_pagamento: Optional[str] = None
    valor_total: Optional[float] = None
    quantidade_itens: Optional[int] = None
    status: Optional[str] = None
    canal_vendas: Optional[str] = None


class PendentesResponse(BaseModel):
    """Resposta de listagem de pendentes."""
    transacoes: List[PendenteTransaction]
    pedidos: List[PendenteOrder]
    total_transacoes: int
    total_pedidos: int


@router.get("/", response_model=PendentesResponse)
async def get_pendentes(
    empresa_id: Optional[int] = Query(None, description="Filtrar por ID da empresa"),
    marketplace_id: Optional[int] = Query(None, description="Filtrar por ID do marketplace"),
    limit: int = Query(1000, ge=1, le=10000, description="Limite de registos por tipo")
):
    """Obtém lista de pendentes (transações sem ciclo de pagamento e pedidos sem data de pagamento)."""
    conn = get_db_connection()
    try:
        # Construir filtros para empresa e marketplace
        filter_conditions = []
        filter_params = []
        
        # Nota: transações ainda não têm empresa_id/marketplace_id, então não filtramos por isso
        # Pedidos têm esses campos, então aplicamos o filtro
        
        # BUSCAR TRANSAÇÕES PENDENTES (sem ciclo de pagamento)
        transacoes_query = """
            SELECT 
                "Ciclo Pagamento",
                "Data do ciclo de faturamento",
                "Data Criação",
                "Canal de vendas",
                Tipo,
                Crédito,
                Débito,
                real,
                Valor,
                Descrição,
                "Nº Pedido",
                "Nº da fatura",
                "Nº da transação",
                "Rótulo da categoria",
                "SKU da oferta",
                Moeda
            FROM transactions
            WHERE "Ciclo Pagamento" IS NULL OR "Ciclo Pagamento" = ''
            ORDER BY "Data Criação" DESC NULLS LAST
            LIMIT ?
        """
        
        transacoes_result = conn.execute(transacoes_query, [limit]).fetchall()
        
        transacoes = []
        for row in transacoes_result:
            transacoes.append(PendenteTransaction(
                ciclo_pagamento=row[0] if row[0] else None,
                data_ciclo_faturamento=str(row[1]) if row[1] else None,
                data_criacao=str(row[2]) if row[2] else None,
                canal_vendas=row[3] if row[3] else None,
                tipo=row[4] if row[4] else None,
                credito=float(row[5] or 0),
                debito=float(row[6] or 0),
                real=float(row[7] or 0),
                valor=float(row[8]) if row[8] is not None else None,
                descricao=row[9] if row[9] else None,
                numero_pedido=row[10] if row[10] else None,
                numero_fatura=row[11] if row[11] else None,
                numero_transacao=row[12] if row[12] else None,
                rotulo_categoria=row[13] if row[13] else None,
                sku_oferta=row[14] if row[14] else None,
                moeda=row[15] if row[15] else None
            ))
        
        # Contar total de transações pendentes
        count_transacoes_query = """
            SELECT COUNT(*)
            FROM transactions
            WHERE "Ciclo Pagamento" IS NULL OR "Ciclo Pagamento" = ''
        """
        total_transacoes = conn.execute(count_transacoes_query).fetchone()[0]
        
        # BUSCAR PEDIDOS PENDENTES (sem data de pagamento ou com status pendente)
        pedidos_conditions = ["(data_pagamento IS NULL OR LOWER(status) LIKE '%pendente%')"]
        pedidos_params = []
        
        if empresa_id is not None:
            pedidos_conditions.append("empresa_id = ?")
            pedidos_params.append(empresa_id)
        
        if marketplace_id is not None:
            pedidos_conditions.append("marketplace_id = ?")
            pedidos_params.append(marketplace_id)
        
        pedidos_where = " WHERE " + " AND ".join(pedidos_conditions) if pedidos_conditions else ""
        
        pedidos_query = f"""
            SELECT 
                id, numero_pedido, data_criacao, data_pagamento, ciclo_pagamento,
                valor_total, quantidade_itens, status, canal_vendas
            FROM orders
            {pedidos_where}
            ORDER BY data_criacao DESC NULLS LAST, id DESC
            LIMIT ?
        """
        pedidos_params.append(limit)
        
        pedidos_result = conn.execute(pedidos_query, pedidos_params).fetchall()
        
        pedidos = []
        for row in pedidos_result:
            pedidos.append(PendenteOrder(
                id=row[0],
                numero_pedido=row[1] or "",
                data_criacao=str(row[2]) if row[2] else None,
                data_pagamento=str(row[3]) if row[3] else None,
                ciclo_pagamento=row[4] if row[4] else None,
                valor_total=float(row[5]) if row[5] is not None else None,
                quantidade_itens=int(row[6]) if row[6] is not None else None,
                status=row[7] if row[7] else None,
                canal_vendas=row[8] if row[8] else None
            ))
        
        # Contar total de pedidos pendentes
        count_pedidos_query = f"SELECT COUNT(*) FROM orders {pedidos_where}"
        count_pedidos_params = pedidos_params[:-1]  # Remover limit
        total_pedidos = conn.execute(count_pedidos_query, count_pedidos_params).fetchone()[0]
        
        return PendentesResponse(
            transacoes=transacoes,
            pedidos=pedidos,
            total_transacoes=int(total_transacoes),
            total_pedidos=int(total_pedidos)
        )
    except Exception as e:
        import traceback
        print(f"Erro ao obter pendentes: {e}")
        print(traceback.format_exc())
        raise
    finally:
        conn.close()

