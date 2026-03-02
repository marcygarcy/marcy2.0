# 06 - Operations & Runbook

Este documento direcciona operações, backups, deploy e retenção.

Backups
- DuckDB: snapshot diário de `data/warehouse.duckdb` para `backups/warehouse_YYYYmmddHHMM.duckdb`.
- Retenção: manter 30 dias por defeito, mover para cold storage após 90 dias.

Deploy
- Recomenda-se containerização (Docker) para backend e frontend.
- Staging separado (host/port diferentes). Criar playbooks para deploy automatizado.

Runbook Rápido
1. Verificar serviços: `curl http://localhost:8000/health`
2. Reiniciar backend: parar processo e `uvicorn app.main:app --reload --port 8000`
3. Restaurar backup: substituir `data/warehouse.duckdb` pelo ficheiro de backup.

Monitorização
- Integrar logs com central (ELK/Datadog) e criar alertas para falhas em jobs RPA e falhas de receção/exceptions.
