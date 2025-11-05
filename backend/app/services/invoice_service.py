"""Serviço para gestão de faturas."""
import duckdb
from pathlib import Path
from typing import List, Optional, Dict
from app.config.database import get_db_connection
from app.config.settings import get_settings


class InvoiceService:
    """Serviço para gestão de faturas."""
    
    def __init__(self):
        self.conn = get_db_connection()
        self.settings = get_settings()
        # Diretório para guardar faturas (relativo à pasta backend)
        BASE_DIR = Path(__file__).resolve().parent.parent.parent
        self.invoices_dir = BASE_DIR / "data" / "invoices"
        self.invoices_dir.mkdir(parents=True, exist_ok=True)
    
    def get_available_cycles(self) -> List[str]:
        """Obtém lista de todos os ciclos disponíveis ordenados por data."""
        try:
            result = self.conn.execute("""
                SELECT "Ciclo Pagamento"
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
            # Tentar query mais simples
            try:
                result = self.conn.execute("""
                    SELECT DISTINCT "Ciclo Pagamento"
                    FROM transactions
                    WHERE "Ciclo Pagamento" IS NOT NULL
                """).fetchall()
                return [row[0] for row in result if row[0]]
            except:
                return []
    
    def save_invoice(
        self,
        ciclo_pagamento: str,
        tipo_documento: str,
        nome_ficheiro: str,
        file_content: bytes
    ) -> Dict:
        """Guarda uma fatura."""
        try:
            # Verificar se já existe
            existing = self.conn.execute("""
                SELECT id FROM invoices
                WHERE ciclo_pagamento = ? AND nome_ficheiro = ?
            """, [ciclo_pagamento, nome_ficheiro]).fetchone()
            
            if existing:
                return {
                    "success": False,
                    "message": f"Fatura {nome_ficheiro} já existe para este ciclo"
                }
            
            # Criar diretório do ciclo se não existir
            cycle_dir = self.invoices_dir / ciclo_pagamento.replace("/", "-").replace(" ", "_")
            cycle_dir.mkdir(parents=True, exist_ok=True)
            
            # Guardar ficheiro
            file_path = cycle_dir / nome_ficheiro
            file_path.write_bytes(file_content)
            
            # Inserir na BD
            # DuckDB não suporta AUTO_INCREMENT, então calculamos o próximo ID manualmente
            next_id_result = self.conn.execute("""
                SELECT COALESCE(MAX(id), 0) + 1 FROM invoices
            """).fetchone()
            
            next_id = int(next_id_result[0]) if next_id_result and next_id_result[0] else 1
            
            self.conn.execute("""
                INSERT INTO invoices (
                    id, ciclo_pagamento, tipo_documento, nome_ficheiro,
                    caminho_ficheiro, tamanho_ficheiro, empresa_id, marketplace_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, [
                next_id,
                ciclo_pagamento,
                tipo_documento,
                nome_ficheiro,
                str(file_path),
                len(file_content),
                2,  # Teste 123
                1   # Pixmania
            ])
            
            self.conn.commit()
            
            return {
                "success": True,
                "message": f"Fatura {nome_ficheiro} guardada com sucesso"
            }
        except Exception as e:
            print(f"Erro ao guardar fatura: {e}")
            return {
                "success": False,
                "message": f"Erro ao guardar fatura: {str(e)}"
            }
    
    def get_invoices_by_cycle(self, ciclo_pagamento: str) -> List[Dict]:
        """Obtém todas as faturas de um ciclo."""
        try:
            result = self.conn.execute("""
                SELECT 
                    id, tipo_documento, nome_ficheiro,
                    tamanho_ficheiro, data_upload
                FROM invoices
                WHERE ciclo_pagamento = ?
                ORDER BY tipo_documento, nome_ficheiro
            """, [ciclo_pagamento]).fetchall()
            
            return [
                {
                    "id": row[0],
                    "tipo_documento": row[1],
                    "nome_ficheiro": row[2],
                    "tamanho_ficheiro": row[3],
                    "data_upload": str(row[4]) if row[4] else None
                }
                for row in result
            ]
        except Exception as e:
            print(f"Erro ao obter faturas: {e}")
            return []
    
    def get_invoice_file(self, invoice_id: int) -> Optional[Path]:
        """Obtém o caminho do ficheiro de uma fatura."""
        try:
            result = self.conn.execute("""
                SELECT caminho_ficheiro
                FROM invoices
                WHERE id = ?
            """, [invoice_id]).fetchone()
            
            if result and result[0]:
                path = Path(result[0])
                if path.exists():
                    return path
            return None
        except Exception as e:
            print(f"Erro ao obter ficheiro: {e}")
            return None
    
    def delete_invoice(self, invoice_id: int) -> Dict:
        """Elimina uma fatura."""
        try:
            # Obter caminho do ficheiro
            result = self.conn.execute("""
                SELECT caminho_ficheiro
                FROM invoices
                WHERE id = ?
            """, [invoice_id]).fetchone()
            
            if not result:
                return {
                    "success": False,
                    "message": "Fatura não encontrada"
                }
            
            file_path = Path(result[0])
            
            # Eliminar da BD
            self.conn.execute("DELETE FROM invoices WHERE id = ?", [invoice_id])
            self.conn.commit()
            
            # Eliminar ficheiro
            if file_path.exists():
                file_path.unlink()
            
            return {
                "success": True,
                "message": "Fatura eliminada com sucesso"
            }
        except Exception as e:
            print(f"Erro ao eliminar fatura: {e}")
            return {
                "success": False,
                "message": f"Erro ao eliminar fatura: {str(e)}"
            }
    
    def get_all_invoices_by_cycle(self) -> Dict[str, List[Dict]]:
        """Obtém todas as faturas agrupadas por ciclo."""
        try:
            result = self.conn.execute("""
                SELECT 
                    ciclo_pagamento,
                    tipo_documento,
                    nome_ficheiro,
                    tamanho_ficheiro,
                    data_upload,
                    id
                FROM invoices
                ORDER BY ciclo_pagamento, tipo_documento, nome_ficheiro
            """).fetchall()
            
            invoices_by_cycle = {}
            for row in result:
                ciclo = row[0]
                if ciclo not in invoices_by_cycle:
                    invoices_by_cycle[ciclo] = []
                
                invoices_by_cycle[ciclo].append({
                    "id": row[5],
                    "tipo_documento": row[1],
                    "nome_ficheiro": row[2],
                    "tamanho_ficheiro": row[3],
                    "data_upload": str(row[4]) if row[4] else None
                })
            
            return invoices_by_cycle
        except Exception as e:
            print(f"Erro ao obter faturas: {e}")
            return {}
    
    def close(self):
        """Fecha conexão."""
        if self.conn:
            self.conn.close()

