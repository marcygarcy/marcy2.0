"""Script para criar empresas e marketplaces iniciais."""
import sys
from pathlib import Path

# Adicionar o diretório raiz ao path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.config.database import get_db_connection, init_database


def seed_empresas():
    """Cria empresas e marketplaces iniciais."""
    # Inicializar base de dados (cria tabelas se não existirem)
    init_database()
    
    conn = get_db_connection()
    
    try:
        # Verificar se já existem empresas
        result = conn.execute("SELECT COUNT(*) FROM empresas").fetchone()
        if result and result[0] > 0:
            print("Empresas já existem. Use '--force' para recriar.")
            return
        
        # Empresas e marketplaces
        empresas_data = [
            {
                "nome": "teste 369",
                "codigo": "BHS",
                "marketplaces": []
            },
            {
                "nome": "Teste 123",
                "codigo": "GHS",
                "marketplaces": ["Pixmania", "Worten"]
            },
            {
                "nome": "testes xyz",
                "codigo": "BHS_SL",
                "marketplaces": []
            },
            {
                "nome": "Teste 123",
                "codigo": "BHS_DE",
                "marketplaces": []
            },
            {
                "nome": "testes xyz",
                "codigo": "BES",
                "marketplaces": []
            }
        ]
        
        empresa_ids = {}
        
        # Criar empresas
        for idx, empresa_info in enumerate(empresas_data, start=1):
            empresa_id = idx
            empresa_ids[empresa_info["nome"]] = empresa_id
            
            conn.execute("""
                INSERT INTO empresas (id, nome, codigo, ativo)
                VALUES (?, ?, ?, ?)
            """, [empresa_id, empresa_info["nome"], empresa_info["codigo"], True])
            
            print(f"Criada empresa: {empresa_info['nome']} (ID: {empresa_id})")
        
        # Criar marketplaces
        marketplace_id = 1
        for empresa_info in empresas_data:
            empresa_id = empresa_ids[empresa_info["nome"]]
            
            for marketplace_nome in empresa_info["marketplaces"]:
                conn.execute("""
                    INSERT INTO marketplaces (id, empresa_id, nome, ativo)
                    VALUES (?, ?, ?, ?)
                """, [marketplace_id, empresa_id, marketplace_nome, True])
                
                print(f"  - Criado marketplace: {marketplace_nome} (ID: {marketplace_id})")
                marketplace_id += 1
        
        conn.commit()
        print(f"\n✅ Seed concluído! {len(empresas_data)} empresas criadas.")
        
    except Exception as e:
        print(f"Erro ao criar seed: {e}")
        import traceback
        print(traceback.format_exc())
        conn.rollback()
    finally:
        conn.close()


if __name__ == "__main__":
    seed_empresas()

