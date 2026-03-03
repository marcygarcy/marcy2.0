# 📊 KPIs e Métricas

Documentação completa sobre os KPIs calculados pelo sistema.

## KPIs Disponíveis

### Vendas Brutas
**Descrição**: Soma de todos os valores de pedidos (tipo "Valor do pedido")

**Cálculo**: `SUM(Valor)` onde `Tipo = "Valor do pedido"`

**Filtros**: Por empresa e marketplace

### Total de Produtos Vendidos no Último Ciclo
**Descrição**: Quantidade de produtos vendidos no último ciclo de pagamento

**Cálculo**: Contagem de transações do tipo "Valor do pedido" no último ciclo

**Filtros**: Apenas último ciclo

### Nº Pedidos Acumulado
**Descrição**: Total de pedidos desde o início

**Cálculo**: Contagem única de `Nº Pedido`

**Filtros**: Por empresa e marketplace

### Comissões Acumuladas
**Descrição**: Total histórico de comissões pagas (sem impostos)

**Cálculo**: `SUM(Crédito)` onde `Tipo = "Taxas de comissão"`

**Filtros**: Por empresa e marketplace

### Comissões Último Ciclo
**Descrição**: Comissões apenas do último ciclo

**Cálculo**: `SUM(Crédito)` do último ciclo onde `Tipo = "Taxas de comissão"`

### Último Ciclo Pago
**Descrição**: Identificador do último ciclo que foi pago

**Fonte**: Prioriza movimentos bancários, depois transações

**Valor**: Valor total do último ciclo pago

### Reserva Presa
**Descrição**: Saldo em aberto (reservas não pagas)

**Cálculo**: Diferença entre créditos e débitos acumulados

### Prazos
**Descrição**: Métricas de prazos de pagamento

**Métricas**:
- Prazo médio (dias)
- Prazo mínimo (dias)
- Prazo máximo (dias)

**Cálculo**: Diferença entre data de criação e data de ciclo de faturamento

### Reembolsos
**Descrição**: Total de reembolsos incluindo impostos

**Tipos**:
- Reembolsos Acumulados
- Reembolsos Último Ciclo

## Visualizações

### Gráfico de Vendas Brutas
Gráfico de barras mostrando evolução das vendas por ciclo.

### Produtos Mais Vendidos
Card mostrando:
- SKU do produto mais vendido
- Categoria
- Quantidade
- Valor total
- Preço unitário

Disponível para:
- Dados históricos
- Últimos 60 dias

## Filtros

Todos os KPIs podem ser filtrados por:
- Empresa (multi-tenant)
- Marketplace (multi-tenant)
- Ciclo de pagamento (quando aplicável)

## Atualização

Os KPIs são atualizados automaticamente após:
- Upload de novos ficheiros
- Mudança de empresa/marketplace selecionado
- Refresh manual

## Referências

- [Funcionalidades](./features.md)
- [Como Usar](./how-to-use.md)

