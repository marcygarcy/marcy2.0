# Estrutura do Ficheiro de Histórico de Transações

## Ficheiro de Entrada

O utilizador deve carregar o **Histórico de Transações por Ciclo** do marketplace.

**Formato:** XLSX ou CSV  
**Nome sugerido:** `historico_trasacoes.xlsx` ou similar

## Colunas do Ficheiro Real

Baseado no ficheiro `historico_trasacoes.xlsx`:

### Colunas Principais

| Coluna no Ficheiro | Mapeamento para BD | Tipo | Descrição |
|-------------------|-------------------|------|-----------|
| `Data Criação` | `Data Criação` | TIMESTAMP | Data de criação do pedido |
| `Data Recebida` | - | TIMESTAMP | Data de receção (não usado na BD) |
| `Data Transação` | - | TIMESTAMP | Data da transação (não usado na BD) |
| `Data do ciclo de faturamento` | `Data do ciclo de faturamento` | TIMESTAMP | Data do ciclo de faturamento |
| `Ciclo Pagamento` | `Ciclo Pagamento` | TEXT | Identificador do ciclo (ex: "20/10 a 31/10") |
| `Canal de vendas` | `Canal de vendas` | TEXT | Canal de vendas (ex: "B2C", "IT - Italy - B2C") |
| `Tipo` | `Tipo` | TEXT | Tipo de transação (ex: "Valor do pedido", "Taxas de comissão") |
| `Crédito` | `Crédito` | DOUBLE | Valor de crédito |
| `Débito` | `Débito` | DOUBLE | Valor de débito |
| `Valor` | - | DOUBLE | Valor total (não usado diretamente) |
| `Saldo` | - | DOUBLE | Saldo acumulado (não usado na BD) |
| `Descrição` | `Descrição` | TEXT | Descrição detalhada da transação |
| `Nº Pedido` | `Nº Pedido` | TEXT | Número do pedido (ex: "7345196-A") |
| `Número da fatura` | `Nº da fatura` | TEXT | Número da fatura |
| `Número da transação` | `Nº da transação` | TEXT | Número da transação |
| `Rótulo da categoria` | `Rótulo da categoria` | TEXT | Categoria do produto |
| `SKU da oferta` | `SKU da oferta` | TEXT | SKU do produto |
| `Moeda` | `Moeda` | TEXT | Moeda (ex: "EUR") |
| `Status do pagamento` | - | TEXT | Status (ex: "Pago") - não usado na BD |
| `Quantidade` | - | DOUBLE | Quantidade - não usado na BD |
| `Loja` | - | TEXT | Nome da loja - não usado na BD |
| `ID de loja` | - | TEXT | ID da loja - não usado na BD |
| `ID da linha do pedido` | - | TEXT | ID da linha - não usado na BD |
| `ID do reembolso` | - | TEXT | ID do reembolso - não usado na BD |
| `Referência do pedido do cliente` | - | TEXT | Referência cliente - não usado na BD |
| `Referência do pedido loja` | - | TEXT | Referência loja - não usado na BD |
| `dias` / `Dias` | - | INTEGER | Dias - não usado na BD |
| `Rótulos de Linha` | - | TEXT | Rótulos - não usado na BD |
| `Soma de Valor` | - | DOUBLE | Soma - não usado na BD |

### Colunas Calculadas

- **`real`**: Calculado automaticamente como `Crédito - Débito`

## Problemas de Encoding

O ficheiro pode ter problemas de encoding com caracteres especiais:
- `Data Criao` → `Data Criação`
- `DÃ©bito` → `Débito`
- `CrÃ©dito` → `Crédito`
- `NÃº Pedido` → `Nº Pedido`

O código de ingestão normaliza automaticamente estes problemas.

## Exemplo de Dados

```
Data Criação: 06/08/2025
Ciclo Pagamento: 20/10 a 31/10
Canal de vendas: B2C
Tipo: Valor do pedido
Crédito: 1276.28
Débito: NaN
Descrição: Valor do pedido de iPhone 16 Pro Max...
Nº Pedido: 7345196-A
Nº da fatura: 253901
```

## Mapeamento para KPIs

O campo `Tipo` é usado para classificar transações em buckets:

- `Valor do pedido` → `itens`
- `Taxas de comissão` → `taxas`
- `Imposto sobre taxas de comissão` → `imp_taxas`
- `Valor do envio do pedido` → `envio`
- `Valor do pedido de reembolso` → `refunds_itens`
- etc.

Ver `backend/app/etl/classify.py` para mapeamento completo.

