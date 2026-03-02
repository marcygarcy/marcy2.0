"""Endpoints da Ficha de Fornecedor (Supplier Master Data), template/import em lote e prepare_draft_purchase."""
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional, List

from app.services.master_data_service import MasterDataService
from app.services.security_service import encrypt_password
from app.services.supplier_scraper import SupplierScraper
from app.api.deps import get_master_data_service
from app.config.database import get_db_connection

router = APIRouter(prefix="/suppliers", tags=["suppliers"])


class SupplierMasterBody(BaseModel):
    """Ficha completa do fornecedor (campos opcionais para criar/atualizar)."""
    empresa_id: int
    nome: str
    codigo: Optional[str] = None
    entidade_id: Optional[int] = None
    designacao_social: Optional[str] = None
    nif_cif: Optional[str] = None
    website_url: Optional[str] = None
    morada: Optional[str] = None
    codigo_postal: Optional[str] = None
    localidade: Optional[str] = None
    pais: Optional[str] = None
    pais_iva: Optional[str] = None
    regime_iva: Optional[str] = None
    taxa_iva_padrao: Optional[float] = None
    tel: Optional[str] = None
    email: Optional[str] = None
    email_comercial: Optional[str] = None
    metodo_pagamento: Optional[str] = None
    iban: Optional[str] = None
    cartao_id: Optional[int] = None
    prazo_pagamento: Optional[str] = None
    default_shipping_type: Optional[str] = None
    tipo_envio: Optional[str] = None
    office_id: Optional[int] = None
    entidade: Optional[int] = None
    lead_time_estimado: Optional[int] = None
    custo_envio_base: Optional[float] = None
    supplier_score: Optional[float] = None
    ativo: Optional[bool] = None
    payment_method_id: Optional[int] = None




@router.get("/")
async def list_suppliers(
    empresa_id: Optional[int] = Query(None),
    limit: int = Query(200, ge=1, le=500),
    service: MasterDataService = Depends(get_master_data_service),
):
    """Lista fornecedores (ficha resumida)."""
    try:
        items = service.list_suppliers(empresa_id=empresa_id, limit=limit)
        return {"items": items}
    finally:
        service.close()


@router.get("/template")
async def get_suppliers_template(
    service: MasterDataService = Depends(get_master_data_service),
):
    """Devolve um ficheiro Excel vazio com os cabeçalhos para importação em lote de fornecedores."""
    try:
        content = service.generate_suppliers_template()
        return Response(
            content=content,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=template_fornecedores.xlsx"},
        )
    finally:
        service.close()


@router.post("/import")
async def import_suppliers_excel(
    file: UploadFile = File(...),
    service: MasterDataService = Depends(get_master_data_service),
):
    """
    Recebe o Excel preenchido, valida entidade único e empresa_id existente, e faz bulk insert.
    """
    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Ficheiro deve ser Excel (.xlsx)")
    try:
        content = await file.read()
        result = service.import_suppliers_excel(content)
        if not result.get("success") and "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        return result
    finally:
        service.close()


@router.get("/offices/")
async def list_office_locations(
    empresa_id: Optional[int] = Query(None),
    service: MasterDataService = Depends(get_master_data_service),
):
    """Lista escritórios (office_locations)."""
    try:
        items = service.list_office_locations(empresa_id=empresa_id)
        return {"items": items}
    finally:
        service.close()


class SupplierAccessBody(BaseModel):
    """Dados de acesso ao site/API do fornecedor (senha encriptada no backend)."""
    url_site: Optional[str] = None
    login_user: Optional[str] = None
    login_password: Optional[str] = None
    api_key: Optional[str] = None
    auto_sync_prices: Optional[bool] = None
    auto_sync_trackings: Optional[bool] = None
    auto_sync_invoices: Optional[bool] = None


@router.get("/{supplier_id}/access")
async def get_supplier_access(
    supplier_id: int,
):
    """Obtém credenciais de acesso do fornecedor (senha nunca devolvida, apenas indicador) e flags Midnight Sync."""
    conn = get_db_connection()
    try:
        row = conn.execute(
            "SELECT id, supplier_id, url_site, login_user, password_encrypted, api_key, last_sync FROM supplier_access WHERE supplier_id = ?",
            [supplier_id],
        ).fetchone()
        if not row:
            return {"has_access": False}
        out = {
            "has_access": True,
            "id": row[0],
            "supplier_id": row[1],
            "url_site": row[2],
            "login_user": row[3],
            "password_set": bool(row[4]),
            "api_key": row[5] if row[5] else None,
            "last_sync": row[6],
        }
        try:
            r2 = conn.execute(
                "SELECT auto_sync_prices, auto_sync_trackings, auto_sync_invoices FROM supplier_access WHERE supplier_id = ?",
                [supplier_id],
            ).fetchone()
            if r2 is not None:
                out["auto_sync_prices"] = bool(r2[0])
                out["auto_sync_trackings"] = bool(r2[1])
                out["auto_sync_invoices"] = bool(r2[2])
        except Exception:
            out["auto_sync_prices"] = False
            out["auto_sync_trackings"] = False
            out["auto_sync_invoices"] = False
        return out
    finally:
        conn.close()


@router.put("/{supplier_id}/access")
async def upsert_supplier_access(
    supplier_id: int,
    body: SupplierAccessBody,
):
    """Cria ou atualiza credenciais de acesso (senha encriptada com chave mestra) e flags Midnight Sync."""
    conn = get_db_connection()
    try:
        existing = conn.execute("SELECT id FROM supplier_access WHERE supplier_id = ?", [supplier_id]).fetchone()
        password_enc = encrypt_password(body.login_password) if body.login_password else None
        ap = body.auto_sync_prices if body.auto_sync_prices is not None else False
        at = body.auto_sync_trackings if body.auto_sync_trackings is not None else False
        ai = body.auto_sync_invoices if body.auto_sync_invoices is not None else False
        if existing:
            if password_enc is not None:
                conn.execute(
                    """UPDATE supplier_access SET url_site = ?, login_user = ?, password_encrypted = ?, api_key = ?,
                       auto_sync_prices = ?, auto_sync_trackings = ?, auto_sync_invoices = ? WHERE supplier_id = ?""",
                    [body.url_site or "", body.login_user or "", password_enc, body.api_key or "", ap, at, ai, supplier_id],
                )
            else:
                conn.execute(
                    """UPDATE supplier_access SET url_site = ?, login_user = ?, api_key = ?,
                       auto_sync_prices = ?, auto_sync_trackings = ?, auto_sync_invoices = ? WHERE supplier_id = ?""",
                    [body.url_site or "", body.login_user or "", body.api_key or "", ap, at, ai, supplier_id],
                )
            conn.commit()
            return {"message": "Acessos atualizados"}
        next_id = conn.execute("SELECT COALESCE(MAX(id), 0) + 1 FROM supplier_access").fetchone()[0]
        conn.execute(
            """INSERT INTO supplier_access (id, supplier_id, url_site, login_user, password_encrypted, api_key,
               auto_sync_prices, auto_sync_trackings, auto_sync_invoices) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            [next_id, supplier_id, body.url_site or "", body.login_user or "", password_enc or "", body.api_key or "", ap, at, ai],
        )
        conn.commit()
        return {"message": "Acessos criados"}
    finally:
        conn.close()


@router.post("/{supplier_id}/sync-profile")
async def sync_supplier_profile(supplier_id: int):
    """Dispara o robô de sincronização: login no site e extração de NIF, morada, nome legal para a ficha."""
    scraper = SupplierScraper()
    try:
        result = scraper.fetch_supplier_profile(supplier_id)
        if not result.get("success") and result.get("error"):
            raise HTTPException(status_code=400, detail=result["error"])
        return result
    finally:
        scraper.close()


@router.get("/{supplier_id}")
async def get_supplier_master(
    supplier_id: int,
    service: MasterDataService = Depends(get_master_data_service),
):
    """Ficha completa do fornecedor (Master Data)."""
    try:
        s = service.get_supplier_master(supplier_id)
        if not s:
            raise HTTPException(status_code=404, detail="Fornecedor não encontrado")
        return s
    finally:
        service.close()


@router.post("/")
async def create_supplier(
    body: SupplierMasterBody,
    service: MasterDataService = Depends(get_master_data_service),
):
    """Cria um fornecedor com dados da ficha mestra."""
    try:
        conn = service.conn
        next_id = conn.execute("SELECT COALESCE(MAX(id), 0) + 1 FROM suppliers").fetchone()[0]
        entidade_val = body.entidade if body.entidade is not None else next_id
        tipo_envio_val = (body.tipo_envio or body.default_shipping_type or "Dropshipping").strip() or "Dropshipping"
        try:
            conn.execute(
                """
                INSERT INTO suppliers (
                    id, empresa_id, nome, codigo, entidade_id, entidade, designacao_social, nif_cif, website_url,
                    morada, codigo_postal, localidade, pais, pais_iva, regime_iva, taxa_iva_padrao,
                    tel, email, email_comercial, metodo_pagamento, iban, cartao_id, prazo_pagamento,
                    default_shipping_type, tipo_envio, office_id, lead_time_estimado, custo_envio_base, supplier_score, ativo, payment_method_id
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    next_id, body.empresa_id, body.nome, body.codigo, body.entidade_id, entidade_val, body.designacao_social,
                    body.nif_cif, body.website_url, body.morada, body.codigo_postal, body.localidade, body.pais,
                    body.pais_iva, body.regime_iva, body.taxa_iva_padrao, body.tel, body.email, body.email_comercial,
                    body.metodo_pagamento, body.iban, body.cartao_id, body.prazo_pagamento, tipo_envio_val, tipo_envio_val, body.office_id,
                    body.lead_time_estimado, body.custo_envio_base, body.supplier_score, body.ativo if body.ativo is not None else True, body.payment_method_id,
                ],
            )
        except Exception:
            conn.execute(
                """
                INSERT INTO suppliers (
                    id, empresa_id, nome, codigo, entidade_id, entidade, designacao_social, nif_cif, website_url,
                    morada, codigo_postal, localidade, pais, pais_iva, regime_iva, taxa_iva_padrao,
                    tel, email, email_comercial, metodo_pagamento, iban, cartao_id, prazo_pagamento,
                    default_shipping_type, tipo_envio, office_id, lead_time_estimado, custo_envio_base, supplier_score, ativo
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    next_id, body.empresa_id, body.nome, body.codigo, body.entidade_id, entidade_val, body.designacao_social,
                    body.nif_cif, body.website_url, body.morada, body.codigo_postal, body.localidade, body.pais,
                    body.pais_iva, body.regime_iva, body.taxa_iva_padrao, body.tel, body.email, body.email_comercial,
                    body.metodo_pagamento, body.iban, body.cartao_id, body.prazo_pagamento, tipo_envio_val, tipo_envio_val, body.office_id,
                    body.lead_time_estimado, body.custo_envio_base, body.supplier_score, body.ativo if body.ativo is not None else True,
                ],
            )
        conn.commit()
        return {"id": next_id, "message": "Fornecedor criado"}
    finally:
        service.close()


@router.put("/{supplier_id}")
async def update_supplier(
    supplier_id: int,
    body: SupplierMasterBody,
    service: MasterDataService = Depends(get_master_data_service),
):
    """Atualiza a ficha do fornecedor."""
    try:
        conn = service.conn
        data = body.model_dump(exclude_unset=True) if hasattr(body, "model_dump") else body.dict(exclude_unset=True)
        if not data:
            return {"message": "Nada a atualizar"}
        # Só atualizar colunas que existem na tabela suppliers
        allowed = {"nome", "codigo", "entidade_id", "entidade", "designacao_social", "nif_cif", "website_url", "morada",
                   "codigo_postal", "localidade", "pais", "pais_iva", "regime_iva", "taxa_iva_padrao", "tel", "email",
                   "email_comercial", "metodo_pagamento", "iban", "cartao_id", "prazo_pagamento", "default_shipping_type",
                   "tipo_envio", "office_id", "lead_time_estimado", "custo_envio_base", "supplier_score", "ativo", "empresa_id", "payment_method_id"}
        data = {k: v for k, v in data.items() if k in allowed}
        if not data:
            return {"message": "Nada a atualizar"}
        sets = ", ".join(f"{k} = ?" for k in data)
        params = list(data.values()) + [supplier_id]
        conn.execute(f"UPDATE suppliers SET {sets} WHERE id = ?", params)
        conn.commit()
        return {"message": "Fornecedor atualizado"}
    finally:
        service.close()


class PrepareDraftBody(BaseModel):
    order_id: int


@router.post("/prepare-draft-purchase")
async def prepare_draft_purchase(
    body: PrepareDraftBody,
    service: MasterDataService = Depends(get_master_data_service),
):
    """
    Dada uma venda (order_id), prepara o rascunho de compra:
    fornecedor via SKU, tipo de envio (Dropshipping/Escritório), morada escritório se aplicável,
    custo total previsto (custo + portes + IVA conforme regime).
    """
    try:
        result = service.prepare_draft_purchase(order_id=body.order_id)
        return result
    finally:
        service.close()
