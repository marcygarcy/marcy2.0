"""Endpoints de Configuração: Tabela de IVA OSS, Mapping Cross-SKU e SMTP."""
import smtplib
from email.mime.text import MIMEText
from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from app.config.database import get_db_connection
from app.config.settings import get_settings

router = APIRouter(prefix="/config", tags=["config"])


# ─── Tax OSS Matrix ──────────────────────────────────────────────────────────

class TaxMatrixUpdate(BaseModel):
    standard_rate: float
    reduced_rate: Optional[float] = None
    reduced_rate_2: Optional[float] = None
    super_reduced_rate: Optional[float] = None
    country_name: Optional[str] = None


@router.get("/tax-matrix")
def list_tax_matrix(only_eu: Optional[bool] = Query(None)):
    """Lista todos os países com as suas taxas de IVA. Filtra por is_eu se indicado."""
    conn = get_db_connection()
    try:
        where = ""
        params: list = []
        if only_eu is not None:
            where = "WHERE is_eu = ?"
            params.append(only_eu)
        rows = conn.execute(
            f"SELECT id, country_code, country_name, standard_rate, reduced_rate, reduced_rate_2, super_reduced_rate, is_eu, updated_at "
            f"FROM tax_oss_matrix {where} ORDER BY is_eu DESC, country_name ASC",
            params,
        ).fetchall()
        cols = ["id", "country_code", "country_name", "standard_rate", "reduced_rate", "reduced_rate_2", "super_reduced_rate", "is_eu", "updated_at"]
        return {"items": [dict(zip(cols, r)) for r in rows]}
    finally:
        conn.close()


@router.put("/tax-matrix/{country_code}")
def update_tax_matrix(country_code: str, body: TaxMatrixUpdate):
    """Atualiza as taxas de IVA de um país."""
    conn = get_db_connection()
    try:
        cc = country_code.upper()
        existing = conn.execute("SELECT id FROM tax_oss_matrix WHERE country_code = ?", [cc]).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail=f"País '{cc}' não encontrado")
        conn.execute(
            """UPDATE tax_oss_matrix
               SET standard_rate = ?, reduced_rate = ?, reduced_rate_2 = ?, super_reduced_rate = ?, updated_at = CURRENT_TIMESTAMP
               WHERE country_code = ?""",
            [body.standard_rate, body.reduced_rate, body.reduced_rate_2, body.super_reduced_rate, cc],
        )
        conn.commit()
        return {"message": f"Taxas de {cc} atualizadas"}
    finally:
        conn.close()


# ─── SKU Bridge ───────────────────────────────────────────────────────────────

class SkuBridgeBody(BaseModel):
    empresa_id: Optional[int] = None
    sku_global: str
    descricao: Optional[str] = None
    ean: Optional[str] = None
    asin: Optional[str] = None
    ref_fornecedor_1: Optional[str] = None
    ref_fornecedor_2: Optional[str] = None
    marketplace: Optional[str] = None


@router.get("/sku-bridge")
def list_sku_bridge(
    empresa_id: Optional[int] = Query(None),
    q: Optional[str] = Query(None, description="Pesquisa em sku_global, ean, asin"),
    limit: int = Query(200, ge=1, le=1000),
    offset: int = Query(0, ge=0),
):
    """Lista mapeamentos de SKU com filtros."""
    conn = get_db_connection()
    try:
        conds = []
        params: list = []
        if empresa_id is not None:
            conds.append("empresa_id = ?")
            params.append(empresa_id)
        if q:
            conds.append("(sku_global ILIKE ? OR ean ILIKE ? OR asin ILIKE ? OR ref_fornecedor_1 ILIKE ? OR descricao ILIKE ?)")
            like = f"%{q}%"
            params.extend([like, like, like, like, like])
        where = f"WHERE {' AND '.join(conds)}" if conds else ""
        total = conn.execute(f"SELECT COUNT(*) FROM master_sku_bridge {where}", params).fetchone()[0]
        rows = conn.execute(
            f"SELECT id, empresa_id, sku_global, descricao, ean, asin, ref_fornecedor_1, ref_fornecedor_2, marketplace, created_at "
            f"FROM master_sku_bridge {where} ORDER BY sku_global ASC LIMIT ? OFFSET ?",
            params + [limit, offset],
        ).fetchall()
        cols = ["id", "empresa_id", "sku_global", "descricao", "ean", "asin", "ref_fornecedor_1", "ref_fornecedor_2", "marketplace", "created_at"]
        return {"items": [dict(zip(cols, r)) for r in rows], "total": int(total)}
    finally:
        conn.close()


@router.post("/sku-bridge")
def create_sku_bridge(body: SkuBridgeBody):
    """Cria um novo mapeamento de SKU."""
    conn = get_db_connection()
    try:
        if not body.sku_global.strip():
            raise HTTPException(status_code=400, detail="sku_global é obrigatório")
        next_id = conn.execute("SELECT COALESCE(MAX(id), 0) + 1 FROM master_sku_bridge").fetchone()[0]
        conn.execute(
            """INSERT INTO master_sku_bridge
               (id, empresa_id, sku_global, descricao, ean, asin, ref_fornecedor_1, ref_fornecedor_2, marketplace)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            [next_id, body.empresa_id, body.sku_global.strip(), body.descricao,
             body.ean, body.asin, body.ref_fornecedor_1, body.ref_fornecedor_2, body.marketplace],
        )
        conn.commit()
        return {"id": next_id, "message": "Mapeamento criado"}
    finally:
        conn.close()


@router.put("/sku-bridge/{item_id}")
def update_sku_bridge(item_id: int, body: SkuBridgeBody):
    """Atualiza um mapeamento de SKU."""
    conn = get_db_connection()
    try:
        existing = conn.execute("SELECT id FROM master_sku_bridge WHERE id = ?", [item_id]).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Mapeamento não encontrado")
        if not body.sku_global.strip():
            raise HTTPException(status_code=400, detail="sku_global é obrigatório")
        conn.execute(
            """UPDATE master_sku_bridge SET
               empresa_id = ?, sku_global = ?, descricao = ?, ean = ?,
               asin = ?, ref_fornecedor_1 = ?, ref_fornecedor_2 = ?, marketplace = ?
               WHERE id = ?""",
            [body.empresa_id, body.sku_global.strip(), body.descricao, body.ean,
             body.asin, body.ref_fornecedor_1, body.ref_fornecedor_2, body.marketplace, item_id],
        )
        conn.commit()
        return {"message": "Mapeamento atualizado"}
    finally:
        conn.close()


@router.delete("/sku-bridge/{item_id}")
def delete_sku_bridge(item_id: int):
    """Elimina um mapeamento de SKU."""
    conn = get_db_connection()
    try:
        existing = conn.execute("SELECT id FROM master_sku_bridge WHERE id = ?", [item_id]).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Mapeamento não encontrado")
        conn.execute("DELETE FROM master_sku_bridge WHERE id = ?", [item_id])
        conn.commit()
        return {"message": "Mapeamento eliminado"}
    finally:
        conn.close()


# ─── SMTP Configuration ──────────────────────────────────────────────────────

_SMTP_KEYS = ["smtp_host", "smtp_port", "smtp_user", "smtp_password", "smtp_from"]


class SmtpConfigBody(BaseModel):
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: Optional[str] = None   # None = não alterar a password guardada
    smtp_from: str = ""


class SmtpTestBody(BaseModel):
    test_email: str


def _read_smtp_from_db(conn) -> dict:
    rows = conn.execute(
        "SELECT key, value FROM system_settings WHERE key LIKE 'smtp_%'"
    ).fetchall()
    return {r[0]: r[1] for r in rows if r[1]}


@router.get("/smtp")
def get_smtp():
    """Lê configuração SMTP (sem devolver a password — apenas indica se está definida)."""
    s = get_settings()
    conn = get_db_connection()
    try:
        db_cfg = _read_smtp_from_db(conn)
    finally:
        conn.close()

    return {
        "smtp_host": db_cfg.get("smtp_host") or s.smtp_host,
        "smtp_port": int(db_cfg.get("smtp_port") or s.smtp_port or 587),
        "smtp_user": db_cfg.get("smtp_user") or s.smtp_user,
        "smtp_from": db_cfg.get("smtp_from") or s.smtp_from,
        "smtp_password_set": bool(db_cfg.get("smtp_password") or s.smtp_password),
    }


@router.post("/smtp")
def save_smtp(body: SmtpConfigBody):
    """Grava configuração SMTP em system_settings."""
    conn = get_db_connection()
    try:
        updates = {
            "smtp_host": body.smtp_host,
            "smtp_port": str(body.smtp_port),
            "smtp_user": body.smtp_user,
            "smtp_from": body.smtp_from,
        }
        if body.smtp_password is not None:
            updates["smtp_password"] = body.smtp_password

        for key, value in updates.items():
            existing = conn.execute(
                "SELECT key FROM system_settings WHERE key = ?", [key]
            ).fetchone()
            if existing:
                conn.execute(
                    "UPDATE system_settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?",
                    [value, key],
                )
            else:
                conn.execute(
                    "INSERT INTO system_settings (key, value) VALUES (?, ?)",
                    [key, value],
                )
        conn.commit()
        return {"ok": True, "message": "Configuração SMTP guardada"}
    finally:
        conn.close()


@router.post("/smtp/test")
def test_smtp(body: SmtpTestBody):
    """Envia email de teste para o endereço indicado."""
    s = get_settings()
    conn = get_db_connection()
    try:
        db_cfg = _read_smtp_from_db(conn)
    finally:
        conn.close()

    host     = db_cfg.get("smtp_host") or s.smtp_host
    port     = int(db_cfg.get("smtp_port") or s.smtp_port or 587)
    user     = db_cfg.get("smtp_user") or s.smtp_user
    password = db_cfg.get("smtp_password") or s.smtp_password
    from_    = db_cfg.get("smtp_from") or s.smtp_from or user

    if not host or not user:
        return {"success": False, "error": "SMTP não configurado — preencha Host e Utilizador"}

    try:
        msg = MIMEText("Teste de ligação SMTP do ERP Hub Sales. Se recebeu este email, a configuração está correcta.", "plain", "utf-8")
        msg["Subject"] = "Teste SMTP — ERP Hub Sales"
        msg["From"]    = from_
        msg["To"]      = body.test_email
        with smtplib.SMTP(host, port, timeout=10) as srv:
            srv.ehlo()
            srv.starttls()
            srv.login(user, password)
            srv.sendmail(from_, [body.test_email], msg.as_string())
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}
