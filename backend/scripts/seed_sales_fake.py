"""
Seed de dados fake para testar o Sales Explorer.
Gera ~80 sales_orders + items para AMBAS as empresas.
Estados com dados coerentes: Shipped/Delivered incluem tracking.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import duckdb, random
from datetime import datetime, timedelta

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'warehouse.duckdb')
conn = duckdb.connect(DB_PATH)

# ─── Referências ──────────────────────────────────────────────────────────────
EMPRESAS = [
    (1, 'teste 369'),
    (2, 'Teste 123'),
]
MARKETPLACES = [
    (1,   'Pixmania'),
    (2,   'Worten'),
    (101, 'Amazon ES'),
]
EU_COUNTRIES  = ['ES', 'FR', 'DE', 'IT', 'PT', 'PL', 'NL', 'BE', 'SE', 'RO', 'AT', 'CZ', 'HU', 'GR']
NON_EU        = ['GB', 'CH', 'NO', 'US']
ALL_COUNTRIES = EU_COUNTRIES + NON_EU

# Pesos realistas: maioria Paid/Shipped, poucos Delivered/Cancelled
STATUSES = [
    'Paid', 'Paid', 'Paid', 'Paid',
    'Shipped', 'Shipped', 'Shipped',
    'Delivered', 'Delivered',
    'Pending', 'Pending',
    'Purchased',
    'Cancelled',
]

CARRIERS = [
    ('CTT Expresso',   'CTT'),
    ('DHL Express',    'DHL'),
    ('DPD Portugal',   'DPD'),
    ('GLS Portugal',   'GLS'),
    ('UPS',            'UPS'),
    ('Correos Express','COR'),
]

CATALOG = [
    ('PHN-SAM-A55',  179.99, 'MKT-A55-ES'),
    ('PHN-SAM-S24',  699.00, 'MKT-S24-ES'),
    ('PHN-XIA-M4',    99.99, 'MKT-RM13'),
    ('PHN-APP-I15',  849.00, 'MKT-I15'),
    ('TAB-SAM-A9',   299.00, 'MKT-TABA9'),
    ('TWS-JBL-T230',  49.99, 'MKT-JBL230'),
    ('TWS-SAM-B2P',  119.00, 'MKT-B2P'),
    ('SPK-JBL-GO3',   39.99, 'MKT-JGO3'),
    ('CHR-ANK-65W',   29.99, 'MKT-ANK65'),
    ('CBL-USBC-2M',    9.99, 'MKT-USBC2'),
    ('PWR-ANK-26K',   79.99, 'MKT-PB268'),
    ('WCH-SAM-GW6',  249.00, 'MKT-GW644'),
    ('LAP-LEN-V15',  549.00, 'MKT-LV15'),
    ('MOU-LOG-M185',  14.99, 'MKT-LM185'),
]

def rand_date(days_back=90) -> datetime:
    return datetime.now() - timedelta(days=random.randint(0, days_back))

def rand_tracking(carrier_code: str) -> str:
    digits = ''.join([str(random.randint(0, 9)) for _ in range(12)])
    return f"{carrier_code}{digits}"

def build_order(order_id: int, seq: int, empresa_id: int, mp_prefix: str):
    mp_id, mp_name = random.choice(MARKETPLACES)
    country        = random.choice(ALL_COUNTRIES)
    status         = random.choice(STATUSES)
    order_date     = rand_date(90)
    n_items        = random.randint(1, 3)
    items          = random.sample(CATALOG, n_items)

    total_gross = 0.0
    total_comm  = 0.0
    order_items = []

    for (sku, price, sku_mp) in items:
        qty   = random.choice([1, 1, 1, 2])
        gross = round(price * qty, 2)
        comm  = round(gross * random.uniform(0.08, 0.15), 2)
        total_gross += gross
        total_comm  += comm
        order_items.append((sku, sku_mp, qty, price))

    total_gross = round(total_gross, 2)
    total_comm  = round(total_comm, 2)
    comm_fixed  = round(random.uniform(0.50, 2.00), 2) if mp_name == 'Worten' else 0.0
    net_value   = round(total_gross - total_comm - comm_fixed, 2)

    prefixes   = {'Pixmania': 'PIX', 'Worten': 'WRT', 'Amazon ES': 'AMZ'}
    prefix     = prefixes.get(mp_name, 'MKT')
    ext_id     = f"{prefix}-E{empresa_id}-{seq:04d}"

    # Cancelamento
    cancelled_at     = None
    cancelled_reason = None
    if status == 'Cancelled':
        cancelled_at     = order_date + timedelta(days=random.randint(1, 5))
        cancelled_reason = random.choice(['Cliente desistiu', 'Stock esgotado', 'Pagamento recusado'])

    # Envio — só para Shipped e Delivered
    carrier_name   = None
    tracking_number = None
    shipping_status = None
    carrier_status  = None
    shipped_at      = None

    if status in ('Shipped', 'Delivered'):
        carrier_full, carrier_code = random.choice(CARRIERS)
        carrier_name    = carrier_full
        tracking_number = rand_tracking(carrier_code)
        shipped_at      = order_date + timedelta(days=random.randint(1, 3))
        if status == 'Shipped':
            shipping_status = 'In Transit'
            carrier_status  = 'In Transit'
        else:  # Delivered
            shipping_status = 'Delivered'
            carrier_status  = 'Delivered'

    return {
        'id':                       order_id,
        'empresa_id':               empresa_id,
        'external_order_id':        ext_id,
        'marketplace_id':           mp_id,
        'order_date':               order_date,
        'status':                   status,
        'customer_country':         country,
        'currency':                 'EUR',
        'total_gross':              total_gross,
        'total_commission_fixed':   comm_fixed,
        'total_commission_percent': total_comm,
        'total_net_value':          net_value,
        'cancelled_at':             cancelled_at,
        'cancelled_reason':         cancelled_reason,
        'carrier_name':             carrier_name,
        'tracking_number':          tracking_number,
        'shipping_status':          shipping_status,
        'carrier_status':           carrier_status,
        'shipped_at':               shipped_at,
        'items':                    order_items,
    }

# ─── Main ─────────────────────────────────────────────────────────────────────
print("Limpando dados antigos...")
conn.execute("DELETE FROM sales_order_items")
conn.execute("DELETE FROM sales_orders")

random.seed(42)
order_id  = 1
item_id   = 1
orders_ok = 0
items_ok  = 0

for (empresa_id, empresa_nome) in EMPRESAS:
    print(f"Gerando 40 ordens para {empresa_nome} (empresa_id={empresa_id})...")
    for seq in range(1, 41):
        o = build_order(order_id, seq, empresa_id, empresa_nome[:3].upper())

        conn.execute("""
            INSERT INTO sales_orders (
                id, empresa_id, external_order_id, marketplace_id, order_date, status,
                customer_country, currency, total_gross,
                total_commission_fixed, total_commission_percent, total_net_value,
                cancelled_at, cancelled_reason,
                carrier_name, tracking_number, shipping_status, carrier_status, shipped_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, [
            o['id'], o['empresa_id'], o['external_order_id'], o['marketplace_id'],
            o['order_date'], o['status'], o['customer_country'], o['currency'],
            o['total_gross'], o['total_commission_fixed'], o['total_commission_percent'],
            o['total_net_value'], o['cancelled_at'], o['cancelled_reason'],
            o['carrier_name'], o['tracking_number'], o['shipping_status'],
            o['carrier_status'], o['shipped_at'],
        ])
        orders_ok += 1

        for (internal_sku, sku_mp, qty, unit_price) in o['items']:
            vat_amount = round(unit_price * qty * 0.23, 2)
            conn.execute("""
                INSERT INTO sales_order_items
                    (id, sales_order_id, sku_marketplace, internal_sku, quantity, unit_price, vat_rate, vat_amount)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, [item_id, order_id, sku_mp, internal_sku, qty, unit_price, 23.0, vat_amount])
            item_id  += 1
            items_ok += 1

        order_id += 1

conn.commit()
print(f"OK {orders_ok} ordens inseridas")
print(f"OK {items_ok} itens inseridos")

# Resumo
print()
print("=== Por empresa / status ===")
rows = conn.execute("""
    SELECT e.nome, so.status, COUNT(*) as n
    FROM sales_orders so JOIN empresas e ON e.id = so.empresa_id
    GROUP BY e.nome, so.status ORDER BY e.nome, n DESC
""").fetchall()
empresa_atual = None
for r in rows:
    if r[0] != empresa_atual:
        print(f"\n  [{r[0]}]")
        empresa_atual = r[0]
    print(f"    {r[1]:<15} {r[2]:>3}")

print()
print("=== Shipped/Delivered com tracking ===")
rows = conn.execute("""
    SELECT COUNT(*) FROM sales_orders
    WHERE status IN ('Shipped','Delivered') AND tracking_number IS NOT NULL
""").fetchone()
print(f"  {rows[0]} ordens com tracking preenchido")

rows2 = conn.execute("""
    SELECT COUNT(*) FROM sales_orders
    WHERE status IN ('Shipped','Delivered') AND tracking_number IS NULL
""").fetchone()
print(f"  {rows2[0]} ordens Shipped/Delivered SEM tracking (deve ser 0)")

conn.close()
print()
print("Seed concluido!")
