# Registo de Funcionalidades

Documento de registo de funcionalidades implementadas no projeto **Recebimentos Marketplaces / ERP Dropshipping**.
Actualizado sempre que uma nova funcionalidade é entregue.

---

## Como usar este documento

- Cada funcionalidade tem: **data**, **módulo**, **descrição**, **ficheiros alterados** e **observações**.
- **Observações** são notas de negócio, limitações conhecidas, decisões de design ou próximos passos — preenchidas no momento da entrega.
- As correcções de bugs menores estão na secção [Correcções](#correcções-de-bugs).

---

## Funcionalidades

---

### F-003 · Sales Explorer — Drawer, Badge PO, Margem, Quick Actions, Export Excel

**Data:** 2026-03-03
**Módulo:** A · Vendas & SCM → Sales Explorer (tab `explorer` em `SalesList`)
**Commit:** `2ca8c5c`

#### O que foi feito

Cinco melhorias integradas no Sales Explorer para ligar visualmente vendas às compras associadas e facilitar a navegação:

| # | Funcionalidade | Detalhe |
|---|---|---|
| 1 | **Drawer de detalhe** | Painel lateral (slide-over) ao clicar no ID do pedido. Mostra: decomposição financeira (bruto → comissão → líquido → custo → lucro), linhas da venda por SKU, PO associada com link "Ver em Compras", envio (transportadora, tracking, estado), dados do cliente (nome, NIF, morada). |
| 2 | **Badge PO na coluna Compra** | Substitui "Sim/Não" por `PO#123` clicável, colorido por estado: verde (Paid/Received), azul (Ordered), cinzento (Draft). Tooltip mostra fornecedor e estado. |
| 3 | **Coluna Margem %** | Nova coluna com a margem percentual por pedido. Cor: emerald ≥ 10 %, âmbar ≥ 0 %, vermelho < 0 %. |
| 4 | **Quick actions contextuais** | Botões de acção por linha: Detalhe (abre drawer), Ver PO (navega para módulo Compras, só se existir PO), Rastrear (abre drawer na secção envio, só se existir tracking), Proforma, Cancelar. |
| 5 | **Export Excel** | Botão "Exportar Excel" exporta o filtro activo ou apenas os pedidos seleccionados. Ficheiro `xlsx` gerado no backend com pandas/openpyxl e devolvido via `StreamingResponse`. |

#### Ficheiros alterados

**Backend:**
- `backend/app/services/sales_module_service.py` — `list_sales()` com JOINs para PO/fornecedor/margem; novo método `get_order_detail()`
- `backend/app/api/v1/sales.py` — endpoints `GET /api/v1/sales/orders/{id}` e `GET /api/v1/sales/export`; modelos Pydantic `SalesOrderDetail`, `SalesOrderItemDetail`, `SalesOrderPODetail`

**Frontend:**
- `frontend/src/lib/api/sales.ts` — novos tipos e funções `getOrderDetail()`, `exportSales()`
- `frontend/src/components/listings/SalesList.tsx` — drawer, badge, coluna margem, quick actions, export

#### Dados / Views usadas

- `v_rentabilidade_prevista` — `lucro_previsto_linha`, `custo_previsto_linha` por `sales_order_item`
- `purchase_orders`, `purchase_order_items`, `suppliers` — cadeia PO ↔ item ↔ fornecedor
- `sales_order_items` + `sku_mapping` — custo por linha no drawer

#### Observações

*(Sem observações registadas no momento da entrega — a preencher se surgirem notas de utilização ou ajustes necessários.)*

---

## Correcções de bugs

---

### B-002 · Tab "Cartão" mostrava pagamentos de todos os métodos

**Data:** 2026-03-03
**Módulo:** C · Financeiro → Finanças Globais (`FinanceGlobalView`)
**Ficheiro:** `frontend/src/components/finance/FinanceGlobalView.tsx`

**Problema:** Ao navegar para a tab "Cartão", o histórico carregava com `historicoMetodo = ''` (todos os métodos), em vez de filtrar apenas por `Cartao`.

**Solução:** O `onValueChange` das tabs passou a definir `historicoMetodo` com o valor correcto ao mudar de tab (`Cartao` / `DebitoDireto`). Adicionado `useEffect` que auto-carrega o histórico quando `subTab` muda para `cartao` ou `debito`.

**Observações:** *(Sem observações.)*

---

### B-001 · Modal "Registar Fatura" listava POs já com fatura associada

**Data:** 2026-03-03
**Módulo:** C · Financeiro → Finanças Globais → Registar Fatura
**Ficheiro:** `backend/app/services/invoice_service.py` (função `get_open_pos_for_supplier`)

**Problema:** O modal de "Registar Fatura" listava todas as POs do fornecedor, incluindo as que já tinham uma fatura registada (`invoice_ref` preenchido).

**Solução:** Adicionada condição SQL `(po.invoice_ref IS NULL OR po.invoice_ref = '')` na query de `get_open_pos_for_supplier()`.

**Observações:** *(Sem observações.)*

---

*Próxima funcionalidade a registar: preencher secção de Observações com notas do utilizador antes de encerrar.*
