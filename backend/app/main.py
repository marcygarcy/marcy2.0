"""Aplicação FastAPI principal."""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import time
import logging
from app.config.database import init_database
from app.config.settings import get_settings
from app.api.v1 import upload, kpis, invoices, transactions, bank, empresas, marketplaces, orders, pendentes, sales, purchases, suppliers, automation, finance, rma, payment_methods, logistics, config, billing, office_stock

_settings = get_settings()

# Configurar logging
logging.basicConfig(level=_settings.debug_logging and logging.DEBUG or logging.INFO)
logger = logging.getLogger(__name__)

# Inicializar base de dados
init_database()

app = FastAPI(
    title="Marketplace Payments API",
    description="API para análise de pagamentos de marketplace",
    version="1.0.0",
    # Configurações para evitar acumulação de conexões
    timeout=300,  # 5 minutos timeout
)

# Middleware de logging para todos os pedidos
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    
    # Log do pedido recebido
    if _settings.debug_logging:
        print(f"[MAIN] ========== PEDIDO RECEBIDO ==========")
        print(f"[MAIN] Método: {request.method}")
        print(f"[MAIN] URL: {request.url}")
        print(f"[MAIN] Headers: {dict(request.headers)}")
        if request.method == "POST":
            print(f"[MAIN] Content-Type: {request.headers.get('content-type', 'N/A')}")
    
    try:
        response = await call_next(request)
        if _settings.debug_logging:
            process_time = time.time() - start_time
            print(f"[MAIN] Resposta: Status {response.status_code} em {process_time:.2f}s")
            print(f"[MAIN] ========== FIM DO PEDIDO ==========")
        return response
    except Exception as e:
        process_time = time.time() - start_time
        print(f"[MAIN] ERRO após {process_time:.2f}s: {str(e)}")
        import traceback
        print(f"[MAIN] Traceback:\n{traceback.format_exc()}")
        raise

# CORS - origens configuradas via CORS_ORIGINS em .env
# IMPORTANTE: O middleware deve ser adicionado ANTES dos routers
_cors_origins = _settings.get_cors_origins()
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=_cors_origins != ["*"],  # credentials só com origens explícitas
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Incluir routers
app.include_router(upload.router, prefix="/api/v1")
app.include_router(kpis.router, prefix="/api/v1")
app.include_router(invoices.router, prefix="/api/v1")
app.include_router(transactions.router, prefix="/api/v1")
app.include_router(bank.router, prefix="/api/v1")
app.include_router(empresas.router, prefix="/api/v1")
app.include_router(marketplaces.router, prefix="/api/v1")
app.include_router(orders.router, prefix="/api/v1")
app.include_router(pendentes.router, prefix="/api/v1")
app.include_router(sales.router, prefix="/api/v1")
app.include_router(purchases.router, prefix="/api/v1")
app.include_router(suppliers.router, prefix="/api/v1")
app.include_router(automation.router, prefix="/api/v1")
app.include_router(finance.router, prefix="/api/v1")
app.include_router(rma.router, prefix="/api/v1")
app.include_router(payment_methods.router, prefix="/api/v1")
app.include_router(logistics.router, prefix="/api/v1")
app.include_router(config.router, prefix="/api/v1")
app.include_router(billing.router, prefix="/api/v1")
app.include_router(office_stock.router, prefix="/api/v1")


@app.on_event("startup")
async def startup():
    """Inicia o scheduler do Midnight Sync (00:00)."""
    try:
        from app.services.automation_service import start_scheduler
        start_scheduler()
    except Exception as e:
        logger.warning("Scheduler não iniciado: %s", e)


@app.on_event("shutdown")
async def shutdown():
    """Para o scheduler no shutdown."""
    try:
        from app.services.automation_service import stop_scheduler
        stop_scheduler()
    except Exception:
        pass


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "Marketplace Payments API",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/health")
async def health():
    """Health check."""
    return {"status": "ok"}


@app.get("/api/v1/test")
async def test():
    """Endpoint de teste."""
    return JSONResponse(
        content={"message": "API está a funcionar!", "cors": "ok"},
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "*",
        }
    )


@app.options("/api/v1/{path:path}")
async def options_handler(path: str):
    """Handler OPTIONS para CORS preflight."""
    return JSONResponse(
        content={},
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Max-Age": "3600",
        }
    )

