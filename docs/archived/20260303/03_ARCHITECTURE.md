# 03 - Architecture & Diagrams

Este documento consolida a arquitectura do sistema: frontend (Next.js), backend (FastAPI), e DB (DuckDB). Inclui diagramas, camadas e fluxo de dados.

Resumo de alto nível
- Frontend: Next.js + Tailwind, portas 3000/3001
- Backend: FastAPI + Uvicorn, porta 8000
- Database: DuckDB (arquivo `data/warehouse.duckdb`) para analytics; considerar Postgres para OLTP de alta concorrência

Camadas
- Presentation: React components, charts, upload forms
- API Layer: FastAPI routers (v1), autenticação e CORS
- Business Logic: services (kpis, upload, reconciliation)
- ETL: ingest/transform/classify/reconcile
- Data Access: DuckDB queries, views

Diagrama simplificado
```
Frontend (Next.js)
   ↓ REST
Backend (FastAPI)
   ↓ SQL
DuckDB (data/warehouse.duckdb)
```

Observações operacionais
- DuckDB é um ficheiro local — criar política de backups e snapshots.
- Para alta concorrência de leitura/escrita, avaliar migração de certas tabelas para Postgres.

Ver `07_DATA_SCHEMA.sql` para o novo schema logístico e VAT OSS.
