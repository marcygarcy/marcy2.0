# 🛠️ Guia de Desenvolvimento

**Versão**: 1.1  
**Data**: Fevereiro 2026  

---

## 📋 Índice

1. [Setup Local](#setup-local)
2. [Estrutura de Ficheiros](#estrutura-de-ficheiros)
3. [Desenvolvimento Backend](#desenvolvimento-backend)
4. [Desenvolvimento Frontend](#desenvolvimento-frontend)
5. [Workflows Comuns](#workflows-comuns)
6. [Testing](#testing)
7. [Debugging](#debugging)
8. [Performance](#performance)
9. [Deployment](#deployment)
10. [Best Practices](#best-practices)

---

## 🚀 Setup Local

### 1. Clonar Repositório

```bash
cd c:\Users\admin\Documents\Marisa\Big\new - Copy
```

### 2. Criar Ambientes Virtuais

**Backend - Python Virtual Environment:**

```bash
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
```

**Frontend - Node Modules:**

```bash
cd frontend
npm install
```

### 3. Iniciar Aplicação

**Option A: Script Automático**
```bash
start_completo.bat
```

**Option B: Manual (Recomendado para Dev)**

Terminal 1 - Backend:
```bash
cd backend
.\venv\Scripts\activate
uvicorn app.main:app --reload --port 8000
```

Terminal 2 - Frontend:
```bash
cd frontend
npm run dev
# Ou em porta diferente
npm run dev:3001
```

### 4. Verificar Status

- Backend Health: `curl http://localhost:8000/health`
- Frontend: Abrir `http://localhost:3000`
- API Docs: `http://localhost:8000/docs`

---

## 📁 Estrutura de Ficheiros

### Backend - Convenções

```
backend/
├── app/
│   ├── main.py                    # Entrada principal FastAPI
│   │
│   ├── api/
│   │   ├── v1/
│   │   │   ├── __init__.py
│   │   │   ├── upload.py         # Routers para upload
│   │   │   ├── kpis.py           # Routers para KPIs
│   │   │   ├── transactions.py   # Routers para transações
│   │   │   ├── invoices.py       # Routers para invoices
│   │   │   ├── orders.py         # Routers para orders
│   │   │   ├── bank.py           # Routers para banco
│   │   │   ├── empresas.py       # Routers para empresas
│   │   │   ├── marketplaces.py   # Routers para marketplaces
│   │   │   ├── pendentes.py      # Routers para pendentes
│   │   │   └── deps.py           # Dependências de injeção
│   │   └── __init__.py
│   │
│   ├── models/
│   │   ├── schemas.py            # Pydantic schemas (requests/responses)
│   │   ├── kpis.py              # Lógica e cálculos KPIs
│   │   └── __init__.py
│   │
│   ├── services/
│   │   ├── upload_service.py     # Lógica de upload
│   │   ├── kpis_service.py       # Lógica de KPIs
│   │   ├── bank_service.py       # Lógica bancária
│   │   ├── empresa_service.py    # Lógica de empresas
│   │   ├── invoice_service.py    # Lógica de invoices
│   │   ├── cache_service.py      # Cache
│   │   └── ...
│   │
│   ├── etl/
│   │   ├── ingest.py             # Ingesta de arquivos
│   │   ├── transform.py          # Transformações de dados
│   │   ├── reconcile.py          # Lógica de reconciliação
│   │   ├── classify.py           # Classificação de dados
│   │   ├── encoding_fix.py       # Correção de encoding
│   │   ├── schemas.py            # Schemas ETL
│   │   └── __init__.py
│   │
│   ├── config/
│   │   ├── database.py           # Inicialização DuckDB
│   │   ├── settings.py           # Configurações (Pydantic)
│   │   └── __init__.py
│   │
│   ├── __init__.py
│   └── __pycache__/
│
... (truncated for archive)
```

---

## 👨‍💻 Desenvolvimento Backend

### Criar Novo Endpoint API

**1. Definir Schema (models/schemas.py):**

```python
from pydantic import BaseModel, Field
from typing import Optional

class MyRequest(BaseModel):
    """Schema para request."""
    campo1: str = Field(..., description="Descrição")
    campo2: Optional[int] = None

class MyResponse(BaseModel):
    """Schema para response."""
    success: bool
    data: Optional[dict] = None
    message: str
```

**2. Criar Router (api/v1/my_router.py):**

```python
from fastapi import APIRouter, Depends, HTTPException
from app.models.schemas import MyRequest, MyResponse

router = APIRouter(tags=["my_feature"])

@router.post("/my_feature/action", response_model=MyResponse)
async def my_action(request: MyRequest):
    """
    Minha ação.
    
    - **campo1**: Descrição do campo1
    - **campo2**: Descrição do campo2
    
    Returns:
        MyResponse with success status
    """
    try:
        # Lógica aqui
        return MyResponse(
            success=True,
            data={"result": "algo"},
            message="Ação concluída"
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
```

... (truncated for archive)
