# 07 - Data Schema (SQL)

O ficheiro seguinte contém o SQL para criar as tabelas logísticas e regras VAT OSS. Copiar o bloco SQL e executá-lo no DuckDB conforme necessário.

```sql
-- logistics_events
CREATE TABLE IF NOT EXISTS logistics_events (
    id BIGINT PRIMARY KEY,
    event_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    event_type VARCHAR,
    reference_type VARCHAR,
    reference_id VARCHAR,
    sku VARCHAR,
    quantity INTEGER,
    serial_number VARCHAR,
    location_from VARCHAR,
    location_to VARCHAR,
    office VARCHAR,
    user_id VARCHAR,
    metadata JSON DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_logistics_events_ref ON logistics_events(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_logistics_events_sku ON logistics_events(sku);

-- inventory_transit
CREATE TABLE IF NOT EXISTS inventory_transit (
    id BIGINT PRIMARY KEY,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    transfer_ref VARCHAR,
    sku VARCHAR,
    quantity INTEGER,
    unit VARCHAR,
    from_office VARCHAR,
    to_office VARCHAR,
    status VARCHAR,
    eta TIMESTAMP,
    actual_received_at TIMESTAMP,
    batch_or_lot VARCHAR,
    po_number VARCHAR,
    shipment_id VARCHAR,
    metadata JSON DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_inventory_transit_status ON inventory_transit(status);
CREATE INDEX IF NOT EXISTS idx_inventory_transit_sku ON inventory_transit(sku);

-- receptions
CREATE TABLE IF NOT EXISTS receptions (
    id BIGINT PRIMARY KEY,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    po_number VARCHAR,
    reception_number VARCHAR,
    office VARCHAR,
    received_by VARCHAR,
    received_at TIMESTAMP,
    status VARCHAR,
    metadata JSON DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_receptions_po ON receptions(po_number);

-- reception_lines
CREATE TABLE IF NOT EXISTS reception_lines (
    id BIGINT PRIMARY KEY,
    reception_id BIGINT,
    po_line_id VARCHAR,
    sku VARCHAR,
    expected_qty INTEGER,
    received_qty INTEGER,
    unit_price NUMERIC,
    invoice_price NUMERIC,
    currency VARCHAR,
    serial_numbers VARCHAR,
    match_status VARCHAR,
    notes VARCHAR,
    metadata JSON DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_reception_lines_reception ON reception_lines(reception_id);
CREATE INDEX IF NOT EXISTS idx_reception_lines_sku ON reception_lines(sku);

-- invoice_extractions
CREATE TABLE IF NOT EXISTS invoice_extractions (
    id BIGINT PRIMARY KEY,
    invoice_number VARCHAR,
    invoice_date DATE,
    supplier_id VARCHAR,
    po_number VARCHAR,
    extracted_lines JSON,
    total_amount NUMERIC,
    currency VARCHAR,
    confidence NUMERIC,
    source_file VARCHAR,
    processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSON DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_invoice_extractions_invoice ON invoice_extractions(invoice_number);

-- vat_oss_rules
CREATE TABLE IF NOT EXISTS vat_oss_rules (
    id BIGINT PRIMARY KEY,
    country_code VARCHAR,
    vat_rate NUMERIC,
    threshold NUMERIC,
    apply_to_shipping BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSON DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_vat_oss_country ON vat_oss_rules(country_code);

-- ledger_entries
CREATE TABLE IF NOT EXISTS ledger_entries (
    id BIGINT PRIMARY KEY,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    company_id INTEGER,
    account_code VARCHAR,
    contra_account VARCHAR,
    reference_type VARCHAR,
    reference_id VARCHAR,
    debit NUMERIC DEFAULT 0,
    credit NUMERIC DEFAULT 0,
    currency VARCHAR,
    description VARCHAR,
    metadata JSON DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_ledger_company ON ledger_entries(company_id);

-- view example
CREATE VIEW IF NOT EXISTS vw_reception_triple_match AS
SELECT rl.id as reception_line_id,
       r.reception_number,
       rl.sku,
       rl.expected_qty,
       rl.received_qty,
       rl.unit_price as po_unit_price,
       rl.invoice_price,
       ie.invoice_number,
       ie.total_amount as invoice_total
FROM reception_lines rl
LEFT JOIN receptions r ON rl.reception_id = r.id
LEFT JOIN invoice_extractions ie ON r.po_number = ie.po_number OR rl.po_line_id = ie.invoice_number;

```
