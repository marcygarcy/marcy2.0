# 🏗️ Arquitetura do Sistema

Visão geral da arquitetura do projeto **Recebimentos Marketplaces V1.1**.

## Arquitetura Geral

```
┌─────────────┐         ┌─────────────┐
│   Frontend  │────────▶│   Backend   │
│  (Next.js)  │  HTTP   │  (FastAPI)  │
│   Port 3000 │         │  Port 8000  │
└─────────────┘         └─────────────┘
                              │
                              ▼
                        ┌─────────────┐
                        │   DuckDB    │
                        │  (SQLite)   │
                        └─────────────┘
```

## Componentes Principais

### Frontend (Next.js)
- **Framework**: Next.js 14+ (App Router)
- **UI**: React + TypeScript
- **Styling**: Tailwind CSS
- **State Management**: React Context API
- **HTTP Client**: Axios

### Backend (FastAPI)
- **Framework**: FastAPI
- **Language**: Python 3.8+
- **Database**: DuckDB (in-process SQL)
- **ETL**: Pandas
- **API**: RESTful

### Base de Dados
- **Engine**: DuckDB
- **Tipo**: In-process (sem servidor separado)
- **Localização**: `backend/data/warehouse.duckdb`
- **Schema**: SQL tables

## Fluxo de Dados

### Upload de Ficheiro
1. Frontend envia ficheiro via HTTP POST
2. Backend recebe e processa (ETL)
3. Dados normalizados inseridos na DuckDB
4. Resposta de sucesso ao frontend

### Consulta de KPIs
1. Frontend faz request GET
2. Backend consulta DuckDB
3. Backend calcula KPIs
4. Backend retorna JSON
5. Frontend renderiza

## Multi-tenant

- **Empresas**: Tabela `empresas`
- **Marketplaces**: Tabela `marketplaces`
- **Filtros**: Todos os dados têm `empresa_id` e `marketplace_id`
- **Context**: React Context API para estado global

## Segurança

- **CORS**: Configurado para desenvolvimento
- **Validação**: Pydantic models no backend
- **Sanitização**: Validação de inputs

## Escalabilidade

- **DuckDB**: Otimizado para analytics
- **In-process**: Sem overhead de rede
- **Caching**: KPIs podem ser cacheados
- **Futuro**: Possível migração para PostgreSQL

## Referências

- [Estrutura do Projeto](./project-structure.md)
- [Base de Dados](./database.md)
- [Multi-tenant](./multi-tenant.md)

