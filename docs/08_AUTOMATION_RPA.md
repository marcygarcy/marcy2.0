# 08 - Automation & RPA

Objetivos
- Jobs noturnos (Midnight Sync): sincronizar preços, extrair faturas, atualizar trackings.
- RPA flows: Playwright para scraping de portais que não expõem API, automações de retry e escalation.

Recomendações técnicas
- Implementar jobs em separado (repo ou pasta `automation/`) com Playwright + Node.js ou Python Playwright.
- Agendar via cron / Windows Task Scheduler / Kubernetes CronJob.
- Expor estado das jobs via API (job status, last_run, last_success, errors).

Observability
- Logs centralizados, métricas de sucesso/falha, alertas (Slack/email) para falhas repetidas.
