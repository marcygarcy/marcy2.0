"""Endpoints de transações."""
from fastapi import APIRouter, Query
from typing import Optional
from app.config.database import get_db_connection

router = APIRouter(prefix="/transactions", tags=["transactions"])


@router.get("/")
async def get_transactions(
    ciclo_pagamento: Optional[str] = Query(None, description="Filtrar por ciclo de pagamento"),
    ciclo_inicio: Optional[str] = Query(None, description="Ciclo inicial (para intervalo)"),
    ciclo_fim: Optional[str] = Query(None, description="Ciclo final (para intervalo)"),
    tipo: Optional[str] = Query(None, description="Filtrar por tipo de transação"),
    limit: int = Query(10000, description="Limite de registos"),
    offset: int = Query(0, description="Offset para paginação")
):
    """Obtém transações com filtros opcionais."""
    conn = get_db_connection()
    try:
        
        # Construir query base
        query = """
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
        """
        
        params = []
        conditions = []
        
        # Adicionar filtro de ciclo único se fornecido (sem intervalo)
        if ciclo_pagamento and ciclo_pagamento.lower() != "todos" and not ciclo_inicio and not ciclo_fim:
            conditions.append('"Ciclo Pagamento" = ?')
            params.append(ciclo_pagamento)
        
        # Adicionar filtro de intervalo de ciclos
        if ciclo_inicio and ciclo_fim:
            # Obter todos os ciclos entre inicio e fim
            # Primeiro, obter lista de todos os ciclos ordenados por data
            cycles_result = conn.execute("""
                SELECT "Ciclo Pagamento"
                FROM (
                    SELECT 
                        "Ciclo Pagamento",
                        MAX("Data do ciclo de faturamento") AS max_date
                    FROM transactions
                    WHERE "Ciclo Pagamento" IS NOT NULL
                    GROUP BY "Ciclo Pagamento"
                )
                ORDER BY max_date
            """).fetchall()
            
            all_cycles = [row[0] for row in cycles_result if row[0]]
            
            # Encontrar índices dos ciclos inicio e fim
            try:
                start_idx = all_cycles.index(ciclo_inicio)
                end_idx = all_cycles.index(ciclo_fim)
                if start_idx <= end_idx:
                    cycles_in_range = all_cycles[start_idx:end_idx + 1]
                    if cycles_in_range:
                        placeholders = ','.join(['?' for _ in cycles_in_range])
                        conditions.append(f'"Ciclo Pagamento" IN ({placeholders})')
                        params.extend(cycles_in_range)
            except ValueError:
                # Se os ciclos não forem encontrados, não aplicar filtro
                pass
        
        # Adicionar filtro de tipo
        if tipo and tipo.lower() != "todos":
            conditions.append('LOWER(Tipo) = LOWER(?)')
            params.append(tipo)
        
        if conditions:
            query += " WHERE " + " AND ".join(conditions)
        
        query += ' ORDER BY "Data do ciclo de faturamento" DESC, "Data Criação" DESC'
        query += f" LIMIT ? OFFSET ?"
        params.extend([limit, offset])
        
        # Executar query
        result = conn.execute(query, params).fetchall()
        
        # Converter para lista de dicionários
        transactions = []
        for row in result:
            transactions.append({
                "ciclo_pagamento": row[0],
                "data_ciclo_faturamento": str(row[1]) if row[1] else None,
                "data_criacao": str(row[2]) if row[2] else None,
                "canal_vendas": row[3],
                "tipo": row[4],
                "credito": float(row[5] or 0),
                "debito": float(row[6] or 0),
                "real": float(row[7] or 0),
                "valor": float(row[8] or 0) if row[8] else None,
                "descricao": row[9],
                "numero_pedido": row[10],
                "numero_fatura": row[11],
                "numero_transacao": row[12],
                "rotulo_categoria": row[13],
                "sku_oferta": row[14],
                "moeda": row[15]
            })
        
        # Obter total de registos
        count_query = "SELECT COUNT(*) FROM transactions"
        count_params = []
        if conditions:
            count_query += " WHERE " + " AND ".join(conditions)
            # Remover limit e offset dos params (últimos 2 elementos)
            count_params = params[:-2] if len(params) > 2 else params
        
        total_result = conn.execute(count_query, count_params).fetchone()
        total = int(total_result[0]) if total_result else 0
        
        return {
            "transactions": transactions,
            "total": total,
            "limit": limit,
            "offset": offset
        }
    finally:
        conn.close()


@router.get("/types")
async def get_transaction_types():
    """Obtém lista de todos os tipos de transação únicos."""
    conn = get_db_connection()
    try:
        result = conn.execute("""
            SELECT DISTINCT Tipo
            FROM transactions
            WHERE Tipo IS NOT NULL
            ORDER BY Tipo
        """).fetchall()
        
        types = [row[0] for row in result if row[0]]
        return {"types": types}
    finally:
        conn.close()

