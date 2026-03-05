"""Endpoints FastAPI — Módulo de Faturação AT-compliant (Portugal)."""
from __future__ import annotations

from datetime import date
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel

from app.services.at_invoice_service import ATInvoiceService
from app.services.saft_pt_exporter import SAFTPTExporter

router = APIRouter(prefix="/at-invoices", tags=["Faturação AT"])

_svc = ATInvoiceService()
_saft = SAFTPTExporter()


# ── Pydantic models ─────────────────────────────────────────────────────────

class ClienteBody(BaseModel):
    nome: Optional[str] = None
    nif: Optional[str] = None
    pais: str = "PT"
    morada: Optional[str] = None


class LinhaBody(BaseModel):
    descricao: str
    quantidade: float = 1.0
    preco_unitario: float
    taxa_iva: float = 23.0


class EmitirDocumentoBody(BaseModel):
    empresa_id: int
    tipo_doc: str                 # FT | FS | NC | ND | RC
    cliente: ClienteBody
    linhas: List[LinhaBody]
    referencia_doc: Optional[str] = None
    metodo_pagamento: Optional[str] = None
    notas: Optional[str] = None


class CancelBody(BaseModel):
    motivo: str


class EnsureSeriesBody(BaseModel):
    empresa_id: int
    tipo_doc: str
    ano: Optional[int] = None


class UpdateAtcudBody(BaseModel):
    codigo_validacao: str


class GenerateRsaBody(BaseModel):
    empresa_id: int


class SAFTExportBody(BaseModel):
    empresa_id: int
    data_inicio: date
    data_fim: date


# ── Documentos ──────────────────────────────────────────────────────────────

@router.get("/")
def list_documents(
    empresa_id: int = Query(...),
    tipo_doc: Optional[str] = Query(None),
    data_inicio: Optional[str] = Query(None),
    data_fim: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """Lista documentos AT com filtros e paginação."""
    return _svc.list_documents(
        empresa_id=empresa_id,
        tipo_doc=tipo_doc,
        data_inicio=data_inicio,
        data_fim=data_fim,
        status=status,
        limit=limit,
        offset=offset,
    )


@router.post("/emit")
def emit_document(body: EmitirDocumentoBody):
    """Emite documento AT-compliant. Gera hash RSA, ATCUD, QR Code e PDF."""
    try:
        doc = _svc.emit_document(
            empresa_id=body.empresa_id,
            tipo_doc=body.tipo_doc,
            cliente=body.cliente.model_dump(),
            linhas=[l.model_dump() for l in body.linhas],
            referencia_doc=body.referencia_doc,
            metodo_pagamento=body.metodo_pagamento,
            notas=body.notas,
        )
        return doc
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao emitir documento: {e}")


@router.get("/{doc_id}")
def get_document(doc_id: int):
    """Detalhe completo do documento (inclui qrcode_b64 para preview)."""
    try:
        return _svc.get_document_detail(doc_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/{doc_id}/pdf")
def get_pdf(doc_id: int):
    """Download do PDF do documento."""
    try:
        pdf_bytes = _svc.get_pdf_bytes(doc_id)
        doc = _svc.get_document_detail(doc_id)
        filename = f"{doc.get('numero_documento', str(doc_id)).replace('/', '_')}.pdf"
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'inline; filename="{filename}"'},
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ImportError as e:
        raise HTTPException(status_code=503, detail=f"Dependência em falta: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao gerar PDF: {e}")


@router.post("/{doc_id}/cancel")
def cancel_document(doc_id: int, body: CancelBody):
    """Cancela documento AT. Muda status para 'anulado' (não elimina)."""
    try:
        return _svc.cancel_document(doc_id, body.motivo)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Séries ──────────────────────────────────────────────────────────────────

@router.get("/series/list")
def list_series(empresa_id: int = Query(...)):
    """Lista séries activas com próximo número e código ATCUD."""
    return _svc.get_series_list(empresa_id)


@router.post("/series/ensure")
def ensure_series(body: EnsureSeriesBody):
    """Cria série se não existir para o tipo de documento e ano."""
    ano = body.ano or date.today().year
    try:
        return _svc.ensure_series(body.empresa_id, body.tipo_doc, ano)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/series/{serie_id}/atcud")
def update_atcud(serie_id: int, body: UpdateAtcudBody):
    """Actualiza código de validação AT da série (após registo na AT)."""
    try:
        return _svc.update_atcud_code(serie_id, body.codigo_validacao)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── RSA ─────────────────────────────────────────────────────────────────────

@router.post("/rsa/generate")
def generate_rsa(body: GenerateRsaBody):
    """Gera par de chaves RSA 1024-bit para a empresa. Devolve chave pública."""
    try:
        return _svc.generate_rsa_keys(body.empresa_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/rsa/{empresa_id}/public")
def get_public_key(empresa_id: int):
    """Devolve chave pública PEM da empresa (para submeter à AT)."""
    try:
        pem = _svc.get_public_key(empresa_id)
        return {"empresa_id": empresa_id, "public_key_pem": pem}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/rsa/{empresa_id}/status")
def rsa_status(empresa_id: int):
    """Verifica se empresa tem par RSA gerado."""
    return {"empresa_id": empresa_id, "has_keypair": _svc.has_rsa_keys(empresa_id)}


# ── SAF-T PT ────────────────────────────────────────────────────────────────

@router.post("/saft/export")
def export_saft(body: SAFTExportBody):
    """Exporta SAF-T PT XML v1.04_01 para o período indicado."""
    try:
        xml_bytes = _saft.export_period(
            empresa_id=body.empresa_id,
            data_inicio=body.data_inicio,
            data_fim=body.data_fim,
        )
        filename = f"SAFT_PT_{body.empresa_id}_{body.data_inicio}_{body.data_fim}.xml"
        return Response(
            content=xml_bytes,
            media_type="application/xml",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except ImportError as e:
        raise HTTPException(status_code=503, detail=f"Dependência em falta: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao exportar SAF-T: {e}")


@router.get("/saft/history")
def saft_history(empresa_id: int = Query(...)):
    """Histórico de exportações SAF-T."""
    from app.config.database import get_db_connection
    conn = get_db_connection()
    try:
        rows = conn.execute(
            """SELECT id, empresa_id, periodo_inicio, periodo_fim, num_documentos, xml_hash, exported_at
               FROM saft_exports WHERE empresa_id = ? ORDER BY exported_at DESC LIMIT 50""",
            [empresa_id],
        ).fetchall()
        cols = ["id", "empresa_id", "periodo_inicio", "periodo_fim", "num_documentos", "xml_hash", "exported_at"]
        return [dict(zip(cols, row)) for row in rows]
    finally:
        conn.close()
