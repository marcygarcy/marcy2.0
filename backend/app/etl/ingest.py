"""Funções de ingestão e normalização de dados."""
import pandas as pd
import duckdb
from typing import Optional
from pathlib import Path
from app.etl.schemas import COLUMN_RENAMES, NUMERIC_COLUMNS, DATE_COLUMNS


def normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Normaliza nomes de colunas."""
    df = df.rename(columns={c: COLUMN_RENAMES.get(c, c) for c in df.columns})
    return df


def normalize_numeric(df: pd.DataFrame) -> pd.DataFrame:
    """Normaliza colunas numéricas."""
    for col in NUMERIC_COLUMNS:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0.0)
    return df


def normalize_dates(df: pd.DataFrame) -> pd.DataFrame:
    """
    Normaliza colunas de data.
    
    Trata formatos como "31/10/2025 - 00:00:34" e converte para TIMESTAMP.
    """
    for col in DATE_COLUMNS:
        if col in df.columns:
            # Tentar converter diretamente
            try:
                # Primeiro, limpar formato com " - " se existir
                if df[col].dtype == 'object':
                    df[col] = df[col].astype(str).str.split(' - ').str[0]
                
                df[col] = pd.to_datetime(df[col], errors="coerce", dayfirst=True)
            except Exception as e:
                print(f"Aviso: Erro ao converter data na coluna {col}: {e}")
                # Tentar sem dayfirst
                try:
                    df[col] = pd.to_datetime(df[col], errors="coerce")
                except:
                    pass
    return df


def calculate_real(df: pd.DataFrame) -> pd.DataFrame:
    """Calcula coluna real (Crédito - Débito)."""
    if "Crédito" in df.columns and "Débito" in df.columns:
        df["real"] = df["Crédito"] - df["Débito"]
    return df


def load_transactions(file_path: Path) -> pd.DataFrame:
    """
    Carrega e normaliza ficheiro de histórico de transações por ciclo.
    
    Baseado na estrutura real do ficheiro do marketplace:
    - Suporta XLSX/CSV
    - Normaliza encoding issues (caracteres especiais)
    - Mapeia colunas para estrutura da base de dados
    """
    # Detectar extensão
    ext = file_path.suffix.lower()
    
    # Carregar ficheiro com encoding correto
    if ext == '.csv':
        # Tentar diferentes encodings
        try:
            df = pd.read_csv(file_path, encoding='utf-8-sig', low_memory=False)
        except UnicodeDecodeError:
            try:
                df = pd.read_csv(file_path, encoding='latin-1', low_memory=False)
            except:
                df = pd.read_csv(file_path, encoding='cp1252', low_memory=False)
    elif ext in ['.xlsx', '.xls']:
        df = pd.read_excel(file_path, engine='openpyxl')
    else:
        raise ValueError(f"Formato não suportado: {ext}. Use XLSX, XLS ou CSV.")
    
    # Normalizar nomes de colunas (resolve encoding issues)
    df = normalize_columns(df)
    
    # Limpar colunas vazias/duplicadas
    df = df.loc[:, ~df.columns.str.contains('^Unnamed', case=False)]
    
    # Normalizar tipos de dados
    df = normalize_numeric(df)
    df = normalize_dates(df)
    
    # Calcular coluna 'real' (Crédito - Débito) se não existir
    if "real" not in df.columns:
        df = calculate_real(df)
    
    return df


def load_trf(file_path: Path) -> pd.DataFrame:
    """Carrega e normaliza ficheiro de transferências bancárias."""
    ext = file_path.suffix.lower()
    
    if ext == '.csv':
        df = pd.read_csv(file_path, encoding='utf-8-sig', low_memory=False)
    elif ext in ['.xlsx', '.xls']:
        df = pd.read_excel(file_path, engine='openpyxl')
    else:
        raise ValueError(f"Formato não suportado: {ext}")
    
    # Tentar mapear colunas comuns
    df.columns = df.columns.str.strip()
    
    # Normalizar colunas de data
    date_cols = [c for c in df.columns if 'data' in c.lower() or 'date' in c.lower()]
    if date_cols:
        df[date_cols[0]] = pd.to_datetime(df[date_cols[0]], errors="coerce", dayfirst=True)
        df = df.rename(columns={date_cols[0]: "data"})
    
    # Normalizar colunas de valor
    valor_cols = [c for c in df.columns if 'valor' in c.lower() or 'amount' in c.lower() or 'importe' in c.lower()]
    if valor_cols:
        df[valor_cols[0]] = pd.to_numeric(df[valor_cols[0]], errors="coerce").fillna(0.0)
        df = df.rename(columns={valor_cols[0]: "valor"})
    
    # Normalizar outras colunas
    ref_cols = [c for c in df.columns if 'referencia' in c.lower() or 'ref' in c.lower() or 'referência' in c.lower()]
    if ref_cols:
        df = df.rename(columns={ref_cols[0]: "referencia"})
    
    desc_cols = [c for c in df.columns if 'descricao' in c.lower() or 'descrição' in c.lower() or 'description' in c.lower()]
    if desc_cols:
        df = df.rename(columns={desc_cols[0]: "descricao"})
    
    # Garantir colunas necessárias
    required_cols = ["data", "valor"]
    for col in required_cols:
        if col not in df.columns:
            df[col] = None if col == "data" else 0.0
    
    df["referencia"] = df.get("referencia", "")
    df["descricao"] = df.get("descricao", "")
    
    return df


def insert_transactions(conn: duckdb.DuckDBPyConnection, df: pd.DataFrame) -> int:
    """
    Insere transações na base de dados.
    
    Mapeia colunas do ficheiro real para estrutura da tabela transactions.
    """
    # Colunas esperadas na tabela (conforme schema)
    expected_cols = [
        "Ciclo Pagamento", 
        "Data do ciclo de faturamento", 
        "Data Criação",
        "Canal de vendas", 
        "Tipo", 
        "Crédito", 
        "Débito", 
        "real",
        "Valor",
        "Descrição", 
        "Nº Pedido", 
        "Nº da fatura", 
        "Nº da transação",
        "Rótulo da categoria", 
        "SKU da oferta", 
        "Moeda",
        "Quantidade"
    ]
    
    # Mapeamento de colunas do ficheiro para colunas da base de dados
    column_mapping = {
        "Ciclo Pagamento": "Ciclo Pagamento",
        "Data do ciclo de faturamento": "Data do ciclo de faturamento",
        "Data Criação": "Data Criação",
        "Canal de vendas": "Canal de vendas",
        "Tipo": "Tipo",
        "Crédito": "Crédito",
        "Débito": "Débito",
        "real": "real",
        "Valor": "Valor",
        "Descrição": "Descrição",
        "Nº Pedido": "Nº Pedido",
        "Nº da fatura": "Nº da fatura",
        "Número da fatura": "Nº da fatura",  # Alternativa
        "Nº da transação": "Nº da transação",
        "Número da transação": "Nº da transação",  # Alternativa
        "Rótulo da categoria": "Rótulo da categoria",
        "SKU da oferta": "SKU da oferta",
        "Moeda": "Moeda",
        "Quantidade": "Quantidade",
    }
    
    # Criar DataFrame com colunas mapeadas
    df_mapped = pd.DataFrame()
    for db_col in expected_cols:
        # Tentar encontrar coluna correspondente
        found = False
        
        # Primeiro: verificar se a coluna existe diretamente
        if db_col in df.columns:
            df_mapped[db_col] = df[db_col]
            found = True
        else:
            # Segundo: verificar mapeamento
            for file_col, mapped_col in column_mapping.items():
                if mapped_col == db_col and file_col in df.columns:
                    df_mapped[db_col] = df[file_col]
                    found = True
                    break
            
            # Terceiro: para "Valor", procurar variações do nome
            if not found and db_col == "Valor":
                # Procurar colunas que contenham "valor" (case insensitive)
                valor_cols = [c for c in df.columns if 'valor' in c.lower()]
                if valor_cols:
                    df_mapped[db_col] = df[valor_cols[0]]
                    found = True
        
        # Se não encontrou, criar coluna vazia
        if not found:
            df_mapped[db_col] = None
    
    # Converter tipos apropriados
    for col in ["Crédito", "Débito", "real", "Valor", "Quantidade"]:
        if col in df_mapped.columns:
            df_mapped[col] = pd.to_numeric(df_mapped[col], errors="coerce").fillna(0.0)
    
    # Garantir que colunas de texto permanecem como string (mas não substituir None)
    for col in ["Ciclo Pagamento", "Canal de vendas", "Tipo", "Descrição", "Nº Pedido", 
                "Nº da fatura", "Nº da transação", "Rótulo da categoria", "SKU da oferta", "Moeda"]:
        if col in df_mapped.columns:
            # Converter para string, mas manter None como None
            df_mapped[col] = df_mapped[col].astype(object).where(pd.notnull(df_mapped[col]), None)
            df_mapped[col] = df_mapped[col].astype(str).replace('nan', None).replace('None', None)
    
    # Registrar DataFrame temporário e inserir
    # Garantir que colunas de texto são strings antes de registrar
    for col in ["Moeda", "Tipo", "Descrição", "Ciclo Pagamento", "Canal de vendas", 
                "Nº Pedido", "Nº da fatura", "Nº da transação", "Rótulo da categoria", "SKU da oferta"]:
        if col in df_mapped.columns:
            # Converter NaN e None para string vazia ou None
            df_mapped[col] = df_mapped[col].fillna('').astype(str)
            # Substituir 'nan' string de volta para None
            df_mapped[col] = df_mapped[col].replace('nan', None).replace('None', None)
    
    conn.register('df_temp', df_mapped)
    
    # Fazer INSERT com colunas explícitas e garantir tipos corretos
    # Associar automaticamente a Teste 123 (ID=2) e Pixmania (ID=1)
    conn.execute("""
        INSERT INTO transactions (
            "Ciclo Pagamento",
            "Data do ciclo de faturamento",
            "Data Criação",
            "Canal de vendas",
            "Tipo",
            "Crédito",
            "Débito",
            "real",
            "Valor",
            "Descrição",
            "Nº Pedido",
            "Nº da fatura",
            "Nº da transação",
            "Rótulo da categoria",
            "SKU da oferta",
            "Moeda",
            "Quantidade",
            empresa_id,
            marketplace_id
        )
        SELECT 
            NULLIF("Ciclo Pagamento", '') AS "Ciclo Pagamento",
            "Data do ciclo de faturamento",
            "Data Criação",
            NULLIF("Canal de vendas", '') AS "Canal de vendas",
            NULLIF("Tipo", '') AS "Tipo",
            CAST("Crédito" AS DOUBLE) AS "Crédito",
            CAST("Débito" AS DOUBLE) AS "Débito",
            CAST("real" AS DOUBLE) AS "real",
            CAST("Valor" AS DOUBLE) AS "Valor",
            NULLIF("Descrição", '') AS "Descrição",
            NULLIF("Nº Pedido", '') AS "Nº Pedido",
            NULLIF("Nº da fatura", '') AS "Nº da fatura",
            NULLIF("Nº da transação", '') AS "Nº da transação",
            NULLIF("Rótulo da categoria", '') AS "Rótulo da categoria",
            NULLIF("SKU da oferta", '') AS "SKU da oferta",
            NULLIF("Moeda", '') AS "Moeda",
            CAST("Quantidade" AS DOUBLE) AS "Quantidade",
            2 AS empresa_id,  -- Teste 123
            1 AS marketplace_id  -- Pixmania
        FROM df_temp
    """)
    
    conn.unregister('df_temp')
    
    return len(df_mapped)


def insert_trf(conn: duckdb.DuckDBPyConnection, df: pd.DataFrame) -> int:
    """Insere transferências bancárias na base de dados."""
    # Garantir colunas
    required_cols = ["data", "valor", "referencia", "descricao"]
    for col in required_cols:
        if col not in df.columns:
            df[col] = None if col in ["referencia", "descricao"] else 0.0
    
    # Converter data para DATE
    if "data" in df.columns:
        df["data"] = pd.to_datetime(df["data"]).dt.date
    
    df_to_insert = df[required_cols].copy()
    
    # Registrar DataFrame temporário e inserir
    conn.register('df_trf_temp', df_to_insert)
    conn.execute("""
        INSERT INTO bank_trf 
        SELECT * FROM df_trf_temp
    """)
    conn.unregister('df_trf_temp')
    
    return len(df_to_insert)


def load_orders(file_path: Path) -> pd.DataFrame:
    """
    Carrega e normaliza ficheiro de listagem de orders (pedidos).
    
    Suporta XLSX/CSV e normaliza colunas comuns.
    """
    # Detectar extensão
    ext = file_path.suffix.lower()
    
    # Carregar ficheiro com encoding correto
    if ext == '.csv':
        try:
            df = pd.read_csv(file_path, encoding='utf-8-sig', low_memory=False)
        except UnicodeDecodeError:
            try:
                df = pd.read_csv(file_path, encoding='latin-1', low_memory=False)
            except:
                df = pd.read_csv(file_path, encoding='cp1252', low_memory=False)
    elif ext in ['.xlsx', '.xls']:
        df = pd.read_excel(file_path, engine='openpyxl')
    else:
        raise ValueError(f"Formato não suportado: {ext}. Use XLSX, XLS ou CSV.")
    
    # Normalizar nomes de colunas (case insensitive e remove espaços)
    df.columns = df.columns.str.strip()
    
    # Limpar colunas vazias/duplicadas
    df = df.loc[:, ~df.columns.str.contains('^Unnamed', case=False)]
    
    return df


def insert_orders(conn: duckdb.DuckDBPyConnection, df: pd.DataFrame) -> int:
    """
    Insere orders (pedidos) na base de dados.
    
    Mapeia colunas comuns do ficheiro para a estrutura da tabela orders.
    """
    # Mapeamento de colunas possíveis do ficheiro para colunas da BD
    column_mapping = {
        # Número do pedido
        'numero_pedido': 'numero_pedido',
        'nº pedido': 'numero_pedido',
        'n pedido': 'numero_pedido',
        'pedido': 'numero_pedido',
        'order': 'numero_pedido',
        'order_id': 'numero_pedido',
        # Data criação
        'data_criacao': 'data_criacao',
        'data criacao': 'data_criacao',
        'data criação': 'data_criacao',
        'data_criação': 'data_criacao',
        'criacao': 'data_criacao',
        'criação': 'data_criacao',
        'created_date': 'data_criacao',
        # Data pagamento
        'data_pagamento': 'data_pagamento',
        'data pagamento': 'data_pagamento',
        'pagamento': 'data_pagamento',
        'payment_date': 'data_pagamento',
        # Ciclo pagamento
        'ciclo_pagamento': 'ciclo_pagamento',
        'ciclo pagamento': 'ciclo_pagamento',
        'ciclo': 'ciclo_pagamento',
        'cycle': 'ciclo_pagamento',
        # Valor total
        'valor_total': 'valor_total',
        'valor total': 'valor_total',
        'total': 'valor_total',
        'amount': 'valor_total',
        'valor': 'valor_total',
        # Quantidade itens
        'quantidade_itens': 'quantidade_itens',
        'quantidade itens': 'quantidade_itens',
        'qtd_itens': 'quantidade_itens',
        'items': 'quantidade_itens',
        'quantidade': 'quantidade_itens',
        # Status
        'status': 'status',
        'estado': 'status',
        'state': 'status',
        # Canal vendas
        'canal_vendas': 'canal_vendas',
        'canal vendas': 'canal_vendas',
        'channel': 'canal_vendas',
        'marketplace': 'canal_vendas',
    }
    
    # Criar DataFrame mapeado
    df_mapped = pd.DataFrame()
    
    # Colunas da BD
    db_columns = [
        'numero_pedido', 'data_criacao', 'data_pagamento', 'ciclo_pagamento',
        'valor_total', 'quantidade_itens', 'status', 'canal_vendas'
    ]
    
    # Mapear colunas
    for db_col in db_columns:
        found = False
        
        # Verificar se existe diretamente
        if db_col in df.columns:
            df_mapped[db_col] = df[db_col]
            found = True
        else:
            # Verificar mapeamento (case insensitive e com espaços removidos)
            df_cols_lower = {col.lower().strip(): col for col in df.columns}
            for file_col_lower, mapped_col in column_mapping.items():
                if mapped_col == db_col and file_col_lower in df_cols_lower:
                    df_mapped[db_col] = df[df_cols_lower[file_col_lower]]
                    found = True
                    break
        
        # Se não encontrou, criar coluna vazia
        if not found:
            df_mapped[db_col] = None
    
    # Converter tipos
    # Número do pedido deve ser string
    if 'numero_pedido' in df_mapped.columns:
        df_mapped['numero_pedido'] = df_mapped['numero_pedido'].astype(str).replace('nan', None)
    
    # Datas
    for date_col in ['data_criacao', 'data_pagamento']:
        if date_col in df_mapped.columns:
            try:
                df_mapped[date_col] = pd.to_datetime(df_mapped[date_col], errors='coerce', dayfirst=True)
            except:
                try:
                    df_mapped[date_col] = pd.to_datetime(df_mapped[date_col], errors='coerce')
                except:
                    pass
    
    # Valores numéricos
    for num_col in ['valor_total', 'quantidade_itens']:
        if num_col in df_mapped.columns:
            df_mapped[num_col] = pd.to_numeric(df_mapped[num_col], errors='coerce').fillna(0.0)
    
    # Texto
    for text_col in ['ciclo_pagamento', 'status', 'canal_vendas']:
        if text_col in df_mapped.columns:
            df_mapped[text_col] = df_mapped[text_col].astype(str).replace('nan', None).replace('None', None)
    
    # Se não houver dados mapeados, retornar 0 sem erro
    if len(df_mapped) == 0:
        print("Aviso: Nenhum dado encontrado no ficheiro após o mapeamento.")
        return 0
    
    # Garantir que numero_pedido não está vazio (se existir)
    if 'numero_pedido' in df_mapped.columns:
        df_mapped = df_mapped[df_mapped['numero_pedido'].notna() & (df_mapped['numero_pedido'] != '')]
    
    # Se não houver pedidos válidos após filtrar por numero_pedido, criar IDs temporários
    if len(df_mapped) == 0:
        print("Aviso: Nenhum pedido com número válido encontrado. Tentando inserir dados com IDs temporários.")
        # Criar um DataFrame com todas as linhas originais e gerar IDs temporários
        df_mapped = pd.DataFrame()
        for db_col in db_columns:
            if db_col in df.columns:
                df_mapped[db_col] = df[db_col]
            else:
                df_cols_lower = {col.lower().strip(): col for col in df.columns}
                found = False
                for file_col_lower, mapped_col in column_mapping.items():
                    if mapped_col == db_col and file_col_lower in df_cols_lower:
                        df_mapped[db_col] = df[df_cols_lower[file_col_lower]]
                        found = True
                        break
                if not found:
                    df_mapped[db_col] = None
        
        # Se ainda não houver numero_pedido, criar IDs automáticos
        if 'numero_pedido' not in df_mapped.columns or df_mapped['numero_pedido'].isna().all():
            df_mapped['numero_pedido'] = [f'TEMP_{i+1}' for i in range(len(df_mapped))]
        
        # Garantir que temos pelo menos uma linha
        if len(df_mapped) == 0:
            print("Aviso: Nenhum dado encontrado no ficheiro.")
            return 0
    
    # Registrar DataFrame temporário
    conn.register('df_orders_temp', df_mapped)
    
    # Obter próximo ID
    next_id_result = conn.execute("SELECT COALESCE(MAX(id), 0) + 1 FROM orders").fetchone()
    next_id = int(next_id_result[0]) if next_id_result and next_id_result[0] else 1
    
    # Inserir com empresa_id e marketplace_id padrão (Teste 123 / Pixmania)
    conn.execute(f"""
        INSERT INTO orders (
            id, numero_pedido, data_criacao, data_pagamento, ciclo_pagamento,
            valor_total, quantidade_itens, status, canal_vendas, empresa_id, marketplace_id
        )
        SELECT 
            {next_id} + ROW_NUMBER() OVER() - 1 AS id,
            NULLIF(numero_pedido, '') AS numero_pedido,
            data_criacao,
            data_pagamento,
            NULLIF(ciclo_pagamento, '') AS ciclo_pagamento,
            CAST(valor_total AS DOUBLE) AS valor_total,
            CAST(quantidade_itens AS INTEGER) AS quantidade_itens,
            NULLIF(status, '') AS status,
            NULLIF(canal_vendas, '') AS canal_vendas,
            2 AS empresa_id,  -- Teste 123
            1 AS marketplace_id  -- Pixmania
        FROM df_orders_temp
    """)
    
    conn.unregister('df_orders_temp')
    
    return len(df_mapped)

