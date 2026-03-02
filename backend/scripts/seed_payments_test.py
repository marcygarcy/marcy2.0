"""
Seed de dados fake para testar o módulo Pagamentos (Finanças).

- Atualiza fornecedores com prazo_pagamento: Antecipado (supplier 2), 30 dias (supplier 3), 7 dias (supplier 1).
- Insere 5 POs de teste (ids 6–10) com status Ordered, não pagas, com due_date nos próximos 7–14 dias,
  para aparecerem em "Antecipado" (fornecedor Antecipado) e "Sugestão de pagamento" (intervalo de datas).

Recomendação: correr primeiro seed_demo e depois este script.
  cd backend
  python -m scripts.seed_demo
  python -m scripts.seed_payments_test
"""
from __future__ import annotations

import sys
from pathlib import Path
from datetime import datetime, timedelta, date

_backend = Path(__file__).resolve().parent.parent
if str(_backend) not in sys.path:
    sys.path.insert(0, str(_backend))

from app.config.database import get_db_connection, init_database


def _dt(d: date | datetime) -> str:
    if isinstance(d, datetime):
        return d.strftime("%Y-%m-%d")
    return d.strftime("%Y-%m-%d")


def seed_payments_test():
    init_database()
    db = get_db_connection()
    today = date.today()

    print("SEED PAYMENTS TEST -- dados fake para Pagamentos (Antecipado + Sugestão)...")

    # 1. Atualizar fornecedores: prazo e método de pagamento
    try:
        db.execute("UPDATE suppliers SET prazo_pagamento = '7 dias',   metodo_pagamento = 'Transferencia' WHERE id = 1")
        db.execute("UPDATE suppliers SET prazo_pagamento = 'Antecipado', metodo_pagamento = 'Transferencia' WHERE id = 2")
        db.execute("UPDATE suppliers SET prazo_pagamento = '30 dias',  metodo_pagamento = 'Transferencia' WHERE id = 3")
        db.commit()
        print("   OK: Fornecedores atualizados (1=7 dias, 2=Antecipado, 3=30 dias).")
    except Exception as e:
        print(f"   Aviso ao atualizar suppliers: {e}")
        db.rollback()

    # 2. Remover POs de teste anteriores (ids 6–10) para poder re-correr o script
    try:
        db.execute("DELETE FROM supplier_ledger WHERE purchase_order_id >= 6")
        db.execute("DELETE FROM financial_reconciliation WHERE purchase_order_id >= 6")
        db.execute("DELETE FROM purchase_order_items WHERE purchase_order_id >= 6")
        db.execute("DELETE FROM purchase_orders WHERE id >= 6")
        db.commit()
    except Exception as e:
        print(f"   Aviso ao limpar POs 6–10: {e}")
        db.rollback()

    # 3. Inserir 5 POs de teste (Ordered, não pagas, vencimento nos próximos 7–14 dias)
    #    supplier 2 = Antecipado (empresa 2), supplier 3 = 30 dias (empresa 2)
    po_test = [
        # id  empresa  supplier  total    due_offset  invoice_ref     notas
        (6,  2,       2,        450.00,  5,          'FT-TEST-001',  'PO teste Antecipado #1 — DropDirect'),
        (7,  2,       2,        189.50,  7,          'FT-TEST-002',  'PO teste Antecipado #2 — DropDirect'),
        (8,  2,       3,        520.00,  10,         'FT-TEST-003',  'PO teste 30 dias #1 — MegaSupply'),
        (9,  2,       3,        310.00,  12,         'FT-TEST-004',  'PO teste 30 dias #2 — MegaSupply'),
        (10, 1,       1,        275.00,  14,         'FT-TEST-005',  'PO teste 7 dias — TechWholesale'),
    ]
    for po_id, eid, sid, total, due_offset, invoice_ref, notas in po_test:
        due = today + timedelta(days=due_offset)
        data_ord = today - timedelta(days=3)
        base = round(total * 0.92, 2)
        try:
            db.execute("""
                INSERT INTO purchase_orders
                    (id, empresa_id, supplier_id, status, tipo_envio, total_base, portes_totais, impostos, total_final,
                     data_ordered, due_date, invoice_ref, notas)
                VALUES (?, ?, ?, 'Ordered', 'Escritorio', ?, 0, 0, ?, ?, ?, ?, ?)
            """, [po_id, eid, sid, base, total, _dt(data_ord), _dt(due), invoice_ref, notas])
        except Exception as e:
            print(f"   Erro ao inserir PO {po_id}: {e}")
    db.commit()
    print("   OK: 5 POs de teste inseridas (ids 6–10, status Ordered, vencimento 5–14 dias).")

    # 4. Opcional: lançamentos Fatura na conta corrente para as POs 6–10 (para parecer que já têm fatura)
    try:
        r = db.execute("SELECT COALESCE(MAX(id), 0) FROM supplier_ledger").fetchone()
        next_id = (r[0] or 0) + 1
        for po_id, eid, sid, total, _, invoice_ref, _ in po_test:
            data_mov = today - timedelta(days=2)
            db.execute("""
                INSERT INTO supplier_ledger (id, empresa_id, supplier_id, data_movimento, tipo, documento_ref,
                    purchase_order_id, valor_credito, valor_debito, saldo_acumulado, notas)
                VALUES (?, ?, ?, ?, 'Fatura', ?, ?, ?, ?, ?, ?)
            """, [next_id, eid, sid, _dt(data_mov), invoice_ref, po_id, total, 0, total, f"Fatura teste {invoice_ref}"])
            next_id += 1
        db.commit()
        print("   OK: Lançamentos Fatura na conta corrente para POs 6–10.")
    except Exception as e:
        print(f"   Aviso ao inserir ledger (opcional): {e}")
        db.rollback()

    db.close()
    print("Concluido. Em Financas > Pagamentos:")
    print("  - Aba 'Antecipado': devem aparecer POs 6 e 7 (Fornecedor DropDirect ES, prazo Antecipado).")
    print("  - Aba 'Sugestao': defina Data inicio = hoje e Data fim = hoje + 14 dias, Gerar sugestao: POs 6-10.")


if __name__ == "__main__":
    seed_payments_test()
