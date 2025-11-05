"""Endpoints de upload."""
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from pathlib import Path
import tempfile
from app.services.upload_service import UploadService
from app.api.deps import get_upload_service
from app.models.schemas import UploadResponse

router = APIRouter(prefix="/upload", tags=["upload"])


@router.post("/transactions", response_model=UploadResponse)
async def upload_transactions(
    file: UploadFile = File(...),
    service: UploadService = Depends(get_upload_service)
):
    """Upload de ficheiro de transações."""
    if not file.filename.endswith(('.xlsx', '.xls', '.csv')):
        raise HTTPException(status_code=400, detail="Formato não suportado. Use XLSX, XLS ou CSV.")
    
    # Salvar ficheiro temporário
    with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = Path(tmp.name)
    
    try:
        success, message, records = service.upload_transactions(tmp_path)
        return UploadResponse(
            success=success,
            message=message,
            records_inserted=records if success else None
        )
    finally:
        # Limpar ficheiro temporário
        if tmp_path.exists():
            tmp_path.unlink()
        service.close()


@router.post("/trf", response_model=UploadResponse)
async def upload_trf(
    file: UploadFile = File(...),
    service: UploadService = Depends(get_upload_service)
):
    """Upload de ficheiro de transferências bancárias."""
    if not file.filename.endswith(('.xlsx', '.xls', '.csv')):
        raise HTTPException(status_code=400, detail="Formato não suportado. Use XLSX, XLS ou CSV.")
    
    with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = Path(tmp.name)
    
    try:
        success, message, records = service.upload_trf(tmp_path)
        return UploadResponse(
            success=success,
            message=message,
            records_inserted=records if success else None
        )
    finally:
        if tmp_path.exists():
            tmp_path.unlink()
        service.close()


@router.post("/orders", response_model=UploadResponse)
async def upload_orders(
    file: UploadFile = File(...),
    service: UploadService = Depends(get_upload_service)
):
    """Upload de ficheiro de listagem de orders (pedidos)."""
    if not file.filename.endswith(('.xlsx', '.xls', '.csv')):
        raise HTTPException(status_code=400, detail="Formato não suportado. Use XLSX, XLS ou CSV.")
    
    with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = Path(tmp.name)
    
    try:
        success, message, records = service.upload_orders(tmp_path)
        return UploadResponse(
            success=success,
            message=message,
            records_inserted=records if success else None
        )
    finally:
        if tmp_path.exists():
            tmp_path.unlink()
        service.close()


@router.delete("/transactions")
async def clear_transactions(service: UploadService = Depends(get_upload_service)):
    """Limpa todos os dados de transações da base de dados."""
    try:
        service.conn.execute("DELETE FROM transactions")
        service.conn.commit()
        return {"success": True, "message": "Dados de transações removidos com sucesso"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao limpar dados: {str(e)}")
    finally:
        service.close()