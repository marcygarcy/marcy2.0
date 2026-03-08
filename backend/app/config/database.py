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
    
    # Adicionar novas colunas à tabela orders (migração)
    try:
        result = conn.execute("DESCRIBE orders").fetchall()
        column_names = [col[0] for col in result]
        
        # Lista de novas colunas a adicionar
        new_columns = [
            ("quantidade", "DOUBLE"),
            ("detalhes", "TEXT"),
            ("valor", "DOUBLE"),
            ("sku_oferta", "TEXT"),
            ("marca", "TEXT"),
            ("etiqueta_categoria", "TEXT"),
            ("preco_unitario", "DOUBLE"),
            ("valor_total_sem_impostos", "DOUBLE"),
            ("valor_total_com_iva", "DOUBLE"),
            ("comissao_sem_impostos", "DOUBLE"),
            ("valor_comissao_com_impostos", "DOUBLE"),
            ("valor_transferido_loja", "DOUBLE"),
            ("pais_faturamento", "TEXT"),
            ("imposto_produto_tva_fr_20", "DOUBLE"),
            ("imposto_envio_tva_fr_20", "DOUBLE"),
            ("imposto_produto_tva_es_21", "DOUBLE"),
            ("imposto_envio_tva_es_21", "DOUBLE"),
            ("imposto_produto_tva_it_22", "DOUBLE"),
            ("imposto_envio_tva_it_22", "DOUBLE"),
            ("imposto_produto_tva_zero", "DOUBLE"),
            ("imposto_envio_tva_zero", "DOUBLE"),
            ("total_impostos_pedido", "DOUBLE"),
            ("total_impostos_envio", "DOUBLE")
        ]
        
        for col_name, col_type in new_columns:
            if col_name not in column_names:
                try:
                    conn.execute(f"ALTER TABLE orders ADD COLUMN {col_name} {col_type}")
                except Exception as e:
                    print(f"Aviso ao adicionar coluna {col_name}: {e}")
                    pass
        
        # Colunas do módulo Sales & Orders (Dropshipping)
        sales_columns = [
            ("nome_produto", "TEXT"),
            ("valor_bruto", "DOUBLE"),
            ("valor_iva", "DOUBLE"),
            ("taxa_comissao_pct", "DOUBLE"),
            ("valor_liquido_venda", "DOUBLE"),
            ("custo_fornecedor", "DOUBLE"),
            ("gastos_envio", "DOUBLE"),
            ("outras_taxas", "DOUBLE"),
            ("margem_unitaria", "DOUBLE"),
            ("margem_total_linha", "DOUBLE"),
            ("status_operacional", "TEXT"),
            ("pago_reconciliado", "BOOLEAN"),
            ("data_reconciliacao", "TIMESTAMP"),
        ]
        for col_name, col_type in sales_columns:
            if col_name not in column_names:
                try:
                    conn.execute(f"ALTER TABLE orders ADD COLUMN {col_name} {col_type}")
                except Exception as e:
                    print(f"Aviso ao adicionar coluna {col_name}: {e}")
                    pass
    except Exception as e:
        print(f"Aviso ao verificar colunas de orders: {e}")
        pass
    
    # Tabela sku_mapping (Marketplace SKU -> Fornecedor SKU e custo)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS sku_mapping (
            id INTEGER PRIMARY KEY,
            empresa_id INTEGER NOT NULL,
            marketplace_id INTEGER,
            sku_marketplace TEXT NOT NULL,
            sku_fornecedor TEXT,
            nome_produto TEXT,
            custo_fornecedor DOUBLE DEFAULT 0,
            moeda TEXT DEFAULT 'EUR',
            ativo BOOLEAN DEFAULT TRUE,
            data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    try:
        r = conn.execute("DESCRIBE sku_mapping").fetchall()
        cols = [c[0] for c in r]
        if "supplier_id" not in cols:
            conn.execute("ALTER TABLE sku_mapping ADD COLUMN supplier_id INTEGER")
        if "vat_rate" not in cols:
            conn.execute("ALTER TABLE sku_mapping ADD COLUMN vat_rate DOUBLE DEFAULT 0")
    except Exception:
        pass

    # Tabela pending_purchase_items (necessidades de compra — draft automático por venda)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS pending_purchase_items (
            id INTEGER PRIMARY KEY,
            empresa_id INTEGER NOT NULL,
            sales_order_id INTEGER NOT NULL,
            sales_order_item_id INTEGER NOT NULL,
            sku_marketplace TEXT,
            sku_supplier TEXT,
            supplier_id INTEGER,
            quantity DOUBLE NOT NULL DEFAULT 1,
            cost_price_base DOUBLE DEFAULT 0,
            unit_price_sale DOUBLE DEFAULT 0,
            commission_share DOUBLE DEFAULT 0,
            expected_profit DOUBLE DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'pending',
            data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Tabela suppliers (Ficha de Fornecedor - Master Data)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS suppliers (
            id INTEGER PRIMARY KEY,
            empresa_id INTEGER NOT NULL,
            nome TEXT NOT NULL,
            codigo TEXT,
            entidade_id INTEGER,
            designacao_social TEXT,
            nif_cif TEXT,
            website_url TEXT,
            morada TEXT,
            codigo_postal TEXT,
            localidade TEXT,
            pais TEXT,
            pais_iva TEXT,
            regime_iva TEXT,
            taxa_iva_padrao DOUBLE DEFAULT 0,
            tel TEXT,
            email TEXT,
            email_comercial TEXT,
            metodo_pagamento TEXT,
            iban TEXT,
            cartao_id INTEGER,
            prazo_pagamento TEXT,
            default_shipping_type TEXT,
            lead_time_estimado INTEGER,
            custo_envio_base DOUBLE DEFAULT 0,
            supplier_score DOUBLE,
            ativo BOOLEAN DEFAULT TRUE,
            data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    # Migração: adicionar colunas ERP à tabela suppliers se já existir
    try:
        r = conn.execute("DESCRIBE suppliers").fetchall()
        cols_s = [c[0] for c in r]
        for col, ctype in [
            ("entidade_id", "INTEGER"), ("entidade", "INTEGER"), ("office_id", "INTEGER"), ("tipo_envio", "TEXT"),
            ("designacao_social", "TEXT"), ("nif_cif", "TEXT"), ("website_url", "TEXT"),
            ("morada", "TEXT"), ("codigo_postal", "TEXT"), ("localidade", "TEXT"), ("pais", "TEXT"),
            ("regime_iva", "TEXT"), ("tel", "TEXT"), ("email", "TEXT"), ("email_comercial", "TEXT"),
            ("metodo_pagamento", "TEXT"), ("iban", "TEXT"), ("cartao_id", "INTEGER"), ("prazo_pagamento", "TEXT"),
            ("default_shipping_type", "TEXT"), ("lead_time_estimado", "INTEGER"), ("custo_envio_base", "DOUBLE"),
            ("supplier_score", "DOUBLE"), ("payment_method_id", "INTEGER"),
        ]:
            if col not in cols_s:
                conn.execute(f"ALTER TABLE suppliers ADD COLUMN {col} {ctype}")
        try:
            r2 = conn.execute("DESCRIBE suppliers").fetchall()
            if any(c[0] == "entidade" for c in r2):
                conn.execute("UPDATE suppliers SET entidade = id WHERE entidade IS NULL")
        except Exception:
            pass
    except Exception:
        pass

    # Tabela purchase_orders (cabeçalho compra; dados fiscais por empresa)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS purchase_orders (
            id INTEGER PRIMARY KEY,
            empresa_id INTEGER NOT NULL,
            supplier_id INTEGER,
            status TEXT NOT NULL DEFAULT 'Draft',
            tipo_envio TEXT NOT NULL DEFAULT 'Escritorio',
            total_base DOUBLE DEFAULT 0,
            portes_totais DOUBLE DEFAULT 0,
            impostos DOUBLE DEFAULT 0,
            total_final DOUBLE DEFAULT 0,
            data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            data_ordered TIMESTAMP,
            data_paid TIMESTAMP,
            notas TEXT,
            billing_nif TEXT,
            billing_address TEXT,
            billing_name TEXT,
            supplier_order_id TEXT
        )
    """)

    # Tabela purchase_order_items (elo venda <-> compra; sales_order_item_id = rastreabilidade)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS purchase_order_items (
            id INTEGER PRIMARY KEY,
            purchase_order_id INTEGER NOT NULL,
            order_id INTEGER NOT NULL,
            sales_order_item_id INTEGER,
            sku_marketplace TEXT,
            sku_fornecedor TEXT,
            quantidade DOUBLE NOT NULL DEFAULT 1,
            custo_unitario DOUBLE NOT NULL DEFAULT 0,
            portes_rateados DOUBLE DEFAULT 0,
            impostos_rateados DOUBLE DEFAULT 0
        )
    """)

    # Migração: campos fiscais em purchase_orders e sales_order_item_id em purchase_order_items
    try:
        r = conn.execute("DESCRIBE purchase_orders").fetchall()
        cols_po = [c[0] for c in r]
        for col, ctype in [
            ("billing_nif", "TEXT"), ("billing_address", "TEXT"), ("billing_name", "TEXT"), ("supplier_order_id", "TEXT"),
            ("tracking_number", "TEXT"), ("invoice_pdf_url", "TEXT"),
            ("external_po_id", "TEXT"), ("office_id", "INTEGER"), ("order_date", "TIMESTAMP"),
            ("taxas_pagamento", "DOUBLE"), ("valor_base_artigos", "DOUBLE"), ("iva_total", "DOUBLE"), ("custo_portes_fornecedor", "DOUBLE"),
            ("carrier_name", "TEXT"), ("carrier_status", "TEXT"),
        ]:
            if col not in cols_po:
                conn.execute(f"ALTER TABLE purchase_orders ADD COLUMN {col} {ctype}")
    except Exception:
        pass
    try:
        r = conn.execute("DESCRIBE purchase_order_items").fetchall()
        cols_poi = [c[0] for c in r]
        if "sales_order_item_id" not in cols_poi:
            conn.execute("ALTER TABLE purchase_order_items ADD COLUMN sales_order_item_id INTEGER")
        for col, ctype in [("quantidade_recebida", "DOUBLE DEFAULT 0"), ("logistics_status", "TEXT"), ("custo_real_po", "DOUBLE"), ("ean", "TEXT")]:
            if col not in cols_poi:
                conn.execute(f"ALTER TABLE purchase_order_items ADD COLUMN {col} {ctype}")
    except Exception:
        pass

    # Tabela logistics_events (receção e expedição no escritório - Physical Hub)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS logistics_events (
            id INTEGER PRIMARY KEY,
            purchase_order_id INTEGER NOT NULL,
            purchase_order_item_id INTEGER,
            office_id INTEGER NOT NULL,
            event_type TEXT NOT NULL,
            quantity DOUBLE NOT NULL DEFAULT 0,
            serial_number TEXT,
            imei TEXT,
            tracking_number TEXT,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            created_by TEXT
        )
    """)
    try:
        conn.execute("CREATE INDEX IF NOT EXISTS idx_logistics_events_po ON logistics_events(purchase_order_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_logistics_events_office ON logistics_events(office_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_logistics_events_type ON logistics_events(event_type)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_logistics_events_created ON logistics_events(created_at)")
    except Exception:
        pass

    # Vista BI: estado da venda + estado logístico (Shipped direto vs No Escritório)
    try:
        conn.execute("""
            CREATE OR REPLACE VIEW v_sale_state AS
            SELECT
                o.id AS order_id,
                o.empresa_id,
                o.numero_pedido,
                o.sales_order_id,
                o.sales_order_item_id,
                o.sku_oferta,
                o.quantidade,
                o.valor_transferido_loja,
                e.nome AS empresa_nome,
                CASE
                    WHEN poi.id IS NULL THEN 'Vendido'
                    WHEN po.status = 'Draft' THEN 'Em Processamento de Compra'
                    WHEN po.status IN ('Ordered', 'Paid') THEN 'Comprado (PO #' || CAST(po.id AS VARCHAR) || ')'
                    ELSE 'Em Processamento de Compra'
                END AS estado_venda,
                po.id AS purchase_order_id,
                po.status AS po_status,
                po.supplier_order_id,
                po.tipo_envio,
                COALESCE(poi.logistics_status, '') AS logistics_status,
                CASE
                    WHEN poi.id IS NULL THEN NULL
                    WHEN COALESCE(po.tipo_envio, '') = 'Direto' THEN 'Shipped_Direct'
                    WHEN COALESCE(po.tipo_envio, '') = 'Escritorio' AND COALESCE(poi.logistics_status, 'pending_receipt') IN ('pending_receipt', 'received_at_office') THEN 'No_Escritorio'
                    WHEN COALESCE(po.tipo_envio, '') = 'Escritorio' AND poi.logistics_status = 'dispatched_to_customer' THEN 'Expedido_Escritorio'
                    ELSE NULL
                END AS estado_logistico
            FROM orders o
            LEFT JOIN empresas e ON e.id = o.empresa_id
            LEFT JOIN purchase_order_items poi ON poi.order_id = o.id
            LEFT JOIN purchase_orders po ON po.id = poi.purchase_order_id
        """)
    except Exception as e:
        print(f"Aviso ao criar vista v_sale_state: {e}")

    # Módulo Sales: marketplaces_config, sales_orders, sales_order_items
    conn.execute("""
        CREATE TABLE IF NOT EXISTS marketplaces_config (
            id INTEGER PRIMARY KEY,
            empresa_id INTEGER NOT NULL,
            marketplace_id INTEGER,
            name TEXT NOT NULL,
            commission_percent DOUBLE DEFAULT 0,
            fixed_fee_per_order DOUBLE DEFAULT 0,
            ativo BOOLEAN DEFAULT TRUE,
            data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS sales_orders (
            id INTEGER PRIMARY KEY,
            empresa_id INTEGER NOT NULL,
            external_order_id TEXT NOT NULL,
            marketplace_id INTEGER,
            order_date TIMESTAMP,
            import_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            status TEXT NOT NULL DEFAULT 'Pending',
            customer_country TEXT,
            currency TEXT DEFAULT 'EUR',
            total_gross DOUBLE DEFAULT 0,
            total_commission_fixed DOUBLE DEFAULT 0,
            total_commission_percent DOUBLE DEFAULT 0,
            total_net_value DOUBLE DEFAULT 0,
            UNIQUE(empresa_id, marketplace_id, external_order_id)
        )
    """)
    # Migração: dados do cliente para proformas (nome, morada, NIF)
    try:
        r = conn.execute("DESCRIBE sales_orders").fetchall()
        cols_so = [c[0] for c in r]
        for col, ctype in [("customer_name", "TEXT"), ("customer_address", "TEXT"), ("customer_nif", "TEXT")]:
            if col not in cols_so:
                conn.execute(f"ALTER TABLE sales_orders ADD COLUMN {col} {ctype}")
        for col, ctype in [("cancelled_at", "TIMESTAMP"), ("cancelled_reason", "TEXT")]:
            if col not in cols_so:
                conn.execute(f"ALTER TABLE sales_orders ADD COLUMN {col} {ctype}")
        for col, ctype in [
            ("shipping_status", "TEXT"), ("carrier_name", "TEXT"), ("tracking_number", "TEXT"),
            ("carrier_status", "TEXT"), ("shipped_at", "TIMESTAMP"),
        ]:
            if col not in cols_so:
                conn.execute(f"ALTER TABLE sales_orders ADD COLUMN {col} {ctype}")
    except Exception:
        pass

    conn.execute("""
        CREATE TABLE IF NOT EXISTS sales_order_items (
            id INTEGER PRIMARY KEY,
            sales_order_id INTEGER NOT NULL,
            sku_marketplace TEXT,
            internal_sku TEXT,
            quantity DOUBLE NOT NULL DEFAULT 1,
            unit_price DOUBLE DEFAULT 0,
            vat_rate DOUBLE DEFAULT 0
        )
    """)
    # Migração OSS: vat_type (national|destination), vat_amount para relatórios fiscais
    try:
        r = conn.execute("DESCRIBE sales_order_items").fetchall()
        cols_soi = [c[0] for c in r]
        for col, ctype in [("vat_type", "TEXT"), ("vat_amount", "DOUBLE DEFAULT 0")]:
            if col not in cols_soi:
                conn.execute(f"ALTER TABLE sales_order_items ADD COLUMN {col} {ctype}")
    except Exception:
        pass

    # Ligação orders <-> sales: permite rentabilidade e trigger de compras
    try:
        r = conn.execute("DESCRIBE orders").fetchall()
        cols = [c[0] for c in r]
        if "sales_order_id" not in cols:
            conn.execute("ALTER TABLE orders ADD COLUMN sales_order_id INTEGER")
        if "sales_order_item_id" not in cols:
            conn.execute("ALTER TABLE orders ADD COLUMN sales_order_item_id INTEGER")
    except Exception:
        pass

    # Vista: Rentabilidade Triangular (Venda vs Compra)
    try:
        conn.execute("""
            CREATE OR REPLACE VIEW v_rentabilidade_triangular AS
            SELECT
                o.id AS order_id,
                o.numero_pedido,
                o.empresa_id,
                o.marketplace_id,
                o.sku_oferta AS sku_marketplace,
                o.quantidade AS qty_venda,
                COALESCE(o.valor_total_sem_impostos, 0) AS vendas_sem_iva,
                COALESCE(o.comissao_sem_impostos, 0) AS comissao,
                COALESCE(o.valor_transferido_loja, 0) AS valor_liquido_venda,
                poi.purchase_order_id,
                po.status AS po_status,
                po.tipo_envio,
                s.nome AS fornecedor_nome,
                COALESCE(poi.custo_real_po, poi.custo_unitario) AS custo_checkout,
                poi.custo_unitario,
                poi.quantidade AS qty_compra,
                (COALESCE(poi.custo_real_po, poi.custo_unitario) * poi.quantidade) AS custo_total_linha,
                poi.portes_rateados,
                poi.impostos_rateados,
                (COALESCE(poi.custo_real_po, poi.custo_unitario) * poi.quantidade + COALESCE(poi.portes_rateados, 0) + COALESCE(poi.impostos_rateados, 0)) AS custo_real_compra,
                (COALESCE(o.valor_total_sem_impostos, 0) - COALESCE(o.comissao_sem_impostos, 0)
                 - (COALESCE(poi.custo_real_po, poi.custo_unitario) * poi.quantidade + COALESCE(poi.portes_rateados, 0) + COALESCE(poi.impostos_rateados, 0))) AS margem_real_linha
            FROM orders o
            LEFT JOIN purchase_order_items poi ON poi.order_id = o.id
            LEFT JOIN purchase_orders po ON po.id = poi.purchase_order_id
            LEFT JOIN suppliers s ON s.id = po.supplier_id
        """)
    except Exception as e:
        print(f"Aviso ao criar vista v_rentabilidade_triangular: {e}")

    # Vista: Rentabilidade Sales (Lucro Real por linha de venda)
    try:
        conn.execute("""
            CREATE OR REPLACE VIEW v_sales_rentabilidade AS
            SELECT
                so.id AS sales_order_id,
                so.external_order_id,
                so.empresa_id,
                so.marketplace_id,
                so.order_date,
                so.status AS sales_status,
                so.total_gross,
                so.total_net_value,
                soi.id AS sales_order_item_id,
                soi.sku_marketplace,
                soi.internal_sku,
                soi.quantity AS qty_venda,
                soi.unit_price,
                (soi.quantity * soi.unit_price) AS linha_gross,
                o.id AS order_id,
                poi.purchase_order_id,
                poi.custo_unitario,
                poi.quantidade AS qty_compra,
                (poi.custo_unitario * poi.quantidade) AS custo_total_linha,
                COALESCE(poi.portes_rateados, 0) AS portes_rateados,
                COALESCE(poi.impostos_rateados, 0) AS impostos_rateados,
                (poi.custo_unitario * poi.quantidade + COALESCE(poi.portes_rateados, 0) + COALESCE(poi.impostos_rateados, 0)) AS custo_real_compra,
                ((soi.quantity * soi.unit_price) - (poi.custo_unitario * poi.quantidade + COALESCE(poi.portes_rateados, 0) + COALESCE(poi.impostos_rateados, 0))) AS lucro_real_unitario
            FROM sales_orders so
            JOIN sales_order_items soi ON soi.sales_order_id = so.id
            LEFT JOIN orders o ON o.sales_order_item_id = soi.id
            LEFT JOIN purchase_order_items poi ON poi.order_id = o.id
        """)
    except Exception as e:
        print(f"Aviso ao criar vista v_sales_rentabilidade: {e}")

    # Vista: Rentabilidade Prevista (venda com custo do sku_mapping; Lucro Previsto por linha)
    try:
        conn.execute("""
            CREATE OR REPLACE VIEW v_rentabilidade_prevista AS
            SELECT
                so.id AS sales_order_id,
                so.empresa_id,
                so.external_order_id,
                so.marketplace_id,
                so.order_date,
                so.total_gross,
                so.total_commission_fixed,
                so.total_commission_percent,
                so.total_net_value,
                soi.id AS sales_order_item_id,
                soi.sku_marketplace,
                soi.internal_sku,
                soi.quantity AS qty,
                soi.unit_price,
                (soi.quantity * soi.unit_price) AS linha_gross,
                m.supplier_id,
                m.custo_fornecedor AS cost_price_base,
                m.vat_rate,
                (soi.quantity * COALESCE(m.custo_fornecedor, 0)) AS custo_previsto_linha,
                ((soi.quantity * soi.unit_price)
                 - (soi.quantity * soi.unit_price) * (COALESCE(so.total_commission_fixed, 0) + COALESCE(so.total_commission_percent, 0)) / NULLIF(so.total_gross, 0)
                 - (soi.quantity * COALESCE(m.custo_fornecedor, 0))) AS lucro_previsto_linha,
                CASE WHEN m.id IS NULL THEN 1 ELSE 0 END AS mapping_em_falta
            FROM sales_orders so
            JOIN sales_order_items soi ON soi.sales_order_id = so.id
            LEFT JOIN sku_mapping m ON m.empresa_id = so.empresa_id AND m.sku_marketplace = soi.sku_marketplace AND COALESCE(m.ativo, TRUE) = TRUE
        """)
    except Exception as e:
        print(f"Aviso ao criar vista v_rentabilidade_prevista: {e}")

    # Tabela de empresas
    conn.execute("""
        CREATE TABLE IF NOT EXISTS empresas (
            id INTEGER PRIMARY KEY,
            nome TEXT NOT NULL UNIQUE,
            codigo TEXT UNIQUE,
            nif TEXT,
            morada TEXT,
            pais TEXT,
            email TEXT,
            telefone TEXT,
            data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            ativo BOOLEAN DEFAULT TRUE
        )
    """)
    try:
        r = conn.execute("DESCRIBE empresas").fetchall()
        cols_e = [c[0] for c in r]
        if "pais" not in cols_e:
            conn.execute("ALTER TABLE empresas ADD COLUMN pais TEXT")
        for col, ctype in [
            ("designacao_social", "TEXT"),
            ("morada_fiscal", "TEXT"),
            ("email_financeiro", "TEXT"),
            ("logotipo_url", "TEXT"),
            ("iban", "TEXT"),
            ("moeda_base", "TEXT"),
        ]:
            if col not in cols_e:
                try:
                    conn.execute(f"ALTER TABLE empresas ADD COLUMN {col} {ctype}")
                except Exception:
                    pass
    except Exception:
        pass

    # Tabela de marketplaces (Ficha de Canal - Channel Master Data)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS marketplaces (
            id INTEGER PRIMARY KEY,
            empresa_id INTEGER NOT NULL,
            nome TEXT NOT NULL,
            codigo TEXT,
            descricao TEXT,
            pais_operacao TEXT,
            comissao_percentual DOUBLE DEFAULT 0,
            taxa_fixa DOUBLE DEFAULT 0,
            taxa_gestao_mensal DOUBLE DEFAULT 0,
            ciclo_pagamento TEXT,
            moeda TEXT DEFAULT 'EUR',
            api_type TEXT,
            ativo BOOLEAN DEFAULT TRUE,
            data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(empresa_id, nome)
        )
    """)
    # Migração: adicionar colunas novas a marketplaces se não existirem
    try:
        r = conn.execute("DESCRIBE marketplaces").fetchall()
        cols_m = [c[0] for c in r]
        for col, ctype in [
            ("entidade", "INTEGER"), ("pais_operacao", "TEXT"), ("comissao_percentual", "DOUBLE"), ("comissao_fixa", "DOUBLE"),
            ("taxa_fixa", "DOUBLE"), ("taxa_gestao_mensal", "DOUBLE"), ("iva_regime", "TEXT"),
            ("ciclo_pagamento", "TEXT"), ("moeda", "TEXT"), ("api_type", "TEXT"),
        ]:
            if col not in cols_m:
                conn.execute(f"ALTER TABLE marketplaces ADD COLUMN {col} {ctype}")
    except Exception:
        pass

    # Tabela office_locations (Escritórios - Lisboa, Huelva, Frankfurt, Paris)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS office_locations (
            id INTEGER PRIMARY KEY,
            empresa_id INTEGER,
            designacao TEXT NOT NULL,
            morada TEXT,
            codigo_postal TEXT,
            localidade TEXT,
            pais TEXT NOT NULL,
            contacto_nome TEXT,
            contacto_tel TEXT,
            ativo BOOLEAN DEFAULT TRUE,
            data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    try:
        r = conn.execute("DESCRIBE office_locations").fetchall()
        cols_off = [c[0] for c in r]
        for col, ctype in [("contacto_nome", "TEXT"), ("contacto_tel", "TEXT")]:
            if col not in cols_off:
                try:
                    conn.execute(f"ALTER TABLE office_locations ADD COLUMN {col} {ctype}")
                except Exception:
                    pass
    except Exception:
        pass

    # Tabela payment_methods (Meios de pagamento por empresa: Cartão, Banco, PayPal)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS payment_methods (
            id INTEGER PRIMARY KEY,
            empresa_id INTEGER NOT NULL,
            metodo_tipo TEXT NOT NULL,
            designacao TEXT NOT NULL,
            referencia_last_4 TEXT,
            ativo BOOLEAN DEFAULT TRUE,
            data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    try:
        conn.execute("CREATE INDEX IF NOT EXISTS idx_payment_methods_empresa ON payment_methods(empresa_id)")
    except Exception:
        pass

    # Tabela company_cards (Cartões da empresa - referência segura)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS company_cards (
            id INTEGER PRIMARY KEY,
            empresa_id INTEGER NOT NULL,
            alias TEXT,
            ultimos_4_digitos TEXT,
            ativo BOOLEAN DEFAULT TRUE,
            data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    # Tabela supplier_access (credenciais para API / RPA / sincronização automática)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS supplier_access (
            id INTEGER PRIMARY KEY,
            supplier_id INTEGER NOT NULL,
            url_site TEXT,
            login_user TEXT,
            password_encrypted TEXT,
            api_key TEXT,
            last_sync TIMESTAMP,
            data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            auto_sync_prices BOOLEAN DEFAULT FALSE,
            auto_sync_trackings BOOLEAN DEFAULT FALSE,
            auto_sync_invoices BOOLEAN DEFAULT FALSE,
            UNIQUE(supplier_id)
        )
    """)
    # Migração: colunas de automação em supplier_access
    try:
        r = conn.execute("DESCRIBE supplier_access").fetchall()
        cols = [c[0] for c in r]
        for col, ctype in [("auto_sync_prices", "BOOLEAN"), ("auto_sync_trackings", "BOOLEAN"), ("auto_sync_invoices", "BOOLEAN")]:
            if col not in cols:
                conn.execute(f"ALTER TABLE supplier_access ADD COLUMN {col} {ctype} DEFAULT FALSE")
    except Exception:
        pass

    # Tabela sync_history (histórico Midnight Sync — Fase 4: Prices, Tracking, Invoices)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS sync_history (
            id INTEGER PRIMARY KEY,
            supplier_id INTEGER NOT NULL,
            empresa_id INTEGER,
            sync_type TEXT NOT NULL,
            started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            finished_at TIMESTAMP,
            status TEXT NOT NULL DEFAULT 'running',
            message TEXT,
            records_updated INTEGER,
            duration_seconds DOUBLE
        )
    """)
    try:
        r = conn.execute("DESCRIBE sync_history").fetchall()
        cols = [c[0] for c in r]
        if "empresa_id" not in cols:
            conn.execute("ALTER TABLE sync_history ADD COLUMN empresa_id INTEGER")
        if "duration_seconds" not in cols:
            conn.execute("ALTER TABLE sync_history ADD COLUMN duration_seconds DOUBLE")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_sync_history_supplier ON sync_history(supplier_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_sync_history_started ON sync_history(started_at)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_sync_history_empresa ON sync_history(empresa_id)")
    except Exception:
        pass
    
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
    
    # Criar índices para melhorar performance
    try:
        # Índices para transactions
        conn.execute("CREATE INDEX IF NOT EXISTS idx_transactions_ciclo ON transactions(\"Ciclo Pagamento\")")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_transactions_tipo ON transactions(Tipo)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_transactions_pedido ON transactions(\"Nº Pedido\")")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_transactions_data_ciclo ON transactions(\"Data do ciclo de faturamento\")")
        
        # Índices para orders
        conn.execute("CREATE INDEX IF NOT EXISTS idx_orders_ciclo ON orders(ciclo_pagamento)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_orders_empresa ON orders(empresa_id, marketplace_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_orders_pedido ON orders(numero_pedido)")
        
        # Índices para invoices
        conn.execute("CREATE INDEX IF NOT EXISTS idx_invoices_ciclo ON invoices(ciclo_pagamento)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_invoices_empresa ON invoices(empresa_id, marketplace_id)")
        
        # Índices para bank_movements
        conn.execute("CREATE INDEX IF NOT EXISTS idx_bank_movements_ciclo ON bank_movements(ciclo)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_bank_movements_data ON bank_movements(data_movimento)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_bank_movements_empresa ON bank_movements(empresa_id, marketplace_id)")
        
        # Índices para marketplaces
        conn.execute("CREATE INDEX IF NOT EXISTS idx_marketplaces_empresa ON marketplaces(empresa_id)")
        # Índices para sku_mapping e orders (módulo Sales)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_sku_mapping_empresa ON sku_mapping(empresa_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_sku_mapping_sku_mkt ON sku_mapping(sku_marketplace)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_orders_data_criacao ON orders(data_criacao)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_orders_status_operacional ON orders(status_operacional)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_suppliers_empresa ON suppliers(empresa_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_office_locations_empresa ON office_locations(empresa_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_office_locations_pais ON office_locations(pais)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_company_cards_empresa ON company_cards(empresa_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_supplier_access_supplier ON supplier_access(supplier_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_purchase_orders_empresa ON purchase_orders(empresa_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_po_items_po ON purchase_order_items(purchase_order_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_po_items_order ON purchase_order_items(order_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_sales_orders_empresa ON sales_orders(empresa_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_sales_orders_marketplace ON sales_orders(marketplace_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_sales_orders_order_date ON sales_orders(order_date)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_sales_orders_status ON sales_orders(status)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_sales_order_items_sales_order ON sales_order_items(sales_order_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_marketplaces_config_empresa ON marketplaces_config(empresa_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_pending_purchase_items_empresa ON pending_purchase_items(empresa_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_pending_purchase_items_sales ON pending_purchase_items(sales_order_id)")
    except Exception as e:
        # DuckDB pode não suportar todos os tipos de índices, ignorar erros
        print(f"Aviso ao criar índices: {e}")
        pass
    
    # FK: suppliers.empresa_id -> empresas.id (integridade referencial)
    try:
        conn.execute("ALTER TABLE suppliers ADD CONSTRAINT fk_suppliers_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id)")
    except Exception:
        pass  # Constraint já existe ou DuckDB sem suporte; relação é lógica

    # ── FASE 5: Ciclo Financeiro e Reconciliação ──────────────────────────────
    # supplier_ledger: conta corrente fornecedor
    conn.execute("""
        CREATE TABLE IF NOT EXISTS supplier_ledger (
            id INTEGER PRIMARY KEY,
            empresa_id INTEGER NOT NULL,
            supplier_id INTEGER NOT NULL,
            data_movimento DATE NOT NULL,
            tipo TEXT NOT NULL,
            documento_ref TEXT,
            purchase_order_id INTEGER,
            valor_credito DOUBLE DEFAULT 0,
            valor_debito DOUBLE DEFAULT 0,
            saldo_acumulado DOUBLE DEFAULT 0,
            notas TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # financial_reconciliation: triple-match PO <-> Fatura <-> Banco
    conn.execute("""
        CREATE TABLE IF NOT EXISTS financial_reconciliation (
            id INTEGER PRIMARY KEY,
            empresa_id INTEGER,
            purchase_order_id INTEGER,
            invoice_ref TEXT,
            invoice_amount DOUBLE,
            po_amount DOUBLE,
            bank_movement_id INTEGER,
            bank_amount DOUBLE,
            status TEXT NOT NULL DEFAULT 'Pending',
            discrepancy_amount DOUBLE DEFAULT 0,
            discrepancy_notes TEXT,
            matched_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # supplier_invoices: registo de faturas de fornecedores (pode cobrir múltiplas POs)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS supplier_invoices (
            id             INTEGER PRIMARY KEY,
            empresa_id     INTEGER NOT NULL,
            supplier_id    INTEGER NOT NULL,
            invoice_ref    VARCHAR NOT NULL,
            invoice_date   DATE,
            invoice_amount DOUBLE NOT NULL,
            status         VARCHAR DEFAULT 'pending',
            notas          VARCHAR,
            data_criacao   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    # supplier_invoice_pos: junção fatura <-> PO (N:M — uma fatura pode cobrir várias POs)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS supplier_invoice_pos (
            id                INTEGER PRIMARY KEY,
            invoice_id        INTEGER NOT NULL,
            purchase_order_id INTEGER NOT NULL
        )
    """)

    # v_extrato_fornecedor: vista contabilística com tipo_doc (FT/NC/ND/RE), D/C e saldo corrente
    try:
        conn.execute("""
            CREATE OR REPLACE VIEW v_extrato_fornecedor AS
            SELECT
                sl.id,
                sl.empresa_id,
                sl.supplier_id,
                sl.data_movimento,
                sl.tipo,
                CASE sl.tipo
                    WHEN 'Fatura'          THEN 'FT'
                    WHEN 'NE'             THEN 'NE'
                    WHEN 'Proforma'       THEN 'PF'
                    WHEN 'Nota de Crédito' THEN 'NC'
                    WHEN 'Nota de Débito'  THEN 'ND'
                    WHEN 'Pagamento'       THEN 'RE'
                    ELSE                        'AJ'
                END AS tipo_doc,
                CASE sl.tipo
                    WHEN 'Fatura'          THEN 'C'
                    WHEN 'NE'             THEN 'C'
                    WHEN 'Proforma'       THEN 'C'
                    WHEN 'Nota de Débito'  THEN 'C'
                    WHEN 'Nota de Crédito' THEN 'D'
                    WHEN 'Pagamento'       THEN 'D'
                    ELSE CASE WHEN sl.valor_credito > 0 THEN 'C' ELSE 'D' END
                END AS dc,
                sl.documento_ref  AS num_doc,
                sl.notas          AS descricao,
                sl.valor_credito,
                sl.valor_debito,
                sl.purchase_order_id,
                SUM(sl.valor_credito - sl.valor_debito) OVER (
                    PARTITION BY sl.empresa_id, sl.supplier_id
                    ORDER BY sl.data_movimento, sl.id
                ) AS saldo_corrente,
                s.nome  AS supplier_nome,
                e.nome  AS empresa_nome
            FROM supplier_ledger sl
            LEFT JOIN suppliers  s ON s.id = sl.supplier_id
            LEFT JOIN empresas   e ON e.id = sl.empresa_id
        """)
    except Exception:
        pass

    # Migrações Fase 5: purchase_orders + pending_purchase_items
    try:
        r = conn.execute("DESCRIBE purchase_orders").fetchall()
        cols_po5 = [c[0] for c in r]
        for col, ctype in [
            ("due_date", "DATE"),
            ("invoice_ref", "TEXT"),
            ("invoice_amount", "DOUBLE"),
        ]:
            if col not in cols_po5:
                conn.execute(f"ALTER TABLE purchase_orders ADD COLUMN {col} {ctype}")
    except Exception:
        pass

    try:
        r = conn.execute("DESCRIBE pending_purchase_items").fetchall()
        cols_ppi = [c[0] for c in r]
        for col, ctype in [
            ("margin_alert", "BOOLEAN"),
            ("margin_alert_msg", "TEXT"),
        ]:
            if col not in cols_ppi:
                conn.execute(f"ALTER TABLE pending_purchase_items ADD COLUMN {col} {ctype}")
    except Exception:
        pass

    try:
        conn.execute("CREATE INDEX IF NOT EXISTS idx_supplier_ledger_empresa ON supplier_ledger(empresa_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_supplier_ledger_supplier ON supplier_ledger(supplier_id, empresa_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_supplier_ledger_data ON supplier_ledger(data_movimento)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_fin_recon_po ON financial_reconciliation(purchase_order_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_fin_recon_empresa ON financial_reconciliation(empresa_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_fin_recon_status ON financial_reconciliation(status)")
    except Exception:
        pass

    # ── v3.0: RMA (Devoluções) e Cash-Flow Forecast ───────────────────────────
    conn.execute("""
        CREATE TABLE IF NOT EXISTS rma_claims (
            id INTEGER PRIMARY KEY,
            empresa_id INTEGER NOT NULL,
            sales_order_id INTEGER,
            sales_order_item_id INTEGER,
            supplier_id INTEGER,
            status TEXT NOT NULL DEFAULT 'Pending',
            refund_customer_value DOUBLE DEFAULT 0,
            credit_note_supplier_value DOUBLE DEFAULT 0,
            reason TEXT,
            ledger_credit_note_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            external_order_id TEXT
        )
    """)
    try:
        r = conn.execute("DESCRIBE rma_claims").fetchall()
        cols_rma = [c[0] for c in r]
        for col, ctype in [
            ("disposition", "TEXT"),
            ("supplier_accepts_return", "INTEGER DEFAULT 1"),
            ("workflow_phase", "TEXT DEFAULT 'intervencao_compras'"),
            ("purchase_order_id", "INTEGER"),
            ("payment_was_made", "INTEGER DEFAULT 0"),
            ("payment_blocked_at", "TIMESTAMP"),
            ("credit_note_numero", "TEXT"),
            ("credit_note_tipo", "TEXT"),
            ("resolved_at", "TIMESTAMP"),
        ]:
            if col not in cols_rma:
                conn.execute(f"ALTER TABLE rma_claims ADD COLUMN {col} {ctype}")
    except Exception:
        pass
    try:
        conn.execute("CREATE INDEX IF NOT EXISTS idx_rma_sales ON rma_claims(sales_order_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_rma_supplier ON rma_claims(supplier_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_rma_status ON rma_claims(status)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_rma_created ON rma_claims(created_at)")
    except Exception:
        pass

    # ── Stock em escritório (origem: cancelamento cliente, fornecedor não aceita devolução) ─
    conn.execute("""
        CREATE TABLE IF NOT EXISTS office_stock (
            id INTEGER PRIMARY KEY,
            empresa_id INTEGER NOT NULL,
            office_id INTEGER,
            sku_marketplace TEXT NOT NULL,
            sku_fornecedor TEXT,
            quantity DOUBLE NOT NULL DEFAULT 1,
            source_type TEXT NOT NULL DEFAULT 'cancelled_order',
            source_sales_order_id INTEGER,
            source_sales_order_item_id INTEGER,
            source_purchase_order_id INTEGER,
            source_purchase_order_item_id INTEGER,
            status TEXT NOT NULL DEFAULT 'available',
            condition TEXT NOT NULL DEFAULT 'new',
            received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            rma_claim_id INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            consumed_by_sales_order_id INTEGER,
            consumed_by_sales_order_item_id INTEGER,
            consumed_at TIMESTAMP
        )
    """)
    try:
        conn.execute("CREATE INDEX IF NOT EXISTS idx_office_stock_empresa ON office_stock(empresa_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_office_stock_sku ON office_stock(sku_marketplace)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_office_stock_status ON office_stock(status)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_office_stock_source_sales ON office_stock(source_sales_order_id)")
    except Exception:
        pass

    try:
        conn.execute("""
            CREATE OR REPLACE VIEW v_cash_flow_forecast AS
            SELECT
                'Marketplace_Receivable' AS tipo,
                CAST(so.order_date AS DATE) + INTERVAL '14 days' AS data_previsa,
                COALESCE(so.total_net_value, 0) AS valor,
                so.empresa_id,
                so.id AS source_id,
                so.external_order_id
            FROM sales_orders so
            WHERE so.status IN ('Shipped', 'Paid', 'Purchased')
            AND so.order_date IS NOT NULL
            UNION ALL
            SELECT
                'Supplier_Payable' AS tipo,
                COALESCE(CAST(po.due_date AS DATE), CAST(po.data_ordered AS DATE) + INTERVAL '7 days') AS data_previsa,
                -COALESCE(po.total_final, 0) AS valor,
                po.empresa_id,
                po.id AS source_id,
                po.supplier_order_id AS external_order_id
            FROM purchase_orders po
            WHERE po.status IN ('Ordered', 'Draft')
            AND (po.data_ordered IS NOT NULL OR po.due_date IS NOT NULL)
        """)
    except Exception as e:
        print(f"Aviso ao criar v_cash_flow_forecast: {e}")

    # Seed: 4 escritórios (Lisboa, Huelva, Frankfurt, Paris) se a tabela estiver vazia
    try:
        n = conn.execute("SELECT COUNT(*) FROM office_locations").fetchone()[0]
        if n == 0:
            conn.execute("""
                INSERT INTO office_locations (id, empresa_id, designacao, morada, codigo_postal, localidade, pais, contacto_nome, contacto_tel, ativo)
                VALUES
                (1, NULL, 'Lisboa', NULL, NULL, 'Lisboa', 'PT', NULL, NULL, TRUE),
                (2, NULL, 'Huelva', NULL, NULL, 'Huelva', 'ES', NULL, NULL, TRUE),
                (3, NULL, 'Frankfurt', NULL, NULL, 'Frankfurt', 'DE', NULL, NULL, TRUE),
                (4, NULL, 'Paris', NULL, NULL, 'Paris', 'FR', NULL, NULL, TRUE)
            """)
            print("Seed: 4 escritórios (Lisboa, Huelva, Frankfurt, Paris) inseridos.")
    except Exception as e:
        print(f"Aviso ao seed office_locations: {e}")

    # ── Tabela de IVA OSS (tax_oss_matrix) ───────────────────────────────────
    conn.execute("""
        CREATE TABLE IF NOT EXISTS tax_oss_matrix (
            id INTEGER PRIMARY KEY,
            country_code VARCHAR(3) NOT NULL UNIQUE,
            country_name VARCHAR(100) NOT NULL,
            standard_rate     DOUBLE NOT NULL DEFAULT 0,
            reduced_rate      DOUBLE NOT NULL DEFAULT 0,
            reduced_rate_2    DOUBLE,
            super_reduced_rate DOUBLE,
            is_eu BOOLEAN NOT NULL DEFAULT TRUE,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    # Migração: adicionar colunas novas se a tabela já existia sem elas
    for _col, _def in [("reduced_rate_2", "DOUBLE"), ("super_reduced_rate", "DOUBLE")]:
        try:
            conn.execute(f"ALTER TABLE tax_oss_matrix ADD COLUMN {_col} {_def}")
        except Exception:
            pass  # Coluna já existe
    try:
        n_tax = conn.execute("SELECT COUNT(*) FROM tax_oss_matrix").fetchone()[0]
        if n_tax == 0:
            conn.execute("""
                INSERT INTO tax_oss_matrix
                  (id, country_code, country_name, standard_rate, reduced_rate, reduced_rate_2, super_reduced_rate, is_eu) VALUES
                -- ── UE 27 ─────────────────────────────────────────────────────────────────
                (1,  'AT', 'Áustria',          20.0,  10.0,  13.0,  NULL, TRUE),
                (2,  'BE', 'Bélgica',          21.0,   6.0,  12.0,  NULL, TRUE),
                (3,  'BG', 'Bulgária',         20.0,   9.0,  NULL,  NULL, TRUE),
                (4,  'CY', 'Chipre',           19.0,   5.0,   9.0,  NULL, TRUE),
                (5,  'CZ', 'República Checa',  21.0,  12.0,  NULL,  NULL, TRUE),
                (6,  'DE', 'Alemanha',         19.0,   7.0,  NULL,  NULL, TRUE),
                (7,  'DK', 'Dinamarca',        25.0,    0.0,  NULL,  NULL, TRUE),
                (8,  'EE', 'Estónia',          24.0,   9.0,  13.0,  NULL, TRUE),
                (9,  'ES', 'Espanha',          21.0,  10.0,  NULL,   4.0, TRUE),
                (10, 'FI', 'Finlândia',        25.5,  10.0,  13.5,  NULL, TRUE),
                (11, 'FR', 'França',           20.0,   5.5,  10.0,   2.1, TRUE),
                (12, 'GR', 'Grécia',           24.0,   6.0,  13.0,  NULL, TRUE),
                (13, 'HR', 'Croácia',          25.0,   5.0,  13.0,  NULL, TRUE),
                (14, 'HU', 'Hungria',          27.0,   5.0,  18.0,  NULL, TRUE),
                (15, 'IE', 'Irlanda',          23.0,   9.0,  13.5,   4.8, TRUE),
                (16, 'IT', 'Itália',           22.0,   5.0,  10.0,   4.0, TRUE),
                (17, 'LT', 'Lituânia',         21.0,   5.0,   9.0,  NULL, TRUE),
                (18, 'LU', 'Luxemburgo',       17.0,   8.0,  NULL,   3.0, TRUE),
                (19, 'LV', 'Letónia',          21.0,   5.0,  12.0,  NULL, TRUE),
                (20, 'MT', 'Malta',            18.0,   5.0,   7.0,  NULL, TRUE),
                (21, 'NL', 'Países Baixos',    21.0,   9.0,  NULL,  NULL, TRUE),
                (22, 'PL', 'Polónia',          23.0,   5.0,   8.0,  NULL, TRUE),
                (23, 'PT', 'Portugal',         23.0,   6.0,  13.0,  NULL, TRUE),
                (24, 'RO', 'Roménia',          21.0,  11.0,  NULL,  NULL, TRUE),
                (25, 'SE', 'Suécia',           25.0,   6.0,  12.0,  NULL, TRUE),
                (26, 'SI', 'Eslovénia',        22.0,   5.0,   9.5,  NULL, TRUE),
                (27, 'SK', 'Eslováquia',       23.0,   5.0,  19.0,  NULL, TRUE),
                -- ── Fora UE (importantes para o negócio) ──────────────────────────────────
                (28, 'GB', 'Reino Unido',      20.0,   5.0,  NULL,  NULL, FALSE),
                (29, 'NO', 'Noruega',          25.0,  12.0,  15.0,  NULL, FALSE),
                (30, 'CH', 'Suíça',             8.1,   3.8,   2.6,  NULL, FALSE),
                (31, 'US', 'Estados Unidos',    0.0,    0.0,  NULL,  NULL, FALSE)
            """)
            print("Seed: 31 países (tax_oss_matrix 2025) inseridos.")
        else:
            # Atualizar países com alterações de taxa em 2024/2025
            updates = [
                # (standard, reduced_1, reduced_2, super_reduced, code)
                (24.0,  9.0,  13.0, None, 'EE'),  # Estónia: 22%→24% (Jul 2025)
                (21.0, 11.0,  None, None, 'RO'),  # Roménia: 19%→21% (Ago 2025)
                (23.0,  5.0,  19.0, None, 'SK'),  # Eslováquia: 20%→23% (Jan 2025)
                (25.5, 10.0,  13.5, None, 'FI'),  # Finlândia: 24%→25.5% (Set 2024)
                (25.0,  5.0,  13.0, None, 'HR'),  # Croácia: reduced 13%→5%
                (24.0,  6.0,  13.0, None, 'GR'),  # Grécia: reduced 13%→6%
                (22.0,  5.0,  10.0,  4.0, 'IT'),  # Itália: reduced 10%→5%
                (21.0,  5.0,  12.0, None, 'LV'),  # Letónia: reduced 12%→5%
                (21.0,  5.0,   9.0, None, 'LT'),  # Lituânia: reduced 9%→5%
                (18.0,  5.0,   7.0, None, 'MT'),  # Malta: reduced 7%→5%
                (23.0,  5.0,   8.0, None, 'PL'),  # Polónia: reduced 8%→5%
                (25.0,  6.0,  12.0, None, 'SE'),  # Suécia: reduced 12%→6%
                (22.0,  5.0,   9.5, None, 'SI'),  # Eslovénia: 9.5%→5%
                (20.0, 10.0,  13.0, None, 'AT'),  # Áustria: add 2nd reduced 13%
                (21.0,  6.0,  12.0, None, 'BE'),  # Bélgica: add 2nd reduced 12%
                (19.0,  5.0,   9.0, None, 'CY'),  # Chipre: add 2nd reduced 9%
                (21.0, 10.0,  None,  4.0, 'ES'),  # Espanha: super-reduced 4%
                (25.5, 10.0,  13.5, None, 'FI'),  # Finlândia: corrigir reduced
                (20.0,  5.5,  10.0,  2.1, 'FR'),  # França: add 2nd + super
                (27.0,  5.0,  18.0, None, 'HU'),  # Hungria: add 2nd reduced 18%
                (23.0,  9.0,  13.5,  4.8, 'IE'),  # Irlanda: add 2nd + super
                (17.0,  8.0,  None,  3.0, 'LU'),  # Luxemburgo: super 3%
                (23.0,  6.0,  13.0, None, 'PT'),  # Portugal: add 2nd reduced 13%
                (24.0,  9.0,  13.0, None, 'EE'),  # Estónia: add 2nd reduced 13%
                (25.0, 12.0,  15.0, None, 'NO'),  # Noruega: corrigir reduced
                ( 8.1,  3.8,   2.6, None, 'CH'),  # Suíça: add 2nd reduced
            ]
            for std, r1, r2, sr, code in updates:
                try:
                    conn.execute(
                        """UPDATE tax_oss_matrix
                           SET standard_rate = ?, reduced_rate = ?, reduced_rate_2 = ?, super_reduced_rate = ?, updated_at = CURRENT_TIMESTAMP
                           WHERE country_code = ?""",
                        [std, r1, r2, sr, code],
                    )
                except Exception:
                    pass
            print("Tax matrix: taxas 2025 actualizadas.")
    except Exception as e:
        print(f"Aviso ao seed tax_oss_matrix: {e}")

    # ── Gestão Comercial: documentos de venda (Proformas, Faturas, NC) ───────
    conn.execute("""
        CREATE TABLE IF NOT EXISTS billing_series (
            id INTEGER PRIMARY KEY,
            empresa_id INTEGER NOT NULL,
            doc_type TEXT NOT NULL,
            prefix TEXT NOT NULL,
            year INTEGER NOT NULL,
            last_sequence INTEGER NOT NULL DEFAULT 0,
            UNIQUE(empresa_id, doc_type, year)
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS billing_documents (
            id INTEGER PRIMARY KEY,
            empresa_id INTEGER NOT NULL,
            sales_order_id INTEGER NOT NULL,
            doc_type TEXT NOT NULL,
            document_number TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'issued',
            total_gross DOUBLE DEFAULT 0,
            total_net DOUBLE DEFAULT 0,
            total_vat DOUBLE DEFAULT 0,
            customer_country TEXT,
            issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            cancelled_at TIMESTAMP,
            UNIQUE(empresa_id, document_number)
        )
    """)
    try:
        conn.execute("CREATE INDEX IF NOT EXISTS idx_billing_docs_empresa ON billing_documents(empresa_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_billing_docs_sales_order ON billing_documents(sales_order_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_billing_docs_status ON billing_documents(status)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_billing_docs_issued ON billing_documents(issued_at)")
    except Exception:
        pass

    # ── Tabela Cross-SKU Bridge (master_sku_bridge) ───────────────────────────
    conn.execute("""
        CREATE TABLE IF NOT EXISTS master_sku_bridge (
            id INTEGER PRIMARY KEY,
            empresa_id INTEGER,
            sku_global VARCHAR(100) NOT NULL,
            descricao  VARCHAR(200),
            ean        VARCHAR(30),
            asin       VARCHAR(20),
            ref_fornecedor_1 VARCHAR(100),
            ref_fornecedor_2 VARCHAR(100),
            marketplace VARCHAR(50),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    try:
        conn.execute("CREATE INDEX IF NOT EXISTS idx_sku_bridge_global ON master_sku_bridge(sku_global)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_sku_bridge_ean   ON master_sku_bridge(ean)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_sku_bridge_asin  ON master_sku_bridge(asin)")
    except Exception:
        pass

    # ── Migrações Fase 6: NE + Invoice Validation + SMTP Settings ────────────

    # purchase_orders: supplier_order_id + invoice_pdf_url (os outros já existem)
    try:
        r = conn.execute("DESCRIBE purchase_orders").fetchall()
        cols_po6 = [c[0] for c in r]
        for col, ctype in [
            ("supplier_order_id", "TEXT"),
            ("invoice_pdf_url",   "TEXT"),
            ("payment_blocked",  "INTEGER DEFAULT 0"),
        ]:
            if col not in cols_po6:
                conn.execute(f"ALTER TABLE purchase_orders ADD COLUMN {col} {ctype}")
    except Exception:
        pass

    # supplier_invoices: ampliar com campos de validação
    try:
        r = conn.execute("DESCRIBE supplier_invoices").fetchall()
        cols_si = [c[0] for c in r]
        for col, ctype in [
            ("purchase_order_id",  "INTEGER"),
            ("supplier_order_id",  "TEXT"),
            ("valor_fatura",       "DOUBLE"),
            ("valor_po",           "DOUBLE"),
            ("diferenca",          "DOUBLE"),
            ("flag_divergencia",   "BOOLEAN DEFAULT FALSE"),
            ("invoice_pdf_url",    "TEXT"),
            ("source",             "TEXT DEFAULT 'manual'"),
            ("aprovado_por",       "TEXT"),
            ("aprovado_em",        "TIMESTAMP"),
            ("nota_aprovacao",     "TEXT"),
            ("invoice_date",       "DATE"),
            ("data_atualizacao",   "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"),
        ]:
            if col not in cols_si:
                conn.execute(f"ALTER TABLE supplier_invoices ADD COLUMN {col} {ctype}")
        # status precisa suportar novos valores — já existe, não alteramos o tipo
    except Exception:
        pass

    # supplier_invoice_comms: histórico de emails e notas
    conn.execute("""
        CREATE TABLE IF NOT EXISTS supplier_invoice_comms (
            id          INTEGER PRIMARY KEY,
            invoice_id  INTEGER NOT NULL,
            data_envio  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            tipo        TEXT NOT NULL,
            para_email  TEXT,
            assunto     TEXT,
            corpo       TEXT,
            enviado_por TEXT
        )
    """)
    try:
        conn.execute("CREATE INDEX IF NOT EXISTS idx_inv_comms_invoice ON supplier_invoice_comms(invoice_id)")
    except Exception:
        pass

    # system_settings: configurações globais (chave-valor) — ex: SMTP
    conn.execute("""
        CREATE TABLE IF NOT EXISTS system_settings (
            key        TEXT PRIMARY KEY,
            value      TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # ── Migrações Fase 7: InvoiceReviewModal — campos decomposição + NC ─────────

    # supplier_invoices: document_type (Fatura | NE | Proforma) para match PO–Fatura + NE/Proforma/adiantamento
    try:
        r = conn.execute("DESCRIBE supplier_invoices").fetchall()
        cols_si_dt = [c[0] for c in r]
        if "document_type" not in cols_si_dt:
            conn.execute("ALTER TABLE supplier_invoices ADD COLUMN document_type TEXT DEFAULT 'Fatura'")
    except Exception:
        pass

    # supplier_invoices: decomposição valor + vencimento + código divergência
    try:
        r = conn.execute("DESCRIBE supplier_invoices").fetchall()
        cols_si7 = [c[0] for c in r]
        for col, ctype in [
            ("valor_base",       "DOUBLE"),
            ("valor_iva",        "DOUBLE"),
            ("valor_portes",     "DOUBLE"),
            ("data_vencimento",  "DATE"),
            ("divergence_code",  "TEXT"),
        ]:
            if col not in cols_si7:
                conn.execute(f"ALTER TABLE supplier_invoices ADD COLUMN {col} {ctype}")
    except Exception:
        pass

    # supplier_credit_notes: notas de crédito associadas a faturas
    conn.execute("""
        CREATE TABLE IF NOT EXISTS supplier_credit_notes (
            id           INTEGER PRIMARY KEY,
            invoice_id   INTEGER NOT NULL,
            empresa_id   INTEGER,
            supplier_id  INTEGER,
            nc_ref       TEXT NOT NULL,
            nc_date      DATE,
            valor        DOUBLE NOT NULL,
            notas        TEXT,
            aprovada     BOOLEAN DEFAULT FALSE,
            data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    try:
        conn.execute("CREATE INDEX IF NOT EXISTS idx_nc_invoice ON supplier_credit_notes(invoice_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_nc_supplier ON supplier_credit_notes(supplier_id)")
    except Exception:
        pass

    # supplier_invoice_pos: índices (tabela já existe, apenas garante índices)
    try:
        conn.execute("CREATE INDEX IF NOT EXISTS idx_inv_pos_invoice ON supplier_invoice_pos(invoice_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_inv_pos_po ON supplier_invoice_pos(purchase_order_id)")
    except Exception:
        pass

    # ── Gestão de Terceiros (GT): Grupos de Terceiro + Movimentos / Contabilidade ──
    conn.execute("""
        CREATE TABLE IF NOT EXISTS gt_grupos (
            id         INTEGER PRIMARY KEY,
            empresa_id INTEGER,
            codigo     TEXT NOT NULL,
            nome       TEXT NOT NULL,
            ativo      BOOLEAN DEFAULT TRUE,
            data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS gt_movimentos (
            id            INTEGER PRIMARY KEY,
            empresa_id    INTEGER,
            grupo_id      INTEGER,
            data_mov      DATE NOT NULL,
            grupo_terceiro TEXT,
            valor         DOUBLE NOT NULL DEFAULT 0,
            conta_contabilidade TEXT,
            descricao     TEXT,
            data_criacao  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    try:
        conn.execute("CREATE INDEX IF NOT EXISTS idx_gt_mov_empresa ON gt_movimentos(empresa_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_gt_mov_data ON gt_movimentos(data_mov)")
    except Exception:
        pass

    # ── MÓDULO FATURAÇÃO AT-COMPLIANT (Portugal) ─────────────────────────────
    # Migração: billing_documents — campos AT (ATCUD, hash chain, QR, PDF)
    try:
        r = conn.execute("DESCRIBE billing_documents").fetchall()
        cols_bd = [c[0] for c in r]
        for col, ctype in [
            ("atcud",             "TEXT"),
            ("hash_documento",    "TEXT"),
            ("hash_anterior",     "TEXT"),
            ("qrcode_data",       "TEXT"),
            ("pdf_path",          "TEXT"),
            ("num_certificacao",  "TEXT DEFAULT '0/AT'"),
            ("hash_4chars",       "TEXT"),
            ("customer_nif",      "TEXT"),
            ("customer_address",  "TEXT"),
            ("vat_breakdown",     "TEXT"),
            ("payment_terms",     "TEXT"),
            ("reference_doc",     "TEXT"),
            ("notes",             "TEXT"),
            ("customer_name",     "TEXT"),
            ("sales_order_id_nullable", "INTEGER"),
        ]:
            if col not in cols_bd:
                try:
                    conn.execute(f"ALTER TABLE billing_documents ADD COLUMN {col} {ctype}")
                except Exception:
                    pass
        # customer_country já existe na tabela original; garantir
        if "customer_country" not in cols_bd:
            try:
                conn.execute("ALTER TABLE billing_documents ADD COLUMN customer_country TEXT DEFAULT 'PT'")
            except Exception:
                pass
        # Tornar sales_order_id opcional (a tabela original tem NOT NULL — não conseguimos alterar em DuckDB;
        # usamos a nova coluna sales_order_id_nullable para documentos AT independentes de sales_orders)
    except Exception as e:
        print(f"Aviso migrações billing_documents AT: {e}")

    # Migração: billing_series — campos AT (código validação, tipo doc, hash)
    try:
        r = conn.execute("DESCRIBE billing_series").fetchall()
        cols_bs = [c[0] for c in r]
        for col, ctype in [
            ("codigo_validacao_at", "TEXT DEFAULT '0'"),
            ("ano_exercicio",       "INTEGER"),
            ("ultimo_hash",         "TEXT"),
            ("tipo_doc",            "TEXT"),
            ("ativo",               "BOOLEAN DEFAULT true"),
        ]:
            if col not in cols_bs:
                try:
                    conn.execute(f"ALTER TABLE billing_series ADD COLUMN {col} {ctype}")
                except Exception:
                    pass
    except Exception as e:
        print(f"Aviso migrações billing_series AT: {e}")

    # Tabela at_rsa_keys (par RSA 1024-bit por empresa)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS at_rsa_keys (
            id              INTEGER PRIMARY KEY,
            empresa_id      INTEGER NOT NULL UNIQUE,
            private_key_pem TEXT NOT NULL,
            public_key_pem  TEXT NOT NULL,
            created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    try:
        conn.execute("CREATE INDEX IF NOT EXISTS idx_at_rsa_empresa ON at_rsa_keys(empresa_id)")
    except Exception:
        pass

    # Tabela saft_exports (histórico de exportações SAF-T PT)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS saft_exports (
            id              INTEGER PRIMARY KEY,
            empresa_id      INTEGER NOT NULL,
            periodo_inicio  DATE NOT NULL,
            periodo_fim     DATE NOT NULL,
            num_documentos  INTEGER,
            xml_hash        TEXT,
            xml_path        TEXT,
            exported_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    try:
        conn.execute("CREATE INDEX IF NOT EXISTS idx_saft_exports_empresa ON saft_exports(empresa_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_saft_exports_periodo ON saft_exports(periodo_inicio, periodo_fim)")
    except Exception:
        pass

    # Tabela at_invoice_documents (documentos AT independentes — não ligados a sales_orders)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS at_invoice_documents (
            id               INTEGER PRIMARY KEY,
            empresa_id       INTEGER NOT NULL,
            tipo_doc         TEXT NOT NULL,
            serie_id         INTEGER NOT NULL,
            numero_sequencial INTEGER NOT NULL,
            numero_documento  TEXT NOT NULL,
            status           TEXT NOT NULL DEFAULT 'emitido',
            data_emissao     DATE NOT NULL,
            customer_name    TEXT,
            customer_nif     TEXT,
            customer_country TEXT DEFAULT 'PT',
            customer_address TEXT,
            linhas           TEXT NOT NULL,
            vat_breakdown    TEXT,
            total_bruto      DOUBLE NOT NULL DEFAULT 0,
            total_iva        DOUBLE NOT NULL DEFAULT 0,
            total_liquido    DOUBLE NOT NULL DEFAULT 0,
            hash_documento   TEXT,
            hash_anterior    TEXT,
            hash_4chars      TEXT,
            atcud            TEXT,
            qrcode_data      TEXT,
            pdf_path         TEXT,
            num_certificacao TEXT DEFAULT '0/AT',
            payment_terms    TEXT,
            reference_doc    TEXT,
            notes            TEXT,
            motivo_anulacao  TEXT,
            anulado_em       TIMESTAMP,
            created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(empresa_id, numero_documento)
        )
    """)
    try:
        conn.execute("CREATE INDEX IF NOT EXISTS idx_at_docs_empresa ON at_invoice_documents(empresa_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_at_docs_tipo ON at_invoice_documents(tipo_doc)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_at_docs_status ON at_invoice_documents(status)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_at_docs_data ON at_invoice_documents(data_emissao)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_at_docs_serie ON at_invoice_documents(serie_id)")
    except Exception:
        pass

    # Garantir directório para PDFs de faturas AT
    try:
        import os
        pdf_dir = DB_PATH.parent / "invoices"
        pdf_dir.mkdir(parents=True, exist_ok=True)
    except Exception:
        pass

    conn.commit()
    conn.close()
    print(f"Base de dados inicializada: {DB_PATH}")

