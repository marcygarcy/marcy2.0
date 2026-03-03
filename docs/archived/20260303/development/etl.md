# 🔄 ETL (Extract, Transform, Load)

Documentação do processamento de dados (ETL).

## Fluxo ETL

```
Ficheiro (XLSX/CSV)
    ↓
Extract (ler ficheiro)
    ↓
Transform (normalizar)
    ↓
Load (inserir na BD)
```

## Componentes

### `ingest.py`
Funções principais:
- `load_transactions()` - Carregar transações
- `load_trf()` - Carregar transferências
- `load_orders()` - Carregar orders
- `insert_transactions()` - Inserir transações
- `insert_orders()` - Inserir orders

### `transform.py`
Transformações de dados:
- Normalização de colunas
- Conversão de tipos
- Cálculo de campos derivados

### `classify.py`
Classificação de transações:
- Mapeamento de tipos
- Buckets de categorias
- Validação de dados

### `reconcile.py`
Conciliação:
- Comparação Net vs TRF
- Matching de valores
- Tolerâncias de dias

## Mapeamento de Colunas

O sistema reconhece variações:
- `Data Criação` / `Data Criacao` / `data_criacao`
- `Nº Pedido` / `numero_pedido` / `Order`
- `Ciclo Pagamento` / `ciclo_pagamento` / `Cycle`

## Processamento

### Normalização
- Remoção de espaços
- Correção de encoding (quando necessário)
- Conversão de tipos

### Validação
- Campos obrigatórios
- Tipos de dados
- Valores válidos

### Associação Multi-tenant
- Atribuição automática de `empresa_id`
- Atribuição automática de `marketplace_id`
- Baseado no contexto selecionado

## Referências

- [Backend](./backend.md)
- [Estrutura de Ficheiros](../setup/file-structure.md)

