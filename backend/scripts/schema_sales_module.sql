-- =============================================================================
-- Módulo de Vendas (Sales/Orders) - Dropshipping Multi-empresa e Multi-canal
-- Tabelas: sales_orders, sales_order_items, marketplaces_config
-- View: v_sales_rentabilidade (Lucro Real = Venda vs Custo Compra)
-- =============================================================================

-- Configuração de comissões por marketplace (Front-margin)
CREATE TABLE IF NOT EXISTS marketplaces_config (
    id INTEGER PRIMARY KEY,
    empresa_id INTEGER NOT NULL,
    marketplace_id INTEGER,
    name TEXT NOT NULL,
    commission_percent DOUBLE DEFAULT 0,
    fixed_fee_per_order DOUBLE DEFAULT 0,
    ativo BOOLEAN DEFAULT TRUE,
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Cabeçalho da venda (uma linha por encomenda externa)
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
);

-- Itens da venda (1:N)
CREATE TABLE IF NOT EXISTS sales_order_items (
    id INTEGER PRIMARY KEY,
    sales_order_id INTEGER NOT NULL,
    sku_marketplace TEXT,
    internal_sku TEXT,
    quantity DOUBLE NOT NULL DEFAULT 1,
    unit_price DOUBLE DEFAULT 0,
    vat_rate DOUBLE DEFAULT 0,
    CONSTRAINT fk_sales_order FOREIGN KEY (sales_order_id) REFERENCES sales_orders(id)
);

-- View: Rentabilidade (Lucro Real Unitário = Venda - Custo Compra rateado)
-- Liga sales_order_items a purchase_order_items via orders (orders.sales_order_item_id = sales_order_items.id)
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
LEFT JOIN purchase_order_items poi ON poi.order_id = o.id;

-- Índices
CREATE INDEX IF NOT EXISTS idx_sales_orders_empresa ON sales_orders(empresa_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_marketplace ON sales_orders(marketplace_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_order_date ON sales_orders(order_date);
CREATE INDEX IF NOT EXISTS idx_sales_orders_status ON sales_orders(status);
CREATE INDEX IF NOT EXISTS idx_sales_order_items_sales_order ON sales_order_items(sales_order_id);
CREATE INDEX IF NOT EXISTS idx_marketplaces_config_empresa ON marketplaces_config(empresa_id);
CREATE INDEX IF NOT EXISTS idx_marketplaces_config_marketplace ON marketplaces_config(marketplace_id);
