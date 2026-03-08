"""Serviço Gestão de Terceiros: GT (Grupos de Terceiro) e Movimentos / Contabilidade."""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from app.config.database import get_db_connection


def _next_id(conn, table: str) -> int:
    row = conn.execute("SELECT COALESCE(MAX(id), 0) + 1 FROM " + table).fetchone()
    return int(row[0]) if row else 1


class TerceirosService:
    def __init__(self):
        self.conn = get_db_connection()

    def close(self):
        try:
            if self.conn:
                self.conn.close()
        except Exception:
            pass

    def list_grupos(self, empresa_id: Optional[int] = None) -> List[Dict[str, Any]]:
        """Lista grupos de terceiro (GT)."""
        if empresa_id is not None:
            rows = self.conn.execute(
                "SELECT id, empresa_id, codigo, nome, ativo FROM gt_grupos WHERE (empresa_id = ? OR empresa_id IS NULL) AND ativo = TRUE ORDER BY nome",
                [empresa_id],
            ).fetchall()
        else:
            rows = self.conn.execute(
                "SELECT id, empresa_id, codigo, nome, ativo FROM gt_grupos WHERE ativo = TRUE ORDER BY nome",
            ).fetchall()
        return [
            {"id": r[0], "empresa_id": r[1], "codigo": r[2], "nome": r[3], "ativo": bool(r[4])}
            for r in rows
        ]

    def create_movimentos(
        self,
        empresa_id: Optional[int],
        linhas: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """Insere múltiplos movimentos GT."""
        created = 0
        for lin in linhas:
            data_mov = lin.get("data") or ""
            grupo_terceiro = (lin.get("grupo_terceiro") or "").strip()
            try:
                valor = float(lin.get("valor") or 0)
            except (TypeError, ValueError):
                valor = 0
            conta_contabilidade = (lin.get("conta_contabilidade") or "").strip()
            descricao = (lin.get("descricao") or "").strip()
            if not data_mov:
                continue
            mov_id = _next_id(self.conn, "gt_movimentos")
            self.conn.execute(
                """
                INSERT INTO gt_movimentos (id, empresa_id, grupo_id, data_mov, grupo_terceiro, valor, conta_contabilidade, descricao)
                VALUES (?, ?, NULL, ?, ?, ?, ?, ?)
                """,
                [mov_id, empresa_id, data_mov, grupo_terceiro, valor, conta_contabilidade, descricao],
            )
            created += 1
        self.conn.commit()
        return {"created": created}

    def list_movimentos(
        self,
        empresa_id: Optional[int] = None,
        limit: int = 200,
        offset: int = 0,
    ) -> tuple:
        """Lista movimentos GT com paginação."""
        where = "1=1"
        params: list = []
        if empresa_id is not None:
            where += " AND (empresa_id = ? OR empresa_id IS NULL)"
            params.append(empresa_id)
        total = self.conn.execute(
            "SELECT COUNT(*) FROM gt_movimentos WHERE " + where,
            params,
        ).fetchone()[0]
        rows = self.conn.execute(
            "SELECT id, empresa_id, grupo_id, data_mov, grupo_terceiro, valor, conta_contabilidade, descricao, data_criacao FROM gt_movimentos WHERE "
            + where
            + " ORDER BY data_mov DESC, id DESC LIMIT ? OFFSET ?",
            params + [limit, offset],
        ).fetchall()
        items = [
            {
                "id": r[0],
                "empresa_id": r[1],
                "grupo_id": r[2],
                "data_mov": str(r[3])[:10] if r[3] else None,
                "grupo_terceiro": r[4],
                "valor": float(r[5] or 0),
                "conta_contabilidade": r[6],
                "descricao": r[7],
                "data_criacao": str(r[8])[:19] if r[8] else None,
            }
            for r in rows
        ]
        return items, int(total)
