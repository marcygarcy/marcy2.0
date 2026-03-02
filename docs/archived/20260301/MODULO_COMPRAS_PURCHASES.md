```markdown
# Módulo de Compras (Purchases) – Alta Automação

## Visão geral

Módulo focado em **Dropshipping** e **Consolidação de Encomendas** para escritório (cross-docking): draft automático a partir de vendas, agregação 1:N (várias vendas → uma ordem de compra) e rentabilidade triangular (Venda vs Compra vs Banco).

---

## 1. Estrutura de dados (DuckDB)

### Tabelas

| Tabela | Descrição |
|--------|-----------|
| **suppliers** | Fornecedores (empresa_id, nome, codigo, pais_iva, taxa_iva_padrao) |
| **sku_mapping** | Já existente; coluna **supplier_id** liga ao fornecedor (SKU Marketplace ↔ SKU Fornecedor, custo base) |
| **purchase_orders** | Cabeçalho da compra: empresa_id, supplier_id, status (Draft/Ordered/Paid), tipo_envio (Direto/Escritorio), total_base, portes_totais, impostos, total_final |
| **purchase_order_items** | Elo venda↔compra: purchase_order_id, **order_id** (venda), sku, quantidade, custo_unitario, portes_rateados, impostos_rateados |

Script SQL: `backend/scripts/schema_purchases_duckdb.sql`.  
Migração aplicada em `init_database()` em `backend/app/config/database.py`.

... (truncated for archive)

```