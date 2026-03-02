-- =============================================================================
-- Schema DuckDB: Módulo de Compras (Purchases) - Dropshipping & Consolidação
-- =============================================================================
-- Tabelas: fornecedores, purchase_orders, purchase_order_items
-- Extensão sku_mapping com supplier_id. Vista de rentabilidade triangular.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Fornecedores (multi-tenant)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY,
    empresa_id INTEGER NOT NULL,
    nome TEXT NOT NULL,
    codigo TEXT,
    pais_iva TEXT,
    taxa_iva_padrao DOUBLE DEFAULT 0,
    ativo BOOLEAN DEFAULT TRUE,
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_suppliers_empresa ON suppliers(empresa_id);

-- -----------------------------------------------------------------------------
-- 2. Extensão sku_mapping: coluna supplier_id (se não existir)
-- -----------------------------------------------------------------------------
ALTER TABLE sku_mapping ADD COLUMN IF NOT EXISTS supplier_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_sku_mapping_supplier ON sku_mapping(supplier_id);

-- -----------------------------------------------------------------------------
-- 3. purchase_orders (cabeçalho da compra)
-- -----------------------------------------------------------------------------
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
    notas TEXT
);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_empresa ON purchase_orders(empresa_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);

-- -----------------------------------------------------------------------------
-- 4. purchase_order_items (elo venda <-> compra; 1 item = 1 linha de venda)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS purchase_order_items (
    id INTEGER PRIMARY KEY,
    purchase_order_id INTEGER NOT NULL,
    order_id INTEGER NOT NULL,
    sku_marketplace TEXT,
    sku_fornecedor TEXT,
    quantidade DOUBLE NOT NULL DEFAULT 1,
    custo_unitario DOUBLE NOT NULL DEFAULT 0,
    portes_rateados DOUBLE DEFAULT 0,
    impostos_rateados DOUBLE DEFAULT 0,
    UNIQUE(purchase_order_id, order_id)
);

CREATE INDEX IF NOT EXISTS idx_po_items_po ON purchase_order_items(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_po_items_order ON purchase_order_items(order_id);

-- -----------------------------------------------------------------------------
-- 5. Vista: Rentabilidade Triangular (Venda vs Compra vs Custo)
-- Margem Real = Valor Líquido Venda - Custo Real Compra (rateado se consolidado)
-- -----------------------------------------------------------------------------
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
    poi.custo_unitario,
    poi.quantidade AS qty_compra,
    (poi.custo_unitario * poi.quantidade) AS custo_total_linha,
    poi.portes_rateados,
    poi.impostos_rateados,
    (poi.custo_unitario * poi.quantidade + COALESCE(poi.portes_rateados, 0) + COALESCE(poi.impostos_rateados, 0)) AS custo_real_compra,
    (COALESCE(o.valor_total_sem_impostos, 0) - COALESCE(o.comissao_sem_impostos, 0)
     - (poi.custo_unitario * poi.quantidade + COALESCE(poi.portes_rateados, 0) + COALESCE(poi.impostos_rateados, 0))) AS margem_real_linha
FROM orders o
LEFT JOIN purchase_order_items poi ON poi.order_id = o.id
LEFT JOIN purchase_orders po ON po.id = poi.purchase_order_id
LEFT JOIN suppliers s ON s.id = po.supplier_id;
