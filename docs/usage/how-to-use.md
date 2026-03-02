# 📖 Como Usar

Guia completo de utilização da aplicação **Recebimentos Marketplaces V1.1**.

## Iniciar a Aplicação

### Windows
```bash
start_completo.bat
```

### Manual
```bash
# Terminal 1 - Backend
cd backend
uvicorn app.main:app --reload --port 8000

# Terminal 2 - Frontend
cd frontend
npm run dev
```

Aceda a: **http://localhost:3000**

## Fluxo Principal

### 1. Selecionar Empresa e Marketplace

No sidebar esquerdo:
1. Selecione a empresa (ex: "Teste 123")
2. Selecione o marketplace (ex: "Pixmania")

### 2. Carregar Dados

#### Upload de Transações
1. Vá à tab **"📥 Upload"**
2. Selecione **"Histórico de Transações (XLSX/CSV)"**
3. Arraste o ficheiro ou clique para selecionar
4. Aguarde o processamento

#### Upload de Transferências Bancárias
1. Na mesma tab **"📥 Upload"**
2. Selecione **"Transferências Bancárias (TRF)"**
3. Carregue o ficheiro

#### Upload de Orders
1. Na tab **"📥 Upload"**
2. Selecione **"Listagem de Orders (XLSX/CSV)"**
3. Carregue o ficheiro

### 3. Visualizar KPIs

Vá à tab **"📊 KPIs"** para ver:
- Vendas Brutas
- Total de Produtos Vendidos
- Nº Pedidos Acumulado
- Comissões Acumuladas
- Comissões Último Ciclo
- Último Ciclo Pago
- E mais...

### 4. Explorar Funcionalidades

#### Listagens
- **Listagem de Transações**: Ver todas as transações com filtros
- **Listagem de Pedidos Global**: Ver todos os pedidos
- **Listagem de Pendentes**: Ver transações e pedidos pendentes

#### Bancos
- **Movimentos Bancários**: Registar movimentos bancários manualmente
- Filtrar por mês ou intervalo de datas

#### Faturas
- Carregar faturas (PDF)
- Associar a ciclos de pagamento

#### Conciliação
- Comparar valores Net vs Transferências Bancárias
- Ver reconciliação por ciclo

#### Reservas
- Ver todas as reservas
- Filtrar e pesquisar

## Funcionalidades Principais

### KPIs
- Cálculo automático de métricas
- Filtros por empresa e marketplace
- Gráficos de evolução

### Filtros
- Por ciclo de pagamento
- Por tipo de transação
- Por intervalo de datas
- Por empresa/marketplace

### Exportação
- Visualização de dados em tabelas
- Cópia de dados (manual)

## Dicas

1. **Primeiro Upload**: Carregue primeiro as transações, depois as transferências
2. **Filtros**: Use os filtros para análise específica
3. **Multi-tenant**: Selecione sempre empresa/marketplace antes de analisar
4. **Pendentes**: Verifique a tab "Pendentes" para itens não processados

## Próximos Passos

- [Upload de Ficheiros](./file-upload.md)
- [KPIs e Métricas](./kpis.md)
- [Funcionalidades](./features.md)

