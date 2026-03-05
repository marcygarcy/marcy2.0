"""
Fase 6 – Validação Manual de Faturas de Fornecedores.

Fluxo:
  Robot → supplier_invoices (status=pendente_validacao)
  Utilizador aprova → supplier_ledger (lançamento Fatura)
  Utilizador contesta → email SMTP + supplier_invoice_comms (status=contestada)
  Utilizador aguarda → status=em_discussao
  Utilizador anula → status=anulada

SMTP: lê de system_settings (BD); fallback para Settings (.env).
"""
from __future__ import annotations

import logging
import smtplib
from datetime import date, datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any, Dict, List, Optional

from app.config.database import get_db_connection
from app.config.settings import get_settings

logger = logging.getLogger(__name__)


# ─── SMTP helpers ────────────────────────────────────────────────────────────

def _get_smtp_config() -> Dict[str, Any]:
    """
    Lê configuração SMTP: primeiro de system_settings (BD), fallback para .env.
    """
    conn = get_db_connection()
    try:
        rows = conn.execute(
            "SELECT key, value FROM system_settings WHERE key LIKE 'smtp_%'"
        ).fetchall()
        db_cfg: Dict[str, str] = {r[0]: r[1] for r in rows if r[1]}
    except Exception:
        db_cfg = {}
    finally:
        conn.close()

    s = get_settings()
    return {
        "host":     db_cfg.get("smtp_host")     or s.smtp_host,
        "port":     int(db_cfg.get("smtp_port") or s.smtp_port or 587),
        "user":     db_cfg.get("smtp_user")     or s.smtp_user,
        "password": db_cfg.get("smtp_password") or s.smtp_password,
        "from":     db_cfg.get("smtp_from")     or s.smtp_from,
    }


def _send_email(to: str, subject: str, body: str) -> None:
    """Envia email via SMTP (stdlib). Levanta excepção se falhar."""
    cfg = _get_smtp_config()
    if not cfg["host"] or not cfg["user"]:
        raise RuntimeError("SMTP não configurado — configure em Configuração Sistema")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = cfg["from"] or cfg["user"]
    msg["To"]      = to
    msg.attach(MIMEText(body, "plain", "utf-8"))

    with smtplib.SMTP(cfg["host"], cfg["port"], timeout=10) as server:
        server.ehlo()
        server.starttls()
        server.login(cfg["user"], cfg["password"])
        server.sendmail(cfg["from"] or cfg["user"], [to], msg.as_string())


def is_smtp_configured() -> bool:
    cfg = _get_smtp_config()
    return bool(cfg["host"] and cfg["user"])


# ─── DB helpers ──────────────────────────────────────────────────────────────

def _next_id(conn, table: str) -> int:
    row = conn.execute(f"SELECT COALESCE(MAX(id), 0) + 1 FROM {table}").fetchone()
    return int(row[0]) if row else 1


def _row_to_dict(row, keys: List[str]) -> Dict[str, Any]:
    return {k: v for k, v in zip(keys, row)}


# ─── Service ─────────────────────────────────────────────────────────────────

class InvoiceValidationService:
    """Gestão de faturas em quarentena para validação manual."""

    # ── Listagem / Stats ──────────────────────────────────────────────────────

    def list_inbox(
        self,
        empresa_id: Optional[int] = None,
        supplier_id: Optional[int] = None,
        status: Optional[str] = None,
        apenas_divergencias: bool = False,
    ) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            conds = []
            params: List[Any] = []
            if empresa_id:
                conds.append("si.empresa_id = ?")
                params.append(empresa_id)
            if supplier_id:
                conds.append("si.supplier_id = ?")
                params.append(supplier_id)
            if status:
                conds.append("si.status = ?")
                params.append(status)
            if apenas_divergencias:
                conds.append("si.flag_divergencia = TRUE")

            where = ("WHERE " + " AND ".join(conds)) if conds else ""
            rows = conn.execute(
                f"""
                SELECT
                    si.id, si.empresa_id, si.supplier_id,
                    s.nome AS supplier_nome,
                    s.email_comercial AS supplier_email,
                    si.purchase_order_id, si.supplier_order_id,
                    si.invoice_ref, si.invoice_date,
                    si.valor_fatura, si.valor_po, si.diferenca, si.flag_divergencia,
                    si.invoice_pdf_url, si.status, si.source,
                    si.aprovado_por, si.aprovado_em, si.nota_aprovacao,
                    si.data_criacao, si.data_atualizacao
                FROM supplier_invoices si
                LEFT JOIN suppliers s ON s.id = si.supplier_id
                {where}
                ORDER BY si.data_criacao DESC
                """,
                params,
            ).fetchall()

            keys = [
                "id", "empresa_id", "supplier_id", "supplier_nome", "supplier_email",
                "purchase_order_id", "supplier_order_id",
                "invoice_ref", "invoice_date",
                "valor_fatura", "valor_po", "diferenca", "flag_divergencia",
                "invoice_pdf_url", "status", "source",
                "aprovado_por", "aprovado_em", "nota_aprovacao",
                "data_criacao", "data_atualizacao",
            ]
            return [_row_to_dict(r, keys) for r in rows]
        finally:
            conn.close()

    def get_stats(self, empresa_id: Optional[int] = None) -> Dict[str, int]:
        """Contagem por estado (para badge na sidebar)."""
        conn = get_db_connection()
        try:
            params: List[Any] = []
            where = ""
            if empresa_id:
                where = "WHERE empresa_id = ?"
                params.append(empresa_id)
            rows = conn.execute(
                f"SELECT status, COUNT(*) FROM supplier_invoices {where} GROUP BY status",
                params,
            ).fetchall()
            result: Dict[str, int] = {
                "pendente_validacao": 0,
                "contestada": 0,
                "em_discussao": 0,
                "aprovada": 0,
                "aprovada_com_nota": 0,
                "anulada": 0,
                "total": 0,
            }
            for (st, cnt) in rows:
                if st in result:
                    result[st] = int(cnt)
                result["total"] = result.get("total", 0) + int(cnt)
            return result
        finally:
            conn.close()

    def get_detail(self, invoice_id: int) -> Optional[Dict[str, Any]]:
        """Detalhe da fatura + info PO."""
        conn = get_db_connection()
        try:
            row = conn.execute(
                """
                SELECT
                    si.id, si.empresa_id, si.supplier_id,
                    s.nome AS supplier_nome, s.email_comercial AS supplier_email,
                    si.purchase_order_id, si.supplier_order_id,
                    si.invoice_ref, si.invoice_date,
                    si.valor_fatura, si.valor_po, si.diferenca, si.flag_divergencia,
                    si.invoice_pdf_url, si.status, si.source,
                    si.aprovado_por, si.aprovado_em, si.nota_aprovacao,
                    si.data_criacao, si.data_atualizacao,
                    'PO#' || CAST(po.id AS VARCHAR) AS po_referencia, po.data_criacao AS po_data,
                    po.total_final AS po_total, po.status AS po_estado
                FROM supplier_invoices si
                LEFT JOIN suppliers s ON s.id = si.supplier_id
                LEFT JOIN purchase_orders po ON po.id = si.purchase_order_id
                WHERE si.id = ?
                """,
                [invoice_id],
            ).fetchone()
            if not row:
                return None
            keys = [
                "id", "empresa_id", "supplier_id", "supplier_nome", "supplier_email",
                "purchase_order_id", "supplier_order_id",
                "invoice_ref", "invoice_date",
                "valor_fatura", "valor_po", "diferenca", "flag_divergencia",
                "invoice_pdf_url", "status", "source",
                "aprovado_por", "aprovado_em", "nota_aprovacao",
                "data_criacao", "data_atualizacao",
                "po_referencia", "po_data", "po_total", "po_estado",
            ]
            return _row_to_dict(row, keys)
        finally:
            conn.close()

    # ── Acções ────────────────────────────────────────────────────────────────

    def _update_status(
        self,
        conn,
        invoice_id: int,
        status: str,
        aprovado_por: Optional[str] = None,
        nota: Optional[str] = None,
    ) -> None:
        conn.execute(
            """
            UPDATE supplier_invoices
            SET status = ?,
                aprovado_por = COALESCE(?, aprovado_por),
                aprovado_em  = CASE WHEN ? IN ('aprovada','aprovada_com_nota') THEN CURRENT_TIMESTAMP ELSE aprovado_em END,
                nota_aprovacao = COALESCE(?, nota_aprovacao),
                data_atualizacao = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            [status, aprovado_por, status, nota, invoice_id],
        )

    def _get_for_action(self, conn, invoice_id: int):
        return conn.execute(
            """
            SELECT id, empresa_id, supplier_id, purchase_order_id,
                   invoice_ref, valor_fatura, supplier_order_id
            FROM supplier_invoices WHERE id = ?
            """,
            [invoice_id],
        ).fetchone()

    def approve(self, invoice_id: int, aprovado_por: str = "utilizador") -> Dict[str, Any]:
        """Aprova a fatura → cria lançamento em supplier_ledger."""
        conn = get_db_connection()
        try:
            row = self._get_for_action(conn, invoice_id)
            if not row:
                raise ValueError(f"Fatura #{invoice_id} não encontrada")
            (_, eid, sid, po_id, inv_ref, valor_fat, _sup_ord) = row

            self._update_status(conn, invoice_id, "aprovada", aprovado_por)
            conn.commit()

            # Criar lançamento na conta corrente (apenas aqui, nunca no robot)
            from app.services.accounting_match_service import AccountingMatchService
            acct = AccountingMatchService()
            try:
                acct.create_ledger_entry(
                    empresa_id=eid,
                    supplier_id=sid,
                    tipo="Fatura",
                    valor_credito=float(valor_fat or 0),
                    documento_ref=inv_ref,
                    purchase_order_id=po_id,
                    notas=f"Aprovado por {aprovado_por}",
                )
            finally:
                acct.close()

            return {"ok": True, "invoice_id": invoice_id, "status": "aprovada"}
        finally:
            conn.close()

    def approve_with_note(
        self, invoice_id: int, nota: str, aprovado_por: str = "utilizador"
    ) -> Dict[str, Any]:
        """Aprova com nota → cria lançamento e guarda nota."""
        conn = get_db_connection()
        try:
            row = self._get_for_action(conn, invoice_id)
            if not row:
                raise ValueError(f"Fatura #{invoice_id} não encontrada")
            (_, eid, sid, po_id, inv_ref, valor_fat, _) = row

            self._update_status(conn, invoice_id, "aprovada_com_nota", aprovado_por, nota)
            conn.commit()

            from app.services.accounting_match_service import AccountingMatchService
            acct = AccountingMatchService()
            try:
                acct.create_ledger_entry(
                    empresa_id=eid,
                    supplier_id=sid,
                    tipo="Fatura",
                    valor_credito=float(valor_fat or 0),
                    documento_ref=inv_ref,
                    purchase_order_id=po_id,
                    notas=f"Aprovado com nota por {aprovado_por}: {nota}",
                )
            finally:
                acct.close()

            return {"ok": True, "invoice_id": invoice_id, "status": "aprovada_com_nota"}
        finally:
            conn.close()

    def set_discussion(self, invoice_id: int) -> Dict[str, Any]:
        """Marca como 'em discussão' (aguardar resposta do fornecedor)."""
        conn = get_db_connection()
        try:
            self._update_status(conn, invoice_id, "em_discussao")
            conn.commit()
            return {"ok": True, "invoice_id": invoice_id, "status": "em_discussao"}
        finally:
            conn.close()

    def annul(self, invoice_id: int, motivo: str = "") -> Dict[str, Any]:
        """Anula a fatura (não cria entrada no ledger)."""
        conn = get_db_connection()
        try:
            self._update_status(conn, invoice_id, "anulada", nota=motivo or "Anulada pelo utilizador")
            conn.commit()
            return {"ok": True, "invoice_id": invoice_id, "status": "anulada"}
        finally:
            conn.close()

    def contest(
        self,
        invoice_id: int,
        email_para: str,
        assunto: str,
        corpo: str,
        enviado_por: str = "utilizador",
    ) -> Dict[str, Any]:
        """
        Contesta a fatura:
        1. Envia email via SMTP (ou levanta erro se não configurado)
        2. Regista em supplier_invoice_comms
        3. Atualiza status → 'contestada'
        """
        email_sent = False
        email_error: Optional[str] = None

        try:
            _send_email(email_para, assunto, corpo)
            email_sent = True
        except Exception as e:
            email_error = str(e)
            logger.warning("contest email erro (invoice #%s): %s", invoice_id, e)

        conn = get_db_connection()
        try:
            # Guardar registo de comunicação
            comm_id = _next_id(conn, "supplier_invoice_comms")
            conn.execute(
                """
                INSERT INTO supplier_invoice_comms
                  (id, invoice_id, tipo, para_email, assunto, corpo, enviado_por)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                [comm_id, invoice_id, "email_contestacao", email_para, assunto, corpo, enviado_por],
            )
            self._update_status(conn, invoice_id, "contestada")
            conn.commit()
        finally:
            conn.close()

        return {
            "ok": True,
            "invoice_id": invoice_id,
            "status": "contestada",
            "email_sent": email_sent,
            "email_error": email_error,
        }

    def add_note(
        self, invoice_id: int, nota: str, utilizador: str = "utilizador"
    ) -> Dict[str, Any]:
        """Adiciona nota interna (não muda estado da fatura)."""
        conn = get_db_connection()
        try:
            comm_id = _next_id(conn, "supplier_invoice_comms")
            conn.execute(
                """
                INSERT INTO supplier_invoice_comms
                  (id, invoice_id, tipo, corpo, enviado_por)
                VALUES (?, ?, ?, ?, ?)
                """,
                [comm_id, invoice_id, "nota_interna", nota, utilizador],
            )
            conn.execute(
                "UPDATE supplier_invoices SET data_atualizacao = CURRENT_TIMESTAMP WHERE id = ?",
                [invoice_id],
            )
            conn.commit()
            return {"ok": True, "comm_id": comm_id}
        finally:
            conn.close()

    def get_comms(self, invoice_id: int) -> List[Dict[str, Any]]:
        """Histórico de comunicações da fatura."""
        conn = get_db_connection()
        try:
            rows = conn.execute(
                """
                SELECT id, invoice_id, data_envio, tipo, para_email, assunto, corpo, enviado_por
                FROM supplier_invoice_comms
                WHERE invoice_id = ?
                ORDER BY data_envio ASC
                """,
                [invoice_id],
            ).fetchall()
            keys = ["id", "invoice_id", "data_envio", "tipo", "para_email", "assunto", "corpo", "enviado_por"]
            return [_row_to_dict(r, keys) for r in rows]
        finally:
            conn.close()

    # ── Fase 7: POs ligadas ───────────────────────────────────────────────────

    def get_linked_pos(self, invoice_id: int) -> List[Dict[str, Any]]:
        """Lista POs ligadas à fatura via supplier_invoice_pos."""
        conn = get_db_connection()
        try:
            rows = conn.execute(
                """
                SELECT po.id, po.status, po.total_final,
                       po.supplier_order_id,
                       s.nome AS supplier_nome,
                       po.data_criacao
                FROM supplier_invoice_pos sip
                JOIN purchase_orders po ON po.id = sip.purchase_order_id
                LEFT JOIN suppliers s ON s.id = po.supplier_id
                WHERE sip.invoice_id = ?
                ORDER BY po.id
                """,
                [invoice_id],
            ).fetchall()
            keys = ["id", "status", "total_final", "supplier_order_id", "supplier_nome", "data_criacao"]
            return [_row_to_dict(r, keys) for r in rows]
        finally:
            conn.close()

    def set_linked_pos(self, invoice_id: int, po_ids: List[int]) -> Dict[str, Any]:
        """Substitui a lista de POs ligadas à fatura e recalcula diferença."""
        conn = get_db_connection()
        try:
            # Remover ligações existentes
            conn.execute("DELETE FROM supplier_invoice_pos WHERE invoice_id = ?", [invoice_id])
            # Inserir novas ligações
            for po_id in po_ids:
                link_id = _next_id(conn, "supplier_invoice_pos")
                conn.execute(
                    "INSERT INTO supplier_invoice_pos (id, invoice_id, purchase_order_id) VALUES (?,?,?)",
                    [link_id, invoice_id, po_id],
                )
            # Recalcular valor_po + diferenca + flag_divergencia
            row = conn.execute(
                "SELECT COALESCE(SUM(total_final), 0) FROM purchase_orders WHERE id IN ({})".format(
                    ",".join("?" * len(po_ids)) if po_ids else "SELECT NULL WHERE FALSE"
                ),
                po_ids if po_ids else [],
            ).fetchone()
            valor_po_total = float(row[0]) if row else 0.0

            inv_row = conn.execute(
                "SELECT COALESCE(valor_fatura, invoice_amount, 0) FROM supplier_invoices WHERE id = ?",
                [invoice_id],
            ).fetchone()
            valor_fat = float(inv_row[0]) if inv_row else 0.0

            diferenca = round(valor_fat - valor_po_total, 2)
            conn.execute(
                """
                UPDATE supplier_invoices
                SET valor_po = ?, diferenca = ?, flag_divergencia = ?,
                    purchase_order_id = ?,
                    data_atualizacao = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                [valor_po_total, diferenca, abs(diferenca) > 0.01,
                 po_ids[0] if po_ids else None, invoice_id],
            )
            conn.commit()
            return {"ok": True, "invoice_id": invoice_id, "valor_po": valor_po_total, "diferenca": diferenca}
        finally:
            conn.close()

    def search_pos(
        self,
        q: Optional[str] = None,
        supplier_id: Optional[int] = None,
        empresa_id: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        """
        Pesquisa POs por PO# (id) ou NE do fornecedor (supplier_order_id).
        Se q for None/vazio, retorna todas as POs abertas do fornecedor (excluindo canceladas/anuladas).
        """
        conn = get_db_connection()
        try:
            conds: List[str] = []
            params: List[Any] = []

            if q and q.strip():
                conds.append("(CAST(po.id AS VARCHAR) LIKE ? OR LOWER(COALESCE(po.supplier_order_id,'')) LIKE ?)")
                pattern = f"%{q.strip().lower()}%"
                params += [f"%{q.strip()}%", pattern]
            else:
                # Sem query → apenas POs não canceladas/anuladas
                conds.append("COALESCE(po.status, '') NOT IN ('cancelada', 'anulada', 'concluida')")

            if supplier_id:
                conds.append("po.supplier_id = ?")
                params.append(supplier_id)
            if empresa_id:
                conds.append("po.empresa_id = ?")
                params.append(empresa_id)

            where = ("WHERE " + " AND ".join(conds)) if conds else ""
            limit = 30 if (q and q.strip()) else 100

            rows = conn.execute(
                f"""
                SELECT po.id, po.status, po.total_final,
                       po.supplier_order_id,
                       s.nome AS supplier_nome,
                       po.data_criacao
                FROM purchase_orders po
                LEFT JOIN suppliers s ON s.id = po.supplier_id
                {where}
                ORDER BY po.id DESC
                LIMIT {limit}
                """,
                params,
            ).fetchall()
            keys = ["id", "status", "total_final", "supplier_order_id", "supplier_nome", "data_criacao"]
            return [_row_to_dict(r, keys) for r in rows]
        finally:
            conn.close()

    # ── Fase 7: actualizar campos da fatura ───────────────────────────────────

    def update_invoice(self, invoice_id: int, fields: Dict[str, Any]) -> Dict[str, Any]:
        """
        Actualiza campos editáveis da fatura (decomposição valor, datas, fornecedor, código).
        Recalcula valor_fatura = valor_base + valor_iva + valor_portes se fornecidos.
        """
        conn = get_db_connection()
        try:
            allowed = {
                "supplier_id", "invoice_ref", "invoice_date", "data_vencimento",
                "valor_base", "valor_iva", "valor_portes",
                "divergence_code", "nota_aprovacao",
            }
            updates: List[str] = []
            params: List[Any] = []
            for k, v in fields.items():
                if k in allowed and v is not None:
                    updates.append(f"{k} = ?")
                    params.append(v)

            # Recalcular valor_fatura e diferenca se componentes foram fornecidos
            if any(k in fields for k in ("valor_base", "valor_iva", "valor_portes")):
                row = conn.execute(
                    "SELECT COALESCE(valor_base,0), COALESCE(valor_iva,0), COALESCE(valor_portes,0), COALESCE(valor_po,0) FROM supplier_invoices WHERE id = ?",
                    [invoice_id],
                ).fetchone()
                base = fields.get("valor_base", float(row[0]) if row else 0)
                iva  = fields.get("valor_iva",  float(row[1]) if row else 0)
                port = fields.get("valor_portes", float(row[2]) if row else 0)
                vpo  = float(row[3]) if row else 0
                total = round((base or 0) + (iva or 0) + (port or 0), 2)
                dif   = round(total - vpo, 2)
                updates += ["valor_fatura = ?", "invoice_amount = ?", "diferenca = ?", "flag_divergencia = ?"]
                params  += [total, total, dif, abs(dif) > 0.01]

            if not updates:
                return {"ok": True, "invoice_id": invoice_id, "changed": 0}

            updates.append("data_atualizacao = CURRENT_TIMESTAMP")
            params.append(invoice_id)
            conn.execute(
                f"UPDATE supplier_invoices SET {', '.join(updates)} WHERE id = ?",
                params,
            )
            conn.commit()
            return {"ok": True, "invoice_id": invoice_id, "changed": len(updates) - 1}
        finally:
            conn.close()

    # ── Fase 7: Notas de Crédito ──────────────────────────────────────────────

    def get_credit_notes(self, invoice_id: int) -> List[Dict[str, Any]]:
        """Lista NCs associadas à fatura."""
        conn = get_db_connection()
        try:
            rows = conn.execute(
                """
                SELECT id, invoice_id, empresa_id, supplier_id,
                       nc_ref, nc_date, valor, notas, aprovada, data_criacao
                FROM supplier_credit_notes
                WHERE invoice_id = ?
                ORDER BY data_criacao
                """,
                [invoice_id],
            ).fetchall()
            keys = ["id", "invoice_id", "empresa_id", "supplier_id",
                    "nc_ref", "nc_date", "valor", "notas", "aprovada", "data_criacao"]
            return [_row_to_dict(r, keys) for r in rows]
        finally:
            conn.close()

    def add_credit_note(
        self,
        invoice_id: int,
        nc_ref: str,
        valor: float,
        nc_date: Optional[str] = None,
        notas: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Adiciona NC à fatura. Recalcula divergência com (valor_fatura - soma_NCs)."""
        conn = get_db_connection()
        try:
            inv = conn.execute(
                "SELECT empresa_id, supplier_id, COALESCE(valor_fatura, invoice_amount, 0), COALESCE(valor_po,0) FROM supplier_invoices WHERE id = ?",
                [invoice_id],
            ).fetchone()
            if not inv:
                raise ValueError(f"Fatura #{invoice_id} não encontrada")
            eid, sid, valor_fat, valor_po = inv[0], inv[1], float(inv[2]), float(inv[3])

            nc_id = _next_id(conn, "supplier_credit_notes")
            conn.execute(
                """
                INSERT INTO supplier_credit_notes
                  (id, invoice_id, empresa_id, supplier_id, nc_ref, nc_date, valor, notas)
                VALUES (?,?,?,?,?,?,?,?)
                """,
                [nc_id, invoice_id, eid, sid, nc_ref, nc_date, valor, notas],
            )
            # Recalcular divergência: (valor_fatura - soma_NCs) vs valor_po
            soma_ncs = conn.execute(
                "SELECT COALESCE(SUM(valor),0) FROM supplier_credit_notes WHERE invoice_id = ?",
                [invoice_id],
            ).fetchone()[0]
            liquido = round(float(valor_fat) - float(soma_ncs), 2)
            diferenca = round(liquido - float(valor_po), 2)
            conn.execute(
                """
                UPDATE supplier_invoices
                SET diferenca = ?, flag_divergencia = ?, data_atualizacao = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                [diferenca, abs(diferenca) > 0.01, invoice_id],
            )
            conn.commit()
            return {"ok": True, "nc_id": nc_id, "liquido": liquido, "diferenca": diferenca}
        finally:
            conn.close()

    def delete_credit_note(self, invoice_id: int, nc_id: int) -> Dict[str, Any]:
        """Remove NC e recalcula divergência."""
        conn = get_db_connection()
        try:
            conn.execute(
                "DELETE FROM supplier_credit_notes WHERE id = ? AND invoice_id = ?",
                [nc_id, invoice_id],
            )
            inv = conn.execute(
                "SELECT COALESCE(valor_fatura, invoice_amount, 0), COALESCE(valor_po,0) FROM supplier_invoices WHERE id = ?",
                [invoice_id],
            ).fetchone()
            if inv:
                soma_ncs = conn.execute(
                    "SELECT COALESCE(SUM(valor),0) FROM supplier_credit_notes WHERE invoice_id = ?",
                    [invoice_id],
                ).fetchone()[0]
                liquido  = round(float(inv[0]) - float(soma_ncs), 2)
                diferenca = round(liquido - float(inv[1]), 2)
                conn.execute(
                    "UPDATE supplier_invoices SET diferenca=?, flag_divergencia=?, data_atualizacao=CURRENT_TIMESTAMP WHERE id=?",
                    [diferenca, abs(diferenca) > 0.01, invoice_id],
                )
            conn.commit()
            return {"ok": True, "nc_id": nc_id}
        finally:
            conn.close()
