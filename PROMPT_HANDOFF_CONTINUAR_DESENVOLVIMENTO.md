# Prompt completo para continuar o desenvolvimento (handoff para Claude/outro dev)

Copia o bloco abaixo e cola na conversa com o Claude (ou outro assistente) quando quiseres continuar o desenvolvimento a partir do estado atual do projeto.

---

## INÍCIO DO PROMPT (copiar daqui até ao fim da secção "Ficheiros principais")

```
Atua como Arquiteto de Software e Desenvolvedor para um ERP de Dropshipping Multi-empresa e Multi-canal. O projeto está em desenvolvimento ativo; as Fases 1 a 5 do roadmap estão implementadas. Preciso que continues a partir deste ponto.

---

## Stack e contexto

- **Backend:** FastAPI (Python), DuckDB (base de dados analítica em ficheiro, ex.: `data/warehouse.duckdb`), Pandas, APScheduler, Playwright (opcional, para RPA).
- **Frontend:** Next.js (React), TypeScript, componentes em `frontend/src/components/`.
- **Objetivo:** Centralizar decisões de compra, automatizar fluxos e garantir rastreabilidade de lucro e separação fiscal por empresa (`empresa_id` em todas as tabelas relevantes).

---

## Estado atual: o que já está feito

### Fase 1 – Fundação e Dados Mestres
- **DuckDB:** Tabelas `suppliers` (com FK a `empresas`), `marketplaces`, `office_locations`, `company_cards`, `supplier_access` (credenciais com encriptação AES-256/Fernet a partir de `ENCRYPTION_KEY` no `.env`). Migrações para `auto_sync_prices`, `auto_sync_trackings`, `auto_sync_invoices` em `supplier_access`.
- **Backend:** Template Excel e import em lote de fornecedores (`GET/POST` suppliers template/import); segurança com `security_service` (encrypt/decrypt); endpoints de acessos e sync de perfil por fornecedor.
- **Frontend:** Ficha de Fornecedor por abas (Geral, Fiscal, Logística, Acessos) com dropdown "Empresa Associada"; aba Acessos com URL, user, password, API Key e opções de sincronização automática.

### Fase 2 – Motor de Vendas e Inteligência de Previsão
- **DuckDB:** `sales_orders`, `sales_order_items`, `marketplaces_config`, `sku_mapping` (empresa_id, sku_marketplace, sku_fornecedor, supplier_id, custo_fornecedor, vat_rate), `pending_purchase_items`. Vista `v_rentabilidade_prevista` (lucro previsto por linha e flag `mapping_em_falta`).
- **Backend:** `SalesModuleService` (import de ordens, cálculo de comissões, trigger para compras); `UniversalSalesIngestor` (normalização JSON/CSV/Excel); `PurchaseAutoDraftService` (criação automática de itens em `pending_purchase_items` com custo e fornecedor). Endpoints: `POST /sales/import`, `POST /sales/import/json`, `GET /sales/stats` (inclui `lucro_previsto`), `GET /sales/recent-with-margin`.
- **Frontend:** Listagem de vendas com GMV, comissões, lucro previsto; tabela "Vendas Recentes" com lucro previsto por linha e badge "Mapping em falta" quando o SKU não está em `sku_mapping`.

### Fase 3 – Operação de Compras e Consolidação
- **DuckDB:** `purchase_orders` (empresa_id, supplier_id, status Draft/Ordered/Paid/Received, tracking_number, invoice_pdf_url, due_date, invoice_ref, invoice_amount, dados fiscais), `purchase_order_items` (ligação a `sales_order_item_id` para rastreabilidade). Migrações para `pending_purchase_items`: margin_alert, margin_alert_msg.
- **Backend:** `PurchaseAggregatorService`: `create_pos_from_pending(pending_item_ids)` agrupa por (empresa_id, supplier_id) e cria uma PO por grupo; atualiza `pending_purchase_items` para 'ordered'. Endpoints: `GET /purchases/pending`, `POST /purchases/consolidate`, `GET /purchases/drafts`.
- **Frontend:** Módulo Compras com tab "Central de Compras" (itens pendentes agrupados por fornecedor, seleção em massa, aviso fiscal), tab "Checkout" com lista de POs em Draft e wizard sequencial (dados fiscais em evidência, botão "Copiar Itens para Carrinho").

### Fase 4 – Midnight Sync e Robótica (RPA)
- **DuckDB:** Tabela `sync_history` com `supplier_id`, `empresa_id`, `sync_type` (Prices, Tracking, Invoices), `status`, `message`, `duration_seconds`; migrações para adicionar estes campos se não existirem.
- **Backend:** MidnightSyncOrchestrator (job às 00:00 via APScheduler): para cada fornecedor com Acessos preenchidos e pelo menos um auto_sync ativo, instancia scraper via factory e executa Prices + Tracking + Invoices. Integração Fase 5: após sync de Invoices chama `_auto_ledger_for_invoices` para criar lançamentos de Crédito em `supplier_ledger`. `BaseScraper` (abstrato), `MiraklScraper` (Playwright headless), `scraper_factory.get_scraper(url_site)`. Sync manual: `run_sync_now_async(supplier_id)` em thread. Endpoints: `POST /api/v1/automation/sync-now/{supplier_id}`, `GET /api/v1/automation/stats`, `GET /api/v1/automation/history`, `GET /api/v1/automation/status` (inclui `suppliers_with_access`).
- **Frontend:** Módulo "Status de Automação" (id `automation`); página `AutomationStatusPage`: KPIs do dia, "Forçar Sincronização Agora", tabela de logs com filtros.

**Nota técnica:** Playwright em headless; sync-now em thread. Para scrapers: `pip install playwright` e `playwright install chromium`.

### Fase 5 – Ciclo Financeiro e Reconciliação (implementada)
- **DuckDB:** `supplier_ledger` (conta corrente: empresa_id, supplier_id, data_movimento, tipo, valor_credito, valor_debito, saldo_acumulado, purchase_order_id, documento_ref, notas). `financial_reconciliation` (triple-match: purchase_order_id, invoice_ref, invoice_amount, po_amount, bank_movement_id, bank_amount, status, discrepancy_amount, discrepancy_notes, matched_at). Migrações em `purchase_orders`: due_date, invoice_ref, invoice_amount.
- **Backend:** `AccountingMatchService` (accounting_match_service.py): extrato da conta corrente (`get_ledger`), lançamento manual (`create_ledger_entry`), aging por fornecedor (dívidas a vencer / vencido 30d / vencido >30d), reconciliação (discrepâncias e match por PO), rentabilidade (GMV, devoluções, comissões, custo_base, portes_reais, impostos_po, lucro_real, margem_pct), cash-flow forecast (projeção de saídas por data de vencimento). Endpoints em `backend/app/api/v1/finance.py`: `GET /finance/ledger/{supplier_id}`, `POST /finance/ledger/entry`, `GET /finance/aging`, `GET /finance/reconciliation/discrepancies`, `POST /finance/reconciliation/match/{po_id}`, `GET /finance/profitability`, `GET /finance/cash-flow-forecast`.
- **Frontend:** Módulo "Finanças Globais" (id `financas`) na sidebar; página `FinanceGlobalView` com tabs: Aging por Fornecedor (dívida total, a vencer, vencido <30d, >30d), Rentabilidade Líquida (GMV, custo total, lucro real, margem %; filtros data início/fim; gráfico waterfall), Extrato da Conta Corrente (por fornecedor/empresa), Divergências Triple-Match (tabela e ações), Previsão de Tesouraria (cash-flow por dia/POs).

---

## Próximos passos possíveis (não implementados ou a aprofundar)

- **Melhorias Fase 4:** Alerta de prejuízo quando o robô deteta subida de preço que anula a margem (campos `margin_alert`, `margin_alert_msg` já existem em `pending_purchase_items`); refinamento de selectors do MiraklScraper; mais scrapers na factory.
- **Fase 5:** Integração mais profunda banco ↔ reconciliação (movimentos bancários batidos automaticamente); relatório de lucratividade por empresa vs visão grupo; export PDF/Excel dos relatórios financeiros.

---

## Ficheiros principais para contexto

- **Backend:**  
  `backend/app/config/database.py` (schema, migrações, sync_history, supplier_ledger, financial_reconciliation, FKs),  
  `backend/app/config/settings.py` (DATABASE_PATH, ENCRYPTION_KEY),  
  `backend/app/main.py` (routers incluindo finance, startup/shutdown do scheduler),  
  `backend/app/api/v1/automation.py`, `backend/app/api/v1/finance.py`, `backend/app/api/v1/sales.py`, `backend/app/api/v1/purchases.py`, `backend/app/api/v1/suppliers.py`,  
  `backend/app/services/automation_service.py` (midnight job, run_sync_now_async, _auto_ledger_for_invoices),  
  `backend/app/services/accounting_match_service.py` (ledger, aging, reconciliation, profitability, cash-flow),  
  `backend/app/services/base_scraper.py`, `backend/app/services/mirakl_scraper.py`, `backend/app/services/scraper_factory.py`,  
  `backend/app/services/supplier_scraper.py`, `backend/app/services/sales_module_service.py`, `backend/app/services/purchase_auto_draft_service.py`, `backend/app/services/purchase_aggregator_service.py`,  
  `backend/app/services/price_sync_service.py`, `backend/app/services/security_service.py`.

- **Frontend:**  
  `frontend/src/app/page.tsx` (roteamento: vendas, compras, bancos, dados-mestres, automation, financas),  
  `frontend/src/components/layout/Sidebar.tsx` (MODULO_VENDAS, MODULO_COMPRAS, MODULO_BANCOS, MODULO_DADOS_MESTRES, MODULO_AUTOMATION, MODULO_FINANCAS),  
  `frontend/src/components/automation/AutomationStatusPage.tsx`,  
  `frontend/src/components/finance/FinanceGlobalView.tsx` (Aging, Rentabilidade, Ledger, Discrepâncias, Cash-Forecast),  
  `frontend/src/lib/api/automation.ts`, `frontend/src/lib/api/finance.ts`,  
  `frontend/src/components/compras/ComprasView.tsx`, `frontend/src/components/listings/SalesList.tsx`.

- **Documentação / especificações:**  
  `Especificacao_App_Pagamentos_Marketplace.txt`, `docs/` (se existir).

---

Agora [descreve aqui a tarefa concreta que queres: ex. "Implementar alerta de prejuízo na Fase 4", "Melhorar relatório de rentabilidade por empresa", "Corrigir X no endpoint Y", etc.].
```

---

## FIM DO PROMPT

---

## Como usar

1. Abre o ficheiro `PROMPT_HANDOFF_CONTINUAR_DESENVOLVIMENTO.md` neste projeto.
2. Copia todo o bloco entre "INÍCIO DO PROMPT" e "FIM DO PROMPT" (incluindo a última linha antes de "FIM DO PROMPT").
3. No final do prompt, substitui a frase "Agora [descreve aqui a tarefa concreta...]" pela tarefa real que queres (ex.: "Implementar a Fase 5: Supplier Ledger e reconciliação triangular").
4. Cola na conversa com o Claude (ou outro assistente) e envia.

Assim o assistente recebe o contexto completo do projeto e do estado das Fases 1–5 e pode continuar de forma coerente.
