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
                    "ativo": bool(row[8]) if row[8] is not None else True,
                })
            try:
                ext = self.conn.execute("SELECT id, pais, designacao_social, morada_fiscal, email_financeiro, logotipo_url, iban, moeda_base FROM empresas ORDER BY nome").fetchall()
                for i, row in enumerate(ext):
                    if i < len(empresas):
                        empresas[i]["pais"] = row[1] or ""
                        empresas[i]["designacao_social"] = row[2]
                        empresas[i]["morada_fiscal"] = row[3]
                        empresas[i]["email_financeiro"] = row[4]
                        empresas[i]["logotipo_url"] = row[5]
                        empresas[i]["iban"] = row[6]
                        empresas[i]["moeda_base"] = row[7] or "EUR"
            except Exception:
                for e in empresas:
                    e.setdefault("pais", "")
                    e.setdefault("moeda_base", "EUR")
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
                SELECT id, nome, codigo, nif, morada, email, telefone, data_criacao, ativo
                FROM empresas WHERE id = ?
            """, [empresa_id]).fetchone()
            if not result:
                return None
            out = {
                "id": int(result[0]),
                "nome": result[1] or "",
                "codigo": result[2] or "",
                "nif": result[3] or "",
                "morada": result[4] or "",
                "email": result[5] or "",
                "telefone": result[6] or "",
                "data_criacao": str(result[7]) if result[7] else None,
                "ativo": bool(result[8]) if result[8] is not None else True,
                "pais": "",
                "moeda_base": "EUR",
            }
            try:
                ext = self.conn.execute("SELECT pais, designacao_social, morada_fiscal, email_financeiro, logotipo_url, iban, moeda_base FROM empresas WHERE id = ?", [empresa_id]).fetchone()
                if ext:
                    out["pais"] = ext[0] or ""
                    out["designacao_social"] = ext[1]
                    out["morada_fiscal"] = ext[2]
                    out["email_financeiro"] = ext[3]
                    out["logotipo_url"] = ext[4]
                    out["iban"] = ext[5]
                    out["moeda_base"] = ext[6] or "EUR"
            except Exception:
                pass
            return out
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
        telefone: Optional[str] = None,
        pais: Optional[str] = None,
        designacao_social: Optional[str] = None,
        morada_fiscal: Optional[str] = None,
        email_financeiro: Optional[str] = None,
        logotipo_url: Optional[str] = None,
        iban: Optional[str] = None,
        moeda_base: Optional[str] = None,
    ) -> Dict:
        """Cria uma nova empresa."""
        try:
            next_id_result = self.conn.execute("""
                SELECT COALESCE(MAX(id), 0) + 1 FROM empresas
            """).fetchone()
            next_id = int(next_id_result[0]) if next_id_result and next_id_result[0] else 1
            try:
                self.conn.execute("""
                    INSERT INTO empresas (id, nome, codigo, nif, morada, pais, email, telefone,
                        designacao_social, morada_fiscal, email_financeiro, logotipo_url, iban, moeda_base)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, [next_id, nome, codigo, nif, morada, pais, email, telefone,
                      designacao_social, morada_fiscal, email_financeiro, logotipo_url, iban, moeda_base or "EUR"])
            except Exception:
                self.conn.execute("""
                    INSERT INTO empresas (id, nome, codigo, nif, morada, email, telefone)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, [next_id, nome, codigo, nif, morada, email, telefone])
            self.conn.commit()
            return self.get_empresa_by_id(next_id) or {"id": next_id, "nome": nome, "ativo": True}
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
        ativo: Optional[bool] = None,
        pais: Optional[str] = None,
        designacao_social: Optional[str] = None,
        morada_fiscal: Optional[str] = None,
        email_financeiro: Optional[str] = None,
        logotipo_url: Optional[str] = None,
        iban: Optional[str] = None,
        moeda_base: Optional[str] = None,
    ) -> Optional[Dict]:
        """Atualiza uma empresa existente."""
        try:
            updates, params = [], []
            for field, col in [
                (nome, "nome"), (codigo, "codigo"), (nif, "nif"), (morada, "morada"),
                (email, "email"), (telefone, "telefone"), (ativo, "ativo"), (pais, "pais"),
                (designacao_social, "designacao_social"), (morada_fiscal, "morada_fiscal"),
                (email_financeiro, "email_financeiro"), (logotipo_url, "logotipo_url"),
                (iban, "iban"), (moeda_base, "moeda_base"),
            ]:
                if field is not None:
                    updates.append(f"{col} = ?")
                    params.append(field)
            if not updates:
                return self.get_empresa_by_id(empresa_id)
            params.append(empresa_id)
            self.conn.execute(f"UPDATE empresas SET {', '.join(updates)} WHERE id = ?", params)
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

