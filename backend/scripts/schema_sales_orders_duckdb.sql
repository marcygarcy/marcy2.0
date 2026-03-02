-- =============================================================================
-- Schema DuckDB: Módulo de Vendas (Sales & Orders) para Dropshipping
-- =============================================================================
-- Este script expande a base de dados para suportar:
-- - Rastreio de vendas por encomenda (Order ID) para margem real
-- - Custos de fornecedor (COGS), portes e outras taxas
-- - Status operacional (Pendente, Enviado, Entregue, Cancelado, Devolvido)
-- - Mapping SKU Marketplace <-> SKU Fornecedor (custo)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tabela sku_mapping: associação SKU Marketplace -> SKU Fornecedor e custo
-- -----------------------------------------------------------------------------
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
);

-- Índices para sku_mapping
CREATE INDEX IF NOT EXISTS idx_sku_mapping_empresa ON sku_mapping(empresa_id);
CREATE INDEX IF NOT EXISTS idx_sku_mapping_sku_mkt ON sku_mapping(sku_marketplace);
CREATE INDEX IF NOT EXISTS idx_sku_mapping_empresa_mkt ON sku_mapping(empresa_id, marketplace_id);

-- -----------------------------------------------------------------------------
-- 2. Colunas adicionais na tabela orders (Dropshipping)
-- Migração: adicionar apenas se não existirem
-- -----------------------------------------------------------------------------

-- Identificação e produto
-- nome_produto: nome do produto (pode vir do ficheiro do marketplace)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS nome_produto TEXT;

-- Financeiro de venda (complementos)
-- valor_bruto, iva_total, taxa_comissao_pct, valor_liquido_venda já cobertos por colunas existentes
-- Garantir que temos: valor_bruto = valor_total_com_iva, iva = total_impostos_pedido + total_impostos_envio
ALTER TABLE orders ADD COLUMN IF NOT EXISTS valor_bruto DOUBLE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS valor_iva DOUBLE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS taxa_comissao_pct DOUBLE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS valor_liquido_venda DOUBLE;

-- Financeiro de custo (Dropshipping)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS custo_fornecedor DOUBLE DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS gastos_envio DOUBLE DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS outras_taxas DOUBLE DEFAULT 0;

-- Margem calculada (pode ser preenchida por trigger ou pela aplicação)
-- Margem Real Unitária = (Preço Venda - IVA) - Comissão - Custo Fornecedor - Portes
ALTER TABLE orders ADD COLUMN IF NOT EXISTS margem_unitaria DOUBLE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS margem_total_linha DOUBLE;

-- Status operacional (Pendente, Enviado, Entregue, Cancelado, Devolvido)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS status_operacional TEXT DEFAULT 'Pendente';

-- Referência para reconciliação futura (Order ID já existe como numero_pedido)
-- Flag para indicar se já foi pago no fluxo financeiro
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pago_reconciliado BOOLEAN DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS data_reconciliacao TIMESTAMP;

-- Data da venda (alias para data_criacao, útil para relatórios)
-- data_venda pode ser igual a data_criacao; já temos data_criacao

-- -----------------------------------------------------------------------------
-- 3. Vista opcional: orders com margem calculada e dados de mapping
-- -----------------------------------------------------------------------------
-- A vista junta orders com sku_mapping para obter custo_fornecedor quando não está na linha
CREATE OR REPLACE VIEW v_orders_margem AS
SELECT
    o.id,
    o.numero_pedido,
    o.data_criacao AS data_venda,
    o.empresa_id,
    o.marketplace_id,
    o.sku_oferta AS sku_marketplace,
    o.nome_produto,
    o.quantidade,
    o.valor_total_com_iva AS valor_bruto,
    COALESCE(o.valor_iva, (COALESCE(o.total_impostos_pedido, 0) + COALESCE(o.total_impostos_envio, 0))) AS iva_total,
    o.comissao_sem_impostos AS comissao,
    o.valor_transferido_loja AS valor_liquido_venda,
    COALESCE(o.custo_fornecedor, m.custo_fornecedor, 0) AS custo_fornecedor,
    COALESCE(o.gastos_envio, 0) AS gastos_envio,
    COALESCE(o.outras_taxas, 0) AS outras_taxas,
    o.status_operacional,
    o.status,
    o.canal_vendas,
    -- Margem Real Unitária: (Venda sem IVA) - Comissão - Custo - Portes
    (
        COALESCE(o.valor_total_sem_impostos, 0) / NULLIF(COALESCE(o.quantidade, 1), 0)
        - COALESCE(o.comissao_sem_impostos, 0) / NULLIF(COALESCE(o.quantidade, 1), 0)
        - COALESCE(o.custo_fornecedor, m.custo_fornecedor, 0)
        - COALESCE(o.gastos_envio, 0) / NULLIF(COALESCE(o.quantidade, 1), 0)
        - COALESCE(o.outras_taxas, 0) / NULLIF(COALESCE(o.quantidade, 1), 0)
    ) AS margem_unitaria_calc,
    (
        COALESCE(o.valor_total_sem_impostos, 0) - COALESCE(o.comissao_sem_impostos, 0)
        - (COALESCE(o.custo_fornecedor, m.custo_fornecedor, 0) * COALESCE(o.quantidade, 1))
        - COALESCE(o.gastos_envio, 0) - COALESCE(o.outras_taxas, 0)
    ) AS margem_total_linha_calc,
    o.pago_reconciliado,
    o.data_upload
FROM orders o
LEFT JOIN sku_mapping m ON m.empresa_id = o.empresa_id
    AND (m.marketplace_id = o.marketplace_id OR (m.marketplace_id IS NULL AND o.marketplace_id IS NULL))
    AND m.sku_marketplace = o.sku_oferta
    AND m.ativo = TRUE;

-- Índices adicionais para performance em filtros de vendas
CREATE INDEX IF NOT EXISTS idx_orders_data_criacao ON orders(data_criacao);
CREATE INDEX IF NOT EXISTS idx_orders_status_operacional ON orders(status_operacional);
CREATE INDEX IF NOT EXISTS idx_orders_empresa_mkt_data ON orders(empresa_id, marketplace_id, data_criacao);
