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
    quantidade: Optional[float] = None
    detalhes: Optional[str] = None
    status: Optional[str] = None
    valor: Optional[float] = None
    canal_vendas: Optional[str] = None
    sku_oferta: Optional[str] = None
    marca: Optional[str] = None
    etiqueta_categoria: Optional[str] = None
    preco_unitario: Optional[float] = None
    valor_total_sem_impostos: Optional[float] = None
    valor_total_com_iva: Optional[float] = None
    comissao_sem_impostos: Optional[float] = None
    valor_comissao_com_impostos: Optional[float] = None
    valor_transferido_loja: Optional[float] = None
    pais_faturamento: Optional[str] = None
    imposto_produto_tva_fr_20: Optional[float] = None
    imposto_envio_tva_fr_20: Optional[float] = None
    imposto_produto_tva_es_21: Optional[float] = None
    imposto_envio_tva_es_21: Optional[float] = None
    imposto_produto_tva_it_22: Optional[float] = None
    imposto_envio_tva_it_22: Optional[float] = None
    imposto_produto_tva_zero: Optional[float] = None
    imposto_envio_tva_zero: Optional[float] = None
    total_impostos_pedido: Optional[float] = None
    total_impostos_envio: Optional[float] = None
    # Campos antigos (compatibilidade)
    data_pagamento: Optional[str] = None
    ciclo_pagamento: Optional[str] = None
    valor_total: Optional[float] = None
    quantidade_itens: Optional[int] = None
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
                id, numero_pedido, data_criacao, quantidade, detalhes, status, valor,
                canal_vendas, sku_oferta, marca, etiqueta_categoria, preco_unitario,
                valor_total_sem_impostos, valor_total_com_iva, comissao_sem_impostos,
                valor_comissao_com_impostos, valor_transferido_loja, pais_faturamento,
                imposto_produto_tva_fr_20, imposto_envio_tva_fr_20,
                imposto_produto_tva_es_21, imposto_envio_tva_es_21,
                imposto_produto_tva_it_22, imposto_envio_tva_it_22,
                imposto_produto_tva_zero, imposto_envio_tva_zero,
                total_impostos_pedido, total_impostos_envio,
                data_pagamento, ciclo_pagamento, valor_total, quantidade_itens,
                empresa_id, marketplace_id, data_upload
            FROM orders
            {where_clause}
            ORDER BY data_criacao DESC NULLS LAST, id DESC
            LIMIT ? OFFSET ?
        """
        params.extend([limit, offset])
        
        results = conn.execute(query, params).fetchall()
        
        orders = []
        for row in results:
            # Garantir que numero_pedido nunca é vazio (usar ID como fallback)
            numero_pedido = row[1] if row[1] and str(row[1]).strip() else f"ORD-{row[0]}"
            orders.append(Order(
                id=row[0],
                numero_pedido=str(numero_pedido).strip() if numero_pedido else f"ORD-{row[0]}",
                data_criacao=str(row[2]) if row[2] else None,
                quantidade=float(row[3]) if row[3] is not None else None,
                detalhes=row[4] if row[4] else None,
                status=row[5] if row[5] else None,
                valor=float(row[6]) if row[6] is not None else None,
                canal_vendas=row[7] if row[7] else None,
                sku_oferta=row[8] if row[8] else None,
                marca=row[9] if row[9] else None,
                etiqueta_categoria=row[10] if row[10] else None,
                preco_unitario=float(row[11]) if row[11] is not None else None,
                valor_total_sem_impostos=float(row[12]) if row[12] is not None else None,
                valor_total_com_iva=float(row[13]) if row[13] is not None else None,
                comissao_sem_impostos=float(row[14]) if row[14] is not None else None,
                valor_comissao_com_impostos=float(row[15]) if row[15] is not None else None,
                valor_transferido_loja=float(row[16]) if row[16] is not None else None,
                pais_faturamento=row[17] if row[17] else None,
                imposto_produto_tva_fr_20=float(row[18]) if row[18] is not None else None,
                imposto_envio_tva_fr_20=float(row[19]) if row[19] is not None else None,
                imposto_produto_tva_es_21=float(row[20]) if row[20] is not None else None,
                imposto_envio_tva_es_21=float(row[21]) if row[21] is not None else None,
                imposto_produto_tva_it_22=float(row[22]) if row[22] is not None else None,
                imposto_envio_tva_it_22=float(row[23]) if row[23] is not None else None,
                imposto_produto_tva_zero=float(row[24]) if row[24] is not None else None,
                imposto_envio_tva_zero=float(row[25]) if row[25] is not None else None,
                total_impostos_pedido=float(row[26]) if row[26] is not None else None,
                total_impostos_envio=float(row[27]) if row[27] is not None else None,
                data_pagamento=str(row[28]) if row[28] else None,
                ciclo_pagamento=row[29] if row[29] else None,
                valor_total=float(row[30]) if row[30] is not None else None,
                quantidade_itens=int(row[31]) if row[31] is not None else None,
                empresa_id=row[32] if row[32] is not None else None,
                marketplace_id=row[33] if row[33] is not None else None,
                data_upload=str(row[34]) if row[34] else None
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

