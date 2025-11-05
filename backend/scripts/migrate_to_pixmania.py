"""Script para migrar todos os dados existentes para Pixmania."""
import sys
from pathlib import Path

# Adicionar o diretório raiz ao path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.config.database import get_db_connection

def migrate_to_pixmania():
    """Associa todos os dados existentes a Teste 123 (ID=2) e Pixmania (ID=1)."""
    conn = get_db_connection()
    
    try:
        # IDs: Teste 123 = 2, Pixmania = 1
        empresa_id = 2
        marketplace_id = 1
        
        print(f"Migrando dados para Empresa ID={empresa_id} (Teste 123) e Marketplace ID={marketplace_id} (Pixmania)...")
        
        # Contar registos antes
        trans_before = conn.execute("SELECT COUNT(*) FROM transactions WHERE empresa_id IS NULL OR marketplace_id IS NULL").fetchone()[0]
        inv_before = conn.execute("SELECT COUNT(*) FROM invoices WHERE empresa_id IS NULL OR marketplace_id IS NULL").fetchone()[0]
        bank_before = conn.execute("SELECT COUNT(*) FROM bank_movements WHERE empresa_id IS NULL OR marketplace_id IS NULL").fetchone()[0]
        
        print(f"  - Registos a atualizar: Transacoes={trans_before}, Faturas={inv_before}, Movimentos={bank_before}")
        
        # Atualizar transações
        conn.execute("""
            UPDATE transactions
            SET empresa_id = ?, marketplace_id = ?
            WHERE empresa_id IS NULL OR marketplace_id IS NULL
        """, [empresa_id, marketplace_id])
        
        # Atualizar invoices
        conn.execute("""
            UPDATE invoices
            SET empresa_id = ?, marketplace_id = ?
            WHERE empresa_id IS NULL OR marketplace_id IS NULL
        """, [empresa_id, marketplace_id])
        
        # Atualizar bank_movements
        conn.execute("""
            UPDATE bank_movements
            SET empresa_id = ?, marketplace_id = ?
            WHERE empresa_id IS NULL OR marketplace_id IS NULL
        """, [empresa_id, marketplace_id])
        
        # Verificar contagens finais
        trans_count = conn.execute("""
            SELECT COUNT(*) FROM transactions WHERE empresa_id = ? AND marketplace_id = ?
        """, [empresa_id, marketplace_id]).fetchone()[0]
        
        invoices_count = conn.execute("""
            SELECT COUNT(*) FROM invoices WHERE empresa_id = ? AND marketplace_id = ?
        """, [empresa_id, marketplace_id]).fetchone()[0]
        
        bank_count = conn.execute("""
            SELECT COUNT(*) FROM bank_movements WHERE empresa_id = ? AND marketplace_id = ?
        """, [empresa_id, marketplace_id]).fetchone()[0]
        
        conn.commit()
        
        print(f"\nMigracao concluida!")
        print(f"   - Total de transacoes associadas: {trans_count}")
        print(f"   - Total de faturas associadas: {invoices_count}")
        print(f"   - Total de movimentos bancarios associados: {bank_count}")
        
    except Exception as e:
        print(f"Erro ao migrar dados: {e}")
        import traceback
        print(traceback.format_exc())
        conn.rollback()
    finally:
        conn.close()


if __name__ == "__main__":
    migrate_to_pixmania()

