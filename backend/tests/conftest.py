"""
Fixtures partilhadas entre todos os módulos de teste.

Estratégia:
- Usar a BD de desenvolvimento real (warehouse.duckdb) mas isolar dados de teste
  com IDs negativos (< 0) e limpar no teardown.
- Nunca alterar dados reais (IDs positivos).
"""
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.config.database import get_db_connection

# IDs de teste (negativos para não colidir com dados reais)
TEST_EMPRESA_ID    = -1
TEST_SUPPLIER_ID   = -1
TEST_PO_ID         = -1
TEST_INVOICE_IDS: list[int] = []


@pytest.fixture(scope="session")
def client():
    return TestClient(app)


@pytest.fixture(scope="session", autouse=True)
def seed_test_supplier():
    """Cria fornecedor de teste (-1) e limpa no fim da sessão."""
    conn = get_db_connection()
    try:
        conn.execute("""
            INSERT OR REPLACE INTO suppliers
              (id, empresa_id, nome, email_comercial, ativo)
            VALUES (-1, -1, 'Fornecedor Teste (pytest)', 'pytest@test.local', TRUE)
        """)
        conn.commit()
    except Exception:
        conn.execute("""
            INSERT INTO suppliers
              (id, empresa_id, nome, email_comercial, ativo)
            SELECT -1, -1, 'Fornecedor Teste (pytest)', 'pytest@test.local', TRUE
            WHERE NOT EXISTS (SELECT 1 FROM suppliers WHERE id = -1)
        """)
        conn.commit()
    finally:
        conn.close()

    yield

    # Teardown: limpar tudo de teste
    conn = get_db_connection()
    try:
        conn.execute("DELETE FROM supplier_invoice_comms WHERE invoice_id < 0")
        conn.execute("DELETE FROM supplier_invoices       WHERE id < 0 OR empresa_id = -1")
        conn.execute("DELETE FROM purchase_orders         WHERE id < 0")
        conn.execute("DELETE FROM suppliers               WHERE id < 0")
        conn.commit()
    finally:
        conn.close()


@pytest.fixture()
def db():
    """Conexão de BD para testes — fecha automaticamente."""
    conn = get_db_connection()
    yield conn
    conn.close()


@pytest.fixture()
def test_invoice(db):
    """
    Cria uma fatura de teste com status='pendente_validacao' e devolve o seu ID.
    Apaga a fatura e comms no teardown.
    """
    inv_id = db.execute("SELECT COALESCE(MIN(id), 0) - 1 FROM supplier_invoices").fetchone()[0]
    if inv_id >= 0:
        inv_id = -1

    db.execute("""
        INSERT INTO supplier_invoices
          (id, empresa_id, supplier_id, invoice_ref,
           invoice_amount, valor_fatura, valor_po, diferenca, flag_divergencia,
           status, source, data_criacao)
        VALUES (?, -1, -1, 'TEST-INV-001',
                120.00, 120.00, 100.00, 20.00, TRUE,
                'pendente_validacao', 'robot', CURRENT_TIMESTAMP)
    """, [inv_id])
    db.commit()

    yield inv_id

    db.execute("DELETE FROM supplier_invoice_comms WHERE invoice_id = ?", [inv_id])
    db.execute("DELETE FROM supplier_invoices WHERE id = ?", [inv_id])
    db.commit()


@pytest.fixture()
def test_invoice_no_divergencia(db):
    """Fatura de teste sem divergência."""
    inv_id = db.execute("SELECT COALESCE(MIN(id), 0) - 1 FROM supplier_invoices").fetchone()[0]
    if inv_id >= 0:
        inv_id = -1

    db.execute("""
        INSERT INTO supplier_invoices
          (id, empresa_id, supplier_id, invoice_ref,
           invoice_amount, valor_fatura, valor_po, diferenca, flag_divergencia,
           status, source, data_criacao)
        VALUES (?, -1, -1, 'TEST-INV-002',
                100.00, 100.00, 100.00, 0.00, FALSE,
                'pendente_validacao', 'robot', CURRENT_TIMESTAMP)
    """, [inv_id])
    db.commit()

    yield inv_id

    db.execute("DELETE FROM supplier_invoice_comms WHERE invoice_id = ?", [inv_id])
    db.execute("DELETE FROM supplier_invoices WHERE id = ?", [inv_id])
    db.commit()
