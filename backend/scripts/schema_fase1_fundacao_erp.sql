-- =============================================================================
-- FASE 1: Fundação e Dados Mestres — ERP Dropshipping Automático
-- Roadmap v2.0: Tabelas âncora multi-tenant (DuckDB)
-- =============================================================================
-- 1.1 Estrutura de Tabelas
-- 1.2 Associação Multi-tenant: empresa_id em suppliers e marketplaces
-- 1.3 Campo numérico entidade para identificação rápida
-- 1.4 supplier_access com campos para encriptação (senha guardada encriptada no app)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- COMPANY MASTER (empresas = entidades legais do grupo)
-- -----------------------------------------------------------------------------
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
);

-- Vista opcional: alinha nomenclatura do roadmap (company_master = empresas)
-- CREATE VIEW company_master AS SELECT * FROM empresas;


-- -----------------------------------------------------------------------------
-- SUPPLIERS (Ficha de Fornecedor — multi-tenant por empresa_id)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY,
    empresa_id INTEGER NOT NULL,
    entidade INTEGER,
    nome TEXT NOT NULL,
    codigo TEXT,
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
    tipo_envio TEXT,
    office_id INTEGER,
    lead_time_estimado INTEGER,
    custo_envio_base DOUBLE DEFAULT 0,
    supplier_score DOUBLE,
    ativo BOOLEAN DEFAULT TRUE,
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- -----------------------------------------------------------------------------
-- MARKETPLACES (Ficha de Canal — multi-tenant por empresa_id)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS marketplaces (
    id INTEGER PRIMARY KEY,
    empresa_id INTEGER NOT NULL,
    entidade INTEGER,
    nome TEXT NOT NULL,
    codigo TEXT,
    descricao TEXT,
    pais_operacao TEXT,
    comissao_percentual DOUBLE DEFAULT 0,
    comissao_fixa DOUBLE DEFAULT 0,
    taxa_fixa DOUBLE DEFAULT 0,
    taxa_gestao_mensal DOUBLE DEFAULT 0,
    ciclo_pagamento TEXT,
    moeda TEXT DEFAULT 'EUR',
    api_type TEXT,
    iva_regime TEXT,
    ativo BOOLEAN DEFAULT TRUE,
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(empresa_id, nome)
);


-- -----------------------------------------------------------------------------
-- OFFICE_LOCATIONS (Escritórios — Lisboa, Huelva, Frankfurt, Paris)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS office_locations (
    id INTEGER PRIMARY KEY,
    empresa_id INTEGER,
    designacao TEXT NOT NULL,
    morada TEXT,
    codigo_postal TEXT,
    localidade TEXT,
    pais TEXT NOT NULL,
    ativo BOOLEAN DEFAULT TRUE,
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- -----------------------------------------------------------------------------
-- COMPANY_CARDS (Cartões da empresa — referência segura)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS company_cards (
    id INTEGER PRIMARY KEY,
    empresa_id INTEGER NOT NULL,
    alias TEXT,
    ultimos_4_digitos TEXT,
    ativo BOOLEAN DEFAULT TRUE,
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- -----------------------------------------------------------------------------
-- SUPPLIER_ACCESS (Aba Acessos — utilizador/senha encriptados no backend)
-- Encriptação AES-256 (Fernet) via app; aqui só se guarda password_encrypted.
-- -----------------------------------------------------------------------------
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
);


-- Índices multi-tenant e performance
CREATE INDEX IF NOT EXISTS idx_suppliers_empresa ON suppliers(empresa_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_entidade ON suppliers(entidade);
CREATE INDEX IF NOT EXISTS idx_marketplaces_empresa ON marketplaces(empresa_id);
CREATE INDEX IF NOT EXISTS idx_office_locations_empresa ON office_locations(empresa_id);
CREATE INDEX IF NOT EXISTS idx_office_locations_pais ON office_locations(pais);
CREATE INDEX IF NOT EXISTS idx_company_cards_empresa ON company_cards(empresa_id);
CREATE INDEX IF NOT EXISTS idx_supplier_access_supplier ON supplier_access(supplier_id);
