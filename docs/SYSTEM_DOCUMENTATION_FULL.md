# Documento Completo — Inventário, Funcionalidades, Submódulos e Circuitos

## Resumo Executivo

- Projeto: Sistema de análise e gestão de recebimentos de marketplaces.
- Stack: Backend Python (FastAPI + Uvicorn), DuckDB (file-based analytics), Pandas; Frontend Next.js + React + Tailwind; scheduler/automação com APScheduler / scripts de scraping.
- Objetivo: ingestão de ficheiros (transações/TRF/orders), normalização, cálculo de KPIs, reconciliação (Net vs TRF), gestão de faturas, compras automatizadas e dashboards.
- Nota importante: DB principal é `data/warehouse.duckdb` — faça backup antes de alterações.

---

## Inventário de alto nível (paths principais)

- Backend: `backend/`
  - App entry: `backend/app/main.py`
  - Routers: `backend/app/api/v1/*.py` (upload, kpis, transactions, invoices, bank, orders, sales, purchases, logistics, automation, etc.)
  - Services: `backend/app/services/*.py` (upload_service, invoice_service, bank_service, kpi_service, automation_service, ...).
  - ETL: `backend/app/etl/*.py` (ingest.py, transform.py, reconcile.py, orders_normalizer.py, classify.py, encoding_fix.py).
  - Config: `backend/app/config/*` (database init, settings).
  - Scripts: `backend/scripts/*.py` (seed, migration).
- Frontend: `frontend/`
  - App router: `frontend/src/app/` (`layout.tsx`, `page.tsx`)
  - Components: `frontend/src/components/`
  - Contexts: `frontend/src/context/` (`TenantContext.tsx`, `AuthContext.tsx`)
  - Lib: `frontend/src/lib/api.ts`, utils, formatters.
- Docs: `docs/` (consolidados em `00_INDEX.md`…`09_FAQ.md`, SQL em `07_DATA_SCHEMA.md`; legados arquivados em `docs/archived/20260301/`).

---

## Visão detalhada por subsistema

### 1) Entrada API e roteamento

- `backend/app/main.py`
  - Inicializa DB (`init_database()`), configura logging e CORS (origens via settings).
  - Inclui routers com prefix `/api/v1` para: `upload`, `kpis`, `invoices`, `transactions`, `bank`, `empresas`, `marketplaces`, `orders`, `pendentes`, `sales`, `purchases`, `suppliers`, `automation`, `finance`, `rma`, `payment_methods`, `logistics`, `config`, `billing`, `office_stock`.
  - Events: `startup` inicia scheduler (`automation_service.start_scheduler()`); `shutdown` para scheduler.
  - Endpoints públicos: `/`, `/health`, `/api/v1/test`, handler OPTIONS para CORS.

### 2) Uploads e pipeline ETL

- Endpoints: `backend/app/api/v1/upload.py`
  - POST `/api/v1/upload/transactions` — recebe multipart/form/form-data com `empresa_id`, `marketplace_id` e ficheiro; valida extensão; guarda temporário; chama `UploadService.upload_transactions`.
  - POST `/api/v1/upload/trf` — similar para transferências.
  - POST `/api/v1/upload/orders` — similar para orders; cada endpoint limpa cache KPIs em sucesso (`CacheService.clear()`).
  - DELETE `/api/v1/upload/transactions` — apaga todas as transações (admin use).
- Serviço: `backend/app/services/upload_service.py`
  - Funções: `upload_transactions`, `upload_trf`, `upload_orders`.
  - Usa funções ETL: `ingest.load_transactions`, `ingest.load_trf`, `ingest.load_orders`, e `insert_*` para persistência em DuckDB.
  - Suporta `clear_existing` (DELETE por `empresa_id`/`marketplace_id`) e faz commit; logs detalhados; `close()` fecha conexão.

### 3) ETL e normalização

- `backend/app/etl/ingest.py` — Carrega ficheiros Excel/CSV em DataFrame; mapeia colunas; aplica `insert_*`.
- `backend/app/etl/orders_normalizer.py` — Mapeia formatos diversos de marketplaces (YAML de mapping por marketplace).
- `backend/app/etl/transform.py`, `classify.py`, `encoding_fix.py` — Limpeza, standardização, categorização e correção de encoding.
- `backend/app/etl/reconcile.py` — Lógica de reconciliação: agrupamentos por ciclos (`Ciclo Pagamento`), cálculo de métricas `net`, `trf_0_7`, diferenças e breakdowns; possivelmente produz a vista `triple_match` (ver `07_DATA_SCHEMA.md`).
- Circuito ETL típico: upload → ingest → transform/classify → insert → (reconcile/kpis) → cache limpar.

### 4) Serviços principais (descrições rápidas)

- `upload_service.py` — upload pipeline.
- `invoice_service.py` — armazenamento físico de faturas em `data/invoices/<ciclo>/`, registo em `invoices` table, listar/baixar/delete.
- `bank_service.py` — CRUD e queries para `bank_movements` / `bank_trf`, filtros por mês/data, totalizações.
- `kpi_service.py` / `kpi_service_helper.py` — queries agregadas para KPIs (prazo médio, comissões, reembolsos, reserva), caching.
- `automation_service.py` — scheduler para midnight-sync: tasks de scraping, ingest automático, price sync.
- `mirakl_scraper.py`, `supplier_scraper.py`, `scraper_factory.py` — integrações/scrapers para obter dados externos dos marketplaces.
- `purchase_*` services — automação do fluxo compras (aggregator, draft, checkout).
- `sales_service.py` / `sales_module_service.py` / `universal_sales_ingestor.py` — ingest e cálculo de margens, SKU mapping.
- `oss_service.py` / `logistics_service.py` / `office_stock_service.py` — VAT OSS rules, logística, stock escritório.
- `cache_service.py` — limpeza/invalidação de cache (chamado após uploads).
- `security_service.py` / `encryption_service.py` — encriptação, gestão de segredos.

### 5) Endpoints e recursos expostos (por área)

- Uploads: `/api/v1/upload/*` (transactions, trf, orders).
- KPIs: `/api/v1/kpis/*` — agregados e períodos.
- Transactions: `/api/v1/transactions/*` — listagem, filtros, detalhes.
- Invoices: `/api/v1/invoices/*` — upload metadata, listar por ciclo, baixar, delete.
- Bank: `/api/v1/bank/*` — movimentos, create/update/delete.
- Orders / Sales: `/api/v1/orders`, `/api/v1/sales/*` — listagens, metrics, top-products, margens.
- Purchases: `/api/v1/purchases/*` — aggregate, draft, checkout.
- Suppliers / Marketplaces: CRUD endpoints.
- Logistics / Stock: endpoints para eventos logísticos e stock.
- Automation: endpoints para triggers manuais do scheduler.

### 6) Database: esquema e práticas

- DB: `data/warehouse.duckdb` (DuckDB file).
- Tabelas críticas (mapeadas no código e docs):
  - `transactions` (campos: data, tipo, valor, descricao, referencia, "Ciclo Pagamento", empresa_id, marketplace_id, etc.).
  - `bank_trf` / `bank_movements`.
  - `orders`, `order_lines` (separado), `sku_mapping`.
  - `invoices` (id, ciclo_pagamento, nome_ficheiro, caminho_ficheiro, tamanho, empresa_id, marketplace_id).
  - `suppliers`, `purchase_orders`, `purchase_order_items`.
  - `logistics_events`, `receptions`, `reception_lines`, `invoice_extractions`, `ledger_entries` (ver `07_DATA_SCHEMA.md` para SQL exato e `triple_match_view`).
- Observações:
  - ID generation: implementado via `SELECT COALESCE(MAX(id),0)+1` — risco de race conditions.
  - Para produção com escrita concorrente, avaliar migrar escrita crítica para PostgreSQL ou proteger via fila/lock.

### 7) Frontend — estrutura e fluxos

- `frontend/src/app/` — app router com `layout.tsx` e `page.tsx`.
- `frontend/src/components/` — Layout (Header/Sidebar), Dashboard (KPICards, Charts), Transactions (Table/Filter), UploadForm.
- `frontend/src/context/` — `TenantContext` e `AuthContext` para multi-tenant e autenticação.
- `frontend/src/lib/api.ts` — cliente Axios que deve anexar `empresa_id` aos requests ou ler do `TenantContext`.
- UX flows:
  - Seleção de empresa → chamadas com `empresa_id`.
  - Upload UI → chama `/api/v1/upload/*` e mostra `records_inserted`.
  - Dashboards → chamam `/api/v1/kpis` e endpoints de listagem; usam Recharts para gráficos.
- Scripts: `package.json` com dev scripts (`dev`, `dev:3000`, `dev:3001`) e `next` 14.

### 8) Automação, scraping e integrações

- Scheduler (`automation_service`) roda jobs noturnos:
  - Ingest automático de ficheiros.
  - Scraping Mirakl / fornecedores (`mirakl_scraper`, `supplier_scraper`).
  - Price sync e atualizações de stock (`price_sync_service`).
  - Geração de relatórios e envio de notificações.
- Há serviços para monitorização de reembolsos e cancelamentos (`refund_monitoring_service`).

### 9) Operação e scripts

- Scripts Windows: `start_completo.bat`, `start.bat`, `INICIAR_BACKEND.bat`, `PARAR_TUDO.bat`.
- Backend scripts: `backend/scripts/seed_empresas.py`, `migrate_to_pixmania.py`.
- Backups: sugerido copy de `data/warehouse.duckdb` antes de migrar ou aplicar SQL.

### 10) Observabilidade, segurança e riscos

- Logging: prints e `logging` configurado; recomenda-se migrar prints para logging estruturado e nivelado (INFO/ERROR) e integrar com um collector (ELK/Prometheus).
- Segurança: CORS controlado por `settings`; `security_service` e `encryption_service` existem mas recomenda-se revisar autenticação/autorizações e secrets handling.
- Riscos técnicos:
  - Concurrency/IDs em DuckDB.
  - Escritas concorrentes em DuckDB.
  - Falta de testes automatizados visíveis — recomenda-se adicionar unit/integration tests.
  - Dependência em scraping — fragile a mudanças nos sites.

### 11) Recomendações práticas

- Backup imediato de `data/warehouse.duckdb`.
- Adicionar testes automatizados para ETL, reconciliação e endpoints críticos.
- Considerar mover operações de escrita concorrente para RDBMS (Postgres) se houver múltiplos writers simultâneos.
- Substituir geração manual de IDs por UUIDs ou um gerador centralizado.
- Consolidar logs (remover prints, usar logger) e adicionar métricas (latência, contagem de uploads, falhas).
- Validar e versionar os mappings `orders_columns_mapping.yaml` e oferecer uma UI para gerir mappings.
- Rever política de cache e garantir invalidação consistente.

### 12) Anexos úteis (locais no repo)

- SQL schema (logistics/triple-match): em `docs/07_DATA_SCHEMA.md`.
- Routers: `backend/app/api/v1/` (ver cada `.py`).
- Services: `backend/app/services/`.
- ETL: `backend/app/etl/`.
- Config: `backend/app/config/`.
- Frontend app: `frontend/src/app/`, `frontend/src/components/`, `frontend/src/context/`.

---

## Fim do documento

(se quiser, posso tentar converter este Markdown para PDF automaticamente aqui; se preferir, também posso gerar uma versão mais detalhada por endpoint antes da conversão.)