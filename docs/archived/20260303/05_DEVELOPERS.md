# 05 - Developers Guide

Conteúdo essencial para engenheiros:

- Setup local: use `02_QUICK_START.md`.
- Estrutura do backend: `backend/app/main.py`, `backend/app/api/v1/`, `backend/app/services/`, `backend/app/etl/`.
- Estrutura do frontend: `frontend/src/app/`, `frontend/src/components/`, `frontend/src/lib/api.ts`.
- Testes: adicionar `pytest` para backend e `@testing-library/react` para frontend.
- Migrations & schema: documento `07_DATA_SCHEMA.sql` e política de versionamento (manter migrations em `backend/migrations/`).

Recomendações imediatas
1. Adicionar `requirements-dev.txt` com `pytest`, `pytest-asyncio`, `black`, `ruff`.
2. Criar `Makefile` com targets: `make install-dev`, `make test`, `make lint`.
3. Implementar GitHub Actions (CI) para lint, tests, build frontend.

Endpoints importantes
- `/api/v1/upload/*` — upload de ficheiros
- `/api/v1/kpis/*` — KPIs
- `/api/v1/reception/*` — (novo) triple-match endpoints
