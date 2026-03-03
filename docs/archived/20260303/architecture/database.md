# 🗄️ Base de Dados

Documentação da estrutura da base de dados DuckDB.

## Engine

- **DuckDB**: Base de dados SQL in-process
- **Tipo**: Analítica (OLAP)
- **Localização**: `backend/data/warehouse.duckdb`
- **Schema**: SQL padrão

## Tabelas Principais

### `transactions`
Histórico de transações do marketplace.

**Colunas principais**:
- `Ciclo Pagamento` (TEXT)
- `Data do ciclo de faturamento` (TIMESTAMP)
- `Data Criação` (TIMESTAMP)
- `Canal de vendas` (TEXT)
- `Tipo` (TEXT)
- `Crédito` (DOUBLE)
- `Débito` (DOUBLE)
- `real` (DOUBLE) - Calculado
- `Valor` (DOUBLE)
- `Nº Pedido` (TEXT)
- `Nº da fatura` (TEXT)
- E mais...

### `bank_movements`
Movimentos bancários (manuais).

**Colunas**:
- `id` (INTEGER PRIMARY KEY)
- `data_ctb` (DATE)
- `data_movimento` (DATE)
- `ciclo` (TEXT)
- `montante` (DOUBLE)
- `empresa_id` (INTEGER)
- `marketplace_id` (INTEGER)

### `orders`
Pedidos globais.

**Colunas**:
- `id` (INTEGER PRIMARY KEY)
- `numero_pedido` (TEXT)
- `data_criacao` (TIMESTAMP)
- `data_pagamento` (TIMESTAMP)
- `ciclo_pagamento` (TEXT)
- `valor_total` (DOUBLE)
- `quantidade_itens` (INTEGER)
- `status` (TEXT)
- `canal_vendas` (TEXT)
- `empresa_id` (INTEGER)
- `marketplace_id` (INTEGER)

### `empresas`
Empresas do sistema (multi-tenant).

**Colunas**:
- `id` (INTEGER PRIMARY KEY)
- `nome` (TEXT)
- `ativo` (BOOLEAN)

### `marketplaces`
Marketplaces por empresa.

**Colunas**:
- `id` (INTEGER PRIMARY KEY)
- `nome` (TEXT)
- `empresa_id` (INTEGER)
- `ativo` (BOOLEAN)

### `invoices`
Faturas (PDFs).

**Colunas**:
- `id` (INTEGER PRIMARY KEY)
- `numero_fatura` (TEXT)
- `ciclo_pagamento` (TEXT)
- `caminho_arquivo` (TEXT)
- `data_upload` (TIMESTAMP)
- `empresa_id` (INTEGER)
- `marketplace_id` (INTEGER)

## Relações

- `marketplaces.empresa_id` → `empresas.id`
- `orders.empresa_id` → `empresas.id`
- `orders.marketplace_id` → `marketplaces.id`
- `bank_movements.empresa_id` → `empresas.id`
- `bank_movements.marketplace_id` → `marketplaces.id`
- `invoices.empresa_id` → `empresas.id`
- `invoices.marketplace_id` → `marketplaces.id`

## Inicialização

A base de dados é criada automaticamente na primeira execução.

Script de inicialização: `backend/app/config/database.py`

## Backup

Para fazer backup:
```bash
cp backend/data/warehouse.duckdb backend/data/warehouse.backup.duckdb
```

## Referências

- [Arquitetura](./overview.md)
- [Multi-tenant](./multi-tenant.md)

