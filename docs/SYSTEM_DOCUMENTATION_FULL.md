# ERP Dropshipping — Documentação Completa
**Projeto:** Recebimentos Marketplaces / ERP Multi-empresa
**Versão:** 1.1
**Repositório:** https://github.com/marcygarcy/marcy2.0.git
**Última atualização:** 2026-03-03

> Este é o único documento de referência do projeto. Sempre que uma funcionalidade for adicionada ou alterada, atualiza este ficheiro na secção correspondente.

---

## Índice

1. [Resumo Executivo](#1-resumo-executivo)
2. [Stack Tecnológica](#2-stack-tecnológica)
3. [Quick Start](#3-quick-start)
4. [Arquitetura](#4-arquitetura)
5. [Estrutura de Ficheiros](#5-estrutura-de-ficheiros)
6. [Base de Dados](#6-base-de-dados)
7. [Módulos ERP](#7-módulos-erp)
   - [A · Vendas & SCM](#a--vendas--scm)
   - [B · Logística](#b--logística)
   - [C · Financeiro](#c--financeiro)
   - [D · Configuração & Automação](#d--configuração--automação)
8. [API — Endpoints](#8-api--endpoints)
9. [ETL — Pipeline de Dados](#9-etl--pipeline-de-dados)
10. [Automação & RPA](#10-automação--rpa)
11. [Multi-tenant](#11-multi-tenant)
12. [Git & Deploy](#12-git--deploy)
13. [Troubleshooting](#13-troubleshooting)
14. [FAQ](#14-faq)

---

## 1. Resumo Executivo

Sistema de análise, gestão e automação de operações de dropshipping multi-empresa e multi-canal.

**Objetivo principal:** centralizar decisões de compra, automatizar fluxos operacionais e garantir rastreabilidade de lucro e separação fiscal por empresa (`empresa_id` em todas as tabelas relevantes).

**Empresas suportadas:**
- teste 369
- Teste 123 (default, ID=2)
- testes xyz
- Teste 123
- testes xyz

**Estado das Fases:**

| Fase | Descrição | Estado |
|------|-----------|--------|
| 1 | Fundação, Dados Mestres, Fornecedores | ✅ Completo |
| 2 | Motor de Vendas, Margem Prevista, SKU Mapping | ✅ Completo |
| 3 | Compras, Consolidação POs, Checkout Wizard | ✅ Completo |
| 4 | Midnight Sync, RPA / Scrapers, Automação | ✅ Completo |
| 5 | Ciclo Financeiro, Conta Corrente, Triple-Match, Aging | ✅ Completo |

---

## 2. Stack Tecnológica

| Camada | Tecnologia | Porta |
|--------|-----------|-------|
| Frontend | Next.js 14 + TypeScript + Tailwind + shadcn/ui | 3000 |
| Backend | FastAPI + Uvicorn (Python) | 8000 |
| Base de Dados | DuckDB (ficheiro `backend/data/warehouse.duckdb`) | — |
| ETL | Pandas + scripts Python em `backend/app/etl/` | — |
| Scheduler | APScheduler (job nocturno midnight sync) | — |
| Scraping | Playwright (headless Chromium) | — |
| Segurança | AES-256 / Fernet (`ENCRYPTION_KEY` no `.env`) | — |

---

## 3. Quick Start

### Pré-requisitos
- Python 3.9+
- Node.js 18+ (LTS)
- Git

### Instalação

```bash
# 1. Clonar repositório
git clone https://github.com/marcygarcy/marcy2.0.git
cd marcy2.0

# 2. Backend
cd backend
pip install -r requirements.txt
cp .env.example .env   # editar ENCRYPTION_KEY, CORS_ORIGINS, etc.

# 3. Frontend
cd ../frontend
npm install
cp .env.example .env.local
```

### Arrancar

**Windows (recomendado):**
```bash
start_completo.bat
```

**Manual:**
```bash
# Terminal 1 — Backend
cd backend
uvicorn app.main:app --reload --port 8000

# Terminal 2 — Frontend
cd frontend
npm run dev
```

### Verificar

| Serviço | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| Swagger/Docs | http://localhost:8000/docs |
| Health check | http://localhost:8000/health |

### Inicializar base de dados (primeira vez)

```bash
cd backend
python -c "from app.config.database import init_database; init_database()"
```

---

## 4. Arquitetura

```
┌─────────────────────────────────────┐
│  Frontend (Next.js 14)              │
│  components/ · context/ · lib/api/  │
└────────────────┬────────────────────┘
                 │ REST / JSON
┌────────────────▼────────────────────┐
│  Backend (FastAPI)                  │
│  api/v1/*.py · services/ · etl/     │
└────────────────┬────────────────────┘
                 │ SQL
┌────────────────▼────────────────────┐
│  DuckDB  (data/warehouse.duckdb)    │
│  Analytics in-process, file-based   │
└─────────────────────────────────────┘
```

**Camadas:**

| Camada | Ficheiros |
|--------|-----------|
| Presentation | `frontend/src/components/` |
| API Layer | `backend/app/api/v1/*.py` |
| Business Logic | `backend/app/services/*.py` |
| ETL | `backend/app/etl/*.py` |
| Data Access | DuckDB queries, views (`v_*`) |
| Config | `backend/app/config/database.py`, `settings.py` |

**Nota importante:** DuckDB é excelente para analytics mas não suporta alta concorrência de escrita. Para escrita concorrente, avaliar migração de tabelas críticas para PostgreSQL.

---

## 5. Estrutura de Ficheiros

```
marcy2.0/
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI app, routers, startup/shutdown
│   │   ├── api/v1/                  # Routers por módulo
│   │   │   ├── upload.py
│   │   │   ├── kpis.py
│   │   │   ├── transactions.py
│   │   │   ├── invoices.py
│   │   │   ├── bank.py
│   │   │   ├── orders.py
│   │   │   ├── sales.py
│   │   │   ├── purchases.py
│   │   │   ├── suppliers.py
│   │   │   ├── finance.py
│   │   │   ├── automation.py
│   │   │   ├── rma.py
│   │   │   ├── logistics.py
│   │   │   ├── billing.py
│   │   │   ├── office_stock.py
│   │   │   ├── payment_methods.py
│   │   │   ├── config.py
│   │   │   ├── empresas.py
│   │   │   ├── marketplaces.py
│   │   │   └── pendentes.py
│   │   ├── services/                # Lógica de negócio
│   │   ├── etl/                     # Ingestão e transformação
│   │   │   ├── ingest.py
│   │   │   ├── transform.py
│   │   │   ├── classify.py
│   │   │   ├── reconcile.py
│   │   │   ├── orders_normalizer.py
│   │   │   └── encoding_fix.py
│   │   └── config/
│   │       ├── database.py          # init_database(), schemas SQL, migrações
│   │       └── settings.py          # DATABASE_PATH, ENCRYPTION_KEY, CORS_ORIGINS
│   ├── config/
│   │   ├── mapping_patterns.yaml    # Regex classificação transações
│   │   └── orders_columns_mapping.yaml  # Mapeamento colunas por marketplace
│   ├── data/
│   │   └── warehouse.duckdb         # Base de dados principal (não versionar)
│   ├── scripts/                     # Seeds, migrações, utilitários
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── app/
│       │   ├── layout.tsx
│       │   └── page.tsx             # Roteamento principal (todas as tabs)
│       ├── components/
│       │   ├── layout/              # Sidebar, Header
│       │   ├── dashboard/           # KPICard, Charts
│       │   ├── listings/            # SalesList, OrdersList, TransactionsList
│       │   ├── compras/             # ComprasView
│       │   ├── finance/             # FinanceGlobalView
│       │   ├── master/              # SupplierMasterView, etc.
│       │   ├── automation/          # AutomationStatusPage
│       │   └── ui/                  # shadcn/ui components
│       ├── context/
│       │   └── AppContext.tsx       # empresa/marketplace selecionados
│       └── lib/api/                 # Clientes API por módulo
├── docs/
│   ├── SYSTEM_DOCUMENTATION_FULL.md  ← este ficheiro
│   ├── CHANGELOG.md
│   └── archived/                    # Documentação antiga (não apagar)
└── start_completo.bat
```

---

## 6. Base de Dados

**Ficheiro:** `backend/data/warehouse.duckdb`
**Inicialização:** `database.py → init_database()` aplica todos os schemas SQL e migrações automáticas.

### Tabelas Principais

| Tabela | Descrição |
|--------|-----------|
| `empresas` | Entidades legais (multi-tenant) |
| `marketplaces` | Canais de venda por empresa |
| `transactions` | Transações MP (upload Excel/CSV) |
| `bank_trf` / `bank_movements` | Movimentos bancários |
| `orders` | Orders importadas (legacy) |
| `sales_orders` | Ordens de venda normalizadas |
| `sales_order_items` | Linhas de venda |
| `sku_mapping` | SKU marketplace → fornecedor + custo |
| `pending_purchase_items` | Itens aguardam compra (draft automático) |
| `purchase_orders` | POs de compra a fornecedores |
| `purchase_order_items` | Linhas de PO |
| `suppliers` | Fornecedores (com FK a empresas) |
| `supplier_access` | Credenciais fornecedores (encriptadas) |
| `supplier_ledger` | Conta corrente por fornecedor |
| `financial_reconciliation` | Triple-match PO ↔ Fatura ↔ Banco |
| `sync_history` | Log de sincronizações automáticas |
| `invoices` | Registo de faturas PDF |
| `billing_documents` | Proformas / faturas de venda |

### Views Importantes

| View | Descrição |
|------|-----------|
| `v_rentabilidade_prevista` | Lucro previsto por linha de venda |
| `v_sales_rentabilidade` | Lucro real (com custos reais da PO) |
| `v_rentabilidade_triangular` | Visão triangular venda/compra/fatura |

### Fórmula de Margem

```
Margem = Venda sem IVA − Comissão − (Custo Fornecedor × Qty) − Portes − Outras Taxas
```

### Schema SQL Logístico (tabelas auxiliares)

```sql
-- logistics_events, inventory_transit, receptions, reception_lines,
-- invoice_extractions, vat_oss_rules, ledger_entries
-- Ver backend/scripts/schema_*.sql para SQL completo
```

### Observações Técnicas

- ID generation via `SELECT COALESCE(MAX(id),0)+1` — avaliar UUID para produção
- Backup obrigatório antes de qualquer migração: copiar `data/warehouse.duckdb`
- Encoding suportado: UTF-8, Latin-1, CP1252 (automático no ETL)

---

## 7. Módulos ERP

### A · Vendas & SCM

#### Recebimentos Marketplaces
- Upload Excel/CSV de transações por empresa/marketplace
- Cálculo de KPIs: comissões, reembolsos, reserva, prazos
- Reconciliação Net vs TRF (janela +7 dias, intencional)
- Endpoints: `/api/v1/upload/*`, `/api/v1/kpis/*`, `/api/v1/transactions/*`

#### Vendas e Margem (`sales`)
- Import de ordens via Excel/CSV/JSON com normalização por marketplace
- Cálculo de margem prevista e real por linha
- Alerta de prejuízo: linha vermelha quando `lucro_previsto < 0`
- Badge "Mapping em falta" quando SKU não está em `sku_mapping`
- Gatilho automático para `pending_purchase_items` ao importar
- Endpoints: `/api/v1/sales/*`
- Frontend: `SalesList.tsx`

#### Compras (`purchases`)
- Central de Compras: itens pendentes agrupados por fornecedor
- Consolidação: `create_pos_from_pending()` cria uma PO por (empresa, fornecedor)
- Checkout wizard: dados fiscais, botão "Copiar Itens para Carrinho"
- 6 tabs: Central | Global Cockpit | Pendentes | Checkout | Tracking | Estado Vendas
- Endpoints: `/api/v1/purchases/*`
- Frontend: `ComprasView.tsx`

#### Fornecedores (`suppliers`)
- Ficha completa: Geral, Fiscal, Logística, Acessos
- Credenciais encriptadas AES-256 (URL, user, password, API Key)
- Opções de sincronização automática (preços, trackings, faturas)
- Endpoints: `/api/v1/suppliers/*`

---

### B · Logística

#### Gestão de Escritório (`office_stock`)
- Stock por escritório / localização
- Endpoints: `/api/v1/office_stock/*`
- Frontend: `OfficeStockView.tsx`

#### Devoluções RMA
- Registo e acompanhamento de devoluções
- Endpoints: `/api/v1/rma/*`
- Frontend: `RMAView.tsx`

#### Logística Operacional
- Eventos logísticos, expedição, receção
- Endpoints: `/api/v1/logistics/*`
- Frontend: `OfficeLogisticsView.tsx`

---

### C · Financeiro

#### Bancos
- Extratos bancários e movimentos
- Criação manual de movimentos
- Frontend: `BancosView.tsx`

#### Finanças Globais (`finance`) — Fase 5
Tabs disponíveis:

| Tab | Descrição |
|-----|-----------|
| Aging | Dívida a fornecedores: total, a vencer, vencido <30d, >30d |
| Rentabilidade | GMV, custo total, lucro real, margem % com filtros de data |
| Tesouraria | Cash-flow por dia / POs vencidas |
| Projeção Saldo | Projeção de saldo bancário |
| Health Fornecedores | Indicadores de saúde por fornecedor |
| POs e Faturas | Listagem POs com estado de fatura; modal "Registar Fatura" |
| Conta Corrente | Extrato da conta corrente por fornecedor |
| Divergências | Triple-match: discrepâncias PO ↔ Fatura ↔ Banco |
| Pagamentos | Antecipado, Sugestão, Cartão, Débito direto |

- Endpoints: `/api/v1/finance/*`
- Frontend: `FinanceGlobalView.tsx`

**Nota:** Modal "Registar Fatura" só mostra POs sem `invoice_ref` (POs já faturadas são filtradas).

#### Faturação (`billing`)
- Proformas e faturas de venda
- Endpoints: `/api/v1/billing/*`
- Frontend: `BillingView.tsx`

---

### D · Configuração & Automação

#### Dados Mestres
- Empresas, Marketplaces, Escritórios, SKU Bridge, Tax Matrix
- Frontend: `EmpresasMasterView`, `MarketplacesMasterView`, `SkuBridgeView`, `TaxMatrixView`

#### Automação / RPA — Fase 4
- **Midnight Sync:** job às 00:00 (APScheduler) — para cada fornecedor com `auto_sync` ativo executa Prices + Tracking + Invoices
- **MiraklScraper:** Playwright headless para scraping de portais
- **Sync manual:** `POST /api/v1/automation/sync-now/{supplier_id}`
- **Alerta de margem:** `margin_alert`/`margin_alert_msg` em `pending_purchase_items`
- Instalar Playwright: `pip install playwright && playwright install chromium`
- Endpoints: `/api/v1/automation/*`
- Frontend: `AutomationStatusPage.tsx`

---

## 8. API — Endpoints

### Base URL
```
http://localhost:8000/api/v1
```

### Upload
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/upload/transactions` | Upload transações (XLSX/CSV) |
| POST | `/upload/trf` | Upload transferências bancárias |
| POST | `/upload/orders` | Upload orders |
| DELETE | `/upload/transactions` | Apagar todas as transações (admin) |

### KPIs
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/kpis/all` | Todos os KPIs |
| GET | `/kpis/prazos` | Métricas de prazos |
| GET | `/kpis/comissoes/acum` | Comissões acumuladas |
| GET | `/kpis/comissoes/ult` | Comissões último ciclo |
| GET | `/kpis/reembolsos/acum` | Reembolsos acumulados |
| GET | `/kpis/reserva/saldo` | Saldo de reserva |
| GET | `/kpis/comissoes-por-ciclo` | Comissões por ciclo (gráfico) |

### Transações
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/transactions/` | Listar (filtros: ciclo, tipo, limit, offset) |
| GET | `/transactions/types` | Tipos únicos |

### Vendas (Sales)
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/sales/import` | Import Excel/CSV |
| POST | `/sales/import/json` | Import via JSON |
| GET | `/sales/list` | Listagem de ordens |
| GET | `/sales/stats` | GMV, comissões, lucro previsto |
| GET | `/sales/recent-with-margin` | Vendas recentes com lucro por linha |
| GET | `/sales/metrics` | Métricas gerais |
| GET | `/sales/top-products` | Ranking SKUs mais rentáveis |

### Compras (Purchases)
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/purchases/pending` | Itens pendentes de compra |
| POST | `/purchases/consolidate` | Criar POs a partir de pendentes |
| GET | `/purchases/drafts` | POs em estado Draft |
| GET | `/purchases/orders` | Listagem de POs com estado fatura |
| POST | `/purchases/{id}/invoice` | Registar fatura numa PO |

### Finanças
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/finance/ledger/{supplier_id}` | Extrato conta corrente |
| POST | `/finance/ledger/entry` | Lançamento manual |
| GET | `/finance/aging` | Aging por fornecedor |
| GET | `/finance/reconciliation/discrepancies` | Divergências triple-match |
| POST | `/finance/reconciliation/match/{po_id}` | Fazer match PO |
| GET | `/finance/profitability` | Rentabilidade líquida |
| GET | `/finance/cash-flow-forecast` | Previsão de tesouraria |
| GET | `/finance/suppliers/{id}/open-pos` | POs sem fatura (modal registar fatura) |
| POST | `/finance/invoices` | Registar fatura multi-PO |

### Automação
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/automation/sync-now/{supplier_id}` | Sync manual imediato |
| GET | `/automation/stats` | Estatísticas do scheduler |
| GET | `/automation/history` | Histórico de syncs |
| GET | `/automation/status` | Estado atual |

### Empresas & Marketplaces
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/empresas/` | Listar empresas |
| GET | `/marketplaces/` | Listar marketplaces (filtro: empresa_id) |

### Banco
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/bank/movements` | Listar movimentos |
| POST | `/bank/movements` | Criar movimento |
| PUT | `/bank/movements/{id}` | Atualizar |
| DELETE | `/bank/movements/{id}` | Eliminar |

### Faturas
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/invoices/` | Listar faturas |
| POST | `/invoices/` | Upload PDF |
| DELETE | `/invoices/{id}` | Eliminar |

---

## 9. ETL — Pipeline de Dados

### Fluxo típico

```
Upload (XLSX/CSV)
    ↓
ingest.py — carrega DataFrame, mapeia colunas
    ↓
encoding_fix.py — corrige UTF-8 / Latin-1 / CP1252
    ↓
transform.py — limpeza, standardização
    ↓
classify.py — categorização via regex (mapping_patterns.yaml)
    ↓
insert_* — persistência em DuckDB
    ↓
reconcile.py — agrupamentos por ciclos, net vs trf
    ↓
CacheService.clear() — invalida cache KPIs
```

### Ficheiros ETL

| Ficheiro | Função |
|----------|--------|
| `ingest.py` | Carrega Excel/CSV → DataFrame |
| `orders_normalizer.py` | Normaliza orders por marketplace (via YAML) |
| `transform.py` | Limpeza e standardização |
| `classify.py` | Classificação de transações (regex via YAML) |
| `encoding_fix.py` | Correção automática de encoding |
| `reconcile.py` | Reconciliação Net vs TRF, ciclos de pagamento |

### Configuração por YAML

| Ficheiro | Conteúdo |
|----------|----------|
| `backend/config/mapping_patterns.yaml` | Regex para classificar transações e identificar reservas |
| `backend/config/orders_columns_mapping.yaml` | Mapeamento de colunas por marketplace para normalização |

---

## 10. Automação & RPA

### Midnight Sync (Fase 4)

- **Quando:** 00:00 via APScheduler
- **O que faz:** Para cada fornecedor com acessos preenchidos e `auto_sync` ativo:
  1. Instancia scraper via `scraper_factory.get_scraper(url_site)`
  2. Executa sync de Prices, Trackings e Invoices
  3. Após sync de Invoices → `_auto_ledger_for_invoices` cria lançamentos na conta corrente
- **Resultado:** Tabela `sync_history` com log por (supplier_id, empresa_id, sync_type, status, duration_seconds)

### Scrapers disponíveis

| Ficheiro | Descrição |
|----------|-----------|
| `base_scraper.py` | Classe abstrata base |
| `mirakl_scraper.py` | Playwright headless para Mirakl |
| `supplier_scraper.py` | Scraper genérico de fornecedor |
| `scraper_factory.py` | Factory: `get_scraper(url_site)` |

### Sync manual via CSV (bypass password)

Se existir o ficheiro `data/temp_scrapes/prices_{supplier_id}.csv`, o sync não requer `ENCRYPTION_KEY`. Fluxo: `seed_total.py → sync-now → CSV → update_sku_costs → check_and_flag_margin_alerts`.

### Instalação Playwright

```bash
pip install playwright
playwright install chromium
```

---

## 11. Multi-tenant

**AppContext** (`frontend/src/context/AppContext.tsx`) exporta:
- `empresaSelecionada` (Empresa | null)
- `marketplaceSelecionado` (Marketplace | null)

**Default:** empresa ID=2 (Teste 123), marketplace ID=1 (Pixmania)

**Todos os componentes** devem propagar `empresa_id` e `marketplace_id` nos pedidos API. Usar `.id` do objeto, não um campo separado (`empresaId`/`marketplaceId` não são exportados diretamente).

---

## 12. Git & Deploy

### Repositório

```bash
git clone https://github.com/marcygarcy/marcy2.0.git
```

### Workflow diário

```bash
git add .
git commit -m "descrição das alterações"
git push origin main
```

### Comandos úteis

```bash
git status                          # ver estado
git log --oneline -10               # histórico
git diff                            # ver diferenças
git pull origin main                # atualizar

# Se houver conflitos:
git pull origin main --allow-unrelated-histories
```

### Autenticação GitHub

**HTTPS com token:**
1. GitHub → Settings → Developer settings → Personal access tokens
2. Permissões: `repo`
3. Usar o token como password no push

**SSH:**
```bash
git remote set-url origin git@github.com:marcygarcy/marcy2.0.git
```

### Deploy (recomendado)

- Containerização Docker para backend e frontend
- Variáveis de ambiente via `.env` (nunca versionar)
- Staging separado antes de produção
- Backups automáticos: `data/warehouse.duckdb` → `backups/warehouse_YYYYMMDD.duckdb`

---

## 13. Troubleshooting

### Erros de arranque

**"Port already in use"**
```bash
# Windows
PARAR_TUDO.bat

# Linux/macOS
lsof -ti:8000 | xargs kill -9
lsof -ti:3000 | xargs kill -9
```

**"Module not found"**
```bash
cd backend && pip install -r requirements.txt
cd frontend && npm install
```

**"Table not found"**
```bash
cd backend
python -c "from app.config.database import init_database; init_database()"
```

### Erros de upload

| Erro | Solução |
|------|---------|
| "Ficheiro inválido" | Verificar se é XLSX ou CSV e se tem colunas esperadas |
| "Nenhum pedido válido" | Verificar mapeamento de colunas no YAML |
| Upload lento | Ficheiros grandes processam em background, aguardar |

### Erros de API

| Erro | Solução |
|------|---------|
| CORS error | Verificar `CORS_ORIGINS` no `.env` do backend |
| 404 Not Found | Verificar rota e se backend está a correr |
| 500 Internal Server Error | Ver logs do backend, verificar BD |

### Erros de base de dados

**"Database locked"**
- Fechar outras conexões ao DuckDB
- Reiniciar o backend

**Restaurar backup**
```bash
cp backups/warehouse_YYYYMMDD.duckdb data/warehouse.duckdb
```

### Interface

| Problema | Solução |
|----------|---------|
| Sidebar não aparece | Selecionar empresa/marketplace; recarregar página |
| KPIs não atualizam | Refresh manual; verificar se dados foram carregados |
| CORS no browser | Verificar se ambos os serviços estão a correr |

---

## 14. FAQ

**Q: Como faço backup da base de dados?**
A: Copiar `backend/data/warehouse.duckdb` para `backups/` antes de qualquer alteração. Recomendado snapshot diário.

**Q: Que formatos são aceites para upload?**
A: `.xlsx` e `.csv` para transações/orders; `.pdf` para faturas (via Invoice Hub).

**Q: O DuckDB suporta múltiplos utilizadores em simultâneo?**
A: Excelente para leitura analytics; para escrita concorrente intensa considerar PostgreSQL para tabelas críticas.

**Q: Como adicionar um novo marketplace?**
A: Interface → Dados Mestres → Marketplaces → Novo. Associar à empresa correta.

**Q: Como adicionar um novo fornecedor?**
A: Interface → Dados Mestres → Fornecedores → Novo. Preencher abas Geral, Fiscal, Logística e Acessos.

**Q: O que é o Triple-Match?**
A: Processo de reconciliação que cruza a PO de compra ↔ Fatura do fornecedor ↔ Movimento bancário. Divergências aparecem na tab "Divergências" em Finanças Globais.

**Q: Como funciona o alerta de prejuízo?**
A: Em Vendas e Margem, quando `lucro_previsto_linha < 0` a linha fica vermelha com badge "Alerta de Prejuízo". Ativado também quando o Midnight Sync deteta subida de preço do fornecedor.

**Q: Como forçar uma sincronização manual com um fornecedor?**
A: Interface → Automação → "Forçar Sincronização Agora" e selecionar fornecedor. Ou via API: `POST /api/v1/automation/sync-now/{supplier_id}`.

---

*Documento mantido em `docs/SYSTEM_DOCUMENTATION_FULL.md`. Atualizar sempre que houver alterações ao sistema.*
