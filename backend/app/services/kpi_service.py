"""Serviço de cálculo de KPIs."""
import duckdb
from typing import Dict, Optional, List
from app.config.database import get_db_connection
from app.models.kpis import (
    PrazosResponse,
    ComissoesResponse,
    ReembolsosResponse,
    ReservaResponse,
)


class KPIService:
    """Serviço para cálculo de KPIs."""
    
    def __init__(self):
        self.conn = get_db_connection()
    
    def _build_filter_clause(self, empresa_id: Optional[int] = None, marketplace_id: Optional[int] = None) -> tuple[str, list]:
        """Constrói cláusula WHERE para filtrar por empresa/marketplace."""
        conditions = []
        params = []
        
        if empresa_id is not None:
            conditions.append("empresa_id = ?")
            params.append(empresa_id)
        
        if marketplace_id is not None:
            conditions.append("marketplace_id = ?")
            params.append(marketplace_id)
        
        if conditions:
            return " AND " + " AND ".join(conditions), params
        return "", []
    
    def get_latest_cycle(self, empresa_id: Optional[int] = None, marketplace_id: Optional[int] = None) -> Optional[str]:
        """Retorna o ciclo mais recente."""
        filter_clause, filter_params = self._build_filter_clause(empresa_id, marketplace_id)
        query = f"""
            SELECT "Ciclo Pagamento"
            FROM transactions
            WHERE "Data do ciclo de faturamento" IS NOT NULL{filter_clause}
            ORDER BY "Data do ciclo de faturamento" DESC
            LIMIT 1
        """
        result = self.conn.execute(query, filter_params).fetchone()
        
        return result[0] if result else None
    
    def calculate_prazos(self, empresa_id: Optional[int] = None, marketplace_id: Optional[int] = None) -> PrazosResponse:
        """Calcula prazos médios (apenas 'Valor do pedido')."""
        try:
            filter_clause, filter_params = self._build_filter_clause(empresa_id, marketplace_id)
            # DuckDB usa DATEDIFF ou DATE_PART
            query = f"""
                WITH items AS (
                    SELECT 
                        CAST("Data do ciclo de faturamento" AS DATE) - CAST("Data Criação" AS DATE) AS dias
                    FROM transactions 
                    WHERE LOWER(Tipo) = 'valor do pedido'
                    AND "Data Criação" IS NOT NULL
                    AND "Data do ciclo de faturamento" IS NOT NULL{filter_clause}
                )
                SELECT 
                    AVG(dias) AS prazo_medio_dias,
                    MIN(dias) AS prazo_min_dias,
                    MAX(dias) AS prazo_max_dias
                FROM items
            """
            result = self.conn.execute(query, filter_params).fetchone()
            
            if result and result[0] is not None:
                return PrazosResponse(
                    prazo_medio_dias=round(float(result[0]), 2),
                    prazo_min_dias=int(result[1]) if result[1] is not None else 0,
                    prazo_max_dias=int(result[2]) if result[2] is not None else 0
                )
        except Exception as e:
            print(f"Erro ao calcular prazos: {e}")
        
        return PrazosResponse(prazo_medio_dias=0.0, prazo_min_dias=0, prazo_max_dias=0)
    
    def calculate_comissoes_acum(self, empresa_id: Optional[int] = None, marketplace_id: Optional[int] = None) -> ComissoesResponse:
        """Calcula comissões acumuladas de todos os dados históricos."""
        filter_clause, filter_params = self._build_filter_clause(empresa_id, marketplace_id)
        
        # Primeiro, verificar quais tipos existem (para debug)
        try:
            debug_query = f"""
                SELECT DISTINCT Tipo, SUM(Débito) as total_debito
                FROM transactions
                WHERE Tipo IS NOT NULL
                  AND (LOWER(Tipo) LIKE '%taxa%' 
                   OR LOWER(Tipo) LIKE '%comiss%'){filter_clause}
                GROUP BY Tipo
                ORDER BY total_debito DESC
            """
            debug_types = self.conn.execute(debug_query, filter_params).fetchall()
            if debug_types:
                print("Tipos de comissões encontrados:")
                for tipo, total in debug_types[:10]:  # Mostrar apenas os 10 primeiros
                    print(f"  - {tipo}: {total}")
        except Exception as e:
            print(f"Erro ao fazer debug de tipos: {e}")
        
        # Buscar todos os tipos de transações que possam ser comissões
        # Usar LIKE que funciona melhor no DuckDB
        query = f"""
            SELECT
                COALESCE(SUM(CASE 
                    WHEN LOWER(Tipo) LIKE '%taxa%' 
                     OR LOWER(Tipo) LIKE '%comiss%'
                    THEN COALESCE(Débito, 0)
                    ELSE 0 
                END), 0) AS comissoes,
                COALESCE(SUM(CASE 
                    WHEN LOWER(Tipo) LIKE '%imposto%taxa%'
                     OR LOWER(Tipo) LIKE '%imposto%comiss%'
                    THEN COALESCE(Débito, 0)
                    ELSE 0 
                END), 0) AS imp_comissoes
            FROM transactions
            WHERE Tipo IS NOT NULL
              AND (LOWER(Tipo) LIKE '%taxa%' 
               OR LOWER(Tipo) LIKE '%comiss%'
               OR LOWER(Tipo) LIKE '%imposto%taxa%'
               OR LOWER(Tipo) LIKE '%imposto%comiss%'){filter_clause}
        """
        result = self.conn.execute(query, filter_params).fetchone()
        
        comissoes_val = float(result[0] or 0) if result else 0.0
        imposto_val = float(result[1] or 0) if result else 0.0
        
        print(f"Comissões acumuladas calculadas: {comissoes_val}, Imposto: {imposto_val}")
        
        return ComissoesResponse(
            comissoes=comissoes_val,
            imposto=imposto_val
        )
    
    def calculate_comissoes_ult(self, empresa_id: Optional[int] = None, marketplace_id: Optional[int] = None) -> ComissoesResponse:
        """Calcula comissões do último ciclo."""
        latest_cycle = self.get_latest_cycle(empresa_id=empresa_id, marketplace_id=marketplace_id)
        if not latest_cycle:
            return ComissoesResponse(comissoes=0.0, imposto=0.0)
        
        filter_clause, filter_params = self._build_filter_clause(empresa_id, marketplace_id)
        params = [latest_cycle] + filter_params
        
        query = f"""
            SELECT
                COALESCE(SUM(CASE 
                    WHEN LOWER(Tipo) LIKE '%taxa%' 
                     OR LOWER(Tipo) LIKE '%comiss%'
                    THEN COALESCE(Débito, 0)
                    ELSE 0 
                END), 0) AS comissoes,
                COALESCE(SUM(CASE 
                    WHEN LOWER(Tipo) LIKE '%imposto%taxa%'
                     OR LOWER(Tipo) LIKE '%imposto%comiss%'
                    THEN COALESCE(Débito, 0)
                    ELSE 0 
                END), 0) AS imp_comissoes
            FROM transactions
            WHERE "Ciclo Pagamento" = ?{filter_clause}
              AND Tipo IS NOT NULL
              AND (LOWER(Tipo) LIKE '%taxa%' 
               OR LOWER(Tipo) LIKE '%comiss%'
               OR LOWER(Tipo) LIKE '%imposto%taxa%'
               OR LOWER(Tipo) LIKE '%imposto%comiss%')
        """
        result = self.conn.execute(query, params).fetchone()
        
        comissoes_val = float(result[0] or 0) if result else 0.0
        imposto_val = float(result[1] or 0) if result else 0.0
        
        print(f"Comissões último ciclo ({latest_cycle}): {comissoes_val}, Imposto: {imposto_val}")
        
        return ComissoesResponse(
            comissoes=comissoes_val,
            imposto=imposto_val
        )
    
    def calculate_reembolsos_acum(self, empresa_id: Optional[int] = None, marketplace_id: Optional[int] = None) -> ReembolsosResponse:
        """Calcula reembolsos acumulados (incluindo impostos)."""
        filter_clause, filter_params = self._build_filter_clause(empresa_id, marketplace_id)
        
        # Primeiro, verificar quais tipos de reembolsos existem (para debug)
        try:
            debug_query = f"""
                SELECT DISTINCT Tipo, SUM(Crédito) as total_credito
                FROM transactions
                WHERE Tipo IS NOT NULL
                  AND (LOWER(Tipo) LIKE '%reembolso%'){filter_clause}
                GROUP BY Tipo
                ORDER BY total_credito DESC
            """
            debug_types = self.conn.execute(debug_query, filter_params).fetchall()
            if debug_types:
                print("Tipos de reembolsos encontrados:")
                for tipo, total in debug_types[:10]:
                    print(f"  - {tipo}: {total}")
            else:
                print("Nenhum tipo de reembolso encontrado na base de dados")
        except Exception as e:
            print(f"Erro ao fazer debug de tipos de reembolso: {e}")
        
        # Buscar todos os tipos de reembolsos
        query = f"""
            SELECT
                COALESCE(SUM(CASE 
                    WHEN LOWER(Tipo) LIKE '%reembolso%'
                    THEN COALESCE(Crédito, 0)
                    ELSE 0 
                END), 0) AS reembolsos_incl_imp
            FROM transactions
            WHERE Tipo IS NOT NULL
              AND LOWER(Tipo) LIKE '%reembolso%'{filter_clause}
        """
        result = self.conn.execute(query, filter_params).fetchone()
        
        total_reembolsos = float(result[0] or 0) if result else 0.0
        print(f"Reembolsos acumulados calculados: {total_reembolsos}")
        
        return ReembolsosResponse(total=total_reembolsos)
    
    def calculate_reembolsos_ult(self, empresa_id: Optional[int] = None, marketplace_id: Optional[int] = None) -> ReembolsosResponse:
        """Calcula reembolsos do último ciclo."""
        latest_cycle = self.get_latest_cycle(empresa_id=empresa_id, marketplace_id=marketplace_id)
        if not latest_cycle:
            return ReembolsosResponse(total=0.0)
        
        filter_clause, filter_params = self._build_filter_clause(empresa_id, marketplace_id)
        params = [latest_cycle] + filter_params
        
        query = f"""
            SELECT
                COALESCE(SUM(CASE 
                    WHEN LOWER(Tipo) LIKE '%reembolso%'
                    THEN COALESCE(Crédito, 0)
                    ELSE 0 
                END), 0) AS reembolsos_incl_imp
            FROM transactions
            WHERE "Ciclo Pagamento" = ?{filter_clause}
              AND Tipo IS NOT NULL
              AND LOWER(Tipo) LIKE '%reembolso%'
        """
        result = self.conn.execute(query, params).fetchone()
        
        total_reembolsos = float(result[0] or 0) if result else 0.0
        print(f"Reembolsos último ciclo ({latest_cycle}): {total_reembolsos}")
        
        return ReembolsosResponse(total=total_reembolsos)
    
    def calculate_reserva_saldo(self, empresa_id: Optional[int] = None, marketplace_id: Optional[int] = None) -> ReservaResponse:
        """Calcula saldo de reserva estimado."""
        from app.config.settings import get_reserva_keywords
        
        filter_clause, filter_params = self._build_filter_clause(empresa_id, marketplace_id)
        
        keywords = get_reserva_keywords()
        # Criar condições OR para cada keyword
        keyword_conditions = " OR ".join([
            f"LOWER(COALESCE(Descrição, '')) LIKE '%{kw}%'" 
            for kw in keywords
        ])
        
        query = f"""
            WITH res AS (
                SELECT SUM(real) AS saldo
                FROM transactions
                WHERE (
                    LOWER(Tipo) LIKE '%fatura manual%' 
                    OR LOWER(Tipo) LIKE '%cr%dito manual%'
                )
                AND ({keyword_conditions}){filter_clause}
            )
            SELECT COALESCE(saldo, 0) AS reserva_saldo FROM res
        """
        
        result = self.conn.execute(query, filter_params).fetchone()
        saldo = float(result[0] or 0) if result else 0.0
        
        # Último ciclo de constituição
        ult_query = f"""
            SELECT "Ciclo Pagamento"
            FROM (
                SELECT "Ciclo Pagamento", SUM(real) AS v
                FROM transactions
                WHERE (
                    LOWER(Tipo) LIKE '%fatura manual%' 
                    OR LOWER(Tipo) LIKE '%cr%dito manual%'
                )
                AND ({keyword_conditions}){filter_clause}
                GROUP BY 1
            )
            WHERE v < 0
            ORDER BY "Ciclo Pagamento" DESC
            LIMIT 1
        """
        
        ult_ciclo_result = self.conn.execute(ult_query, filter_params).fetchone()
        ult_ciclo = ult_ciclo_result[0] if ult_ciclo_result else None
        
        return ReservaResponse(saldo=saldo, ultimo_ciclo=ult_ciclo)
    
    def get_reservas_list(self, empresa_id: Optional[int] = None, marketplace_id: Optional[int] = None) -> List[Dict]:
        """Obtém lista de todas as reservas."""
        from app.config.settings import get_reserva_keywords
        
        keywords = get_reserva_keywords()
        # Adicionar "rolling" às keywords baseado na imagem
        keywords = keywords + ["rolling"]
        
        filter_clause, filter_params = self._build_filter_clause(empresa_id, marketplace_id)
        
        # Criar condições OR para cada keyword
        keyword_conditions = " OR ".join([
            f"LOWER(COALESCE(Descrição, '')) LIKE '%{kw}%'" 
            for kw in keywords
        ])
        
        query = f"""
            SELECT 
                "Nº da transação",
                "Data Criação",
                "Nº da fatura",
                "Descrição",
                "Tipo",
                "Valor",
                COALESCE("Valor", Crédito - Débito) AS valor_calculado,
                "Ciclo Pagamento",
                real,
                Crédito,
                Débito
            FROM transactions
            WHERE (
                LOWER(Tipo) LIKE '%fatura manual%' 
                OR LOWER(Tipo) LIKE '%cr%dito manual%'
            )
            AND ({keyword_conditions}){filter_clause}
            ORDER BY "Ciclo Pagamento" DESC, "Data Criação" DESC
        """
        
        result = self.conn.execute(query, filter_params).fetchall()
        
        reservas = []
        for row in result:
            reservas.append({
                "numero_transacao": row[0] or "",
                "data_criacao": str(row[1]) if row[1] else None,
                "numero_fatura": row[2] or "",
                "descricao": row[3] or "",
                "tipo": row[4] or "",
                "valor": float(row[5] or 0) if row[5] is not None else float(row[6] or 0),
                "ciclo_pagamento": row[7] or "",
                "real": float(row[8] or 0),
                "credito": float(row[9] or 0),
                "debito": float(row[10] or 0)
            })
        
        return reservas
    
    def delete_reserva(self, numero_transacao: str, numero_fatura: str, data_criacao: str, tipo: str) -> bool:
        """Elimina uma reserva específica."""
        try:
            # Usar uma combinação de campos para identificar de forma única
            conditions = []
            params = []
            
            if numero_transacao:
                conditions.append('"Nº da transação" = ?')
                params.append(numero_transacao)
            
            if numero_fatura:
                conditions.append('"Nº da fatura" = ?')
                params.append(numero_fatura)
            
            if data_criacao:
                conditions.append('CAST("Data Criação" AS DATE) = CAST(? AS DATE)')
                params.append(data_criacao)
            
            if tipo:
                conditions.append('"Tipo" = ?')
                params.append(tipo)
            
            if not conditions:
                return False
            
            query = f"""
                DELETE FROM transactions
                WHERE {' AND '.join(conditions)}
            """
            
            result = self.conn.execute(query, params)
            self.conn.commit()
            
            return result.rowcount > 0
        except Exception as e:
            print(f"Erro ao eliminar reserva: {e}")
            import traceback
            print(traceback.format_exc())
            return False
    
    def count_pedidos_recebidos(self, empresa_id: Optional[int] = None, marketplace_id: Optional[int] = None) -> int:
        """Conta pedidos recebidos (status 'Recebido')."""
        filter_clause, filter_params = self._build_filter_clause(empresa_id, marketplace_id)
        query = f"""
            SELECT COUNT(DISTINCT "Nº Pedido")
            FROM transactions
            WHERE LOWER(Tipo) = 'valor do pedido'
            AND "Nº Pedido" IS NOT NULL{filter_clause}
        """
        result = self.conn.execute(query, filter_params).fetchone()
        
        return int(result[0] or 0) if result else 0
    
    def count_produtos_vendidos(self) -> int:
        """Conta produtos vendidos (total acumulado)."""
        result = self.conn.execute("""
            SELECT COUNT(*)
            FROM transactions
            WHERE LOWER(Tipo) = 'valor do pedido'
            AND "SKU da oferta" IS NOT NULL
        """).fetchone()
        
        return int(result[0] or 0) if result else 0
    
    def count_produtos_vendidos_ultimo_ciclo(self, empresa_id: Optional[int] = None, marketplace_id: Optional[int] = None) -> int:
        """Conta produtos vendidos no último ciclo (soma de Quantidade ou COUNT de transações)."""
        latest_cycle = self.get_latest_cycle(empresa_id=empresa_id, marketplace_id=marketplace_id)
        if not latest_cycle:
            return 0
        
        filter_clause, filter_params = self._build_filter_clause(empresa_id, marketplace_id)
        params = [latest_cycle] + filter_params
        
        # Contar usando Quantidade se disponível, senão COUNT de transações
        query = f"""
            SELECT COALESCE(SUM(Quantidade), COUNT(*))
            FROM transactions
            WHERE LOWER(Tipo) = 'valor do pedido'
            AND "SKU da oferta" IS NOT NULL
            AND "SKU da oferta" != ''
            AND "Ciclo Pagamento" = ?{filter_clause}
        """
        result = self.conn.execute(query, params).fetchone()
        
        count = int(result[0] or 0) if result else 0
        
        # Debug
        debug_query = f"""
            SELECT 
                COUNT(*) as transacoes,
                SUM(COALESCE(Quantidade, 0)) as soma_quantidade,
                COUNT(Quantidade) as com_quantidade
            FROM transactions
            WHERE LOWER(Tipo) = 'valor do pedido'
            AND "SKU da oferta" IS NOT NULL
            AND "SKU da oferta" != ''
            AND "Ciclo Pagamento" = ?{filter_clause}
        """
        debug_count = self.conn.execute(debug_query, params).fetchone()
        
        if debug_count:
            print(f"Produtos vendidos último ciclo ({latest_cycle}): Transações={debug_count[0]}, Soma Quantidade={debug_count[1]}, Com Quantidade={debug_count[2]}, Resultado={count}")
        
        return count
    
    def calculate_vendas_brutas(self, empresa_id: Optional[int] = None, marketplace_id: Optional[int] = None) -> float:
        """Calcula vendas brutas (soma de Valor para 'Valor do pedido')."""
        filter_clause, filter_params = self._build_filter_clause(empresa_id, marketplace_id)
        
        try:
            # Primeiro tentar usar a coluna Valor (se existir e tiver dados)
            query = f"""
                SELECT COALESCE(SUM(Valor), 0), COUNT(*)
                FROM transactions
                WHERE LOWER(Tipo) = 'valor do pedido'
                AND Valor IS NOT NULL
                AND Valor != 0{filter_clause}
            """
            result = self.conn.execute(query, filter_params).fetchone()

            if result:
                vendas_valor = float(result[0] or 0)
                count_valor = int(result[1] or 0)

                # Se temos valores na coluna Valor, usar essa
                if count_valor > 0 and vendas_valor > 0:
                    return vendas_valor

            # Se Valor não tiver dados, usar Crédito (que geralmente tem os valores)
            query_credito = f"""
                SELECT COALESCE(SUM(Crédito), 0)
                FROM transactions
                WHERE LOWER(Tipo) = 'valor do pedido'
                AND Crédito IS NOT NULL
                AND Crédito != 0{filter_clause}
            """
            result_credito = self.conn.execute(query_credito, filter_params).fetchone()

            vendas_credito = float(result_credito[0] or 0) if result_credito else 0.0

            if vendas_credito > 0:
                print(f"Usando Crédito para Vendas Brutas (Valor não disponível): {vendas_credito}")
                return vendas_credito

            return 0.0
        except Exception as e:
            print(f"Erro ao calcular vendas brutas: {e}")
            import traceback
            print(traceback.format_exc())
            # Tentar fallback com Crédito
            try:
                query_fallback = f"""
                    SELECT COALESCE(SUM(Crédito), 0)
                    FROM transactions
                    WHERE LOWER(Tipo) = 'valor do pedido'
                    AND Crédito IS NOT NULL{filter_clause}
                """
                result = self.conn.execute(query_fallback, filter_params).fetchone()
                return float(result[0] or 0) if result else 0.0
            except:
                return 0.0
    
    def get_vendas_brutas_por_ciclo(self, empresa_id: Optional[int] = None, marketplace_id: Optional[int] = None) -> List[Dict]:
        """Obtém vendas brutas agrupadas por ciclo."""
        try:
            filter_clause, filter_params = self._build_filter_clause(empresa_id, marketplace_id)
            # Primeiro tentar usar a coluna Valor
            query = f"""
                WITH cycle_data AS (
                    SELECT 
                        "Ciclo Pagamento",
                        MAX("Data do ciclo de faturamento") AS data_ciclo,
                        COALESCE(SUM(Valor), 0) AS vendas_valor,
                        COUNT(CASE WHEN Valor IS NOT NULL AND Valor != 0 THEN 1 END) AS count_valor,
                        COALESCE(SUM(Crédito), 0) AS vendas_credito
                    FROM transactions
                    WHERE LOWER(Tipo) = 'valor do pedido'
                      AND "Ciclo Pagamento" IS NOT NULL{filter_clause}
                    GROUP BY "Ciclo Pagamento"
                )
                SELECT 
                    "Ciclo Pagamento",
                    data_ciclo,
                    CASE 
                        WHEN count_valor > 0 AND vendas_valor > 0 THEN vendas_valor
                        ELSE vendas_credito
                    END AS vendas_brutas
                FROM cycle_data
                ORDER BY data_ciclo ASC
            """
            result = self.conn.execute(query, filter_params).fetchall()
            
            cycles = []
            for row in result:
                cycles.append({
                    "ciclo": row[0] or "",
                    "data_ciclo": str(row[1]) if row[1] else "",
                    "vendas_brutas": float(row[2] or 0)
                })
            
            return cycles
        except Exception as e:
            print(f"Erro ao calcular vendas brutas por ciclo: {e}")
            import traceback
            print(traceback.format_exc())
            return []
    
    def get_produto_mais_vendido_historico(self, empresa_id: Optional[int] = None, marketplace_id: Optional[int] = None) -> Optional[Dict]:
        """Obtém o produto mais vendido no histórico (por quantidade)."""
        try:
            filter_clause, filter_params = self._build_filter_clause(empresa_id, marketplace_id)
            # Encontrar SKU mais vendido (maior quantidade de unidades físicas)
            query = f"""
                WITH sku_stats AS (
                    SELECT 
                        "SKU da oferta" AS sku,
                        "Rótulo da categoria" AS categoria,
                        COALESCE(SUM(Quantidade), COUNT(*)) AS quantidade,
                        COALESCE(SUM(CASE 
                            WHEN Valor IS NOT NULL AND Valor != 0 THEN Valor
                            ELSE Crédito
                        END), 0) AS valor_total
                    FROM transactions
                    WHERE LOWER(Tipo) = 'valor do pedido'
                      AND "SKU da oferta" IS NOT NULL
                      AND "SKU da oferta" != ''{filter_clause}
                    GROUP BY "SKU da oferta", "Rótulo da categoria"
                )
                SELECT 
                    sku,
                    COALESCE(MAX(categoria), 'N/A') AS categoria,
                    quantidade,
                    valor_total
                FROM sku_stats
                GROUP BY sku, quantidade, valor_total
                ORDER BY quantidade DESC
                LIMIT 1
            """
            result = self.conn.execute(query, filter_params).fetchone()
            
            if not result or not result[0]:
                print("Nenhum produto encontrado no histórico")
                return None
            
            valor_total = float(result[3] or 0)
            quantidade = float(result[2] or 0)
            preco_unitario = (valor_total / quantidade) if quantidade > 0 else 0.0
            
            print(f"Produto mais vendido histórico: SKU={result[0]}, Quantidade={quantidade}, Valor={valor_total}, Preço Unitário={preco_unitario}")
            
            return {
                "sku": result[0] or "",
                "categoria": result[1] or "N/A",
                "quantidade": int(quantidade) if quantidade else 0,
                "valor_total": valor_total,
                "preco_unitario": round(preco_unitario, 2)
            }
        except Exception as e:
            print(f"Erro ao obter produto mais vendido histórico: {e}")
            import traceback
            print(traceback.format_exc())
            return None
    
    def get_produto_mais_vendido_ultimos_60_dias(self, empresa_id: Optional[int] = None, marketplace_id: Optional[int] = None) -> Optional[Dict]:
        """Obtém o produto mais vendido nos últimos 60 dias (por quantidade)."""
        try:
            from datetime import datetime, timedelta
            filter_clause, filter_params = self._build_filter_clause(empresa_id, marketplace_id)
            # Calcular data de 60 dias atrás
            data_limite = datetime.now() - timedelta(days=60)
            data_limite_str = data_limite.strftime('%Y-%m-%d')
            
            # Encontrar SKU mais vendido nos últimos 60 dias
            # A ordem na query: primeiro a data (?) depois filter_clause
            # A ordem dos parâmetros: primeiro data_limite, depois filter_params
            query = f"""
                WITH sku_stats AS (
                    SELECT 
                        "SKU da oferta" AS sku,
                        "Rótulo da categoria" AS categoria,
                        COALESCE(SUM(Quantidade), COUNT(*)) AS quantidade,
                        COALESCE(SUM(CASE 
                            WHEN Valor IS NOT NULL AND Valor != 0 THEN Valor
                            ELSE Crédito
                        END), 0) AS valor_total
                    FROM transactions
                    WHERE LOWER(Tipo) = 'valor do pedido'
                      AND "SKU da oferta" IS NOT NULL
                      AND "SKU da oferta" != ''
                      AND CAST("Data Criação" AS DATE) >= ?{filter_clause}
                    GROUP BY "SKU da oferta", "Rótulo da categoria"
                )
                SELECT 
                    sku,
                    COALESCE(MAX(categoria), 'N/A') AS categoria,
                    quantidade,
                    valor_total
                FROM sku_stats
                GROUP BY sku, quantidade, valor_total
                ORDER BY quantidade DESC
                LIMIT 1
            """
            # Ordem dos parâmetros: primeiro data_limite, depois filter_params
            all_params = [data_limite_str] + filter_params
            result = self.conn.execute(query, all_params).fetchone()
            
            if not result or not result[0]:
                return None
            
            valor_total = float(result[3] or 0)
            quantidade = float(result[2] or 0)
            preco_unitario = (valor_total / quantidade) if quantidade > 0 else 0.0
            
            return {
                "sku": result[0] or "",
                "categoria": result[1] or "N/A",
                "quantidade": int(quantidade) if quantidade else 0,
                "valor_total": valor_total,
                "preco_unitario": round(preco_unitario, 2)
            }
        except Exception as e:
            print(f"Erro ao obter produto mais vendido últimos 60 dias: {e}")
            import traceback
            print(traceback.format_exc())
            return None
    
    def get_reconciliation(self, window_days: int = 7, empresa_id: Optional[int] = None, marketplace_id: Optional[int] = None) -> list:
        """Obtém conciliação Net por ciclo vs Movimentos Bancários (baseado no ciclo)."""
        try:
            filter_clause_t, filter_params_t = self._build_filter_clause(empresa_id, marketplace_id)
            filter_clause_b, filter_params_b = self._build_filter_clause(empresa_id, marketplace_id)
            # Usar bank_movements que já tem o ciclo associado
            query = f"""
                WITH cycle AS (
                    SELECT 
                        "Ciclo Pagamento", 
                        MAX("Data do ciclo de faturamento") AS end_dt,
                        SUM(Crédito) - SUM(Débito) AS net
                    FROM transactions
                    WHERE "Ciclo Pagamento" IS NOT NULL{filter_clause_t}
                    GROUP BY "Ciclo Pagamento"
                ),
                bank_movs AS (
                    SELECT 
                        ciclo,
                        SUM(montante) AS total_movimento
                    FROM bank_movements
                    WHERE ciclo IS NOT NULL{filter_clause_b}
                    GROUP BY ciclo
                )
                SELECT
                    cycle."Ciclo Pagamento",
                    CAST(cycle.end_dt AS DATE) AS cycle_end,
                    cycle.net,
                    COALESCE(bank_movs.total_movimento, 0) AS trf_0_7,
                    COALESCE(bank_movs.total_movimento, 0) - cycle.net AS diff
                FROM cycle
                LEFT JOIN bank_movs ON cycle."Ciclo Pagamento" = bank_movs.ciclo
                ORDER BY cycle_end
            """
            result = self.conn.execute(query, filter_params_t + filter_params_b).fetchall()
        except Exception as e:
            print(f"Erro ao calcular conciliação: {e}")
            import traceback
            print(traceback.format_exc())
            # Se houver erro, tentar versão simplificada
            try:
                result = self.conn.execute("""
                    WITH cycle AS (
                        SELECT 
                            "Ciclo Pagamento", 
                            CAST(MAX("Data do ciclo de faturamento") AS DATE) AS cycle_end,
                            SUM(Crédito) - SUM(Débito) AS net
                        FROM transactions
                        WHERE "Ciclo Pagamento" IS NOT NULL
                        GROUP BY "Ciclo Pagamento"
                    ),
                    bank_movs AS (
                        SELECT 
                            ciclo,
                            SUM(montante) AS total_movimento
                        FROM bank_movements
                        WHERE ciclo IS NOT NULL
                        GROUP BY ciclo
                    )
                    SELECT
                        cycle."Ciclo Pagamento",
                        cycle.cycle_end,
                        cycle.net,
                        COALESCE(bank_movs.total_movimento, 0) AS trf_0_7,
                        COALESCE(bank_movs.total_movimento, 0) - cycle.net AS diff
                    FROM cycle
                    LEFT JOIN bank_movs ON cycle."Ciclo Pagamento" = bank_movs.ciclo
                    ORDER BY cycle.cycle_end
                """).fetchall()
            except Exception as e2:
                print(f"Erro no fallback de conciliação: {e2}")
                return []
        
        return [
            {
                "ciclo": row[0],
                "cycle_end": str(row[1]) if row[1] else "",
                "net": float(row[2] or 0),
                "trf_0_7": float(row[3] or 0),
                "diff": float(row[4] or 0)
            }
            for row in result
        ]
    
    def get_last_cycle_breakdown(self, empresa_id: Optional[int] = None, marketplace_id: Optional[int] = None) -> Dict:
        """Obtém breakdown detalhado do último ciclo por tipo de transação."""
        latest_cycle = self.get_latest_cycle(empresa_id=empresa_id, marketplace_id=marketplace_id)
        if not latest_cycle:
            return {
                "ciclo": None,
                "data_ciclo": None,
                "breakdown": [],
                "total_net": 0.0
            }
        
        filter_clause, filter_params = self._build_filter_clause(empresa_id, marketplace_id)
        
        # Obter data do ciclo
        query_cycle = f"""
            SELECT MAX("Data do ciclo de faturamento")
            FROM transactions
            WHERE "Ciclo Pagamento" = ?{filter_clause}
        """
        cycle_date_result = self.conn.execute(query_cycle, [latest_cycle] + filter_params).fetchone()
        
        cycle_date = str(cycle_date_result[0]) if cycle_date_result and cycle_date_result[0] else None
        
        # Obter breakdown por tipo
        query_breakdown = f"""
            SELECT 
                Tipo,
                SUM(Crédito) AS total_credito,
                SUM(Débito) AS total_debito,
                SUM(real) AS total_real,
                COUNT(*) AS quantidade
            FROM transactions
            WHERE "Ciclo Pagamento" = ?{filter_clause}
            GROUP BY Tipo
            ORDER BY ABS(SUM(real)) DESC
        """
        breakdown_result = self.conn.execute(query_breakdown, [latest_cycle] + filter_params).fetchall()
        
        breakdown = [
            {
                "tipo": row[0] or "N/A",
                "credito": float(row[1] or 0),
                "debito": float(row[2] or 0),
                "real": float(row[3] or 0),
                "quantidade": int(row[4] or 0)
            }
            for row in breakdown_result
        ]
        
        # Calcular total net
        total_net = sum(item["real"] for item in breakdown)
        
        return {
            "ciclo": latest_cycle,
            "data_ciclo": cycle_date,
            "breakdown": breakdown,
            "total_net": total_net
        }
    
    def get_ultimo_ciclo_pago(self, empresa_id: Optional[int] = None, marketplace_id: Optional[int] = None) -> Dict:
        """Obtém o último ciclo pago (baseado em movimentos bancários) e o seu valor."""
        try:
            filter_clause_t, filter_params_t = self._build_filter_clause(empresa_id, marketplace_id)
            filter_clause_b, filter_params_b = self._build_filter_clause(empresa_id, marketplace_id)
            
            # Buscar o último ciclo que tem movimentos bancários
            query = f"""
                WITH ultimo_ciclo_pago AS (
                    SELECT 
                        bm.ciclo,
                        MAX(bm.data_movimento) AS data_movimento,
                        SUM(bm.montante) AS valor_total
                    FROM bank_movements bm
                    WHERE bm.ciclo IS NOT NULL
                      AND bm.ciclo != ''{filter_clause_b}
                    GROUP BY bm.ciclo
                    ORDER BY MAX(bm.data_movimento) DESC
                    LIMIT 1
                )
                SELECT 
                    ciclo,
                    data_movimento,
                    valor_total
                FROM ultimo_ciclo_pago
            """
            result = self.conn.execute(query, filter_params_b).fetchone()
            
            if result and result[0]:
                return {
                    "ciclo": result[0] or None,
                    "valor": float(result[2] or 0) if result[2] else 0.0,
                    "data_ciclo": str(result[1]) if result[1] else None
                }
            
            # Se não houver movimentos bancários, usar o último ciclo com transações
            query_fallback = f"""
                SELECT 
                    "Ciclo Pagamento",
                    MAX("Data do ciclo de faturamento") AS data_ciclo,
                    SUM(Crédito) - SUM(Débito) AS valor_net
                FROM transactions
                WHERE "Ciclo Pagamento" IS NOT NULL
                  AND "Ciclo Pagamento" != ''{filter_clause_t}
                GROUP BY "Ciclo Pagamento"
                ORDER BY MAX("Data do ciclo de faturamento") DESC
                LIMIT 1
            """
            result_fallback = self.conn.execute(query_fallback, filter_params_t).fetchone()
            
            if result_fallback and result_fallback[0]:
                return {
                    "ciclo": result_fallback[0] or None,
                    "valor": float(result_fallback[2] or 0) if result_fallback[2] else 0.0,
                    "data_ciclo": str(result_fallback[1]) if result_fallback[1] else None
                }
            
            return {
                "ciclo": None,
                "valor": 0.0,
                "data_ciclo": None
            }
        except Exception as e:
            print(f"Erro ao obter último ciclo pago: {e}")
            import traceback
            print(traceback.format_exc())
            return {
                "ciclo": None,
                "valor": 0.0,
                "data_ciclo": None
            }
    
    def close(self):
        """Fecha conexão."""
        if self.conn:
            self.conn.close()

