# 🏗️ Diagramas e Arquitetura do Sistema

**Visualizações e diagramas arquiteturais completos**

---

## 🏢 Arquitetura Geral

```
┌─────────────────────────────────────────────────────────────────┐
│                    INTERNET / NAVEGADOR                         │
└──────────────────────────┬──────────────────────────────────────┘
                           │ 
                           ↓ (HTTP/HTTPS)
                           │
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND LAYER                               │
│  (React + Next.js + Tailwind)                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Pages:                                                     │ │
│  │ - Dashboard (KPIs, Gráficos)                              │ │
│  │ - Upload (Ficheiros)                                      │ │
│  │ - Transações (Listagem)                                   │ │
│  │ - Invoices, Orders, Bank                                 │ │
│  │ - Reconciliação                                           │ │
│  │ - Admin (Empresas)                                        │ │
│  └────────────────────────────────────────────────────────────┘ │
│  │                                                             │
│  │ Context:                                                    │
│  │ - TenantContext (empresa selecionada)                     │ │
│  │ - AuthContext (utilizador)                               │ │
│  └────────────────────────────────────────────────────────────┘ │
│  Port: 3000, 3001, 3002                                        │
└──────────────────────┬───────────────────────────────────────────┘
                       │
                       ↓ (REST API JSON)
                       │
┌──────────────────────────────────────────────────────────────────┐
│                   API GATEWAY / MIDDLEWARE                       │
│  - CORS Handler                                                  │
│  - Auth Middleware                                               │
│  - Request Logging                                               │
│  - Error Handling                                                │
└──────────────────────┬───────────────────────────────────────────┘
                       │
                       ↓ (HTTP)
                       │
┌──────────────────────────────────────────────────────────────────┐
│                   BACKEND LAYER (FastAPI)                        │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ API ROUTERS (v1)                                           │ │
│  │ - /api/v1/upload/ (transações, trf, invoices)            │ │
│  │ - /api/v1/kpis/ (todos, prazos, comissões, etc)          │ │
│  │ - /api/v1/transactions/ (listagem, detalhes)             │ │
│  │ - /api/v1/invoices/ (listagem, detalhes)                 │ │
│  │ - /api/v1/orders/ (listagem, pendentes)                  │ │
│  │ - /api/v1/bank/ (movimentos, saldos)                     │ │
│  │ - /api/v1/empresas/ (listagem, criação)                  │ │
│  │ - /api/v1/reconciliation/ (análise)                      │ │
│  └────────────────────────────────────────────────────────────┘ │
│  │                                                             │ │
│  ├→ SERVICES LAYER                                              │ │
│  │  - UploadService (processa ficheiros)                       │ │
│  │  - KPIsService (calcula métricas)                          │ │
│  │  - BankService (movimentos bancários)                      │ │
│  │  - ReconciliationService (análise Net/TRF)                │ │
│  │  - CacheService (cache em memória)                         │ │
│  │                                                             │ │
│  ├→ ETL LAYER                                                   │ │
│  │  - ingest.py (lê ficheiros Excel)                          │ │
│  │  - transform.py (limpa e normaliza)                        │ │
│  │  - classify.py (classifica dados)                          │ │
│  │  - reconcile.py (reconciliação)                            │ │
│  │  - encoding_fix.py (corrige encoding)                      │ │
│  │                                                             │ │
│  └→ MODELS LAYER                                                │ │
│     - Pydantic Schemas (request/response)                       │ │
│     - KPI Calculations                                          │ │
│     - Business Logic                                            │ │
│                                                                 │ │
│  Port: 8000                                                     │ │
└──────────────────────┬───────────────────────────────────────────┘
                       │
                       ↓ (SQL/Python)
                       │
┌──────────────────────────────────────────────────────────────────┐
│                  DATABASE LAYER (DuckDB)                         │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ TABLES                                                     │ │
│  │ ┌─────────────────────────────────────────────────────┐   │ │
│  │ │ empresas                                            │   │ │
│  │ │ - id, nome, ativa, created_at                      │   │ │
│  │ └─────────────────────────────────────────────────────┘   │ │
│  │ ┌─────────────────────────────────────────────────────┐   │ │
│  │ │ transactions                                        │   │ │
│  │ │ - id, empresa_id, data, tipo, valor                │   │ │
│  │ │ - descricao, referencia                            │   │ │
│  │ └─────────────────────────────────────────────────────┘   │ │
│  │ ┌─────────────────────────────────────────────────────┐   │ │
│  │ │ transfers                                           │   │ │
│  │ │ - id, empresa_id, data, valor                       │   │ │
│  │ │ - beneficiario, status                              │   │ │
│  │ └─────────────────────────────────────────────────────┘   │ │
│  │ ┌─────────────────────────────────────────────────────┐   │ │
│  │ │ invoices                                            │   │ │
│  │ │ - id, empresa_id, data, numero                      │   │ │
│  │ │ - valor, status, descricao                          │   │ │
│  │ └─────────────────────────────────────────────────────┘   │ │
│  │ ┌─────────────────────────────────────────────────────┐   │ │
│  │ │ orders                                              │   │ │
│  │ │ - id, empresa_id, data, numero, valor              │   │ │
│  │ │ - status, descricao                                 │   │ │
│  │ └─────────────────────────────────────────────────────┘   │ │
│  │ ┌─────────────────────────────────────────────────────┐   │ │
│  │ │ bank_movements                                      │   │ │
│  │ │ - id, empresa_id, data, tipo                        │   │ │
│  │ │ - valor, descricao                                  │   │ │
│  │ └─────────────────────────────────────────────────────┘   │ │
│  │                                                             │ │
│  │ INDICES:                                                    │ │
│  │ - idx_transactions_empresa_data                             │ │
│  │ - idx_transfers_empresa_data                                │ │
│  │ - idx_invoices_empresa_data                                 │ │
│  │ - idx_orders_empresa_data                                   │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │ │
│  File: data/warehouse.duckdb                                   │ │
└──────────────────────────────────────────────────────────────────┘

---

## 📊 Fluxo de Dados - Upload

```
Utilizador                    Frontend                  Backend               Database
   │                            │                          │                      │
   ├─ Seleciona ficheiro       │                          │                      │
   │      ├─ Upload             │                          │                      │
   │                          POST /upload/transactions  │                      │
   │                            ├──────────────────────→  │                      │
   │                            │                         ├─ Validate file      │
   │                            │                         ├─ Parse Excel        │
   │                            │                         ├─ Transform data     │
   │                            │                         ├─ Classify records   │
   │                            │                         │                      │
   │                            │                         ├─ INSERT INTO        │
   │                            │                         │  transactions       ├───→
   │                            │                         │                      │
   │                            │      Response ✅       │                      │
   │                            │  {"success": true,     │                      │
   │                            │  "records": 150}       │                      │
   │                           ←─────────────────────────┤                      │
   │                            │                         │                      │
   │ ✅ Mensagem sucesso        │                        │                      │
   │                            │                         │                      │
   ├─ Mais dados?              │                         │                      │
   │      ├─ Upload Transfer    │                        │                      │
   │                          POST /upload/trf          │                      │
   │                            ├──────────────────────→  │                      │
   │                            │                         ├─ Similar process   │
   │                            │                         │                      │
   │                            │      Response ✅       │                      │
   │                           ←─────────────────────────┤                      │
```

---

## 📊 Fluxo de Dados - KPI Calculation

```
Frontend (User)              Frontend (Components)      Backend API           Database
      │                            │                         │                   │
      ├─ Load page                 │                         │                   │
      │  with KPIs                 │                         │                   │
      │                  ├─ useEffect()                      │                   │
      │                  │      fetch('/kpis/all')          │                   │
      │                  │           │                       │                   │
      │                  │         GET /api/v1/kpis/all     │                   │
      │                  │           ├──────────────────────→│                   │
      │                  │           │                       ├─ Get company_id  │
      │                  │           │                       │  from context    │
      │                  │           │                       │                   │
      │                  │           │                       ├─ SELECT SUM()    │
      │                  │           │                       │  FROM transactions├──→
      │                  │           │                       │  WHERE empresa=X  │
      │                  │           │                    ←──┤   GROUP BY...    │
      │                  │           │                       │                   │
      │                  │           │                       ├─ Python calc:    │
      │                  │           │                       │  - Average       │
      │                  │           │                       │  - Aggregation   │
      │                  │           │                       │  - Formatting    │
      │                  │           │                       │                   │
      │                  │         Response {               │                   │
      │                  │       "prazos": {...}            │                   │
      │                  │       "comissoes": {...}         │                   │
      │                  │       "reembolsos": {...}        │                   │
      │                  │       "reserva": {...}           │                   │
      │                  │      }                            │                   │
      │                  │           ←──────────────────────┤                   │
```
