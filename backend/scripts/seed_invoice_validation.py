"""
Seed de faturas em quarentena para testar "Faturas por Validar" (Finanças Globais).

Cria 4–5 registos em supplier_invoices com status='pendente_validacao':
- Algumas com divergência (valor fatura != valor PO)
- Ligadas a POs existentes ou a POs de teste criadas pelo script

Uso:
  cd backend
  python -m scripts.seed_invoice_validation
"""
from __future__ import annotations

import sys
from pathlib import Path
from datetime import date, timedelta

_backend = Path(__file__).resolve().parent.parent
if str(_backend) not in sys.path:
    sys.path.insert(0, str(_backend))

from app.config.database import get_db_connection, init_database


def seed_invoice_validation():
    init_database()
    conn = get_db_connection()

    print("SEED INVOICE VALIDATION -- faturas para testar 'Faturas por Validar'...")

    # 1. Obter POs existentes (com supplier e empresa) que ainda não tenham supplier_invoices
    pos = conn.execute(
        """
        SELECT po.id, po.empresa_id, po.supplier_id, po.total_final, po.supplier_order_id
        FROM purchase_orders po
        WHERE po.supplier_id IS NOT NULL AND po.empresa_id IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM supplier_invoices si WHERE si.purchase_order_id = po.id)
        ORDER BY po.id
        LIMIT 10
        """
    ).fetchall()

    # Se não houver POs disponíveis, criar 2 POs de teste
    if not pos:
        print("   Nenhuma PO disponível; a criar 2 POs de teste...")
        try:
            max_id = conn.execute("SELECT COALESCE(MAX(id), 0) FROM purchase_orders").fetchone()[0]
            for i in range(1, 3):
                po_id = max_id + i
                conn.execute(
                    """
                    INSERT INTO purchase_orders
                    (id, empresa_id, supplier_id, status, total_final, supplier_order_id, data_criacao)
                    VALUES (?, 1, 1, 'Ordered', ?, ?, CURRENT_TIMESTAMP)
                    """,
                    [po_id, 100.0 + i * 50, f"NE-SEED-{po_id}"],
                )
            conn.commit()
            pos = conn.execute(
                """
                SELECT po.id, po.empresa_id, po.supplier_id, po.total_final, po.supplier_order_id
                FROM purchase_orders po
                WHERE po.id > ?
                ORDER BY po.id
                LIMIT 10
                """,
                [max_id],
            ).fetchall()
        except Exception as e:
            print(f"   Erro ao criar POs: {e}")
            conn.rollback()
            conn.close()
            return

    if not pos:
        print("   Aviso: continua sem POs. A criar faturas sem purchase_order_id (apenas empresa/supplier).")

    # 2. Próximo id em supplier_invoices
    next_id_row = conn.execute("SELECT COALESCE(MAX(id), 0) + 1 FROM supplier_invoices").fetchone()
    next_id = int(next_id_row[0]) if next_id_row else 1

    hoje = date.today()
    # Faturas de teste: (valor_fatura, valor_po, invoice_ref, tem_divergencia)
    faturas = [
        (150.00, 150.00, "FT-SEED-001", False),   # sem divergência
        (289.50, 285.00, "FT-SEED-002", True),   # +4.50
        (99.99, 100.00, "FT-SEED-003", True),    # -0.01
        (520.00, 520.00, "FT-SEED-004", False),
        (310.25, 310.00, "FT-SEED-005", True),   # +0.25
    ]

    created = 0
    for i, (valor_fat, valor_po, inv_ref, tem_div) in enumerate(faturas):
        if i < len(pos):
            po_id, eid, sid, total_po, sup_ord_id = pos[i]
            po_id_use = po_id
            eid_use = eid
            sid_use = sid
            sup_ord_use = sup_ord_id or f"NE-{po_id}"
        else:
            # Sem PO: usar primeira empresa/fornecedor disponível
            first = pos[0] if pos else (None, 1, 1, 100.0, "NE-SEED")
            po_id_use = None
            eid_use = first[1]
            sid_use = first[2]
            sup_ord_use = first[4] or "—"

        diferenca = round(valor_fat - valor_po, 2)
        flag_div = abs(diferenca) > 0.01

        try:
            conn.execute(
                """
                INSERT INTO supplier_invoices
                (id, empresa_id, supplier_id, purchase_order_id, supplier_order_id,
                 invoice_ref, invoice_date, invoice_amount,
                 valor_fatura, valor_po, diferenca, flag_divergencia,
                 invoice_pdf_url, status, source, data_criacao)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                """,
                [
                    next_id,
                    eid_use,
                    sid_use,
                    po_id_use,
                    sup_ord_use,
                    inv_ref,
                    (hoje - timedelta(days=i)).isoformat(),
                    valor_fat,
                    valor_fat,
                    valor_po,
                    diferenca,
                    flag_div,
                    "https://example.com/pdf/fake.pdf" if i % 2 == 0 else None,
                    "pendente_validacao",
                    "seed",
                ],
            )
            next_id += 1
            created += 1
        except Exception as e:
            print(f"   Erro ao inserir fatura {inv_ref}: {e}")
            conn.rollback()
            break

    if created:
        conn.commit()
        print(f"   OK: {created} fatura(s) criada(s) em 'Faturas por Validar'.")
        print("   Abre Finanças Globais -> Faturas por Validar e faz refresh.")
    conn.close()


if __name__ == "__main__":
    seed_invoice_validation()
