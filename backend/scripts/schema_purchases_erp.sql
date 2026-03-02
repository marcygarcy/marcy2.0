-- =============================================================================
-- Módulo de Compras ERP: Purchase Orders com dados fiscais e rastreabilidade
-- Cada PO = uma empresa_id (faturação separada por entidade legal)
-- Cada item ligado a sales_order_item_id para lucro real
-- =============================================================================

-- Campos fiscais e ID encomenda fornecedor em purchase_orders
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS billing_nif TEXT;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS billing_address TEXT;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS billing_name TEXT;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS supplier_order_id TEXT;

-- Rastreabilidade: cada linha de compra ligada à linha de venda original
ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS sales_order_item_id INTEGER;

-- Vista BI: estado de cada venda (Vendido -> Em Processamento de Compra -> Comprado (PO #123))
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
    po.supplier_order_id
FROM orders o
LEFT JOIN empresas e ON e.id = o.empresa_id
LEFT JOIN purchase_order_items poi ON poi.order_id = o.id
LEFT JOIN purchase_orders po ON po.id = poi.purchase_order_id;

-- Índice para listagem global por fornecedor
CREATE INDEX IF NOT EXISTS idx_po_supplier_order_id ON purchase_orders(supplier_order_id);
CREATE INDEX IF NOT EXISTS idx_po_items_sales_order_item ON purchase_order_items(sales_order_item_id);
