-- =============================================================================
-- Dados Mestres ERP Dropshipping: Fornecedor, Marketplace, Escritórios, Cartões
-- =============================================================================

-- 1. SUPPLIERS (Ficha de Fornecedor - Supplier Master Data)
-- Campos existentes: id, empresa_id, nome, codigo, pais_iva, taxa_iva_padrao, ativo, data_criacao
-- Novos campos (usar ALTER TABLE em migração):
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS entidade_id INTEGER;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS designacao_social TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS nif_cif TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS website_url TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS morada TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS codigo_postal TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS localidade TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS pais TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS regime_iva TEXT;  -- Nacional, Intracomunitario, Extracomunitario
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS tel TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS email_comercial TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS metodo_pagamento TEXT;  -- Transferencia, Cartao, DebitoDireto
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS iban TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS cartao_id INTEGER;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS prazo_pagamento TEXT;  -- Antecipado, 7 dias, 30 dias
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS default_shipping_type TEXT;  -- Dropshipping, Escritorio
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS lead_time_estimado INTEGER;  -- dias
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS custo_envio_base DOUBLE DEFAULT 0;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS supplier_score DOUBLE;  -- futuro: cumprimento prazos, devoluções

-- 2. MARKETPLACES (Ficha de Canal - Channel Master Data)
ALTER TABLE marketplaces ADD COLUMN IF NOT EXISTS pais_operacao TEXT;  -- PT, ES, FR, DE
ALTER TABLE marketplaces ADD COLUMN IF NOT EXISTS comissao_percentual DOUBLE DEFAULT 0;
ALTER TABLE marketplaces ADD COLUMN IF NOT EXISTS taxa_fixa DOUBLE DEFAULT 0;
ALTER TABLE marketplaces ADD COLUMN IF NOT EXISTS taxa_gestao_mensal DOUBLE DEFAULT 0;
ALTER TABLE marketplaces ADD COLUMN IF NOT EXISTS ciclo_pagamento TEXT;  -- Diario, Semanal, Quinzenal
ALTER TABLE marketplaces ADD COLUMN IF NOT EXISTS moeda TEXT DEFAULT 'EUR';
ALTER TABLE marketplaces ADD COLUMN IF NOT EXISTS api_type TEXT;  -- Mirakl, Amazon_SP, manual_excel

-- 3. OFFICE_LOCATIONS (Escritórios - moradas de consolidação)
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

-- 4. COMPANY_CARDS (Cartões da empresa - referência segura)
CREATE TABLE IF NOT EXISTS company_cards (
    id INTEGER PRIMARY KEY,
    empresa_id INTEGER NOT NULL,
    alias TEXT,
    ultimos_4_digitos TEXT,
    ativo BOOLEAN DEFAULT TRUE,
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_office_locations_empresa ON office_locations(empresa_id);
CREATE INDEX IF NOT EXISTS idx_office_locations_pais ON office_locations(pais);
CREATE INDEX IF NOT EXISTS idx_company_cards_empresa ON company_cards(empresa_id);
