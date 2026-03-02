# 04 - Modules (ERP v5.0) — Nova Hierarquia

Visão: reorganizar o sistema em 4 pilares principais, cada um com sub-módulos claros.

- SCM — Gestão de Supply Chain
  - Dados Mestres: Fornecedores, Marketplaces, Nossas Empresas, Escritórios, Meios de Pagamento
  - Central de Compras (Procurement): rascunhos de PO, Bulk-Split Wizard, regras fiscais por empresa
  - Invoice Hub (IA / OCR): upload PDFs, OCR+LLM extraction, Triple-Match, Discrepancy Queue

- Operações — Logística & Hub Operacional
  - Inbound (Receção): scan por PO, registo IMEI/serial, reception lines, putaway
  - Inventory in Transit: cross-docking, transferências entre escritórios, ETAs
  - Outbound (Expedição): picking/packing, carriers API, labels & tracking, returns/RMA

- Finance — Controlo Financeiro & IVA
  - Ledger & Contas Correntes: lançamentos, ajustes, notas de crédito
  - Banco & Recebimentos: extratos, TRF importer, conciliação
  - Fiscalidade & OSS: VAT rules, taxable base, reports por país destino

- Automation — Automação & RPA
  - Midnight Sync: Playwright/Headless jobs (prices, invoices, trackings)
  - RPA Flows: retries, escalations, human-in-loop
  - Observability & Alerts: task status, SLAs

Notas
- Cada módulo deve ter sua API claramente versionada em `/api/v1/{module}` e permissão baseada em roles.
- Filtrar por `Global / Empresa` em toda a UI, com contexto `TenantContext`.
