# 09 - FAQ Consolidado

Perguntas frequentes e respostas rápidas — combinação das FAQs existentes.

Q: Como faço backup da base?
A: Copiar `data/warehouse.duckdb` para `backups/` diariamente; manter 30 dias.

Q: Que formato de ficheiro é aceite para upload?
A: `.xlsx` para transações e transfers; invoices em PDF são suportadas via Invoice Hub (OCR).

Q: Como corro a aplicação localmente?
A: Ver `02_QUICK_START.md`.

Q: O DuckDB suporta alta concorrência?
A: É excelente para analytics; para OLTP de alta concorrência considere Postgres para receções em tempo-real.
