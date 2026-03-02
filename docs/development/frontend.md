# 💻 Frontend - Next.js

Documentação do frontend do projeto.

## Estrutura

```
frontend/
├── src/
│   ├── app/           # Páginas (App Router)
│   ├── components/    # Componentes React
│   ├── context/       # Context API
│   ├── lib/           # Utilitários e API
│   └── types/         # TypeScript types
├── public/            # Ficheiros estáticos
└── package.json       # Dependências
```

## Executar

```bash
cd frontend
npm run dev
```

Aceda a: http://localhost:3000

## Principais Componentes

### Layout (`src/components/layout/`)
- `Sidebar.tsx` - Sidebar com empresas/marketplaces
- `Header.tsx` - Cabeçalho da aplicação

### Dashboard (`src/components/dashboard/`)
- `KPIGrid.tsx` - Grid de KPIs
- `KPICard.tsx` - Card individual de KPI
- `SalesChart.tsx` - Gráfico de vendas
- `TopProductsCard.tsx` - Produtos mais vendidos
- `ReconciliationTable.tsx` - Tabela de conciliação

### Listagens (`src/components/listings/`)
- `ListingsContainer.tsx` - Container de listagens
- `TransactionsList.tsx` - Lista de transações
- `OrdersList.tsx` - Lista de pedidos
- `PendentesList.tsx` - Lista de pendentes

### Upload (`src/components/upload/`)
- `FileUpload.tsx` - Componente de upload

### API (`src/lib/api/`)
- `client.ts` - Cliente HTTP (Axios)
- `kpis.ts` - API de KPIs
- `transactions.ts` - API de transações
- `orders.ts` - API de pedidos
- `pendentes.ts` - API de pendentes
- E mais...

### Hooks (`src/lib/hooks/`)
- `useKPIs.ts` - Hook para KPIs
- `useUpload.ts` - Hook para upload
- `useInvoices.ts` - Hook para faturas
- E mais...

## Context API

`src/context/AppContext.tsx` - Estado global:
- Empresa selecionada
- Marketplace selecionado
- Persistência no localStorage

## Variáveis de Ambiente

Criar `frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Referências

- [Backend](./backend.md)
- [Next.js Docs](https://nextjs.org/docs)

