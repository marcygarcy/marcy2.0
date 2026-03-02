"""
Script de Seeding Demo — dados realistas para testar TODOS os módulos do frontend.

Cria:
  - 2 Empresas, 4 Marketplaces, 3 Fornecedores
  - 9 SKUs mapeados (com custo fornecedor por fornecedor)
  - 15 Pedidos de venda (sales_orders + orders) com estados e margens variados
      → 4 pedidos com MARGEM NEGATIVA (alertas de prejuízo visíveis a vermelho)
  - 8 Itens pendentes de compra (3 com alerta de margem)
  - 5 Purchase Orders (Draft / Ordered / Paid)
  - 10 Lançamentos na Conta Corrente (Aging: 1 PO vencida, 1 a vencer)
  - 8 Movimentos bancários (3 ciclos)
  - ~45 Transações Recebimentos (5 ciclos, Pixmania + Worten PT)
  - 10 Registos de histórico de automação (3 fornecedores)
  - CSVs de preços em data/temp_scrapes/ (suppliers 1 e 3) para testar robô

IDs de marketplace ALINHADOS com o Sidebar hardcoded:
  empresa_id=2 (Teste 123): Pixmania=1, Worten=2
  empresa_id=1 (teste 369):     Worten=37

Uso:
  cd backend
  python -m scripts.seed_demo
  ou:
  python scripts/seed_demo.py

AVISO: este script apaga TODOS os dados existentes antes de inserir os novos.
"""
from __future__ import annotations

import sys
from pathlib import Path
from datetime import datetime, timedelta, date

_backend = Path(__file__).resolve().parent.parent
if str(_backend) not in sys.path:
    sys.path.insert(0, str(_backend))

import pandas as pd
from app.config.database import get_db_connection, init_database
from app.services.security_service import encrypt_password


def _ts(d: datetime) -> str:
    return d.strftime("%Y-%m-%d %H:%M:%S")


def _dt(d: datetime | date) -> str:
    if isinstance(d, datetime):
        return d.strftime("%Y-%m-%d")
    return d.strftime("%Y-%m-%d")


def seed_demo():
    init_database()
    db = get_db_connection()
    now = datetime.now()

    print("SEEDING DEMO -- dados realistas para todos os modulos frontend...")
    print("   AVISO: Todos os dados existentes serao apagados.")

    # ── LIMPEZA (ordem por dependências FK) ─────────────────────────────────
    TABELAS = [
        "sync_history", "supplier_ledger", "financial_reconciliation",
        "rma_claims", "logistics_events",
        "purchase_order_items", "purchase_orders",
        "pending_purchase_items", "sales_order_items", "sales_orders",
        "orders", "sku_mapping", "supplier_access", "suppliers",
        "marketplaces_config", "marketplaces", "empresas",
        "bank_movements", "transactions", "invoices",
    ]
    for t in TABELAS:
        try:
            db.execute(f"DELETE FROM {t}")
        except Exception as e:
            print(f"   Aviso ao limpar {t}: {e}")
    db.commit()
    print("   OK: Tabelas limpas.")

    # ────────────────────────────────────────────────────────────────────────
    # 1. EMPRESAS
    # ────────────────────────────────────────────────────────────────────────
    db.execute("""
        INSERT INTO empresas (id, nome, codigo, ativo)
        VALUES (1, 'teste 369', 'BHS', TRUE),
               (2, 'Teste 123', 'GHS', TRUE)
    """)

    # ────────────────────────────────────────────────────────────────────────
    # 2. MARKETPLACES — IDs alinhados com sidebar hardcoded
    # ────────────────────────────────────────────────────────────────────────
    db.execute("""
        INSERT INTO marketplaces (id, empresa_id, nome, comissao_percentual, taxa_fixa, ativo)
        VALUES
          (1,   2, 'Pixmania',  18.0, 0.50, TRUE),
          (2,   2, 'Worten',    15.0, 0.60, TRUE),
          (37,  1, 'Worten',    15.0, 0.60, TRUE),
          (101, 1, 'Amazon ES', 12.0, 0.99, TRUE)
    """)

    # ────────────────────────────────────────────────────────────────────────
    # 3. MARKETPLACES_CONFIG (para cálculo de comissões no Sales Module)
    # ────────────────────────────────────────────────────────────────────────
    db.execute("""
        INSERT INTO marketplaces_config (id, empresa_id, marketplace_id, name,
                                          commission_percent, fixed_fee_per_order, ativo)
        VALUES
          (1, 2,   1, 'Pixmania',  18.0, 0.50, TRUE),
          (2, 2,   2, 'Worten ES', 15.0, 0.60, TRUE),
          (3, 1,  37, 'Worten PT', 15.0, 0.60, TRUE),
          (4, 1, 101, 'Amazon ES', 12.0, 0.99, TRUE)
    """)

    # ────────────────────────────────────────────────────────────────────────
    # 4. SUPPLIERS
    # ────────────────────────────────────────────────────────────────────────
    db.execute("""
        INSERT INTO suppliers (id, empresa_id, nome, designacao_social, nif_cif, pais,
                                default_shipping_type, metodo_pagamento, ativo)
        VALUES
          (1, 1, 'TechWholesale IT', 'TechWholesale Italia S.r.l.', 'IT12345678', 'IT', 'Escritorio',   'Transferencia', TRUE),
          (2, 2, 'DropDirect ES',    'DropDirect España S.L.',      'ESA8887776', 'ES', 'Dropshipping', 'Cartao',        TRUE),
          (3, 2, 'MegaSupply FR',    'MegaSupply France SARL',      'FR99887766', 'FR', 'Escritorio',   'Transferencia', TRUE)
    """)

    # ────────────────────────────────────────────────────────────────────────
    # 5. SUPPLIER_ACCESS (para Status de Automação + robô)
    # ────────────────────────────────────────────────────────────────────────
    pw = encrypt_password("senha_demo_123") or "dummy_encrypted"
    db.execute("""
        INSERT INTO supplier_access (id, supplier_id, url_site, login_user, password_encrypted,
                                      auto_sync_prices, auto_sync_trackings, auto_sync_invoices)
        VALUES
          (1, 1, 'https://portal.techwholesale.it', 'admin@bighub.com',   ?, TRUE,  TRUE,  TRUE),
          (2, 2, 'https://portal.dropdirect.es',    'admin@grupohub.com', ?, FALSE, TRUE,  TRUE),
          (3, 3, 'https://portal.megasupply.fr',    'admin@grupohub.com', ?, TRUE,  FALSE, TRUE)
    """, [pw, pw, pw])

    # ────────────────────────────────────────────────────────────────────────
    # 6. SKU_MAPPING (empresa 1: 4 SKUs; empresa 2: 5 SKUs)
    # ────────────────────────────────────────────────────────────────────────
    sku_rows = [
        # id  eid  sku_marketplace   sku_fornecedor  nome_produto                       custo   sup_id
        (1,   1,   'PHONE-X',        'X-IT-500',     'Smartphone X Pro 128GB',          100.00, 1),
        (2,   1,   'TABLET-PRO',     'T-IT-200',     'Tablet Pro 10" WiFi 64GB',        150.00, 1),
        (3,   1,   'HEADSET-BT',     'H-IT-300',     'Headset Bluetooth ANC',            45.00, 1),
        (4,   1,   'LAPTOP-15',      'L-IT-100',     'Laptop 15" Intel i5 16GB',        380.00, 1),
        (5,   2,   'WATCH-S8',       'W-ES-100',     'Smartwatch Series 8 GPS',         120.00, 2),
        (6,   2,   'CAMERA-4K',      'C-ES-200',     'Câmera Compacta 4K 20MP',          85.00, 2),
        (7,   2,   'SPEAKER-JBL',    'S-FR-300',     'Coluna Bluetooth 20W IPX5',        35.00, 3),
        (8,   2,   'POWERBANK-20K',  'P-FR-400',     'PowerBank 20000mAh 65W USB-C',     22.00, 3),
        (9,   2,   'HEADSET-PRO',    'H-FR-500',     'Headset Pro Gaming 7.1 Surround',  65.00, 3),
    ]
    for sid, eid, sku_mkt, sku_forn, nome, custo, supplier_id in sku_rows:
        db.execute("""
            INSERT INTO sku_mapping (id, empresa_id, sku_marketplace, sku_fornecedor,
                                      nome_produto, custo_fornecedor, supplier_id, ativo)
            VALUES (?, ?, ?, ?, ?, ?, ?, TRUE)
        """, [sid, eid, sku_mkt, sku_forn, nome, custo, supplier_id])

    # ────────────────────────────────────────────────────────────────────────
    # 7. SALES_ORDERS + SALES_ORDER_ITEMS (Sales Explorer tab)
    #    Empresa 2 / Pixmania(1):  7 pedidos  (2 com margem negativa)
    #    Empresa 2 / Worten(2):    3 pedidos  (1 com margem negativa)
    #    Empresa 1 / Worten PT(37):5 pedidos  (1 com margem negativa)
    # ────────────────────────────────────────────────────────────────────────
    # Colunas: id, ext_id, eid, mp_id, dias, status, country, gross, fix, pct, net, sku, qty, unit_price
    so_data = [
        (1,  'PIX-001',    2, 1,  45, 'Paid',       'ES', 249.99, 0.50, 45.00, 204.49, 'WATCH-S8',      1, 249.99),
        (2,  'PIX-002',    2, 1,  40, 'Paid',       'ES', 199.99, 0.50, 36.00, 163.49, 'CAMERA-4K',     2,  99.99),  # NEGATIVO −6.51
        (3,  'PIX-003',    2, 1,  30, 'Shipped',    'PT',  89.99, 0.50, 16.20,  73.29, 'SPEAKER-JBL',   2,  44.99),
        (4,  'PIX-004',    2, 1,  20, 'Purchased',  'FR', 119.99, 0.50, 21.60,  97.89, 'HEADSET-PRO',   1, 119.99),
        (5,  'PIX-005',    2, 1,  10, 'Pending',    'ES', 159.99, 0.50, 28.80, 130.69, 'WATCH-S8',      1, 159.99),
        (6,  'PIX-006',    2, 1,   5, 'Pending',    'PT',  74.97, 0.50, 13.49,  60.98, 'POWERBANK-20K', 3,  24.99),  # NEGATIVO −5.02
        (7,  'PIX-007',    2, 1,  50, 'Paid',       'ES', 239.98, 0.50, 43.20, 196.28, 'HEADSET-PRO',   2, 119.99),
        (8,  'WRT-ES-001', 2, 2,  38, 'Paid',       'ES', 149.99, 0.60, 22.50, 126.89, 'CAMERA-4K',     1, 149.99),
        (9,  'WRT-ES-002', 2, 2,  25, 'Shipped',    'ES',  99.99, 0.60, 15.00,  84.39, 'SPEAKER-JBL',   3,  33.33),  # NEGATIVO −20.61
        (10, 'WRT-ES-003', 2, 2,   8, 'Pending',    'PT',  54.98, 0.60,  8.25,  46.13, 'POWERBANK-20K', 2,  27.49),
        (11, 'WRT-PT-001', 1, 37, 48, 'Paid',       'PT', 229.99, 0.60, 34.50, 194.89, 'PHONE-X',       1, 229.99),
        (12, 'WRT-PT-002', 1, 37, 43, 'Paid',       'PT', 189.99, 0.60, 28.50, 160.89, 'HEADSET-BT',    2,  94.99),
        (13, 'WRT-PT-003', 1, 37, 28, 'Shipped',    'PT', 449.99, 0.60, 67.50, 381.89, 'TABLET-PRO',    1, 449.99),
        (14, 'WRT-PT-004', 1, 37, 18, 'Purchased',  'PT', 649.99, 0.60, 97.50, 551.89, 'LAPTOP-15',     1, 649.99),
        (15, 'WRT-PT-005', 1, 37,  6, 'Pending',    'PT',  89.99, 0.60, 13.50,  75.89, 'PHONE-X',       1,  89.99),  # NEGATIVO −24.11
    ]

    for so_id, ext_id, eid, mp_id, dias, status, country, gross, fix, pct, net, sku, qty, unit_price in so_data:
        order_date = now - timedelta(days=dias)
        db.execute("""
            INSERT INTO sales_orders (id, empresa_id, external_order_id, marketplace_id, order_date,
                                       status, customer_country, currency, total_gross,
                                       total_commission_fixed, total_commission_percent, total_net_value)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'EUR', ?, ?, ?, ?)
        """, [so_id, eid, ext_id, mp_id, _ts(order_date), status, country, gross, fix, pct, net])

        db.execute("""
            INSERT INTO sales_order_items (id, sales_order_id, sku_marketplace, internal_sku,
                                            quantity, unit_price, vat_rate)
            VALUES (?, ?, ?, ?, ?, ?, 23.0)
        """, [so_id, so_id, sku, sku, qty, unit_price])

    # ────────────────────────────────────────────────────────────────────────
    # 8. ORDERS (tabela clássica — KPIs tab e Listagens > Vendas com Margem)
    #    margem = valor_total_sem_impostos − comissao − custo_fornecedor × qty
    # ────────────────────────────────────────────────────────────────────────
    # Colunas: id, numero, eid, mp_id, canal, sku, nome, qty, gross, sem_iva, comissao, custo, status, dias
    orders_data = [
        (1,  'PIX-001',    2, 1,  'Pixmania',  'WATCH-S8',      'Smartwatch Series 8 GPS',            1, 249.99, 249.99,  45.50, 120.00, 'Paid',      45),
        (2,  'PIX-002',    2, 1,  'Pixmania',  'CAMERA-4K',     'Câmera Compacta 4K 20MP',            2, 199.99, 199.99,  36.50, 170.00, 'Paid',      40),  # −6.51
        (3,  'PIX-003',    2, 1,  'Pixmania',  'SPEAKER-JBL',   'Coluna Bluetooth 20W IPX5',          2,  89.99,  89.99,  16.70,  70.00, 'Shipped',   30),
        (4,  'PIX-004',    2, 1,  'Pixmania',  'HEADSET-PRO',   'Headset Pro Gaming 7.1 Surround',    1, 119.99, 119.99,  22.10,  65.00, 'Purchased', 20),
        (5,  'PIX-005',    2, 1,  'Pixmania',  'WATCH-S8',      'Smartwatch Series 8 GPS',            1, 159.99, 159.99,  29.30, 120.00, 'Pending',   10),
        (6,  'PIX-006',    2, 1,  'Pixmania',  'POWERBANK-20K', 'PowerBank 20000mAh 65W USB-C',       3,  74.97,  74.97,  13.99,  66.00, 'Pending',    5),  # −5.02
        (7,  'PIX-007',    2, 1,  'Pixmania',  'HEADSET-PRO',   'Headset Pro Gaming 7.1 Surround',    2, 239.98, 239.98,  43.70, 130.00, 'Paid',      50),
        (8,  'WRT-ES-001', 2, 2,  'Worten ES', 'CAMERA-4K',     'Câmera Compacta 4K 20MP',            1, 149.99, 149.99,  23.10,  85.00, 'Paid',      38),
        (9,  'WRT-ES-002', 2, 2,  'Worten ES', 'SPEAKER-JBL',   'Coluna Bluetooth 20W IPX5',          3,  99.99,  99.99,  15.60, 105.00, 'Shipped',   25),  # −20.61
        (10, 'WRT-ES-003', 2, 2,  'Worten ES', 'POWERBANK-20K', 'PowerBank 20000mAh 65W USB-C',       2,  54.98,  54.98,   8.85,  44.00, 'Pending',    8),
        (11, 'WRT-PT-001', 1, 37, 'Worten PT', 'PHONE-X',       'Smartphone X Pro 128GB',             1, 229.99, 229.99,  35.10, 100.00, 'Paid',      48),
        (12, 'WRT-PT-002', 1, 37, 'Worten PT', 'HEADSET-BT',    'Headset Bluetooth ANC',              2, 189.99, 189.99,  29.10,  90.00, 'Paid',      43),
        (13, 'WRT-PT-003', 1, 37, 'Worten PT', 'TABLET-PRO',    'Tablet Pro 10" WiFi 64GB',           1, 449.99, 449.99,  68.10, 150.00, 'Shipped',   28),
        (14, 'WRT-PT-004', 1, 37, 'Worten PT', 'LAPTOP-15',     'Laptop 15" Intel i5 16GB',           1, 649.99, 649.99,  98.10, 380.00, 'Purchased', 18),
        (15, 'WRT-PT-005', 1, 37, 'Worten PT', 'PHONE-X',       'Smartphone X Pro 128GB',             1,  89.99,  89.99,  14.10, 100.00, 'Pending',    6),  # −24.11
    ]

    for oid, num, eid, mp_id, canal, sku, nome, qty, gross, sem_iva, comissao, custo, status, dias in orders_data:
        data = now - timedelta(days=dias)
        db.execute("""
            INSERT INTO orders (id, numero_pedido, data_criacao, empresa_id, marketplace_id,
                                 canal_vendas, sku_oferta, nome_produto, quantidade,
                                 valor_total_com_iva, valor_total_sem_impostos,
                                 comissao_sem_impostos, custo_fornecedor, status,
                                 sales_order_id, sales_order_item_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, [oid, num, _ts(data), eid, mp_id, canal, sku, nome, qty,
              gross, sem_iva, comissao, custo, status, oid, oid])

    # ────────────────────────────────────────────────────────────────────────
    # 9. PENDING_PURCHASE_ITEMS (Central de Compras)
    #    3 itens com margem negativa → margin_alert = TRUE
    # ────────────────────────────────────────────────────────────────────────
    ppi_data = [
        # id  eid so  soi  sku_mkt          sku_sup   sup qty  custo  preco   profit  status    alert
        (1,   2,  4,  4,   'HEADSET-PRO',   'H-FR-500', 3, 1, 65.00, 119.99,  32.89, 'pending', False),
        (2,   2,  5,  5,   'WATCH-S8',      'W-ES-100', 2, 1, 120.00,159.99,  10.69, 'pending', False),
        (3,   2,  6,  6,   'POWERBANK-20K', 'P-FR-400', 3, 3,  22.00, 24.99,  -5.02, 'pending', True),   # ALERTA
        (4,   2,  9,  9,   'SPEAKER-JBL',   'S-FR-300', 3, 3,  35.00, 33.33, -20.61, 'pending', True),   # ALERTA
        (5,   2,  10, 10,  'POWERBANK-20K', 'P-FR-400', 3, 2,  22.00, 27.49,   2.13, 'pending', False),
        (6,   1,  14, 14,  'LAPTOP-15',     'L-IT-100', 1, 1, 380.00,649.99, 171.89, 'pending', False),
        (7,   1,  15, 15,  'PHONE-X',       'X-IT-500', 1, 1, 100.00, 89.99, -24.11, 'pending', True),   # ALERTA
        (8,   2,  7,  7,   'HEADSET-PRO',   'H-FR-500', 3, 2,  65.00,119.99,  66.28, 'pending', False),
    ]
    for pid, eid, so_id, soi_id, sku_mkt, sku_sup, sup_id, qty, custo, preco, profit, status, alert in ppi_data:
        alert_msg = f'Margem negativa: custo {custo:.2f}€ > preço líquido' if alert else None
        db.execute("""
            INSERT INTO pending_purchase_items (id, empresa_id, sales_order_id, sales_order_item_id,
                                                 sku_marketplace, sku_supplier, supplier_id, quantity,
                                                 cost_price_base, unit_price_sale, expected_profit,
                                                 status, data_criacao, margin_alert, margin_alert_msg)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?)
        """, [pid, eid, so_id, soi_id, sku_mkt, sku_sup, sup_id, qty,
              custo, preco, profit, status, alert, alert_msg])

    # ────────────────────────────────────────────────────────────────────────
    # 10. PURCHASE_ORDERS
    # ────────────────────────────────────────────────────────────────────────
    # PO#3: data_ordered há 35 dias, due = 30 dias → vencida há 5 dias (aging!)
    # PO#5: data_ordered há 8 dias,  due = 45 dias → a vencer daqui a 37 dias
    po_data = [
        # id  eid sup status    base    portes  imp   total   offset_dias  due_days  notas
        (1,   2,  3,  'Draft',   130.00,  8.00, 0.0,  138.00, None,        None,    'PO MegaSupply #1 — Rascunho (SPEAKER+POWERBANK)'),
        (2,   2,  2,  'Ordered', 120.00, 10.00, 0.0,  130.00, -15,          30,     'PO DropDirect #1 — Encomendada'),
        (3,   2,  2,  'Ordered', 300.00, 12.00, 0.0,  312.00, -35,          30,     'PO DropDirect #2 — VENCIDA há 5 dias'),
        (4,   1,  1,  'Paid',    380.00, 15.00, 0.0,  395.00, -50,          30,     'PO TechWholesale #1 — Paga (PHONE-X x10)'),
        (5,   2,  3,  'Ordered', 195.00,  9.00, 0.0,  204.00, -8,           45,     'PO MegaSupply #2 — HEADSET-PRO x3'),
    ]
    for po_id, eid, sup_id, status, base, portes, imp, total, offset, due_days, notes in po_data:
        data_ord = (now + timedelta(days=offset)) if offset is not None else None
        due_date = (data_ord + timedelta(days=due_days)).date() if data_ord and due_days else None
        db.execute("""
            INSERT INTO purchase_orders (id, empresa_id, supplier_id, status, total_base,
                                          portes_totais, impostos, total_final,
                                          data_ordered, due_date, notas)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, [po_id, eid, sup_id, status, base, portes, imp, total,
              _ts(data_ord) if data_ord else None,
              str(due_date) if due_date else None, notes])

    # ────────────────────────────────────────────────────────────────────────
    # 11. SUPPLIER_LEDGER (Conta Corrente + Aging)
    # ────────────────────────────────────────────────────────────────────────
    ledger_rows = [
        # id  eid sup  offset  tipo              cred      deb      notas
        (1,   1,  1,   -55,  'Fatura',          3800.00,    0.00,  'FT2024/001 TechWholesale — LAPTOP-15 ×10'),
        (2,   1,  1,   -40,  'Pagamento',          0.00, 3800.00,  'TRF Nov-2024 liquidação total TechWholesale'),
        (3,   1,  1,   -20,  'Fatura',            395.00,    0.00,  'FT2024/028 TechWholesale — PO#4'),
        (4,   1,  1,   -18,  'Pagamento',          0.00,  395.00,  'TRF pagamento FT2024/028'),
        (5,   2,  2,   -40,  'Fatura',            800.00,    0.00,  'FT2024/045 DropDirect — CAMERA-4K + WATCH-S8'),
        (6,   2,  2,   -30,  'Pagamento',          0.00,  800.00,  'TRF pagamento FT2024/045'),
        (7,   2,  2,   -35,  'Fatura',            312.00,    0.00,  'FT2024/067 DropDirect PO#3 — EM ATRASO'),
        (8,   2,  3,   -10,  'Fatura',            138.00,    0.00,  'FT2024/081 MegaSupply — PO#1'),
        (9,   2,  3,    -8,  'Nota de Crédito',     0.00,   15.00,  'NC001 devolução produto danificado'),
        (10,  2,  3,    -8,  'Fatura',            204.00,    0.00,  'FT2024/085 MegaSupply — PO#5 (a vencer)'),
    ]
    saldos: dict[tuple, float] = {}
    for lid, eid, sup_id, offset, tipo, cred, deb, notas in ledger_rows:
        key = (eid, sup_id)
        saldo = saldos.get(key, 0.0) + cred - deb
        saldos[key] = saldo
        data_mov = (now + timedelta(days=offset)).date()
        db.execute("""
            INSERT INTO supplier_ledger (id, empresa_id, supplier_id, data_movimento, tipo,
                                          valor_credito, valor_debito, saldo_acumulado, notas)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, [lid, eid, sup_id, str(data_mov), tipo, cred, deb, round(saldo, 2), notas])

    # ────────────────────────────────────────────────────────────────────────
    # 12. BANK_MOVEMENTS (Módulo Bancos)
    # ────────────────────────────────────────────────────────────────────────
    bm_data = [
        # id  ctb   mov   ciclo       montante  eid
        (1,  -58,  -56,  '2024-C10',  1850.75,  2),
        (2,  -55,  -53,  '2024-C10', -3800.00,  1),  # pag. TechWholesale
        (3,  -45,  -43,  '2024-C11',  2340.20,  2),
        (4,  -38,  -36,  '2024-C11',  -800.00,  2),  # pag. DropDirect
        (5,  -30,  -28,  '2024-C12',  3120.50,  2),
        (6,  -25,  -23,  '2024-C12', -3800.00,  1),  # pag. TechWholesale PO#4
        (7,  -15,  -13,  '2024-C13',  1680.40,  2),
        (8,   -5,   -3,  '2024-C13',  -395.00,  1),  # pag. FT2024/028
    ]
    for bid, d_ctb, d_mov, ciclo, montante, eid in bm_data:
        db.execute("""
            INSERT INTO bank_movements (id, data_ctb, data_movimento, ciclo, montante, empresa_id)
            VALUES (?, ?, ?, ?, ?, ?)
        """, [bid,
              _dt(now + timedelta(days=d_ctb)),
              _dt(now + timedelta(days=d_mov)),
              ciclo, montante, eid])

    # ────────────────────────────────────────────────────────────────────────
    # 13. TRANSACTIONS (Módulo Recebimentos de Marketplaces)
    #     3 ciclos para empresa_id=2 / Pixmania(1)
    #     2 ciclos para empresa_id=1 / Worten PT(37)
    # ────────────────────────────────────────────────────────────────────────
    ciclos_e2 = [
        ('2024-C10', now - timedelta(days=55), 2, 1,  'Pixmania',
         [249.99, 199.99,  89.99, 239.98],
         [ 45.50,  36.50,  16.70,  43.70]),
        ('2024-C11', now - timedelta(days=40), 2, 1,  'Pixmania',
         [119.99, 159.99,  74.97],
         [ 22.10,  29.30,  13.99]),
        ('2024-C12', now - timedelta(days=20), 2, 1,  'Pixmania',
         [149.99,  99.99,  54.98],
         [ 23.10,  15.60,   8.85]),
    ]
    ciclos_e1 = [
        ('2024-C10', now - timedelta(days=50), 1, 37, 'Worten PT',
         [229.99, 189.99, 449.99],
         [ 35.10,  29.10,  68.10]),
        ('2024-C11', now - timedelta(days=25), 1, 37, 'Worten PT',
         [649.99,  89.99],
         [ 98.10,  14.10]),
    ]
    tx_id = 1
    for ciclo, ciclo_date, eid, mp_id, canal, vendas, comissoes in (ciclos_e2 + ciclos_e1):
        for v in vendas:
            db.execute("""
                INSERT INTO transactions ("Ciclo Pagamento", "Data do ciclo de faturamento",
                    "Data Criação", "Canal de vendas", Tipo, Crédito, Débito, real,
                    Descrição, Moeda, empresa_id, marketplace_id)
                VALUES (?, ?, ?, ?, 'Valor do pedido', ?, 0, ?, 'Venda de produto', 'EUR', ?, ?)
            """, [ciclo, _ts(ciclo_date), _ts(ciclo_date - timedelta(days=2)), canal, v, v, eid, mp_id])
            tx_id += 1
        for c in comissoes:
            db.execute("""
                INSERT INTO transactions ("Ciclo Pagamento", "Data do ciclo de faturamento",
                    "Data Criação", "Canal de vendas", Tipo, Crédito, Débito, real,
                    Descrição, Moeda, empresa_id, marketplace_id)
                VALUES (?, ?, ?, ?, 'Comissão de vendedor', 0, ?, ?, 'Comissão marketplace', 'EUR', ?, ?)
            """, [ciclo, _ts(ciclo_date), _ts(ciclo_date - timedelta(days=1)), canal, c, -c, eid, mp_id])
            tx_id += 1
        # Transferência
        trf = round(sum(vendas) * 0.88, 2)
        db.execute("""
            INSERT INTO transactions ("Ciclo Pagamento", "Data do ciclo de faturamento",
                "Data Criação", "Canal de vendas", Tipo, Crédito, Débito, real,
                Descrição, Moeda, empresa_id, marketplace_id)
            VALUES (?, ?, ?, ?, 'Transferência', ?, 0, ?, 'Transferência recebida', 'EUR', ?, ?)
        """, [ciclo, _ts(ciclo_date), _ts(ciclo_date), canal, trf, trf, eid, mp_id])
        tx_id += 1
        # Reserva (5%)
        reserva = round(sum(vendas) * 0.05, 2)
        db.execute("""
            INSERT INTO transactions ("Ciclo Pagamento", "Data do ciclo de faturamento",
                "Data Criação", "Canal de vendas", Tipo, Crédito, Débito, real,
                Descrição, Moeda, empresa_id, marketplace_id)
            VALUES (?, ?, ?, ?, 'Reserva', 0, ?, ?, 'Reserva retida pelo marketplace', 'EUR', ?, ?)
        """, [ciclo, _ts(ciclo_date), _ts(ciclo_date), canal, reserva, -reserva, eid, mp_id])
        tx_id += 1

    # ────────────────────────────────────────────────────────────────────────
    # 14. SYNC_HISTORY (Status de Automação — Midnight Sync)
    # ────────────────────────────────────────────────────────────────────────
    sh_data = [
        # id  sup  eid tipo       h_offset  status    msg                              rec   dur
        (1,   1,   1,  'Prices',   -26,  'success', '4 SKUs actualizados',              4,   41.2),
        (2,   1,   1,  'Tracking', -26,  'success', '2 trackings capturados',           2,   12.8),
        (3,   1,   1,  'Invoices', -26,  'success', '1 fatura descarregada',            1,   18.5),
        (4,   2,   2,  'Prices',   -25,  'error',   'Timeout ao aceder ao portal',      0,   30.0),
        (5,   2,   2,  'Tracking', -25,  'success', '3 trackings capturados',           3,   14.1),
        (6,   3,   2,  'Prices',    -1,  'success', '5 SKUs actualizados',              5,   55.3),
        (7,   3,   2,  'Tracking',  -1,  'success', '4 trackings capturados',           4,   11.7),
        (8,   3,   2,  'Invoices',  -1,  'success', '2 faturas descarregadas',          2,   22.4),
        (9,   1,   1,  'Prices',    -2,  'success', '4 SKUs — sem alterações de preço', 0,   39.8),
        (10,  2,   2,  'Invoices', -27,  'success', '1 fatura descarregada',            1,   19.0),
    ]
    for sh_id, sup_id, eid, stype, h_off, status, msg, records, dur in sh_data:
        started = now + timedelta(hours=h_off)
        finished = started + timedelta(seconds=dur)
        db.execute("""
            INSERT INTO sync_history (id, supplier_id, empresa_id, sync_type, started_at,
                                       finished_at, status, message, records_updated, duration_seconds)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, [sh_id, sup_id, eid, stype, _ts(started), _ts(finished), status, msg, records, dur])

    # ────────────────────────────────────────────────────────────────────────
    # 15. PURCHASE_ORDER_ITEMS (linhas das POs)
    # ────────────────────────────────────────────────────────────────────────
    # PO#2 (Ordered, DropDirect): WATCH-S8 x1 → order_id=5
    # PO#3 (Ordered, DropDirect): CAMERA-4K x2 → order_id=1 ; SPEAKER-JBL x3 → order_id=9
    # PO#4 (Paid, TechWholesale): PHONE-X x1 → order_id=15
    # PO#5 (Ordered, MegaSupply): HEADSET-PRO x1 → order_id=4
    poi_data = [
        # id  po  order  sku_mkt          sku_sup     qty  custo   portes  imp  qty_rec  log_status
        (1,   2,  5,  'WATCH-S8',       'W-ES-100',   1, 120.00,  3.33,  0.0,  0.0,   'pending_receipt'),
        (2,   3,  1,  'CAMERA-4K',      'C-ES-200',   2,  80.00,  4.00,  0.0,  2.0,   'received_at_office'),
        (3,   3,  9,  'SPEAKER-JBL',    'S-FR-300',   3,  35.00,  4.00,  0.0,  0.0,   'pending_receipt'),
        (4,   4,  15, 'PHONE-X',        'X-IT-500',   1, 100.00,  5.00,  0.0,  1.0,   'dispatched_to_customer'),
        (5,   5,  4,  'HEADSET-PRO',    'H-FR-500',   1,  65.00,  3.00,  0.0,  0.0,   'pending_receipt'),
    ]
    for poi_id, po_id, order_id, sku_mkt, sku_sup, qty, custo, portes, imp, qty_rec, log_st in poi_data:
        db.execute("""
            INSERT INTO purchase_order_items (id, purchase_order_id, order_id,
                                               sku_marketplace, sku_fornecedor, quantidade,
                                               custo_unitario, portes_rateados, impostos_rateados,
                                               quantidade_recebida, logistics_status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, [poi_id, po_id, order_id, sku_mkt, sku_sup, qty, custo, portes, imp, qty_rec, log_st])

    # Atualizar tracking_number nas POs Ordered/Paid
    db.execute("UPDATE purchase_orders SET tracking_number='DHL2024-98765', tipo_envio='Escritorio' WHERE id=2")
    db.execute("UPDATE purchase_orders SET tracking_number='GLS2024-11223', tipo_envio='Escritorio' WHERE id=3")
    db.execute("UPDATE purchase_orders SET tracking_number='UPS2024-44321', tipo_envio='Escritorio', supplier_order_id='TW-PO-2024-007' WHERE id=4")
    db.execute("UPDATE purchase_orders SET tracking_number='FEDEX2024-5567', tipo_envio='Direto',    supplier_order_id='MS-PO-2024-012' WHERE id=5")

    # ────────────────────────────────────────────────────────────────────────
    # 16. LOGISTICS_EVENTS (receção e expedição no escritório)
    # ────────────────────────────────────────────────────────────────────────
    # PO#3 item CAMERA-4K: recebido no escritório 2 dias após encomenda
    # PO#4 item PHONE-X: recebido E expedido ao cliente (PO Paid)
    le_data = [
        # id  po_id  poi_id  office  event_type               qty  serial              tracking          offset_days
        (1,   3,     2,      1,  'received_at_office',     2.0, None,               'GLS2024-11223',  -33),
        (2,   4,     4,      1,  'received_at_office',     1.0, 'SN-PHONEX-A0042',  'UPS2024-44321',  -48),
        (3,   4,     4,      1,  'dispatched_to_customer', 1.0, 'SN-PHONEX-A0042',  'DHL2024-CUST-99',-45),
    ]
    for le_id, po_id, poi_id, office_id, etype, qty, serial, tracking, offset in le_data:
        db.execute("""
            INSERT INTO logistics_events (id, purchase_order_id, purchase_order_item_id, office_id,
                                           event_type, quantity, serial_number, tracking_number, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, [le_id, po_id, poi_id, office_id, etype, qty, serial, tracking,
              _ts(now + timedelta(days=offset))])

    # ────────────────────────────────────────────────────────────────────────
    # 17. RMA_CLAIMS (Devoluções)
    # ────────────────────────────────────────────────────────────────────────
    # RMA#1: > 7 dias sem nota de crédito → aparece como ALERTA
    # RMA#2: 3 dias → ainda dentro do prazo
    # RMA#3: Claimed_from_Supplier (resolvido)
    # RMA#4: 10 dias sem nota de crédito → ALERTA
    rma_data = [
        # id eid  so_id sup  status                     refund  credit_note  reason                        ext_order   offset
        (1,  2,   2,    3,   'Pending',                199.99,   0.00,  'Produto com defeito',        'PIX-002',  -15),
        (2,  2,   6,    3,   'Pending',                 74.97,   0.00,  'Cliente desistiu da compra', 'PIX-006',   -3),
        (3,  1,   13,   1,   'Claimed_from_Supplier',  299.99, 280.00, 'Produto errado enviado',      'WRT-PT-003',-20),
        (4,  2,   8,    2,   'Pending',                 89.99,   0.00,  'Dano na entrega',            'WRT-ES-001',-10),
    ]
    for rma_id, eid, so_id, sup_id, status, refund, credit, reason, ext_ord, offset in rma_data:
        created = now + timedelta(days=offset)
        db.execute("""
            INSERT INTO rma_claims (id, empresa_id, sales_order_id, supplier_id, status,
                                     refund_customer_value, credit_note_supplier_value,
                                     reason, external_order_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, [rma_id, eid, so_id, sup_id, status,
              refund, credit, reason, ext_ord,
              _ts(created), _ts(created)])

    scrape_dir = _backend / "data" / "temp_scrapes"
    scrape_dir.mkdir(parents=True, exist_ok=True)

    # Supplier 1 (TechWholesale) — PHONE-X subiu de 100€ para 140€
    pd.DataFrame([
        {'sku': 'X-IT-500', 'price': 140.0, 'stock': 'In Stock'},   # subiu! WRT-PT-005 fica negativo
        {'sku': 'T-IT-200', 'price': 155.0, 'stock': 'In Stock'},
        {'sku': 'H-IT-300', 'price':  48.0, 'stock': 'In Stock'},
        {'sku': 'L-IT-100', 'price': 395.0, 'stock': 'Low Stock'},
    ]).to_csv(scrape_dir / "prices_1.csv", index=False)

    # Supplier 3 (MegaSupply) — POWERBANK subiu de 22€ para 28€
    pd.DataFrame([
        {'sku': 'S-FR-300', 'price':  38.0, 'stock': 'In Stock'},
        {'sku': 'P-FR-400', 'price':  28.0, 'stock': 'In Stock'},   # subiu! PIX-006 fica mais negativo
        {'sku': 'H-FR-500', 'price':  68.0, 'stock': 'In Stock'},
    ]).to_csv(scrape_dir / "prices_3.csv", index=False)

    db.commit()
    db.close()

    print("\nSEEDING DEMO concluido com sucesso!")
    print("\n--- Modulos frontend populados ---")
    print("  Recebimentos: 5 ciclos (Pixmania x3 + Worten PT x2)")
    print("       KPIs, Ciclos, Transferencias, Reservas, Comissoes")
    print("  Vendas e Margem: 15 pedidos -- KPIs + Listagens + Sales Explorer")
    print("       4 PEDIDOS COM MARGEM NEGATIVA (linhas vermelhas):")
    print("         PIX-002    CAMERA-4K  x2 ->  -6.51 EUR")
    print("         PIX-006    POWERBANK  x3 ->  -5.02 EUR")
    print("         WRT-ES-002 SPEAKER    x3 -> -20.61 EUR")
    print("         WRT-PT-005 PHONE-X    x1 -> -24.11 EUR")
    print("  Compras: 5 POs + 8 itens pendentes")
    print("       3 itens com ALERTA DE MARGEM (vermelho na Central de Compras)")
    print("  Financas: Aging + Conta Corrente")
    print("       PO#3 DropDirect VENCIDA ha 5 dias")
    print("       PO#5 MegaSupply a vencer em 37 dias")
    print("  Automacao: 10 registos sync (2 empresas, 3 fornecedores)")
    print("       1 erro (DropDirect timeout) + 9 sucesso")
    print("  Bancos: 8 movimentos (3 ciclos, empresa 1 e 2)")
    print("  Robo: prices_1.csv + prices_3.csv em data/temp_scrapes/")
    print("       Sync TechWholesale: PHONE-X 100->140 EUR")
    print("       Sync MegaSupply:    POWERBANK 22->28 EUR")
    print("  RMA/Devolucoes: 4 claims (2 ALERTAS >7 dias, 1 resolvido, 1 recente)")
    print("  Tracking: POs 2/3/4/5 com tracking_number + logistics_events")
    print("\n--- Selecionar no frontend ---")
    print("  Empresa 2 (Teste 123) -> Pixmania  -> 7 pedidos")
    print("  Empresa 2 (Teste 123) -> Worten    -> 3 pedidos")
    print("  Empresa 1 (teste 369)     -> Worten PT -> 5 pedidos")
    print("------------------------------------------")


if __name__ == "__main__":
    seed_demo()
