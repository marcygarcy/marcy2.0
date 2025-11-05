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
    
    def upload_transactions(self, file_path: Path, clear_existing: bool = True) -> Tuple[bool, str, int]:
        """
        Processa upload de transações.
        
        Args:
            file_path: Caminho do ficheiro
            clear_existing: Se True, limpa dados existentes antes de inserir
        
        Returns:
            (success, message, records_inserted)
        """
        try:
            # Limpar dados existentes se solicitado
            if clear_existing:
                self.conn.execute("DELETE FROM transactions")
                self.conn.commit()
                print("Dados existentes removidos antes do novo upload")
            
            df = load_transactions(file_path)
            records = insert_transactions(self.conn, df)
            self.conn.commit()
            return True, f"Processadas {records} transações", records
        except Exception as e:
            import traceback
            print(f"Erro no upload de transações: {traceback.format_exc()}")
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
    
    def upload_orders(self, file_path: Path, clear_existing: bool = True) -> Tuple[bool, str, int]:
        """
        Processa upload de listagem de orders (pedidos).
        
        Args:
            file_path: Caminho do ficheiro
            clear_existing: Se True, limpa dados existentes antes de inserir
        
        Returns:
            (success, message, records_inserted)
        """
        try:
            # Limpar dados existentes se solicitado
            if clear_existing:
                self.conn.execute("DELETE FROM orders")
                self.conn.commit()
                print("Dados de orders existentes removidos antes do novo upload")
            
            df = load_orders(file_path)
            records = insert_orders(self.conn, df)
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

