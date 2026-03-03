# 📡 Endpoints da API

Lista completa de endpoints da API REST.

## Base URL

```
http://localhost:8000/api/v1
```

## Upload

### `POST /upload/transactions`
Upload de ficheiro de transações.

**Body**: `multipart/form-data`
- `file`: Ficheiro XLSX/CSV
- `clear_existing`: Boolean (opcional)

**Resposta**:
```json
{
  "success": true,
  "message": "Processados X transações",
  "records_inserted": 1000
}
```

### `POST /upload/trf`
Upload de transferências bancárias.

**Body**: `multipart/form-data`
- `file`: Ficheiro XLSX/CSV

### `POST /upload/orders`
Upload de listagem de orders.

**Body**: `multipart/form-data`
- `file`: Ficheiro XLSX/CSV

## KPIs

### `GET /kpis/all`
Todos os KPIs.

**Query params**:
- `empresa_id`: Integer (opcional)
- `marketplace_id`: Integer (opcional)

### `GET /kpis/prazos`
Métricas de prazos.

### `GET /kpis/comissoes/acum`
Comissões acumuladas.

### `GET /kpis/comissoes/ult`
Comissões último ciclo.

### `GET /kpis/reembolsos/acum`
Reembolsos acumulados.

### `GET /kpis/reembolsos/ult`
Reembolsos último ciclo.

### `GET /kpis/reserva/saldo`
Saldo de reserva.

## Transações

### `GET /transactions/`
Listar transações.

**Query params**:
- `ciclo_pagamento`: String (opcional)
- `ciclo_inicio`: String (opcional)
- `ciclo_fim`: String (opcional)
- `tipo`: String (opcional)
- `limit`: Integer (padrão: 10000)
- `offset`: Integer (padrão: 0)

### `GET /transactions/types`
Listar tipos de transação únicos.

## Pedidos

### `GET /orders/`
Listar pedidos.

**Query params**:
- `empresa_id`: Integer (opcional)
- `marketplace_id`: Integer (opcional)
- `limit`: Integer (padrão: 100)
- `offset`: Integer (padrão: 0)

## Pendentes

### `GET /pendentes/`
Listar pendentes (transações e pedidos).

**Query params**:
- `empresa_id`: Integer (opcional)
- `marketplace_id`: Integer (opcional)
- `limit`: Integer (padrão: 1000)

## Empresas

### `GET /empresas/`
Listar empresas.

### `GET /empresas/{id}`
Detalhes de empresa.

## Marketplaces

### `GET /marketplaces/`
Listar marketplaces.

**Query params**:
- `empresa_id`: Integer (opcional)

### `GET /marketplaces/{id}`
Detalhes de marketplace.

## Bancos

### `GET /bank/movements`
Listar movimentos bancários.

**Query params**:
- `mes`: String (opcional, formato: "YYYY-MM")
- `data_inicio`: String (opcional)
- `data_fim`: String (opcional)

### `POST /bank/movements`
Criar movimento bancário.

### `PUT /bank/movements/{id}`
Atualizar movimento bancário.

### `DELETE /bank/movements/{id}`
Eliminar movimento bancário.

## Faturas

### `GET /invoices/`
Listar faturas.

### `POST /invoices/`
Upload de fatura (PDF).

### `DELETE /invoices/{id}`
Eliminar fatura.

## Referências

- [API Overview](./overview.md)
- [Exemplos](./examples.md)

