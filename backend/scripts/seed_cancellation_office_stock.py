"""
Seed de dados fake para testar Cancelamento de Venda + Stock em Escritório.

- Atualiza purchase_order_items com sales_order_item_id (a partir de orders) para permitir
  o fluxo de cancelamento criar office_stock a partir dos itens no escritório.
- Insere 1 RMA com disposition=stock_we_keep e 2 linhas em office_stock para a vista
  "Stock Escritório" mostrar dados sem precisar de cancelar uma venda primeiro.
- Opcional: marca a sales_order 3 como Cancelled e insere uma Nota de Crédito (billing_document)
  para ter um exemplo completo.

Recomendação: correr depois de seed_demo (e opcionalmente seed_payments_test).
  cd backend
  python -m scripts.seed_demo
  python -m scripts.seed_cancellation_office_stock
"""
from __future__ import annotations

import sys
from pathlib import Path
from datetime import datetime, date

_backend = Path(__file__).resolve().parent.parent
if str(_backend) not in sys.path:
    sys.path.insert(0, str(_backend))

from app.config.database import get_db_connection, init_database


def _dt(d: date | datetime) -> str:
    if isinstance(d, datetime):
        return d.strftime("%Y-%m-%d %H:%M:%S")
    return d.strftime("%Y-%m-%d")


def seed_cancellation_office_stock():
    init_database()
    db = get_db_connection()
    now = datetime.now()

    print("SEED CANCELLATION / OFFICE STOCK -- dados fake para cancelamento e stock escritorio...")

    # 1. Atualizar purchase_order_items: preencher sales_order_item_id a partir de orders
    try:
        rows = db.execute("SELECT id, order_id FROM purchase_order_items WHERE sales_order_item_id IS NULL").fetchall()
        for (poi_id, order_id) in rows:
            o = db.execute(
                "SELECT sales_order_item_id FROM orders WHERE id = ?",
                [order_id],
            ).fetchone()
            if o and o[0] is not None:
                db.execute(
                    "UPDATE purchase_order_items SET sales_order_item_id = ? WHERE id = ?",
                    [o[0], poi_id],
                )
        db.commit()
        print("   OK: purchase_order_items.sales_order_item_id preenchido a partir de orders.")
    except Exception as e:
        print(f"   Aviso ao atualizar POI: {e}")
        db.rollback()

    # 2. Inserir 1 RMA e 2 linhas em office_stock (empresa 2, SKUs existentes)
    try:
        r = db.execute("SELECT COALESCE(MAX(id), 0) FROM rma_claims").fetchone()
        rma_id = (r[0] or 0) + 1
        db.execute("""
            INSERT INTO rma_claims (id, empresa_id, sales_order_id, sales_order_item_id, supplier_id,
                status, refund_customer_value, credit_note_supplier_value, reason,
                disposition, supplier_accepts_return, created_at, updated_at, external_order_id)
            VALUES (?, 2, 3, 3, 2, 'Pending', 199.99, 0, 'Cliente cancelou; fornecedor nao aceita devolucao',
                'stock_we_keep', 0, ?, ?, 'PIX-003')
        """, [rma_id, _dt(now), _dt(now)])
        db.commit()

        r2 = db.execute("SELECT COALESCE(MAX(id), 0) FROM office_stock").fetchone()
        os_id = (r2[0] or 0) + 1
        # office_stock: origem venda 3, item CAMERA-4K (poi id=2 tem received_at_office)
        db.execute("""
            INSERT INTO office_stock (id, empresa_id, office_id, sku_marketplace, sku_fornecedor, quantity,
                source_type, source_sales_order_id, source_sales_order_item_id, source_purchase_order_id, source_purchase_order_item_id,
                status, condition, received_at, rma_claim_id, created_at)
            VALUES (?, 2, 1, 'CAMERA-4K', 'C-ES-200', 2, 'cancelled_order', 3, 3, 3, 2, 'available', 'new', ?, ?, ?)
        """, [os_id, _dt(now), rma_id, _dt(now)])
        db.execute("""
            INSERT INTO office_stock (id, empresa_id, office_id, sku_marketplace, sku_fornecedor, quantity,
                source_type, source_sales_order_id, source_sales_order_item_id, source_purchase_order_id, source_purchase_order_item_id,
                status, condition, received_at, rma_claim_id, created_at)
            VALUES (?, 2, 1, 'SPEAKER-JBL', 'S-FR-300', 1, 'cancelled_order', 9, 9, 3, 3, 'available', 'new', ?, ?, ?)
        """, [os_id + 1, _dt(now), rma_id, _dt(now)])
        db.commit()
        print("   OK: 1 RMA (stock_we_keep) e 2 linhas office_stock inseridas (SKU CAMERA-4K e SPEAKER-JBL).")
    except Exception as e:
        print(f"   Erro ao inserir RMA/office_stock: {e}")
        db.rollback()

    # 3. Opcional: marcar sales_order 3 como Cancelled e criar Nota de Crédito ao cliente
    try:
        db.execute(
            "UPDATE sales_orders SET status = 'Cancelled', cancelled_at = ?, cancelled_reason = ? WHERE id = 3",
            [_dt(now), "Cliente cancelou (exemplo seed)"],
        )
        # Série e documento NC para empresa 2
        year = now.year
        sr = db.execute(
            "SELECT id, last_sequence FROM billing_series WHERE empresa_id = 2 AND doc_type = 'NotaCreditoCliente' AND year = ?",
            [year],
        ).fetchone()
        if sr:
            seq = int(sr[1] or 0) + 1
            db.execute("UPDATE billing_series SET last_sequence = ? WHERE id = ?", [seq, sr[0]])
            doc_num = f"NC-{year}-{seq:05d}"
        else:
            sid = db.execute("SELECT COALESCE(MAX(id), 0) + 1 FROM billing_series").fetchone()[0]
            db.execute(
                "INSERT INTO billing_series (id, empresa_id, doc_type, prefix, year, last_sequence) VALUES (?, 2, 'NotaCreditoCliente', 'NC', ?, 1)",
                [sid, year],
            )
            doc_num = f"NC-{year}-00001"
        bid = db.execute("SELECT COALESCE(MAX(id), 0) + 1 FROM billing_documents").fetchone()[0]
        so = db.execute("SELECT total_gross, total_net_value, total_commission_fixed, total_commission_percent FROM sales_orders WHERE id = 3").fetchone()
        total_net = float(so[1] or 0) if so else 0
        total_vat = 0.0  # simplificado
        total_gross = float(so[0] or 0) if so else 0
        db.execute("""
            INSERT INTO billing_documents (id, empresa_id, sales_order_id, doc_type, document_number, status,
                total_gross, total_net, total_vat, customer_country)
            VALUES (?, 2, 3, 'NotaCreditoCliente', ?, 'issued', ?, ?, ?, 'PT')
        """, [bid, doc_num, total_gross, total_net, total_vat])
        db.commit()
        print("   OK: sales_order 3 marcada como Cancelled e Nota de Credito emitida (exemplo).")
    except Exception as e:
        print(f"   Aviso ao cancelar SO 3 / criar NC: {e}")
        db.rollback()

    db.close()
    print("Concluido. Pode testar: Vendas > Explorer (cancelar outra venda) e Stock Escritorio (ver as 2 linhas).")


if __name__ == "__main__":
    seed_cancellation_office_stock()
