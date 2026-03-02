"""Endpoints de upload."""
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Form
from pathlib import Path
import tempfile
from app.services.upload_service import UploadService
from app.services.cache_service import CacheService
from app.api.deps import get_upload_service
from app.models.schemas import UploadResponse

router = APIRouter(prefix="/upload", tags=["upload"])


@router.post("/transactions", response_model=UploadResponse)
async def upload_transactions(
    empresa_id: int = Form(2),
    marketplace_id: int = Form(1),
    file: UploadFile = File(...),
    service: UploadService = Depends(get_upload_service)
):
    """Upload de ficheiro de transações."""
    print(f"[UPLOAD_ENDPOINT] ========== INÍCIO DO UPLOAD ==========")
    print(f"[UPLOAD_ENDPOINT] Parâmetros recebidos: empresa_id={empresa_id}, marketplace_id={marketplace_id}")
    print(f"[UPLOAD_ENDPOINT] Ficheiro: filename={file.filename}, content_type={file.content_type}")
    
    if not file.filename:
        print("[UPLOAD_ENDPOINT] ERRO: filename está vazio")
        raise HTTPException(status_code=400, detail="Nome do ficheiro é obrigatório")
    
    if not file.filename.endswith(('.xlsx', '.xls', '.csv')):
        print(f"[UPLOAD_ENDPOINT] ERRO: Formato não suportado: {file.filename}")
        raise HTTPException(status_code=400, detail="Formato não suportado. Use XLSX, XLS ou CSV.")
    
    print(f"[UPLOAD_ENDPOINT] Lendo conteúdo do ficheiro...")
    # Salvar ficheiro temporário
    with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix) as tmp:
        content = await file.read()
        file_size = len(content)
        print(f"[UPLOAD_ENDPOINT] Ficheiro lido: {file_size} bytes")
        tmp.write(content)
        tmp_path = Path(tmp.name)
        print(f"[UPLOAD_ENDPOINT] Ficheiro temporário criado: {tmp_path}")
    
    try:
        print(f"[UPLOAD_ENDPOINT] Chamando service.upload_transactions...")
        success, message, records = service.upload_transactions(tmp_path, clear_existing=False, empresa_id=empresa_id, marketplace_id=marketplace_id)
        print(f"[UPLOAD_ENDPOINT] Resultado do serviço: success={success}, message={message}, records={records}")
        
        # Limpar cache de KPIs após upload
        if success:
            print(f"[UPLOAD_ENDPOINT] Limpando cache de KPIs...")
            CacheService.clear()  # Limpar todo o cache de KPIs
        
        response = UploadResponse(
            success=success,
            message=message,
            records_inserted=records if success else None
        )
        print(f"[UPLOAD_ENDPOINT] Resposta preparada: {response}")
        print(f"[UPLOAD_ENDPOINT] ========== FIM DO UPLOAD (SUCESSO) ==========")
        return response
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"[UPLOAD_ENDPOINT] ========== ERRO NO UPLOAD ==========")
        print(f"[UPLOAD_ENDPOINT] Erro: {str(e)}")
        print(f"[UPLOAD_ENDPOINT] Traceback completo:\n{error_trace}")
        raise HTTPException(status_code=500, detail=f"Erro ao processar upload: {str(e)}")
    finally:
        # Limpar ficheiro temporário
        print(f"[UPLOAD_ENDPOINT] Limpando ficheiro temporário...")
        if tmp_path.exists():
            tmp_path.unlink()
            print(f"[UPLOAD_ENDPOINT] Ficheiro temporário removido")
        service.close()
        print(f"[UPLOAD_ENDPOINT] Serviço fechado")


@router.post("/trf", response_model=UploadResponse)
async def upload_trf(
    empresa_id: int = Form(2),
    marketplace_id: int = Form(1),
    file: UploadFile = File(...),
    service: UploadService = Depends(get_upload_service)
):
    """Upload de ficheiro de transferências bancárias."""
    print(f"[UPLOAD_ENDPOINT] ========== INÍCIO DO UPLOAD TRF ==========")
    print(f"[UPLOAD_ENDPOINT] Parâmetros recebidos: empresa_id={empresa_id}, marketplace_id={marketplace_id}")
    print(f"[UPLOAD_ENDPOINT] Ficheiro: filename={file.filename}, content_type={file.content_type}")
    
    if not file.filename:
        print("[UPLOAD_ENDPOINT] ERRO: filename está vazio")
        raise HTTPException(status_code=400, detail="Nome do ficheiro é obrigatório")
    
    if not file.filename.endswith(('.xlsx', '.xls', '.csv')):
        print(f"[UPLOAD_ENDPOINT] ERRO: Formato não suportado: {file.filename}")
        raise HTTPException(status_code=400, detail="Formato não suportado. Use XLSX, XLS ou CSV.")
    
    print(f"[UPLOAD_ENDPOINT] Lendo conteúdo do ficheiro...")
    with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix) as tmp:
        content = await file.read()
        file_size = len(content)
        print(f"[UPLOAD_ENDPOINT] Ficheiro lido: {file_size} bytes")
        tmp.write(content)
        tmp_path = Path(tmp.name)
        print(f"[UPLOAD_ENDPOINT] Ficheiro temporário criado: {tmp_path}")
    
    try:
        print(f"[UPLOAD_ENDPOINT] Chamando service.upload_trf...")
        success, message, records = service.upload_trf(tmp_path, clear_existing=False, empresa_id=empresa_id, marketplace_id=marketplace_id)
        print(f"[UPLOAD_ENDPOINT] Resultado do serviço: success={success}, message={message}, records={records}")
        
        # Limpar cache de KPIs após upload
        if success:
            print(f"[UPLOAD_ENDPOINT] Limpando cache de KPIs...")
            CacheService.clear()
        
        response = UploadResponse(
            success=success,
            message=message,
            records_inserted=records if success else None
        )
        print(f"[UPLOAD_ENDPOINT] Resposta preparada: {response}")
        print(f"[UPLOAD_ENDPOINT] ========== FIM DO UPLOAD TRF (SUCESSO) ==========")
        return response
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"[UPLOAD_ENDPOINT] ========== ERRO NO UPLOAD TRF ==========")
        print(f"[UPLOAD_ENDPOINT] Erro: {str(e)}")
        print(f"[UPLOAD_ENDPOINT] Traceback completo:\n{error_trace}")
        raise HTTPException(status_code=500, detail=f"Erro ao processar upload: {str(e)}")
    finally:
        print(f"[UPLOAD_ENDPOINT] Limpando ficheiro temporário...")
        if tmp_path.exists():
            tmp_path.unlink()
            print(f"[UPLOAD_ENDPOINT] Ficheiro temporário removido")
        service.close()
        print(f"[UPLOAD_ENDPOINT] Serviço fechado")


@router.post("/orders", response_model=UploadResponse)
async def upload_orders(
    empresa_id: int = Form(2),
    marketplace_id: int = Form(1),
    file: UploadFile = File(...),
    service: UploadService = Depends(get_upload_service)
):
    """Upload de ficheiro de listagem de orders (pedidos)."""
    print(f"[UPLOAD_ENDPOINT] ========== INÍCIO DO UPLOAD ORDERS ==========")
    print(f"[UPLOAD_ENDPOINT] Parâmetros recebidos: empresa_id={empresa_id}, marketplace_id={marketplace_id}")
    print(f"[UPLOAD_ENDPOINT] Ficheiro: filename={file.filename}, content_type={file.content_type}")
    
    if not file.filename:
        print("[UPLOAD_ENDPOINT] ERRO: filename está vazio")
        raise HTTPException(status_code=400, detail="Nome do ficheiro é obrigatório")
    
    if not file.filename.endswith(('.xlsx', '.xls', '.csv')):
        print(f"[UPLOAD_ENDPOINT] ERRO: Formato não suportado: {file.filename}")
        raise HTTPException(status_code=400, detail="Formato não suportado. Use XLSX, XLS ou CSV.")
    
    print(f"[UPLOAD_ENDPOINT] Lendo conteúdo do ficheiro...")
    with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix) as tmp:
        content = await file.read()
        file_size = len(content)
        print(f"[UPLOAD_ENDPOINT] Ficheiro lido: {file_size} bytes")
        tmp.write(content)
        tmp_path = Path(tmp.name)
        print(f"[UPLOAD_ENDPOINT] Ficheiro temporário criado: {tmp_path}")
    
    try:
        print(f"[UPLOAD_ENDPOINT] Chamando service.upload_orders...")
        success, message, records = service.upload_orders(tmp_path, clear_existing=False, empresa_id=empresa_id, marketplace_id=marketplace_id)
        print(f"[UPLOAD_ENDPOINT] Resultado do serviço: success={success}, message={message}, records={records}")
        
        # Limpar cache de KPIs após upload
        if success:
            print(f"[UPLOAD_ENDPOINT] Limpando cache de KPIs...")
            CacheService.clear()
        
        response = UploadResponse(
            success=success,
            message=message,
            records_inserted=records if success else None
        )
        print(f"[UPLOAD_ENDPOINT] Resposta preparada: {response}")
        print(f"[UPLOAD_ENDPOINT] ========== FIM DO UPLOAD ORDERS (SUCESSO) ==========")
        return response
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"[UPLOAD_ENDPOINT] ========== ERRO NO UPLOAD ORDERS ==========")
        print(f"[UPLOAD_ENDPOINT] Erro: {str(e)}")
        print(f"[UPLOAD_ENDPOINT] Traceback completo:\n{error_trace}")
        raise HTTPException(status_code=500, detail=f"Erro ao processar upload: {str(e)}")
    finally:
        print(f"[UPLOAD_ENDPOINT] Limpando ficheiro temporário...")
        if tmp_path.exists():
            tmp_path.unlink()
            print(f"[UPLOAD_ENDPOINT] Ficheiro temporário removido")
        service.close()
        print(f"[UPLOAD_ENDPOINT] Serviço fechado")


@router.delete("/transactions")
async def clear_transactions(service: UploadService = Depends(get_upload_service)):
    """Limpa todos os dados de transações da base de dados."""
    try:
        service.conn.execute("DELETE FROM transactions")
        service.conn.commit()
        # Limpar cache após limpar dados
        CacheService.clear()
        return {"success": True, "message": "Dados de transações removidos com sucesso"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao limpar dados: {str(e)}")
    finally:
        service.close()