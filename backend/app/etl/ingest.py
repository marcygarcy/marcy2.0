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


def insert_transactions(conn: duckdb.DuckDBPyConnection, df: pd.DataFrame, empresa_id: int = 2, marketplace_id: int = 1) -> int:
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
    
    print(f"[INSERT_TRANSACTIONS] Registando DataFrame temporário com {len(df_mapped)} linhas")
    conn.register('df_temp', df_mapped)
    
    # Fazer INSERT com colunas explícitas e garantir tipos corretos
    # Associar à empresa e marketplace especificados
    print(f"[INSERT_TRANSACTIONS] Executando INSERT com empresa_id={empresa_id}, marketplace_id={marketplace_id}")
    try:
        result = conn.execute("""
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
                ? AS empresa_id,
                ? AS marketplace_id
            FROM df_temp
        """, [empresa_id, marketplace_id])
        
        # Verificar quantos registos foram inseridos
        rows_inserted = result.rowcount if hasattr(result, 'rowcount') else len(df_mapped)
        print(f"[INSERT_TRANSACTIONS] INSERT executado. Registos inseridos: {rows_inserted}")
        
    except Exception as e:
        import traceback
        print(f"[INSERT_TRANSACTIONS] ERRO no INSERT: {traceback.format_exc()}")
        raise
    
    conn.unregister('df_temp')
    print(f"[INSERT_TRANSACTIONS] Retornando {len(df_mapped)} registos processados")
    
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


def insert_orders(conn: duckdb.DuckDBPyConnection, df: pd.DataFrame, empresa_id: int = 2, marketplace_id: int = 1) -> int:
    """
    Insere orders (pedidos) na base de dados.
    
    Mapeia colunas comuns do ficheiro para a estrutura da tabela orders.
    """
    # Primeiro, imprimir colunas disponíveis no ficheiro para debug
    print("=" * 80)
    print("INÍCIO DO PROCESSAMENTO DE ORDERS")
    print("=" * 80)
    print(f"Total de linhas no ficheiro: {len(df)}")
    print(f"Colunas disponíveis no ficheiro ({len(df.columns)} colunas):")
    for i, col in enumerate(df.columns, 1):
        # Verificar se a coluna tem valores
        non_null_count = df[col].notna().sum()
        sample = df[col].dropna().head(1).iloc[0] if non_null_count > 0 else None
        sample_str = str(sample)[:50] if sample is not None else "vazia"
        print(f"  {i}. '{col}' ({non_null_count} valores não-nulos) - exemplo: {sample_str}")
    print("=" * 80)
    
    # Mapeamento de colunas possíveis do ficheiro para colunas da BD
    column_mapping = {
        # Número do pedido - adicionar mais variações
        'numero_pedido': 'numero_pedido',
        'nº pedido': 'numero_pedido',
        'n pedido': 'numero_pedido',
        'n° pedido': 'numero_pedido',
        'n° do pedido': 'numero_pedido',
        'nº do pedido': 'numero_pedido',
        'n. pedido': 'numero_pedido',
        'n.º pedido': 'numero_pedido',
        'pedido': 'numero_pedido',
        'order': 'numero_pedido',
        'order_id': 'numero_pedido',
        'order number': 'numero_pedido',
        'order_number': 'numero_pedido',
        'order id': 'numero_pedido',
        'orderid': 'numero_pedido',
        'order-id': 'numero_pedido',
        'id pedido': 'numero_pedido',
        'id do pedido': 'numero_pedido',
        'número do pedido': 'numero_pedido',
        'numero do pedido': 'numero_pedido',
        # Data criação
        'data_criacao': 'data_criacao',
        'data criacao': 'data_criacao',
        'data criação': 'data_criacao',
        'data de criação': 'data_criacao',
        'data_criação': 'data_criacao',
        'criacao': 'data_criacao',
        'criação': 'data_criacao',
        'created_date': 'data_criacao',
        # Quantidade
        'quantidade': 'quantidade',
        'qty': 'quantidade',
        'qtd': 'quantidade',
        # Detalhes
        'detalhes': 'detalhes',
        'detalhe': 'detalhes',
        'details': 'detalhes',
        'descricao': 'detalhes',
        'descrição': 'detalhes',
        # Status
        'status': 'status',
        'estado': 'status',
        'state': 'status',
        # Valor
        'valor': 'valor',
        'value': 'valor',
        # Canal vendas
        'canal_vendas': 'canal_vendas',
        'canal vendas': 'canal_vendas',
        'canal': 'canal_vendas',
        'channel': 'canal_vendas',
        'marketplace': 'canal_vendas',
        # SKU da oferta
        'sku_oferta': 'sku_oferta',
        'sku da oferta': 'sku_oferta',
        'sku': 'sku_oferta',
        'offer_sku': 'sku_oferta',
        # Marca
        'marca': 'marca',
        'brand': 'marca',
        # Etiqueta de categoria
        'etiqueta_categoria': 'etiqueta_categoria',
        'etiqueta de categoria': 'etiqueta_categoria',
        'categoria': 'etiqueta_categoria',
        'category': 'etiqueta_categoria',
        # Preço unitário
        'preco_unitario': 'preco_unitario',
        'preço unitário': 'preco_unitario',
        'preco unitario': 'preco_unitario',
        'preço_unitário': 'preco_unitario',
        'unit_price': 'preco_unitario',
        # Valor total do pedido sem impostos
        'valor_total_sem_impostos': 'valor_total_sem_impostos',
        'valor total do pedido sem impostos (incluindo despesas de envio)': 'valor_total_sem_impostos',
        'valor total sem impostos': 'valor_total_sem_impostos',
        'total_sem_impostos': 'valor_total_sem_impostos',
        # Valor total do pedido com IVA
        'valor_total_com_iva': 'valor_total_com_iva',
        'valor total do pedido (incluindo IVA e despesas de envio)': 'valor_total_com_iva',
        'valor total com iva': 'valor_total_com_iva',
        'total_com_iva': 'valor_total_com_iva',
        # Comissão sem impostos
        'comissao_sem_impostos': 'comissao_sem_impostos',
        'comissão (sem impostos)': 'comissao_sem_impostos',
        'comissao sem impostos': 'comissao_sem_impostos',
        # Valor da comissão com impostos
        'valor_comissao_com_impostos': 'valor_comissao_com_impostos',
        'valor da comissão (incluindo impostos)': 'valor_comissao_com_impostos',
        'comissao com impostos': 'valor_comissao_com_impostos',
        # Valor transferido para loja
        'valor_transferido_loja': 'valor_transferido_loja',
        'valor transferido para loja (incluindo impostos)': 'valor_transferido_loja',
        'transferido loja': 'valor_transferido_loja',
        # País do endereço de faturamento
        'pais_faturamento': 'pais_faturamento',
        'país do endereço de faturamento': 'pais_faturamento',
        'pais faturamento': 'pais_faturamento',
        'billing_country': 'pais_faturamento',
        # Impostos TVA FR
        'imposto_produto_tva_fr_20': 'imposto_produto_tva_fr_20',
        'valor do imposto sobre o produto (TVA FR - tva-fr-20)': 'imposto_produto_tva_fr_20',
        'imposto_envio_tva_fr_20': 'imposto_envio_tva_fr_20',
        'valor dos impostos de envio (TVA FR - tva-fr-20)': 'imposto_envio_tva_fr_20',
        # Impostos TVA ES
        'imposto_produto_tva_es_21': 'imposto_produto_tva_es_21',
        'valor do imposto sobre o produto (TVA ES - tva-es-21)': 'imposto_produto_tva_es_21',
        'imposto_envio_tva_es_21': 'imposto_envio_tva_es_21',
        'valor dos impostos de envio (TVA ES - tva-es-21)': 'imposto_envio_tva_es_21',
        # Impostos TVA IT
        'imposto_produto_tva_it_22': 'imposto_produto_tva_it_22',
        'valor do imposto sobre o produto (TVA IT - tva-it-22)': 'imposto_produto_tva_it_22',
        'imposto_envio_tva_it_22': 'imposto_envio_tva_it_22',
        'valor dos impostos de envio (TVA IT - tva-it-22)': 'imposto_envio_tva_it_22',
        # Impostos TVA ZERO
        'imposto_produto_tva_zero': 'imposto_produto_tva_zero',
        'valor do imposto sobre o produto (TVA ZERO - tva-zero)': 'imposto_produto_tva_zero',
        'imposto_envio_tva_zero': 'imposto_envio_tva_zero',
        'valor dos impostos de envio (TVA ZERO - tva-zero)': 'imposto_envio_tva_zero',
        # Total de impostos
        'total_impostos_pedido': 'total_impostos_pedido',
        'total de impostos do pedido': 'total_impostos_pedido',
        'total_impostos_envio': 'total_impostos_envio',
        'total dos impostos de envio': 'total_impostos_envio',
        # Campos antigos (compatibilidade)
        'data_pagamento': 'data_pagamento',
        'data pagamento': 'data_pagamento',
        'pagamento': 'data_pagamento',
        'payment_date': 'data_pagamento',
        'ciclo_pagamento': 'ciclo_pagamento',
        'ciclo pagamento': 'ciclo_pagamento',
        'ciclo': 'ciclo_pagamento',
        'cycle': 'ciclo_pagamento',
        'valor_total': 'valor_total',
        'valor total': 'valor_total',
        'total': 'valor_total',
        'amount': 'valor_total',
        'quantidade_itens': 'quantidade_itens',
        'quantidade itens': 'quantidade_itens',
        'qtd_itens': 'quantidade_itens',
        'items': 'quantidade_itens',
    }
    
    # Criar DataFrame mapeado
    df_mapped = pd.DataFrame()
    
    # Colunas da BD (incluindo todas as novas)
    db_columns = [
        'numero_pedido', 'data_criacao', 'quantidade', 'detalhes', 'status', 'valor',
        'canal_vendas', 'sku_oferta', 'marca', 'etiqueta_categoria', 'preco_unitario',
        'valor_total_sem_impostos', 'valor_total_com_iva', 'comissao_sem_impostos',
        'valor_comissao_com_impostos', 'valor_transferido_loja', 'pais_faturamento',
        'imposto_produto_tva_fr_20', 'imposto_envio_tva_fr_20',
        'imposto_produto_tva_es_21', 'imposto_envio_tva_es_21',
        'imposto_produto_tva_it_22', 'imposto_envio_tva_it_22',
        'imposto_produto_tva_zero', 'imposto_envio_tva_zero',
        'total_impostos_pedido', 'total_impostos_envio',
        # Campos antigos (mantidos para compatibilidade)
        'data_pagamento', 'ciclo_pagamento', 'valor_total', 'quantidade_itens'
    ]
    
    # Mapear colunas
    # IMPORTANTE: Para numero_pedido, fazer busca PRIMEIRO antes de mapear outras colunas
    print("\n--- PROCURANDO COLUNA DO NÚMERO DO PEDIDO ---")
    numero_pedido_col = None
    
    # 1. Verificar se existe diretamente
    if 'numero_pedido' in df.columns:
        numero_pedido_col = 'numero_pedido'
        print(f"✓ Coluna 'numero_pedido' encontrada diretamente no ficheiro")
    else:
        # 2. Verificar mapeamento (case insensitive e com espaços removidos)
        df_cols_lower = {col.lower().strip(): col for col in df.columns}
        for file_col_lower, mapped_col in column_mapping.items():
            if mapped_col == 'numero_pedido' and file_col_lower in df_cols_lower:
                numero_pedido_col = df_cols_lower[file_col_lower]
                print(f"✓ Coluna 'numero_pedido' mapeada a partir de '{numero_pedido_col}'")
                break
        
        # 3. Se ainda não encontrou, tentar usar a segunda coluna (coluna B) diretamente
        # O número do pedido está tipicamente na coluna B do Excel
        if not numero_pedido_col and len(df.columns) >= 2:
            col_b = df.columns[1]
            non_null_b = df[col_b].notna().sum()
            if non_null_b > 0:
                numero_pedido_col = col_b
                print(f"✓ Coluna 'numero_pedido' encontrada na segunda coluna (coluna B): '{col_b}'")
                print(f"   Valores não-nulos: {non_null_b} de {len(df)}")
        
        # 4. Se ainda não encontrou, fazer busca por palavras-chave
        if not numero_pedido_col:
            print("   Procurando colunas que contenham palavras-chave...")
            for col in df.columns:
                col_lower = col.lower().strip()
                # Procurar por palavras-chave mais específicas primeiro
                keywords = ['pedido', 'order', 'n°', 'nº', 'numero', 'number']
                if any(keyword in col_lower for keyword in keywords):
                    numero_pedido_col = col
                    print(f"✓ Coluna 'numero_pedido' encontrada por busca: '{col}'")
                    break
        
        # 5. Se ainda não encontrou, usar primeira coluna como último fallback
        if not numero_pedido_col and len(df.columns) > 0:
            numero_pedido_col = df.columns[0]
            print(f"⚠️ Usando primeira coluna '{numero_pedido_col}' como número de pedido (último fallback)")
    
    # Mostrar informações sobre a coluna encontrada
    if numero_pedido_col:
        non_null = df[numero_pedido_col].notna().sum()
        print(f"   Coluna selecionada: '{numero_pedido_col}'")
        print(f"   Valores não-nulos: {non_null} de {len(df)}")
        if non_null > 0:
            examples = df[numero_pedido_col].dropna().head(5).tolist()
            print(f"   Exemplos de valores: {examples}")
        else:
            print(f"   ⚠️ AVISO: A coluna está vazia!")
    
    print("--- FIM DA BUSCA POR NÚMERO DO PEDIDO ---\n")
    
    # Agora mapear todas as colunas
    for db_col in db_columns:
        found = False
        
        # Para numero_pedido, usar a coluna já encontrada
        if db_col == 'numero_pedido' and numero_pedido_col:
            df_mapped[db_col] = df[numero_pedido_col]
            found = True
        # Verificar se existe diretamente
        elif db_col in df.columns:
            df_mapped[db_col] = df[db_col]
            found = True
        else:
            # Verificar mapeamento (case insensitive e com espaços removidos)
            df_cols_lower = {col.lower().strip(): col for col in df.columns}
            for file_col_lower, mapped_col in column_mapping.items():
                if mapped_col == db_col and file_col_lower in df_cols_lower:
                    original_col_name = df_cols_lower[file_col_lower]
                    df_mapped[db_col] = df[original_col_name]
                    found = True
                    break
        
        # Se não encontrou, criar coluna vazia
        if not found:
            df_mapped[db_col] = None
    
    # Converter tipos
    # Número do pedido deve ser string - mas preservar valores originais
    if 'numero_pedido' in df_mapped.columns:
        # Verificar valores antes de converter
        before_count = df_mapped['numero_pedido'].notna().sum()
        print(f"   Valores não-nulos ANTES da conversão: {before_count} de {len(df_mapped)}")
        
        # Converter para string, mas preservar valores originais
        # IMPORTANTE: Não converter None para string 'None', manter como None
        df_mapped['numero_pedido'] = df_mapped['numero_pedido'].apply(
            lambda x: str(x) if pd.notna(x) and x is not None else None
        )
        
        # Substituir apenas strings que representam valores vazios (mas não strings válidas que contenham "None")
        df_mapped['numero_pedido'] = df_mapped['numero_pedido'].replace(
            ['nan', 'NaN', '<NA>', 'NaT', ''], None
        )
        # Não substituir 'None' se vier como string literal do ficheiro - apenas se for realmente None
        
        # Verificar valores após conversão
        after_count = df_mapped['numero_pedido'].notna().sum()
        print(f"   Valores não-nulos DEPOIS da conversão: {after_count} de {len(df_mapped)}")
        
        # Mostrar alguns exemplos de valores para debug
        sample_values = df_mapped['numero_pedido'].dropna().head(5).tolist()
        if sample_values:
            print(f"   ✓ Exemplos de números de pedido encontrados: {sample_values}")
        else:
            print(f"   ⚠️ Nenhum valor não-nulo encontrado em numero_pedido após conversão")
            # Mostrar valores únicos para debug (mesmo que sejam None)
            unique_vals = df_mapped['numero_pedido'].unique()[:10].tolist()
            print(f"   Valores únicos (primeiros 10): {unique_vals}")
    
    # Datas - tratar formato "DD/MM/YYYY - HH:MM:SS"
    for date_col in ['data_criacao', 'data_pagamento']:
        if date_col in df_mapped.columns:
            try:
                # Função auxiliar para converter formato "DD/MM/YYYY - HH:MM:SS" para datetime
                def convert_date_format(value):
                    # Verificar se é None, NaN ou string vazia
                    if value is None:
                        return None
                    try:
                        if pd.isna(value):
                            return None
                    except:
                        pass
                    
                    # Converter para string
                    date_str = str(value).strip()
                    if date_str in ['None', 'nan', 'NaN', '', 'NaT', '<NA>']:
                        return None
                    
                    # Se contém " - ", separar data e hora
                    if ' - ' in date_str:
                        parts = date_str.split(' - ', 1)
                        date_part = parts[0].strip()
                        time_part = parts[1].strip() if len(parts) > 1 else '00:00:00'
                        
                        # Converter DD/MM/YYYY para YYYY-MM-DD
                        try:
                            date_parts = date_part.split('/')
                            if len(date_parts) == 3:
                                day, month, year = date_parts
                                formatted_date = f"{year}-{month.zfill(2)}-{day.zfill(2)}"
                                datetime_str = f"{formatted_date} {time_part}"
                                result = pd.to_datetime(datetime_str, errors='coerce')
                                # Verificar se a conversão foi bem-sucedida
                                if pd.isna(result):
                                    return None
                                return result
                        except Exception as e:
                            print(f"Erro ao converter data específica '{date_str}': {e}")
                            return None
                    
                    # Tentar conversão padrão
                    try:
                        result = pd.to_datetime(date_str, errors='coerce', dayfirst=True)
                        if pd.isna(result):
                            return None
                        return result
                    except:
                        try:
                            result = pd.to_datetime(date_str, errors='coerce')
                            if pd.isna(result):
                                return None
                            return result
                        except:
                            return None
                
                # Aplicar conversão a cada valor
                df_mapped[date_col] = df_mapped[date_col].apply(convert_date_format)
                
                # Garantir que o tipo é datetime64[ns] e substituir NaT por None
                df_mapped[date_col] = df_mapped[date_col].where(pd.notna(df_mapped[date_col]), None)
                
            except Exception as e:
                print(f"Erro ao converter datas na coluna {date_col}: {e}")
                import traceback
                traceback.print_exc()
                # Tentar conversão simples como fallback
                try:
                    df_mapped[date_col] = pd.to_datetime(df_mapped[date_col], errors='coerce', dayfirst=True)
                    df_mapped[date_col] = df_mapped[date_col].where(pd.notna(df_mapped[date_col]), None)
                except:
                    # Se tudo falhar, definir como None
                    df_mapped[date_col] = None
    
    # Valores numéricos (DOUBLE)
    numeric_cols = [
        'quantidade', 'valor', 'preco_unitario', 'valor_total_sem_impostos',
        'valor_total_com_iva', 'comissao_sem_impostos', 'valor_comissao_com_impostos',
        'valor_transferido_loja', 'imposto_produto_tva_fr_20', 'imposto_envio_tva_fr_20',
        'imposto_produto_tva_es_21', 'imposto_envio_tva_es_21',
        'imposto_produto_tva_it_22', 'imposto_envio_tva_it_22',
        'imposto_produto_tva_zero', 'imposto_envio_tva_zero',
        'total_impostos_pedido', 'total_impostos_envio',
        'valor_total', 'quantidade_itens'  # Campos antigos
    ]
    for num_col in numeric_cols:
        if num_col in df_mapped.columns:
            df_mapped[num_col] = pd.to_numeric(df_mapped[num_col], errors='coerce')
    
    # Texto
    text_cols = [
        'detalhes', 'status', 'canal_vendas', 'sku_oferta', 'marca',
        'etiqueta_categoria', 'pais_faturamento',
        'ciclo_pagamento'  # Campo antigo
    ]
    for text_col in text_cols:
        if text_col in df_mapped.columns:
            df_mapped[text_col] = df_mapped[text_col].astype(str).replace('nan', None).replace('None', None)
    
    # Se não houver dados mapeados, retornar 0 sem erro
    if len(df_mapped) == 0:
        print("Aviso: Nenhum dado encontrado no ficheiro após o mapeamento.")
        return 0
    
    # Garantir que numero_pedido não está vazio (se existir)
    # Mas primeiro, tentar limpar valores que podem estar como string "nan" ou "None"
    if 'numero_pedido' in df_mapped.columns:
        # Verificar se a coluna tem valores antes de converter
        original_non_null = df_mapped['numero_pedido'].notna().sum()
        print(f"Valores não-nulos originais em numero_pedido: {original_non_null} de {len(df_mapped)}")
        
        # Converter para string e limpar - mas preservar valores originais
        df_mapped['numero_pedido'] = df_mapped['numero_pedido'].astype(str)
        # Substituir apenas strings que representam valores vazios
        df_mapped['numero_pedido'] = df_mapped['numero_pedido'].replace(['nan', 'None', 'NaN', '<NA>', 'NaT', ''], None)
        
        # Filtrar apenas os que são realmente None ou vazios
        valid_mask = df_mapped['numero_pedido'].notna() & (df_mapped['numero_pedido'] != '') & (df_mapped['numero_pedido'] != 'None')
        
        # Mostrar quantos registos têm número de pedido válido
        num_valid = valid_mask.sum()
        print(f"Registos com número de pedido válido após limpeza: {num_valid} de {len(df_mapped)}")
        
        # Mostrar exemplos dos valores encontrados
        if num_valid > 0:
            examples = df_mapped[valid_mask]['numero_pedido'].head(3).tolist()
            print(f"   Exemplos de valores válidos: {examples}")
        
        # Se houver pelo menos alguns válidos, manter apenas esses
        if num_valid > 0:
            df_mapped = df_mapped[valid_mask]
            print(f"✓ Mantendo {num_valid} registos com número de pedido válido")
        # Se não houver nenhum válido, manter todos e tentar usar valores mesmo que estejam vazios
        else:
            print("⚠️ AVISO: Nenhum número de pedido válido encontrado após limpeza.")
            print("   Manter todos os registos e tentar usar valores disponíveis.")
            print(f"   Valores únicos encontrados (primeiros 5): {df_mapped['numero_pedido'].unique()[:5].tolist()}")
    
    # Se não houver pedidos válidos após filtrar, verificar se há dados no ficheiro original
    if len(df_mapped) == 0:
        print("Aviso: Nenhum pedido com número válido encontrado após filtro.")
        print("   Tentando usar dados do ficheiro original sem filtrar por número de pedido...")
        
        # Recriar DataFrame mapeado sem filtrar por numero_pedido
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
                
                # Para numero_pedido, fazer busca mais agressiva
                if not found and db_col == 'numero_pedido':
                    for col in df.columns:
                        col_lower = col.lower().strip()
                        if 'pedido' in col_lower or 'order' in col_lower or 'n°' in col_lower or 'nº' in col_lower:
                            df_mapped[db_col] = df[col]
                            found = True
                            print(f"   ✓ Encontrada coluna '{col}' para numero_pedido")
                            break
                
                if not found:
                    df_mapped[db_col] = None
        
        # Se ainda não encontrou numero_pedido, tentar usar primeira coluna ou criar IDs apenas se realmente necessário
        if 'numero_pedido' in df_mapped.columns:
            # Verificar se há valores não nulos
            non_null_count = df_mapped['numero_pedido'].notna().sum()
            print(f"   Verificação final: {non_null_count} registos com numero_pedido não-nulo")
            
            if non_null_count == 0:
                # Tentar usar a segunda coluna (coluna B) diretamente
                print("   Tentando usar a segunda coluna (coluna B) como número de pedido...")
                if len(df.columns) >= 2:
                    col_b = df.columns[1]
                    non_null_in_col = df[col_b].notna().sum()
                    if non_null_in_col > 0:
                        df_mapped['numero_pedido'] = df[col_b]
                        print(f"   ✓ Usando segunda coluna (coluna B) '{col_b}' como número de pedido")
                        print(f"   Valores não-nulos: {non_null_in_col} de {len(df)}")
                        examples = df[col_b].dropna().head(3).tolist()
                        print(f"   Exemplos: {examples}")
                        non_null_count = non_null_in_col
                
                # Se ainda não encontrou, tentar todas as colunas uma por uma
                if non_null_count == 0:
                    print("   Tentando todas as colunas do ficheiro para encontrar número de pedido...")
                    for col in df.columns:
                        non_null_in_col = df[col].notna().sum()
                        if non_null_in_col > 0:
                            # Verificar se os valores parecem ser IDs/pedidos (não são todos NaN após conversão)
                            sample = df[col].dropna().head(1).iloc[0] if non_null_in_col > 0 else None
                            if sample is not None:
                                df_mapped['numero_pedido'] = df[col]
                                print(f"   ✓ Usando coluna '{col}' como número de pedido")
                                print(f"   Valores não-nulos: {non_null_in_col} de {len(df)}")
                                examples = df[col].dropna().head(3).tolist()
                                print(f"   Exemplos: {examples}")
                                non_null_count = non_null_in_col
                                break
                
                # Se ainda não tem valores, criar IDs temporários apenas como último recurso
                if non_null_count == 0:
                    print("   ⚠️ Ainda sem valores válidos após tentar todas as colunas, criando IDs temporários...")
                    print("   ⚠️ ATENÇÃO: Isto significa que o ficheiro pode não ter coluna de número de pedido ou está vazia!")
                    df_mapped['numero_pedido'] = [f'TEMP_{i+1}' for i in range(len(df_mapped))]
            else:
                print(f"   ✓ Encontrados {non_null_count} registos com número de pedido válido")
                examples = df_mapped['numero_pedido'].dropna().head(3).tolist()
                print(f"   Exemplos finais: {examples}")
        
        # Garantir que temos pelo menos uma linha
        if len(df_mapped) == 0:
            print("Aviso: Nenhum dado encontrado no ficheiro.")
            return 0
    
    # Garantir que colunas de data são do tipo correto antes de registar
    # Converter datetime para string no formato YYYY-MM-DD HH:MM:SS para evitar problemas de tipo no DuckDB
    for date_col in ['data_criacao', 'data_pagamento']:
        if date_col in df_mapped.columns:
            # Substituir NaT por None e converter datetime para string formato ISO
            def format_datetime_for_db(value):
                if value is None or pd.isna(value):
                    return None
                try:
                    # Se já é datetime, converter para string no formato correto
                    if isinstance(value, pd.Timestamp):
                        return value.strftime('%Y-%m-%d %H:%M:%S')
                    # Se é string, verificar se precisa de conversão
                    elif isinstance(value, str):
                        # Se já está no formato correto, retornar como está
                        if len(value) >= 19 and value[4] == '-' and value[7] == '-':
                            return value[:19]  # Pegar apenas YYYY-MM-DD HH:MM:SS
                        # Tentar converter
                        dt = pd.to_datetime(value, errors='coerce', dayfirst=True)
                        if pd.notna(dt):
                            return dt.strftime('%Y-%m-%d %H:%M:%S')
                        return None
                    else:
                        # Tentar converter para datetime primeiro
                        dt = pd.to_datetime(value, errors='coerce', dayfirst=True)
                        if pd.notna(dt):
                            return dt.strftime('%Y-%m-%d %H:%M:%S')
                        return None
                except:
                    return None
            
            df_mapped[date_col] = df_mapped[date_col].apply(format_datetime_for_db)
    
    # Registrar DataFrame temporário
    conn.register('df_orders_temp', df_mapped)
    
    # Obter próximo ID
    next_id_result = conn.execute("SELECT COALESCE(MAX(id), 0) + 1 FROM orders").fetchone()
    next_id = int(next_id_result[0]) if next_id_result and next_id_result[0] else 1
    
    # Inserir com empresa_id e marketplace_id padrão (Teste 123 / Pixmania)
    conn.execute(f"""
        INSERT INTO orders (
            id, numero_pedido, data_criacao, quantidade, detalhes, status, valor,
            canal_vendas, sku_oferta, marca, etiqueta_categoria, preco_unitario,
            valor_total_sem_impostos, valor_total_com_iva, comissao_sem_impostos,
            valor_comissao_com_impostos, valor_transferido_loja, pais_faturamento,
            imposto_produto_tva_fr_20, imposto_envio_tva_fr_20,
            imposto_produto_tva_es_21, imposto_envio_tva_es_21,
            imposto_produto_tva_it_22, imposto_envio_tva_it_22,
            imposto_produto_tva_zero, imposto_envio_tva_zero,
            total_impostos_pedido, total_impostos_envio,
            data_pagamento, ciclo_pagamento, valor_total, quantidade_itens,
            empresa_id, marketplace_id
        )
        SELECT 
            {next_id} + ROW_NUMBER() OVER() - 1 AS id,
            NULLIF(numero_pedido, '') AS numero_pedido,
            CASE 
                WHEN data_criacao IS NULL OR data_criacao = '' THEN NULL
                ELSE CAST(data_criacao AS TIMESTAMP)
            END AS data_criacao,
            CAST(quantidade AS DOUBLE) AS quantidade,
            NULLIF(detalhes, '') AS detalhes,
            NULLIF(status, '') AS status,
            CAST(valor AS DOUBLE) AS valor,
            NULLIF(canal_vendas, '') AS canal_vendas,
            NULLIF(sku_oferta, '') AS sku_oferta,
            NULLIF(marca, '') AS marca,
            NULLIF(etiqueta_categoria, '') AS etiqueta_categoria,
            CAST(preco_unitario AS DOUBLE) AS preco_unitario,
            CAST(valor_total_sem_impostos AS DOUBLE) AS valor_total_sem_impostos,
            CAST(valor_total_com_iva AS DOUBLE) AS valor_total_com_iva,
            CAST(comissao_sem_impostos AS DOUBLE) AS comissao_sem_impostos,
            CAST(valor_comissao_com_impostos AS DOUBLE) AS valor_comissao_com_impostos,
            CAST(valor_transferido_loja AS DOUBLE) AS valor_transferido_loja,
            NULLIF(pais_faturamento, '') AS pais_faturamento,
            CAST(imposto_produto_tva_fr_20 AS DOUBLE) AS imposto_produto_tva_fr_20,
            CAST(imposto_envio_tva_fr_20 AS DOUBLE) AS imposto_envio_tva_fr_20,
            CAST(imposto_produto_tva_es_21 AS DOUBLE) AS imposto_produto_tva_es_21,
            CAST(imposto_envio_tva_es_21 AS DOUBLE) AS imposto_envio_tva_es_21,
            CAST(imposto_produto_tva_it_22 AS DOUBLE) AS imposto_produto_tva_it_22,
            CAST(imposto_envio_tva_it_22 AS DOUBLE) AS imposto_envio_tva_it_22,
            CAST(imposto_produto_tva_zero AS DOUBLE) AS imposto_produto_tva_zero,
            CAST(imposto_envio_tva_zero AS DOUBLE) AS imposto_envio_tva_zero,
            CAST(total_impostos_pedido AS DOUBLE) AS total_impostos_pedido,
            CAST(total_impostos_envio AS DOUBLE) AS total_impostos_envio,
            CASE 
                WHEN data_pagamento IS NULL OR data_pagamento = '' THEN NULL
                ELSE CAST(data_pagamento AS TIMESTAMP)
            END AS data_pagamento,
            NULLIF(ciclo_pagamento, '') AS ciclo_pagamento,
            CAST(valor_total AS DOUBLE) AS valor_total,
            CAST(quantidade_itens AS INTEGER) AS quantidade_itens,
            ? AS empresa_id,
            ? AS marketplace_id
        FROM df_orders_temp
    """, [empresa_id, marketplace_id])
    
    conn.unregister('df_orders_temp')
    
    return len(df_mapped)

