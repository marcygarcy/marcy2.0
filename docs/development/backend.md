# 💻 Backend - FastAPI

Documentação do backend do projeto.

## Estrutura

```
backend/
├── app/
│   ├── api/          # Endpoints da API
│   ├── config/       # Configurações
│   ├── etl/          # Processamento de dados
│   ├── models/       # Modelos Pydantic
│   ├── services/     # Lógica de negócio
│   └── main.py       # Aplicação principal
├── config/           # Ficheiros de configuração
├── data/             # Base de dados DuckDB
├── scripts/          # Scripts utilitários
└── requirements.txt  # Dependências
```

## Executar

```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

## Principais Componentes

### API (`app/api/v1/`)
- `upload.py` - Upload de ficheiros
- `kpis.py` - Cálculo de KPIs
- `transactions.py` - Gestão de transações
- `orders.py` - Gestão de pedidos
- `pendentes.py` - Listagem de pendentes
- `bank.py` - Movimentos bancários
- `invoices.py` - Gestão de faturas
- `empresas.py` - Gestão de empresas
- `marketplaces.py` - Gestão de marketplaces

### ETL (`app/etl/`)
- `ingest.py` - Ingestão de dados
- `transform.py` - Transformação de dados
- `classify.py` - Classificação de transações
- `reconcile.py` - Conciliação
- `schemas.py` - Schemas de dados

### Services (`app/services/`)
- `upload_service.py` - Serviço de upload
- `kpi_service.py` - Cálculo de KPIs
- `bank_service.py` - Serviço bancário
- `invoice_service.py` - Serviço de faturas
- `empresa_service.py` - Serviço de empresas
- `marketplace_service.py` - Serviço de marketplaces

### Config (`app/config/`)
- `database.py` - Configuração da base de dados
- `settings.py` - Configurações gerais

## Base de Dados

Ver [Base de Dados](../architecture/database.md)

## Scripts

- `seed_empresas.py` - Popular empresas e marketplaces
- `migrate_to_pixmania.py` - Migrar dados existentes

## Referências

- [Frontend](./frontend.md)
- [ETL](./etl.md)

