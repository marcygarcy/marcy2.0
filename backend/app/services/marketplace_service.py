"""Serviço para gestão de marketplaces."""
import duckdb
from typing import Dict, List, Optional
from app.config.database import get_db_connection


class MarketplaceService:
    """Serviço para gestão de marketplaces."""

    def __init__(self):
        self.conn = get_db_connection()

    def get_all_marketplaces(self) -> List[Dict]:
        """Obtém todos os marketplaces."""
        try:
            result = self.conn.execute("""
                SELECT m.id, m.empresa_id, m.nome, m.codigo, m.descricao, 
                       m.ativo, m.data_criacao, e.nome as empresa_nome
                FROM marketplaces m
                LEFT JOIN empresas e ON m.empresa_id = e.id
                ORDER BY e.nome, m.nome
            """).fetchall()
            
            marketplaces = []
            for row in result:
                marketplaces.append({
                    "id": int(row[0]),
                    "empresa_id": int(row[1]) if row[1] else None,
                    "nome": row[2] or "",
                    "codigo": row[3] or "",
                    "descricao": row[4] or "",
                    "ativo": bool(row[5]) if row[5] is not None else True,
                    "data_criacao": str(row[6]) if row[6] else None,
                    "empresa_nome": row[7] or ""
                })
            
            return marketplaces
        except Exception as e:
            print(f"Erro ao obter marketplaces: {e}")
            import traceback
            print(traceback.format_exc())
            return []

    def get_marketplaces_by_empresa(self, empresa_id: int) -> List[Dict]:
        """Obtém marketplaces de uma empresa específica."""
        try:
            result = self.conn.execute("""
                SELECT id, empresa_id, nome, codigo, descricao, ativo, data_criacao
                FROM marketplaces
                WHERE empresa_id = ? AND ativo = TRUE
                ORDER BY nome
            """, [empresa_id]).fetchall()
            
            marketplaces = []
            for row in result:
                marketplaces.append({
                    "id": int(row[0]),
                    "empresa_id": int(row[1]),
                    "nome": row[2] or "",
                    "codigo": row[3] or "",
                    "descricao": row[4] or "",
                    "ativo": bool(row[5]) if row[5] is not None else True,
                    "data_criacao": str(row[6]) if row[6] else None
                })
            
            return marketplaces
        except Exception as e:
            print(f"Erro ao obter marketplaces da empresa: {e}")
            import traceback
            print(traceback.format_exc())
            return []

    def get_marketplace_by_id(self, marketplace_id: int) -> Optional[Dict]:
        """Obtém um marketplace por ID."""
        try:
            result = self.conn.execute("""
                SELECT id, empresa_id, nome, codigo, descricao, ativo, data_criacao
                FROM marketplaces
                WHERE id = ?
            """, [marketplace_id]).fetchone()
            
            if not result:
                return None
            
            return {
                "id": int(result[0]),
                "empresa_id": int(result[1]),
                "nome": result[2] or "",
                "codigo": result[3] or "",
                "descricao": result[4] or "",
                "ativo": bool(result[5]) if result[5] is not None else True,
                "data_criacao": str(result[6]) if result[6] else None
            }
        except Exception as e:
            print(f"Erro ao obter marketplace: {e}")
            return None

    def create_marketplace(
        self,
        empresa_id: int,
        nome: str,
        codigo: Optional[str] = None,
        descricao: Optional[str] = None
    ) -> Dict:
        """Cria um novo marketplace."""
        try:
            # Verificar se empresa existe
            empresa_check = self.conn.execute("""
                SELECT id FROM empresas WHERE id = ? AND ativo = TRUE
            """, [empresa_id]).fetchone()
            
            if not empresa_check:
                raise ValueError(f"Empresa com ID {empresa_id} não encontrada ou inativa")
            
            # Calcular próximo ID
            next_id_result = self.conn.execute("""
                SELECT COALESCE(MAX(id), 0) + 1 FROM marketplaces
            """).fetchone()
            
            next_id = int(next_id_result[0]) if next_id_result and next_id_result[0] else 1
            
            self.conn.execute("""
                INSERT INTO marketplaces (id, empresa_id, nome, codigo, descricao)
                VALUES (?, ?, ?, ?, ?)
            """, [next_id, empresa_id, nome, codigo, descricao])
            
            self.conn.commit()
            
            return {
                "id": next_id,
                "empresa_id": empresa_id,
                "nome": nome,
                "codigo": codigo or "",
                "descricao": descricao or "",
                "ativo": True
            }
        except Exception as e:
            print(f"Erro ao criar marketplace: {e}")
            import traceback
            print(traceback.format_exc())
            raise

    def update_marketplace(
        self,
        marketplace_id: int,
        nome: Optional[str] = None,
        codigo: Optional[str] = None,
        descricao: Optional[str] = None,
        ativo: Optional[bool] = None
    ) -> Dict:
        """Atualiza um marketplace existente."""
        try:
            updates = []
            params = []
            
            if nome is not None:
                updates.append("nome = ?")
                params.append(nome)
            if codigo is not None:
                updates.append("codigo = ?")
                params.append(codigo)
            if descricao is not None:
                updates.append("descricao = ?")
                params.append(descricao)
            if ativo is not None:
                updates.append("ativo = ?")
                params.append(ativo)
            
            if not updates:
                return self.get_marketplace_by_id(marketplace_id)
            
            params.append(marketplace_id)
            
            query = f"UPDATE marketplaces SET {', '.join(updates)} WHERE id = ?"
            self.conn.execute(query, params)
            self.conn.commit()
            
            return self.get_marketplace_by_id(marketplace_id)
        except Exception as e:
            print(f"Erro ao atualizar marketplace: {e}")
            import traceback
            print(traceback.format_exc())
            raise

    def delete_marketplace(self, marketplace_id: int) -> bool:
        """Remove um marketplace (soft delete - marca como inativo)."""
        try:
            self.conn.execute("""
                UPDATE marketplaces SET ativo = FALSE WHERE id = ?
            """, [marketplace_id])
            self.conn.commit()
            return True
        except Exception as e:
            print(f"Erro ao remover marketplace: {e}")
            import traceback
            print(traceback.format_exc())
            raise

    def close(self):
        """Fecha a conexão com a base de dados."""
        if self.conn:
            self.conn.close()

