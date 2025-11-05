"""Aplicação FastAPI principal."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.config.database import init_database
from app.api.v1 import upload, kpis, invoices, transactions, bank, empresas, marketplaces, orders

# Inicializar base de dados
init_database()

app = FastAPI(
    title="Marketplace Payments API",
    description="API para análise de pagamentos de marketplace",
    version="1.0.0"
)

# CORS - Configuração para desenvolvimento
# IMPORTANTE: O middleware deve ser adicionado ANTES dos routers
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Permitir todas as origens em desenvolvimento
    allow_credentials=False,  # False permite usar "*" em allow_origins
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

