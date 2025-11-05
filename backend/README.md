# Marketplace Payments API

API backend para análise de pagamentos de marketplace usando FastAPI e DuckDB.

## Instalação

```bash
pip install -r requirements.txt
```

## Executar

```bash
uvicorn app.main:app --reload --port 8000
```

A API estará disponível em `http://localhost:8000`

Documentação interativa: `http://localhost:8000/docs`

## Endpoints

### Upload
- `POST /api/v1/upload/transactions` - Upload de ficheiro de transações
- `POST /api/v1/upload/trf` - Upload de ficheiro de transferências bancárias

### KPIs
- `GET /api/v1/kpis/all` - Todos os KPIs
- `GET /api/v1/kpis/prazos` - Prazos médios
- `GET /api/v1/kpis/comissoes/acum` - Comissões acumuladas
- `GET /api/v1/kpis/comissoes/ult` - Comissões último ciclo
- `GET /api/v1/kpis/reembolsos/acum` - Reembolsos acumulados
- `GET /api/v1/kpis/reembolsos/ult` - Reembolsos último ciclo
- `GET /api/v1/kpis/reserva/saldo` - Saldo de reserva
- `GET /api/v1/kpis/reconciliation` - Conciliação Net vs TRF

