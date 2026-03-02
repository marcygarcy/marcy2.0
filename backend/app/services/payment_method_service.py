"""Serviço para meios de pagamento (Cartão, Banco, PayPal) por empresa."""
from typing import Dict, List, Optional
from app.config.database import get_db_connection


class PaymentMethodService:
    def __init__(self):
        self.conn = get_db_connection()

    def list_by_empresa(self, empresa_id: int) -> List[Dict]:
        rows = self.conn.execute("""
            SELECT id, empresa_id, metodo_tipo, designacao, referencia_last_4, ativo, data_criacao
            FROM payment_methods
            WHERE empresa_id = ? AND (ativo IS NULL OR ativo = TRUE)
            ORDER BY designacao
        """, [empresa_id]).fetchall()
        cols = ["id", "empresa_id", "metodo_tipo", "designacao", "referencia_last_4", "ativo", "data_criacao"]
        return [dict(zip(cols, row)) for row in rows]

    def get(self, method_id: int) -> Optional[Dict]:
        row = self.conn.execute("""
            SELECT id, empresa_id, metodo_tipo, designacao, referencia_last_4, ativo, data_criacao
            FROM payment_methods WHERE id = ?
        """, [method_id]).fetchone()
        if not row:
            return None
        cols = ["id", "empresa_id", "metodo_tipo", "designacao", "referencia_last_4", "ativo", "data_criacao"]
        return dict(zip(cols, row))

    def create(self, empresa_id: int, metodo_tipo: str, designacao: str, referencia_last_4: Optional[str] = None) -> Dict:
        next_id = self.conn.execute("SELECT COALESCE(MAX(id), 0) + 1 FROM payment_methods").fetchone()[0]
        self.conn.execute("""
            INSERT INTO payment_methods (id, empresa_id, metodo_tipo, designacao, referencia_last_4, ativo)
            VALUES (?, ?, ?, ?, ?, TRUE)
        """, [next_id, empresa_id, metodo_tipo, designacao, referencia_last_4])
        self.conn.commit()
        out = self.get(int(next_id))
        return out or {}

    def close(self):
        if self.conn:
            self.conn.close()
