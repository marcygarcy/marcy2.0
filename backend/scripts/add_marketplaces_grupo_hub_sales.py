"""Script para adicionar marketplaces ao Teste 123."""
import sys
from pathlib import Path

# Adicionar o diretório raiz ao path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.config.database import get_db_connection

# Lista de marketplaces em ordem alfabética
MARKETPLACES = [
    "Alltricks",
    "Bigbang",
    "Bricodepot",
    "Bulevip",
    "Carrefour",
    "Castorama",
    "Clubefashion",
    "Eprice",
    "Elcorteingles",
    "Empik",
    "Leroymerlin",
    "Leclerc",
    "Mediamarkt DE",
    "Mediamarkt ES",
    "PC Componentes ES",
    "PC Componentes FR",
    "PC Componentes IT",
    "PC Componentes PT",
    "Phonehouse",
    "Planetahuerto",
    "Rueducommerce",
    "Tiendanimal",
    "Ventunique",
]


def add_marketplaces():
    """Adiciona marketplaces ao Teste 123."""
    conn = get_db_connection()
    
    try:
        # Verificar se a empresa "Teste 123" existe
        empresa_result = conn.execute(
            "SELECT id FROM empresas WHERE nome = ?",
            ["Teste 123"]
        ).fetchone()
        
        if not empresa_result:
            print("Erro: Empresa 'Teste 123' não encontrada!")
            return
        
        empresa_id = empresa_result[0]
        print(f"Empresa encontrada: Teste 123 (ID: {empresa_id})")
        
        # Verificar marketplaces existentes
        existing_marketplaces = conn.execute(
            "SELECT nome FROM marketplaces WHERE empresa_id = ?",
            [empresa_id]
        ).fetchall()
        existing_names = {row[0] for row in existing_marketplaces}
        
        # Obter próximo ID disponível
        max_id_result = conn.execute("SELECT COALESCE(MAX(id), 0) FROM marketplaces").fetchone()
        next_id = int(max_id_result[0]) + 1 if max_id_result and max_id_result[0] else 1
        
        added_count = 0
        skipped_count = 0
        
        print(f"\nAdicionando {len(MARKETPLACES)} marketplaces...")
        print("-" * 60)
        
        for marketplace_name in MARKETPLACES:
            if marketplace_name in existing_names:
                print(f"  [SKIP] {marketplace_name} (já existe)")
                skipped_count += 1
                continue
            
            try:
                # Gerar código a partir do nome (lowercase, sem espaços)
                codigo = marketplace_name.lower().replace(" ", "_")
                
                conn.execute("""
                    INSERT INTO marketplaces (id, empresa_id, nome, codigo, ativo, data_criacao)
                    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                """, [next_id, empresa_id, marketplace_name, codigo, True])
                
                print(f"  [OK] {marketplace_name} (ID: {next_id}, Código: {codigo})")
                next_id += 1
                added_count += 1
                
            except Exception as e:
                print(f"  [ERRO] {marketplace_name}: {e}")
        
        conn.commit()
        
        print("-" * 60)
        print(f"\nResumo:")
        print(f"  Adicionados: {added_count}")
        print(f"  Já existiam: {skipped_count}")
        print(f"  Total: {len(MARKETPLACES)}")
        
        # Listar todos os marketplaces da empresa em ordem alfabética
        print(f"\nMarketplaces do Teste 123 (ordem alfabética):")
        all_marketplaces = conn.execute("""
            SELECT id, nome, codigo, ativo
            FROM marketplaces
            WHERE empresa_id = ?
            ORDER BY nome
        """, [empresa_id]).fetchall()
        
        for mp in all_marketplaces:
            status = "Ativo" if mp[3] else "Inativo"
            print(f"  - {mp[1]} (ID: {mp[0]}, Código: {mp[2]}, {status})")
        
    except Exception as e:
        print(f"Erro ao adicionar marketplaces: {e}")
        import traceback
        traceback.print_exc()
        conn.rollback()
    finally:
        conn.close()


if __name__ == "__main__":
    add_marketplaces()

