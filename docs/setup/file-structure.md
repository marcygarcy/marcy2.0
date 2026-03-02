# 📁 Estrutura de Ficheiros de Entrada

Este documento descreve a estrutura esperada dos ficheiros que podem ser carregados no sistema.

## Tipos de Ficheiro Suportados

### Formatos Aceites
- **XLSX** (Excel) - Recomendado
- **CSV** (Comma Separated Values)
- **XLS** (Excel antigo)

## 1. Histórico de Transações

### Ficheiro: `historico_trasacoes.xlsx`

**Descrição**: Histórico de transações por ciclo do marketplace.

### Colunas Principais

| Coluna no Ficheiro | Tipo | Descrição | Obrigatório |
|-------------------|------|-----------|-------------|
| `Data Criação` | TIMESTAMP | Data de criação do pedido | ✅ |
| `Ciclo Pagamento` | TEXT | Identificador do ciclo (ex: "20/10 a 31/10") | ✅ |
| `Data do ciclo de faturamento` | TIMESTAMP | Data do ciclo de faturamento | ✅ |
| `Canal de vendas` | TEXT | Canal de vendas (ex: "B2C", "IT - Italy - B2C") | ✅ |
| `Tipo` | TEXT | Tipo de transação (ex: "Valor do pedido", "Taxas de comissão") | ✅ |
| `Crédito` | DOUBLE | Valor de crédito | ✅ |
| `Débito` | DOUBLE | Valor de débito | ✅ |
| `Descrição` | TEXT | Descrição detalhada da transação | |
| `Nº Pedido` | TEXT | Número do pedido (ex: "7345196-A") | |
| `Nº da fatura` | TEXT | Número da fatura | |
| `Nº da transação` | TEXT | Número da transação | |
| `Rótulo da categoria` | TEXT | Categoria do produto | |
| `SKU da oferta` | TEXT | SKU do produto | |
| `Moeda` | TEXT | Moeda (ex: "EUR") | |

### Colunas Não Utilizadas

Estas colunas são ignoradas pelo sistema:
- `Data Recebida`
- `Data Transação`
- `Valor` (usado apenas para cálculo)
- `Saldo`
- `Status do pagamento`
- `Quantidade`
- `Loja`
- `ID de loja`
- `ID da linha do pedido`
- `ID do reembolso`
- `Referência do pedido do cliente`
- `Referência do pedido loja`
- `dias` / `Dias`
- `Rótulos de Linha`
- `Soma de Valor`

### Mapeamento Automático

O sistema reconhece variações de nomes de colunas:
- `Data Criao` → `Data Criação`
- `DÃ©bito` → `Débito`
- `CrÃ©dito` → `Crédito`
- `NÃº Pedido` → `Nº Pedido`

### Exemplo de Dados

```
Data Criação: 06/08/2025
Ciclo Pagamento: 20/10 a 31/10
Canal de vendas: B2C
Tipo: Valor do pedido
Crédito: 1276.28
Débito: 0
Descrição: Valor do pedido de iPhone 16 Pro Max...
Nº Pedido: 7345196-A
Nº da fatura: 253901
```

## 2. Transferências Bancárias (TRF)

### Ficheiro: `transferencias.xlsx` ou `trf.csv`

**Descrição**: Ficheiro com transferências bancárias recebidas.

### Colunas Principais

| Coluna no Ficheiro | Tipo | Descrição | Obrigatório |
|-------------------|------|-----------|-------------|
| `data` | DATE | Data da transferência | ✅ |
| `valor` | DOUBLE | Valor da transferência | ✅ |
| `referencia` | TEXT | Referência da transferência | |
| `descricao` | TEXT | Descrição da transferência | |

### Variações Aceites

- `Data` / `data` / `DATA`
- `Valor` / `valor` / `VALOR`
- `Referência` / `referencia` / `REFERENCIA`
- `Descrição` / `descricao` / `DESCRICAO`

## 3. Listagem de Orders (Pedidos)

### Ficheiro: `orders.xlsx` ou `listagem_de_orders.csv`

**Descrição**: Listagem global de pedidos.

### Colunas Principais

| Coluna no Ficheiro | Tipo | Descrição | Obrigatório |
|-------------------|------|-----------|-------------|
| `numero_pedido` / `Nº Pedido` | TEXT | Número do pedido | ✅ |
| `data_criacao` / `Data Criação` | TIMESTAMP | Data de criação | |
| `data_pagamento` / `Data Pagamento` | TIMESTAMP | Data de pagamento | |
| `ciclo_pagamento` / `Ciclo` | TEXT | Ciclo de pagamento | |
| `valor_total` / `Valor Total` | DOUBLE | Valor total do pedido | |
| `quantidade_itens` / `Quantidade` | INTEGER | Quantidade de itens | |
| `status` / `Status` | TEXT | Status do pedido | |
| `canal_vendas` / `Canal Vendas` | TEXT | Canal de vendas | |

## Problemas Comuns

### Encoding

Se aparecerem caracteres mal codificados (ex: `CrÃ©dito`), o sistema tenta corrigir automaticamente.

### Formato de Data

O sistema aceita vários formatos:
- DD/MM/YYYY
- YYYY-MM-DD
- DD-MM-YYYY

### Valores Vazios

Valores vazios ou `NaN` são tratados como `0` ou `NULL` conforme apropriado.

## Referências

- [Upload de Ficheiros](../usage/file-upload.md)
- [Troubleshooting Upload](../troubleshooting/upload.md)

