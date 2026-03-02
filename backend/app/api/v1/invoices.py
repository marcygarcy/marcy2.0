"""Endpoints de gestão de faturas."""
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Form, Query
from fastapi.responses import FileResponse
from typing import List
from app.services.invoice_service import InvoiceService
from app.api.deps import get_invoice_service
from app.models.schemas import UploadResponse

router = APIRouter(prefix="/invoices", tags=["invoices"])


@router.get("/cycles")
async def get_cycles(service: InvoiceService = Depends(get_invoice_service)):
    """Obtém lista de ciclos disponíveis."""
    try:
        cycles = service.get_available_cycles()
        return {"cycles": cycles}
    finally:
        service.close()


@router.get("/cycles-with-files")
async def get_cycles_with_files(service: InvoiceService = Depends(get_invoice_service)):
    """Obtém lista de ciclos com informações sobre ficheiros carregados."""
    try:
        cycles = service.get_available_cycles()
        all_invoices = service.get_all_invoices_by_cycle()
        
        cycles_info = []
        for cycle in cycles:
            invoices = all_invoices.get(cycle, [])
            cycles_info.append({
                "cycle": cycle,
                "has_files": len(invoices) > 0,
                "files": [
                    {
                        "nome": inv["nome_ficheiro"],
                        "tipo": inv["tipo_documento"]
                    }
                    for inv in invoices
                ] if invoices else []
            })
        
        return {"cycles": cycles_info}
    finally:
        service.close()


@router.post("/upload")
async def upload_invoice(
    ciclo_pagamento: str = Form(...),
    tipo_documento: str = Form(...),
    file: UploadFile = File(...),
    service: InvoiceService = Depends(get_invoice_service)
):
    """Upload de uma fatura."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="Nome do ficheiro é obrigatório")
    
    # Validar tipo de documento
    allowed_types = ["fatura", "crédito automático"]
    if tipo_documento not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Tipo de documento inválido. Use: {', '.join(allowed_types)}"
        )
    
    try:
        content = await file.read()
        result = service.save_invoice(
            ciclo_pagamento=ciclo_pagamento,
            tipo_documento=tipo_documento,
            nome_ficheiro=file.filename,
            file_content=content
        )
        
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["message"])
        
        return {
            "success": True,
            "message": result["message"]
        }
    finally:
        service.close()


@router.post("/upload-multiple")
async def upload_multiple_invoices(
    ciclo_pagamento: str = Form(...),
    tipo_documento: str = Form(...),
    files: List[UploadFile] = File(...),
    service: InvoiceService = Depends(get_invoice_service)
):
    """Upload de múltiplas faturas."""
    
    allowed_types = ["fatura", "crédito automático"]
    if tipo_documento not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Tipo de documento inválido. Use: {', '.join(allowed_types)}"
        )
    
    # Validar tipos de ficheiro permitidos
    allowed_extensions = ['.pdf', '.jpg', '.jpeg', '.png']
    
    results = []
    try:
        for file in files:
            if not file.filename:
                results.append({
                    "filename": "unknown",
                    "success": False,
                    "message": "Nome do ficheiro não fornecido"
                })
                continue
            
            # Validar extensão
            file_ext = None
            for ext in allowed_extensions:
                if file.filename.lower().endswith(ext):
                    file_ext = ext
                    break
            
            if not file_ext:
                results.append({
                    "filename": file.filename,
                    "success": False,
                    "message": f"Formato não suportado. Use: {', '.join(allowed_extensions)}"
                })
                continue
            
            try:
                content = await file.read()
                
                if len(content) == 0:
                    results.append({
                        "filename": file.filename,
                        "success": False,
                        "message": "Ficheiro vazio"
                    })
                    continue
                
                result = service.save_invoice(
                    ciclo_pagamento=ciclo_pagamento,
                    tipo_documento=tipo_documento,
                    nome_ficheiro=file.filename,
                    file_content=content
                )
                
                results.append({
                    "filename": file.filename,
                    "success": result["success"],
                    "message": result["message"]
                })
            except Exception as e:
                import traceback
                error_trace = traceback.format_exc()
                print(f"Erro ao processar {file.filename}: {error_trace}")
                results.append({
                    "filename": file.filename,
                    "success": False,
                    "message": f"Erro: {str(e)}"
                })
        
        # Verificar se houve algum sucesso
        success_count = sum(1 for r in results if r.get("success", False))
        
        return {
            "success": success_count > 0,
            "results": results,
            "message": f"{success_count} de {len(results)} faturas carregadas com sucesso"
        }
    finally:
        service.close()


@router.get("/cycle")
async def get_invoices_by_cycle(
    ciclo_pagamento: str = Query(..., description="Ciclo de pagamento"),
    service: InvoiceService = Depends(get_invoice_service)
):
    """Obtém todas as faturas de um ciclo."""
    try:
        invoices = service.get_invoices_by_cycle(ciclo_pagamento)
        return {"invoices": invoices}
    finally:
        service.close()


@router.get("/all")
async def get_all_invoices(service: InvoiceService = Depends(get_invoice_service)):
    """Obtém todas as faturas agrupadas por ciclo."""
    try:
        invoices = service.get_all_invoices_by_cycle()
        return {"invoices_by_cycle": invoices}
    finally:
        service.close()


@router.get("/download/{invoice_id}")
async def download_invoice(
    invoice_id: int,
    service: InvoiceService = Depends(get_invoice_service)
):
    """Descarrega uma fatura."""
    try:
        file_path = service.get_invoice_file(invoice_id)
        if not file_path:
            raise HTTPException(status_code=404, detail="Fatura não encontrada")
        
        return FileResponse(
            path=str(file_path),
            filename=file_path.name,
            media_type="application/pdf"
        )
    finally:
        service.close()


@router.delete("/{invoice_id}")
async def delete_invoice(
    invoice_id: int,
    service: InvoiceService = Depends(get_invoice_service)
):
    """Elimina uma fatura."""
    try:
        result = service.delete_invoice(invoice_id)
        if not result["success"]:
            raise HTTPException(status_code=404, detail=result["message"])
        
        return result
    finally:
        service.close()

