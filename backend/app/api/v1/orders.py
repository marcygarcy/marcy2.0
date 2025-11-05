"""Endpoints para listagem de orders (pedidos)."""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from pydantic import BaseModel
from app.config.database import get_db_connection
from app.api.deps import get_upload_service
from app.services.upload_service import UploadService

router = APIRouter(prefix="/orders", tags=["orders"])


class Order(BaseModel):
    """Modelo de order."""
    id: int
    numero_pedido: str
    data_criacao: Optional[str] = None
    data_pagamento: Optional[str] = None
    ciclo_pagamento: Optional[str] = None
    valor_total: Optional[float] = None
    quantidade_itens: Optional[int] = None
    status: Optional[str] = None
    canal_vendas: Optional[str] = None
    empresa_id: Optional[int] = None
    marketplace_id: Optional[int] = None
    data_upload: Optional[str] = None


class OrdersResponse(BaseModel):
    """Resposta de listagem de orders."""
    orders: List[Order]
    total: int
    limit: int
    offset: int


@router.get("/", response_model=OrdersResponse)
async def get_orders(
    empresa_id: Optional[int] = Query(None, description="Filtrar por ID da empresa"),
    marketplace_id: Optional[int] = Query(None, description="Filtrar por ID do marketplace"),
    limit: int = Query(100, ge=1, le=1000, description="Limite de registos"),
    offset: int = Query(0, ge=0, description="Offset para paginação")
):
    """Obtém lista de orders (pedidos)."""
    conn = get_db_connection()
    try:
        # Construir filtros
        conditions = []
        params = []
        
        if empresa_id is not None:
            conditions.append("empresa_id = ?")
            params.append(empresa_id)
        
        if marketplace_id is not None:
            conditions.append("marketplace_id = ?")
            params.append(marketplace_id)
        
        where_clause = ""
        if conditions:
            where_clause = "WHERE " + " AND ".join(conditions)
        
        # Contar total
        count_query = f"SELECT COUNT(*) FROM orders {where_clause}"
        total_result = conn.execute(count_query, params).fetchone()
        total = int(total_result[0]) if total_result else 0
        
        # Buscar orders
        query = f"""
            SELECT 
                id, numero_pedido, data_criacao, data_pagamento, ciclo_pagamento,
                valor_total, quantidade_itens, status, canal_vendas, empresa_id, marketplace_id, data_upload
            FROM orders
            {where_clause}
            ORDER BY data_criacao DESC NULLS LAST, id DESC
            LIMIT ? OFFSET ?
        """
        params.extend([limit, offset])
        
        results = conn.execute(query, params).fetchall()
        
        orders = []
        for row in results:
            orders.append(Order(
                id=row[0],
                numero_pedido=row[1] or "",
                data_criacao=str(row[2]) if row[2] else None,
                data_pagamento=str(row[3]) if row[3] else None,
                ciclo_pagamento=row[4] if row[4] else None,
                valor_total=float(row[5]) if row[5] is not None else None,
                quantidade_itens=int(row[6]) if row[6] is not None else None,
                status=row[7] if row[7] else None,
                canal_vendas=row[8] if row[8] else None,
                empresa_id=row[9] if row[9] is not None else None,
                marketplace_id=row[10] if row[10] is not None else None,
                data_upload=str(row[11]) if row[11] else None
            ))
        
        return OrdersResponse(
            orders=orders,
            total=total,
            limit=limit,
            offset=offset
        )
    except Exception as e:
        import traceback
        print(f"Erro ao obter orders: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Erro ao obter orders: {str(e)}")
    finally:
        conn.close()

