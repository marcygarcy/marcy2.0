````markdown
# Módulo de Vendas (Sales & Orders) – Dropshipping

## Visão geral

O módulo centraliza as encomendas (orders) exportadas dos marketplaces (Worten, Amazon, Pixmania, etc.) e calcula a **margem real** por venda, suportando o controlo de negócio em modelo Dropshipping. As vendas podem ser cruzadas no futuro com o fluxo de reconciliação (Order ID ↔ pagamentos).

---

## 1. Schema DuckDB

### Tabela `orders` (expandida)

Campos principais para Dropshipping:

| Área | Campos |
|------|--------|
| **Identificação** | `numero_pedido`, `data_criacao`, `empresa_id`, `marketplace_id`, `canal_vendas` |
| **Produto** | `sku_oferta`, `nome_produto`, `quantidade` |
| **Venda** | `valor_total_com_iva` (bruto), `valor_total_sem_impostos`, `total_impostos_pedido`, `total_impostos_envio`, `comissao_sem_impostos`, `valor_transferido_loja` |
| **Custo** | `custo_fornecedor`, `gastos_envio`, `outras_taxas` |
| **Margem** | `margem_unitaria`, `margem_total_linha` (calculados ou preenchidos) |
| **Status** | `status`, `status_operacional` (Pendente, Enviado, Entregue, Cancelado, Devolvido) |
| **Reconciliação** | `pago_reconciliado`, `data_reconciliacao` |

... (truncated for archive)

````
