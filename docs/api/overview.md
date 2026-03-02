# 🔌 API Overview

Visão geral da API REST do projeto.

## Base URL

```
http://localhost:8000/api/v1
```

## Documentação Interativa

Aceda a: http://localhost:8000/docs

## Endpoints Principais

### Upload
- `POST /upload/transactions` - Upload de transações
- `POST /upload/trf` - Upload de transferências
- `POST /upload/orders` - Upload de orders

### KPIs
- `GET /kpis/all` - Todos os KPIs
- `GET /kpis/prazos` - Prazos
- `GET /kpis/comissoes/acum` - Comissões acumuladas
- `GET /kpis/comissoes/ult` - Comissões último ciclo

### Transações
- `GET /transactions/` - Listar transações
- `GET /transactions/types` - Tipos de transação

### Pedidos
- `GET /orders/` - Listar pedidos

### Pendentes
- `GET /pendentes/` - Listar pendentes

### Empresas
- `GET /empresas/` - Listar empresas
- `GET /empresas/{id}` - Detalhes de empresa

### Marketplaces
- `GET /marketplaces/` - Listar marketplaces
- `GET /marketplaces/{id}` - Detalhes de marketplace

### Bancos
- `GET /bank/movements` - Movimentos bancários
- `POST /bank/movements` - Criar movimento
- `PUT /bank/movements/{id}` - Atualizar movimento
- `DELETE /bank/movements/{id}` - Eliminar movimento

### Faturas
- `GET /invoices/` - Listar faturas
- `POST /invoices/` - Upload de fatura
- `DELETE /invoices/{id}` - Eliminar fatura

## Autenticação

Atualmente não requer autenticação (desenvolvimento).

## Formato de Resposta

JSON padrão:
```json
{
  "data": {...},
  "message": "Success"
}
```

## Códigos de Status

- `200` - Sucesso
- `400` - Bad Request
- `404` - Not Found
- `500` - Internal Server Error

## Referências

- [Endpoints Detalhados](./endpoints.md)
- [Exemplos](./examples.md)

