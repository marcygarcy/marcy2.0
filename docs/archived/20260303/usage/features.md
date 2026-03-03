# ✨ Funcionalidades

Lista completa de funcionalidades do sistema **Recebimentos Marketplaces V1.1**.

## Funcionalidades Principais

### 📊 Dashboard e KPIs
- ✅ Cálculo automático de KPIs
- ✅ Filtros por empresa e marketplace
- ✅ Gráficos de evolução
- ✅ Cards de métricas principais
- ✅ Visualização de produtos mais vendidos

### 📥 Upload de Dados
- ✅ Upload de histórico de transações (XLSX/CSV)
- ✅ Upload de transferências bancárias (TRF)
- ✅ Upload de listagem de orders (pedidos)
- ✅ Processamento automático
- ✅ Mapeamento inteligente de colunas

### 📋 Listagens
- ✅ **Listagem de Transações**: Ver todas as transações com filtros
- ✅ **Listagem de Pedidos Global**: Ver todos os pedidos
- ✅ **Listagem de Pendentes**: Transações e pedidos sem pagamento

### 🏦 Gestão Bancária
- ✅ **Movimentos Bancários**: Registar movimentos manualmente
- ✅ Filtros por mês ou intervalo de datas
- ✅ Campos: Data CTB, Data Movimento, Ciclo, Montante

### 📄 Gestão de Faturas
- ✅ Upload de faturas (PDF)
- ✅ Associar a ciclos de pagamento
- ✅ Organização por ciclos

### 🔄 Conciliação
- ✅ Comparação Net vs Transferências Bancárias
- ✅ Reconciliação por ciclo
- ✅ Tolerância de dias (+0/+7 dias)

### 🔒 Gestão de Reservas
- ✅ Listagem de todas as reservas
- ✅ Filtros e pesquisa
- ✅ Informações detalhadas: Data, Fatura, Tipo, Status, Valor, Ciclo

### 🏢 Multi-tenant
- ✅ Suporte a múltiplas empresas
- ✅ Suporte a múltiplos marketplaces por empresa
- ✅ Filtros automáticos por empresa/marketplace
- ✅ Sidebar para seleção

### 📈 Análises
- ✅ Gráfico de vendas brutas por ciclo
- ✅ Produtos mais vendidos (histórico e últimos 60 dias)
- ✅ Breakdown do último ciclo
- ✅ Análise de prazos
- ✅ Análise de comissões

### 🔍 Pesquisa e Filtros
- ✅ Pesquisa por número de pedido
- ✅ Filtro por ciclo de pagamento
- ✅ Filtro por tipo de transação
- ✅ Filtro por intervalo de ciclos
- ✅ Filtro por data

## Funcionalidades Técnicas

### Backend
- ✅ API REST com FastAPI
- ✅ Base de dados DuckDB (SQL in-process)
- ✅ ETL automático para processamento de ficheiros
- ✅ Normalização de dados
- ✅ Cálculo de KPIs em tempo real

### Frontend
- ✅ Interface moderna com Next.js
- ✅ Design responsivo
- ✅ Tabs organizadas
- ✅ Componentes reutilizáveis
- ✅ Context API para estado global

### Segurança
- ✅ CORS configurado
- ✅ Validação de dados
- ✅ Sanitização de inputs

## Funcionalidades Futuras

- 🔄 Exportação de dados (Excel/PDF)
- 🔄 Relatórios automáticos
- 🔄 Notificações
- 🔄 Dashboard personalizável
- 🔄 API para integrações

## Referências

- [Como Usar](./how-to-use.md)
- [KPIs e Métricas](./kpis.md)

