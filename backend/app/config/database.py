"""Configuração e gestão da base de dados DuckDB."""
import duckdb
from pathlib import Path
from typing import Optional
from app.config.settings import get_settings

_settings = get_settings()
DB_PATH = Path(_settings.database_path)


def get_db_connection() -> duckdb.DuckDBPyConnection:
    """Retorna conexão com DuckDB."""
    conn = duckdb.connect(str(DB_PATH))
    return conn


def init_database():
    """Inicializa as tabelas da base de dados."""
    # Criar diretório se não existir
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    
    conn = get_db_connection()
    
    # Tabela de transações
    conn.execute("""
        CREATE TABLE IF NOT EXISTS transactions (
            "Ciclo Pagamento" TEXT,
            "Data do ciclo de faturamento" TIMESTAMP,
            "Data Criação" TIMESTAMP,
            "Canal de vendas" TEXT,
            Tipo TEXT,
            Crédito DOUBLE,
            Débito DOUBLE,
            real DOUBLE,
            Valor DOUBLE,
            Descrição TEXT,
            "Nº Pedido" TEXT,
            "Nº da fatura" TEXT,
            "Nº da transação" TEXT,
            "Rótulo da categoria" TEXT,
            "SKU da oferta" TEXT,
            Moeda TEXT,
            Quantidade DOUBLE
        )
    """)
    
    # Adicionar colunas se não existirem (migração para tabelas existentes)
    try:
        # Verificar se as colunas já existem usando DESCRIBE
        result = conn.execute("DESCRIBE transactions").fetchall()
        column_names = [col[0] for col in result]
        
        if "Valor" not in column_names:
            try:
                conn.execute("ALTER TABLE transactions ADD COLUMN Valor DOUBLE")
            except:
                pass  # Coluna já existe
        
        if "Quantidade" not in column_names:
            try:
                conn.execute("ALTER TABLE transactions ADD COLUMN Quantidade DOUBLE")
            except:
                pass  # Coluna já existe
    except Exception as e:
        # Tabela pode não existir ainda ou erro ao adicionar coluna
        # Tentar adicionar diretamente (pode falhar se já existir, mas não é crítico)
        try:
            conn.execute("ALTER TABLE transactions ADD COLUMN Valor DOUBLE")
        except:
            pass
        try:
            conn.execute("ALTER TABLE transactions ADD COLUMN Quantidade DOUBLE")
        except:
            pass
    
    # Tabela de documentos contabilísticos
    conn.execute("""
        CREATE TABLE IF NOT EXISTS accounting_docs (
            cycle_id TEXT,
            data_emissao TIMESTAMP,
            numero_documento TEXT,
            tipo_documento TEXT,
            direcao TEXT,
            valor_bruto DOUBLE,
            valor_imposto DOUBLE,
            valor_liquido DOUBLE,
            descricao TEXT,
            manual_flag BOOLEAN
        )
    """)
    
    # Tabela de resumo por ciclo
    conn.execute("""
        CREATE TABLE IF NOT EXISTS cycle_summary (
            cycle_id TEXT,
            key TEXT,
            valor DOUBLE
        )
    """)
    
    # Tabela de movimentos bancários (preenchimento manual)
    # Primeiro, criar nova estrutura se não existir
    conn.execute("""
        CREATE TABLE IF NOT EXISTS bank_movements (
            id INTEGER PRIMARY KEY,
            data_ctb DATE,
            data_movimento DATE,
            ciclo TEXT,
            montante DOUBLE
        )
    """)
    
    # Manter tabela antiga bank_trf para compatibilidade (pode ser usada para uploads)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS bank_trf (
            data DATE,
            valor DOUBLE,
            referencia TEXT,
            descricao TEXT
        )
    """)
    
    # Migração: Se bank_movements não tem dados mas bank_trf tem, tentar migrar
    try:
        result = conn.execute("SELECT COUNT(*) FROM bank_movements").fetchone()
        if result and result[0] == 0:
            # Verificar se bank_trf tem dados
            result_trf = conn.execute("SELECT COUNT(*) FROM bank_trf").fetchone()
            if result_trf and result_trf[0] > 0:
                # Obter todos os registos de bank_trf
                trf_data = conn.execute("SELECT data, valor FROM bank_trf ORDER BY data").fetchall()
                # Inserir um a um com ID sequencial
                for idx, (data, valor) in enumerate(trf_data, start=1):
                    conn.execute("""
                        INSERT INTO bank_movements (id, data_ctb, data_movimento, ciclo, montante)
                        VALUES (?, ?, ?, ?, ?)
                    """, [idx, data, data, None, valor])
                conn.commit()
    except Exception as e:
        # Ignorar erros de migração
        print(f"Aviso na migração de bank_trf: {e}")
        pass
    
    # Tabela de pedidos (orders)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY,
            numero_pedido TEXT NOT NULL,
            data_criacao TIMESTAMP,
            data_pagamento TIMESTAMP,
            ciclo_pagamento TEXT,
            valor_total DOUBLE,
            quantidade_itens INTEGER,
            status TEXT,
            canal_vendas TEXT,
            empresa_id INTEGER,
            marketplace_id INTEGER,
            data_upload TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(numero_pedido, empresa_id, marketplace_id)
        )
    """)
    
    # Tabela de empresas
    conn.execute("""
        CREATE TABLE IF NOT EXISTS empresas (
            id INTEGER PRIMARY KEY,
            nome TEXT NOT NULL UNIQUE,
            codigo TEXT UNIQUE,
            nif TEXT,
            morada TEXT,
            email TEXT,
            telefone TEXT,
            data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            ativo BOOLEAN DEFAULT TRUE
        )
    """)
    
    # Tabela de marketplaces/ambientes
    conn.execute("""
        CREATE TABLE IF NOT EXISTS marketplaces (
            id INTEGER PRIMARY KEY,
            empresa_id INTEGER NOT NULL,
            nome TEXT NOT NULL,
            codigo TEXT,
            descricao TEXT,
            ativo BOOLEAN DEFAULT TRUE,
            data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(empresa_id, nome)
        )
    """)
    
    # Tabela de faturas
    # DuckDB não suporta AUTO_INCREMENT, então usamos uma sequência ou geramos manualmente
    conn.execute("""
        CREATE TABLE IF NOT EXISTS invoices (
            id INTEGER PRIMARY KEY,
            ciclo_pagamento TEXT NOT NULL,
            tipo_documento TEXT NOT NULL,
            nome_ficheiro TEXT NOT NULL,
            caminho_ficheiro TEXT NOT NULL,
            tamanho_ficheiro INTEGER,
            data_upload TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            empresa_id INTEGER,
            marketplace_id INTEGER,
            UNIQUE(ciclo_pagamento, nome_ficheiro, empresa_id, marketplace_id)
        )
    """)
    
    # Adicionar colunas empresa_id e marketplace_id às tabelas existentes (migração)
    try:
        result = conn.execute("DESCRIBE transactions").fetchall()
        column_names = [col[0] for col in result]
        
        if "empresa_id" not in column_names:
            try:
                conn.execute("ALTER TABLE transactions ADD COLUMN empresa_id INTEGER")
            except:
                pass
        
        if "marketplace_id" not in column_names:
            try:
                conn.execute("ALTER TABLE transactions ADD COLUMN marketplace_id INTEGER")
            except:
                pass
    except:
        pass
    
    try:
        result = conn.execute("DESCRIBE invoices").fetchall()
        column_names = [col[0] for col in result]
        
        if "empresa_id" not in column_names:
            try:
                conn.execute("ALTER TABLE invoices ADD COLUMN empresa_id INTEGER")
            except:
                pass
        
        if "marketplace_id" not in column_names:
            try:
                conn.execute("ALTER TABLE invoices ADD COLUMN marketplace_id INTEGER")
            except:
                pass
    except:
        pass
    
    try:
        result = conn.execute("DESCRIBE bank_movements").fetchall()
        column_names = [col[0] for col in result]
        
        if "empresa_id" not in column_names:
            try:
                conn.execute("ALTER TABLE bank_movements ADD COLUMN empresa_id INTEGER")
            except:
                pass
        
        if "marketplace_id" not in column_names:
            try:
                conn.execute("ALTER TABLE bank_movements ADD COLUMN marketplace_id INTEGER")
            except:
                pass
    except:
        pass
    
    conn.commit()
    conn.close()
    print(f"Base de dados inicializada: {DB_PATH}")

