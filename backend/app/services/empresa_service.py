"""Serviço para gestão de empresas."""
import duckdb
from typing import Dict, List, Optional
from app.config.database import get_db_connection


class EmpresaService:
    """Serviço para gestão de empresas."""

    def __init__(self):
        self.conn = get_db_connection()

    def get_all_empresas(self) -> List[Dict]:
        """Obtém todas as empresas."""
        try:
            result = self.conn.execute("""
                SELECT id, nome, codigo, nif, morada, email, telefone, 
                       data_criacao, ativo
                FROM empresas
                ORDER BY nome
            """).fetchall()
            
            empresas = []
            for row in result:
                empresas.append({
                    "id": int(row[0]),
                    "nome": row[1] or "",
                    "codigo": row[2] or "",
                    "nif": row[3] or "",
                    "morada": row[4] or "",
                    "email": row[5] or "",
                    "telefone": row[6] or "",
                    "data_criacao": str(row[7]) if row[7] else None,
                    "ativo": bool(row[8]) if row[8] is not None else True
                })
            
            return empresas
        except Exception as e:
            print(f"Erro ao obter empresas: {e}")
            import traceback
            print(traceback.format_exc())
            return []

    def get_empresa_by_id(self, empresa_id: int) -> Optional[Dict]:
        """Obtém uma empresa por ID."""
        try:
            result = self.conn.execute("""
                SELECT id, nome, codigo, nif, morada, email, telefone, 
                       data_criacao, ativo
                FROM empresas
                WHERE id = ?
            """, [empresa_id]).fetchone()
            
            if not result:
                return None
            
            return {
                "id": int(result[0]),
                "nome": result[1] or "",
                "codigo": result[2] or "",
                "nif": result[3] or "",
                "morada": result[4] or "",
                "email": result[5] or "",
                "telefone": result[6] or "",
                "data_criacao": str(result[7]) if result[7] else None,
                "ativo": bool(result[8]) if result[8] is not None else True
            }
        except Exception as e:
            print(f"Erro ao obter empresa: {e}")
            return None

    def create_empresa(
        self,
        nome: str,
        codigo: Optional[str] = None,
        nif: Optional[str] = None,
        morada: Optional[str] = None,
        email: Optional[str] = None,
        telefone: Optional[str] = None
    ) -> Dict:
        """Cria uma nova empresa."""
        try:
            # Calcular próximo ID
            next_id_result = self.conn.execute("""
                SELECT COALESCE(MAX(id), 0) + 1 FROM empresas
            """).fetchone()
            
            next_id = int(next_id_result[0]) if next_id_result and next_id_result[0] else 1
            
            self.conn.execute("""
                INSERT INTO empresas (id, nome, codigo, nif, morada, email, telefone)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, [next_id, nome, codigo, nif, morada, email, telefone])
            
            self.conn.commit()
            
            return {
                "id": next_id,
                "nome": nome,
                "codigo": codigo or "",
                "nif": nif or "",
                "morada": morada or "",
                "email": email or "",
                "telefone": telefone or "",
                "ativo": True
            }
        except Exception as e:
            print(f"Erro ao criar empresa: {e}")
            import traceback
            print(traceback.format_exc())
            raise

    def update_empresa(
        self,
        empresa_id: int,
        nome: Optional[str] = None,
        codigo: Optional[str] = None,
        nif: Optional[str] = None,
        morada: Optional[str] = None,
        email: Optional[str] = None,
        telefone: Optional[str] = None,
        ativo: Optional[bool] = None
    ) -> Dict:
        """Atualiza uma empresa existente."""
        try:
            # Construir query dinamicamente
            updates = []
            params = []
            
            if nome is not None:
                updates.append("nome = ?")
                params.append(nome)
            if codigo is not None:
                updates.append("codigo = ?")
                params.append(codigo)
            if nif is not None:
                updates.append("nif = ?")
                params.append(nif)
            if morada is not None:
                updates.append("morada = ?")
                params.append(morada)
            if email is not None:
                updates.append("email = ?")
                params.append(email)
            if telefone is not None:
                updates.append("telefone = ?")
                params.append(telefone)
            if ativo is not None:
                updates.append("ativo = ?")
                params.append(ativo)
            
            if not updates:
                return self.get_empresa_by_id(empresa_id)
            
            params.append(empresa_id)
            
            query = f"UPDATE empresas SET {', '.join(updates)} WHERE id = ?"
            self.conn.execute(query, params)
            self.conn.commit()
            
            return self.get_empresa_by_id(empresa_id)
        except Exception as e:
            print(f"Erro ao atualizar empresa: {e}")
            import traceback
            print(traceback.format_exc())
            raise

    def delete_empresa(self, empresa_id: int) -> bool:
        """Remove uma empresa (soft delete - marca como inativo)."""
        try:
            self.conn.execute("""
                UPDATE empresas SET ativo = FALSE WHERE id = ?
            """, [empresa_id])
            self.conn.commit()
            return True
        except Exception as e:
            print(f"Erro ao remover empresa: {e}")
            import traceback
            print(traceback.format_exc())
            raise

    def close(self):
        """Fecha a conexão com a base de dados."""
        if self.conn:
            self.conn.close()

