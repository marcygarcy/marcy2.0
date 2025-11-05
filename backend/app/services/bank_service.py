"""Serviço para gestão de movimentos bancários."""

from typing import Dict, List, Optional
from datetime import datetime, date
from app.config.database import get_db_connection


class BankService:
    """Serviço para gestão de movimentos bancários."""

    def __init__(self):
        self.conn = get_db_connection()

    def get_bank_movements(
        self,
        mes: Optional[str] = None,
        data_inicio: Optional[str] = None,
        data_fim: Optional[str] = None
    ) -> List[Dict]:
        """
        Obtém movimentos bancários.
        
        Args:
            mes: Mês no formato "YYYY-MM" (ex: "2024-10")
            data_inicio: Data inicial no formato "YYYY-MM-DD"
            data_fim: Data final no formato "YYYY-MM-DD"
        """
        try:
            query = """
                SELECT 
                    id,
                    data_ctb,
                    data_movimento,
                    ciclo,
                    montante
                FROM bank_movements
                WHERE 1=1
            """
            
            params = []
            
            # Filtro por mês (usando data_movimento)
            if mes:
                query += " AND EXTRACT(YEAR FROM data_movimento) = ? AND EXTRACT(MONTH FROM data_movimento) = ?"
                year, month = mes.split("-")
                params.extend([int(year), int(month)])
            
            # Filtro por intervalo de datas (usando data_movimento)
            if data_inicio:
                query += " AND data_movimento >= ?"
                params.append(data_inicio)
            
            if data_fim:
                query += " AND data_movimento <= ?"
                params.append(data_fim)
            
            query += " ORDER BY data_movimento DESC, id DESC"
            
            result = self.conn.execute(query, params).fetchall()
            
            movements = []
            for row in result:
                movements.append({
                    "id": int(row[0]) if row[0] else None,
                    "data_ctb": row[1].isoformat() if row[1] and isinstance(row[1], date) else (str(row[1]) if row[1] else ""),
                    "data_movimento": row[2].isoformat() if row[2] and isinstance(row[2], date) else (str(row[2]) if row[2] else ""),
                    "ciclo": row[3] or "",
                    "montante": float(row[4]) if row[4] else 0.0
                })
            
            return movements
            
        except Exception as e:
            print(f"Erro ao obter movimentos bancários: {e}")
            import traceback
            print(traceback.format_exc())
            return []

    def create_bank_movement(
        self,
        data_ctb: str,
        data_movimento: str,
        ciclo: str,
        montante: float
    ) -> Dict:
        """Cria um novo movimento bancário."""
        try:
            # Calcular próximo ID
            next_id_result = self.conn.execute("""
                SELECT COALESCE(MAX(id), 0) + 1 FROM bank_movements
            """).fetchone()
            
            next_id = int(next_id_result[0]) if next_id_result and next_id_result[0] else 1
            
            self.conn.execute("""
                INSERT INTO bank_movements (id, data_ctb, data_movimento, ciclo, montante, empresa_id, marketplace_id)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, [next_id, data_ctb, data_movimento, ciclo or None, montante, 2, 1])  # Teste 123, Pixmania
            
            self.conn.commit()
            
            return {
                "id": next_id,
                "data_ctb": data_ctb,
                "data_movimento": data_movimento,
                "ciclo": ciclo,
                "montante": montante
            }
        except Exception as e:
            print(f"Erro ao criar movimento bancário: {e}")
            import traceback
            print(traceback.format_exc())
            raise

    def update_bank_movement(
        self,
        movement_id: int,
        data_ctb: str,
        data_movimento: str,
        ciclo: str,
        montante: float
    ) -> Dict:
        """Atualiza um movimento bancário existente."""
        try:
            self.conn.execute("""
                UPDATE bank_movements
                SET data_ctb = ?, data_movimento = ?, ciclo = ?, montante = ?
                WHERE id = ?
            """, [data_ctb, data_movimento, ciclo or None, montante, movement_id])
            
            self.conn.commit()
            
            return {
                "id": movement_id,
                "data_ctb": data_ctb,
                "data_movimento": data_movimento,
                "ciclo": ciclo,
                "montante": montante
            }
        except Exception as e:
            print(f"Erro ao atualizar movimento bancário: {e}")
            import traceback
            print(traceback.format_exc())
            raise

    def delete_bank_movement(self, movement_id: int) -> bool:
        """Remove um movimento bancário."""
        try:
            self.conn.execute("""
                DELETE FROM bank_movements WHERE id = ?
            """, [movement_id])
            
            self.conn.commit()
            return True
        except Exception as e:
            print(f"Erro ao remover movimento bancário: {e}")
            import traceback
            print(traceback.format_exc())
            raise

    def get_total_amount(
        self,
        mes: Optional[str] = None,
        data_inicio: Optional[str] = None,
        data_fim: Optional[str] = None
    ) -> float:
        """Calcula o total de montantes no período filtrado."""
        try:
            query = "SELECT COALESCE(SUM(montante), 0) FROM bank_movements WHERE 1=1"
            params = []
            
            if mes:
                query += " AND EXTRACT(YEAR FROM data_movimento) = ? AND EXTRACT(MONTH FROM data_movimento) = ?"
                year, month = mes.split("-")
                params.extend([int(year), int(month)])
            
            if data_inicio:
                query += " AND data_movimento >= ?"
                params.append(data_inicio)
            
            if data_fim:
                query += " AND data_movimento <= ?"
                params.append(data_fim)
            
            result = self.conn.execute(query, params).fetchone()
            return float(result[0]) if result and result[0] else 0.0
            
        except Exception as e:
            print(f"Erro ao calcular total: {e}")
            return 0.0

    def get_available_cycles(self) -> List[str]:
        """Obtém lista de ciclos disponíveis."""
        try:
            result = self.conn.execute("""
                SELECT DISTINCT "Ciclo Pagamento"
                FROM (
                    SELECT 
                        "Ciclo Pagamento",
                        MAX("Data do ciclo de faturamento") AS max_date
                    FROM transactions
                    WHERE "Ciclo Pagamento" IS NOT NULL
                    GROUP BY "Ciclo Pagamento"
                )
                ORDER BY max_date DESC
            """).fetchall()
            return [row[0] for row in result if row[0]]
        except Exception as e:
            print(f"Erro ao obter ciclos: {e}")
            return []

    def close(self):
        """Fecha a conexão com a base de dados."""
        if self.conn:
            self.conn.close()

