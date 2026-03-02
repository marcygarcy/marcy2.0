"""
Script de Seeding Total — Ciclo completo: Vendas, Compras, Finanças e Robótica.

Prepara cenário "Robot-Ready":
- TechWholesale (supplier_id=1): CSV de preços em data/temp_scrapes/prices_1.csv
  com preço subido (100€ -> 180€) para testar Alerta de Prejuízo.
- DropDirect (supplier_id=2): fornecedor com acessos para trackings/faturas.

Uso: a partir da raiz do backend:
  python -m scripts.seed_total
Ou:  cd backend && python scripts/seed_total.py
"""
from __future__ import annotations

import os
import sys
from pathlib import Path
from datetime import datetime, timedelta

# Garantir que o backend está no path
_backend = Path(__file__).resolve().parent.parent
if str(_backend) not in sys.path:
    sys.path.insert(0, str(_backend))

import pandas as pd
from app.config.database import get_db_connection, init_database
from app.services.security_service import encrypt_password


def _next_id(conn, table: str) -> int:
    r = conn.execute(f"SELECT COALESCE(MAX(id), 0) + 1 FROM {table}").fetchone()
    return int(r[0]) if r else 1


def seed_complete_system():
    init_database()
    db = get_db_connection()

    print("🚀 A iniciar SEEDING TOTAL (Vendas, Compras, Finanças e Robótica)...")

    # --- 1. LIMPEZA (ordem por dependências) ---
    for table in (
        "sync_history",
        "supplier_ledger",
        "financial_reconciliation",
        "purchase_order_items",
        "purchase_orders",
        "pending_purchase_items",
        "sales_order_items",
        "sales_orders",
        "sku_mapping",
        "supplier_access",
        "suppliers",
        "marketplaces_config",
        "marketplaces",
        "empresas",
    ):
        try:
            db.execute(f"DELETE FROM {table}")
        except Exception as e:
            print(f"  Aviso ao limpar {table}: {e}")

    db.commit()

    today = datetime.now()
    today_ts = today.strftime("%Y-%m-%d %H:%M:%S")
    today_date = today.strftime("%Y-%m-%d")
    old_date = (today - timedelta(days=45)).strftime("%Y-%m-%d")
    order_ts = (today - timedelta(hours=2)).strftime("%Y-%m-%d %H:%M:%S")
    sync_ts = (today - timedelta(hours=1)).strftime("%Y-%m-%d %H:%M:%S")

    # --- 2. EMPRESAS ---
    db.execute("""
        INSERT INTO empresas (id, nome, codigo, ativo)
        VALUES (1, 'Bighub Sales SA', 'BHS', TRUE), (2, 'Teste 123', 'GHS', TRUE)
    """)

    # --- 3. MARKETPLACES (comissões) ---
    db.execute("""
        INSERT INTO marketplaces (id, empresa_id, nome, comissao_percentual, taxa_fixa, ativo)
        VALUES (101, 1, 'Worten PT', 15.0, 0.60, TRUE), (201, 2, 'Amazon ES', 12.0, 0.99, TRUE)
    """)

    # --- 4. SUPPLIERS (TechWholesale = 1, DropDirect = 2) ---
    db.execute("""
        INSERT INTO suppliers (id, empresa_id, nome, designacao_social, nif_cif, pais, default_shipping_type, metodo_pagamento, ativo)
        VALUES
        (1, 1, 'TechWholesale IT', 'TechWholesale Italia S.r.l.', 'IT12345678', 'IT', 'Escritorio', 'Transferencia', TRUE),
        (2, 2, 'DropDirect ES', 'DropDirect España S.L.', 'ESA8887776', 'ES', 'Dropshipping', 'Cartao', TRUE)
    """)

    # --- 5. ACESSOS PARA O ROBÔ (só TechWholesale com URL Mirakl-like para preços) ---
    pw_enc = encrypt_password("senha_secreta_123")
    if not pw_enc:
        pw_enc = "dummy_encrypted"
    db.execute(
        """
        INSERT INTO supplier_access (id, supplier_id, url_site, login_user, password_encrypted, auto_sync_prices, auto_sync_trackings, auto_sync_invoices)
        VALUES (1, 1, 'https://portal.techwholesale.it', 'admin@bighub.com', ?, TRUE, TRUE, TRUE)
        """,
        [pw_enc],
    )
    db.execute(
        """
        INSERT INTO supplier_access (id, supplier_id, url_site, login_user, password_encrypted, auto_sync_prices, auto_sync_trackings, auto_sync_invoices)
        VALUES (2, 2, 'https://portal.dropdirect.es', 'admin@bighub.com', ?, FALSE, TRUE, TRUE)
        """,
        [pw_enc],
    )

    # --- 6. SKU MAPPING (PHONE-X: custo inicial 100€; após robô ler CSV passará a 180€) ---
    db.execute("""
        INSERT INTO sku_mapping (id, empresa_id, sku_marketplace, sku_fornecedor, supplier_id, custo_fornecedor, vat_rate, ativo)
        VALUES (1, 1, 'PHONE-X', 'X-IT-500', 1, 100.00, 23.0, TRUE)
    """)

    # --- 7. VENDA (WRT-888: 200€ na Worten; comissão ~15%+0.60 => net ~169.40) ---
    db.execute(f"""
        INSERT INTO sales_orders (id, empresa_id, external_order_id, marketplace_id, order_date, total_gross, total_commission_fixed, total_commission_percent, total_net_value, status)
        VALUES (10, 1, 'WRT-888', 101, '{order_ts}', 200.00, 0.60, 30.00, 169.40, 'Pending')
    """)
    db.execute("""
        INSERT INTO sales_order_items (id, sales_order_id, sku_marketplace, quantity, unit_price)
        VALUES (100, 10, 'PHONE-X', 1, 200.00)
    """)

    # --- 8. PENDING PURCHASE (item pendente para Central de Compras) ---
    db.execute(f"""
        INSERT INTO pending_purchase_items (id, empresa_id, sales_order_id, sales_order_item_id, sku_marketplace, sku_supplier, supplier_id, quantity, cost_price_base, unit_price_sale, expected_profit, status, data_criacao)
        VALUES (1, 1, 10, 100, 'PHONE-X', 'X-IT-500', 1, 1, 100.00, 200.00, 69.40, 'pending', '{today_ts}')
    """)

    # --- 9. FICHEIRO DE PREÇOS FAKE (o robô lerá este CSV; preço subiu 100€ -> 180€) ---
    scrape_dir = _backend / "data" / "temp_scrapes"
    scrape_dir.mkdir(parents=True, exist_ok=True)
    csv_path = scrape_dir / "prices_1.csv"
    df_precos = pd.DataFrame([
        {"sku": "X-IT-500", "price": 180.00, "stock": "In Stock"},
        {"sku": "OUTRO-SKU", "price": 50.00, "stock": "Out of Stock"},
    ])
    df_precos.to_csv(csv_path, index=False)
    print(f"📁 Ficheiro de preços criado: {csv_path} (preço X-IT-500 = 180€ para teste de Alerta de Prejuízo)")

    # --- 10. SUPPLIER LEDGER (dívida 5000€ antiga para Aging Report) ---
    db.execute(f"""
        INSERT INTO supplier_ledger (id, empresa_id, supplier_id, data_movimento, tipo, valor_credito, valor_debito, saldo_acumulado, notas)
        VALUES (1, 1, 1, '{old_date}', 'Fatura', 5000.00, 0, 5000.00, 'Seed: dívida vencida >30d')
    """)

    # --- 11. HISTÓRICO DE AUTOMAÇÃO (dashboard Status de Automação) ---
    db.execute(f"""
        INSERT INTO sync_history (id, supplier_id, empresa_id, sync_type, started_at, finished_at, status, message, records_updated, duration_seconds)
        VALUES (1, 1, 1, 'Prices', '{sync_ts}', '{sync_ts}', 'success', '120 SKUs atualizados', 120, 45.0)
    """)

    db.commit()
    db.close()

    print("✅ SEEDING CONCLUÍDO com sucesso!")
    print("")
    print("Próximos passos:")
    print("  A) Módulo Vendas: ver venda WRT-888 e Lucro Previsto (verde com custo 100€).")
    print("  B) Central de Compras: item pendente PHONE-X no fornecedor TechWholesale IT.")
    print("  C) Status de Automação: executar sync (robô lê data/temp_scrapes/prices_1.csv) -> custo passa a 180€ -> Alerta de Prejuízo.")
    print("  D) Finanças: Aging com 5000€ em 'Vencido > 30 dias'.")


if __name__ == "__main__":
    seed_complete_system()
