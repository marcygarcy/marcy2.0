"""Serviço de upload de ficheiros."""
import duckdb
from pathlib import Path
from typing import Tuple
from app.config.database import get_db_connection
from app.etl.ingest import load_transactions, load_trf, load_orders, insert_transactions, insert_trf, insert_orders


class UploadService:
    """Serviço para processamento de uploads."""
    
    def __init__(self):
        self.conn = get_db_connection()
    
    def upload_transactions(self, file_path: Path, clear_existing: bool = False, empresa_id: int = 2, marketplace_id: int = 1) -> Tuple[bool, str, int]:
        """
        Processa upload de transações.
        
        Args:
            file_path: Caminho do ficheiro
            clear_existing: Se True, limpa dados existentes da empresa/marketplace antes de inserir
            empresa_id: ID da empresa (padrão: 2 - Teste 123)
            marketplace_id: ID do marketplace (padrão: 1 - Pixmania)
        
        Returns:
            (success, message, records_inserted)
        """
        try:
            print(f"[UPLOAD_SERVICE] Iniciando processamento: file_path={file_path}, empresa_id={empresa_id}, marketplace_id={marketplace_id}")
            # Limpar dados existentes da empresa/marketplace específica se solicitado
            if clear_existing:
                self.conn.execute(
                    "DELETE FROM transactions WHERE empresa_id = ? AND marketplace_id = ?",
                    [empresa_id, marketplace_id]
                )
                self.conn.commit()
                print(f"Dados existentes da empresa {empresa_id} / marketplace {marketplace_id} removidos antes do novo upload")
            
            print(f"[UPLOAD_SERVICE] Carregando ficheiro...")
            df = load_transactions(file_path)
            print(f"[UPLOAD_SERVICE] Ficheiro carregado: {len(df)} linhas, {len(df.columns)} colunas")
            print(f"[UPLOAD_SERVICE] Colunas: {list(df.columns)[:10]}...")  # Mostrar primeiras 10 colunas
            
            print(f"[UPLOAD_SERVICE] Inserindo transações na BD...")
            records = insert_transactions(self.conn, df, empresa_id, marketplace_id)
            print(f"[UPLOAD_SERVICE] {records} registos inseridos")
            
            self.conn.commit()
            print(f"[UPLOAD_SERVICE] Commit realizado com sucesso")
            return True, f"Processadas {records} transações", records
        except Exception as e:
            import traceback
            error_trace = traceback.format_exc()
            print(f"[UPLOAD_SERVICE] Erro no upload de transações: {error_trace}")
            return False, f"Erro: {str(e)}", 0
    
    def upload_trf(self, file_path: Path, clear_existing: bool = True) -> Tuple[bool, str, int]:
        """
        Processa upload de transferências bancárias.
        
        Args:
            file_path: Caminho do ficheiro
            clear_existing: Se True, limpa dados existentes antes de inserir
        
        Returns:
            (success, message, records_inserted)
        """
        try:
            # Limpar dados existentes se solicitado
            if clear_existing:
                self.conn.execute("DELETE FROM bank_trf")
                self.conn.commit()
                print("Dados de transferências existentes removidos antes do novo upload")
            
            df = load_trf(file_path)
            records = insert_trf(self.conn, df)
            self.conn.commit()
            return True, f"Processadas {records} transferências", records
        except Exception as e:
            import traceback
            print(f"Erro no upload de transferências: {traceback.format_exc()}")
            return False, f"Erro: {str(e)}", 0
    
    def upload_orders(self, file_path: Path, clear_existing: bool = False, empresa_id: int = 2, marketplace_id: int = 1) -> Tuple[bool, str, int]:
        """
        Processa upload de listagem de orders (pedidos).
        
        Args:
            file_path: Caminho do ficheiro
            clear_existing: Se True, limpa dados existentes da empresa/marketplace antes de inserir
            empresa_id: ID da empresa (padrão: 2 - Teste 123)
            marketplace_id: ID do marketplace (padrão: 1 - Pixmania)
        
        Returns:
            (success, message, records_inserted)
        """
        try:
            # Limpar dados existentes da empresa/marketplace específica se solicitado
            if clear_existing:
                self.conn.execute(
                    "DELETE FROM orders WHERE empresa_id = ? AND marketplace_id = ?",
                    [empresa_id, marketplace_id]
                )
                self.conn.commit()
                print(f"Dados de orders existentes da empresa {empresa_id} / marketplace {marketplace_id} removidos antes do novo upload")
            
            df = load_orders(file_path)
            records = insert_orders(self.conn, df, empresa_id, marketplace_id)
            self.conn.commit()
            
            if records == 0:
                return True, "Ficheiro processado com sucesso, mas nenhum pedido válido foi encontrado. Verifique se as colunas do ficheiro correspondem aos campos esperados (ex: Nº Pedido, numero_pedido, order, etc.)", 0
            else:
                return True, f"Processados {records} pedidos com sucesso", records
        except Exception as e:
            import traceback
            print(f"Erro no upload de orders: {traceback.format_exc()}")
            return False, f"Erro: {str(e)}", 0
    
    def close(self):
        """Fecha conexão."""
        if self.conn:
            self.conn.close()

