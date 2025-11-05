# 💳 Marketplace Payments App

Aplicação simples de análise de pagamentos de marketplace - **Frontend apenas em Node.js**

## 🚀 Execução

### ⚠️ CRÍTICO: Parar TODOS os Servidores Antigos Primeiro

**Se está a ver erros de React/Axios/localhost:8000, está a usar a aplicação ERRADA!**

**Execute primeiro:**
```bash
PARAR_TUDO.bat
```

Isso vai parar:
- Servidor Next.js na porta 3001 (aplicação antiga)
- Backend Python na porta 8000
- Todos os outros servidores Node.js (exceto o novo na porta 3000)

**Depois:**
1. Feche **TODAS** as tabs do browser
2. Feche completamente o browser (Alt+F4)
3. Execute: `npm start`
4. Abra **http://localhost:3000** (NÃO 3001!)

### Instalação

```bash
npm install
```

### Executar

```bash
npm start
```

ou no Windows:

```bash
start.bat
```

### Aceder à Aplicação

**Abra o browser e vá para:** **http://localhost:3000**

⚠️ **NÃO use localhost:8000 ou localhost:3001** - essas são as aplicações antigas!

## 📋 Funcionalidades

- ✅ Upload de ficheiros de histórico de transações (XLSX/CSV)
- ✅ Upload de transferências bancárias (TRF)
- ✅ Cálculo de KPIs localmente (sem backend)
- ✅ Dashboard completo com todas as visualizações
- ✅ Breakdown detalhado do último ciclo
- ✅ Conciliação Net vs TRF
- ✅ Análise de comissões por ciclo
- ✅ Gestão de reservas
- ✅ Análise de prazos

## 📁 Estrutura

```
marketplace-payments-app/
├── server.js              # Servidor Express simples
├── package.json
├── start.bat             # Script para Windows
├── public/
│   ├── index.html         # Interface HTML
│   ├── styles.css         # Estilos
│   └── app.js             # Lógica JavaScript
└── README.md
```

## 📤 Upload de Ficheiros

### Formato Aceite
- **XLSX** (Excel) - Recomendado
- **CSV** (Comma Separated Values)
- **XLS** (Excel antigo)

### Tipos de Ficheiro

1. **Histórico de Transações**
   - Colunas principais: Ciclo Pagamento, Data do ciclo de faturamento, Tipo, Crédito, Débito
   - O sistema mapeia automaticamente variações de nomes de colunas

2. **Transferências Bancárias (TRF)**
   - Colunas: data, valor, referencia, descricao
   - Mapeamento automático de colunas

## 🎯 KPIs Calculados

- Prazos médios de pagamento (média, mínimo, máximo)
- Total de pedidos recebidos
- Total de produtos vendidos
- Reserva presa (saldo em aberto)
- Ciclo da constituição da última reserva
- Total de comissões pagas (sem impostos)
- Imposto sobre comissões
- Total de reembolsos incluindo impostos
- Conciliação: Net por ciclo vs TRF (+0/+7 dias)

## 💡 Notas

- **Tudo processado localmente** - Os dados nunca saem do seu computador
- **Sem base de dados** - Dados processados em memória
- **Interface simples** - HTML/CSS/JavaScript puro
- **Sem dependências pesadas** - Apenas Express para servir ficheiros estáticos

## 🔧 Tecnologias

- Node.js
- Express (servidor simples)
- XLSX (leitura de ficheiros Excel via CDN)
- PapaParse (leitura de CSV via CDN)
- Chart.js (gráficos via CDN)
- Vanilla JavaScript (sem frameworks)

## 📝 Como Usar

1. Inicie o servidor: `npm start`
2. Abra http://localhost:3000 no browser
3. Selecione o tipo de ficheiro (Transações ou TRF)
4. Carregue o ficheiro (arrastar e soltar ou clicar)
5. Clique em "Processar Ficheiro"
6. Explore os KPIs nas diferentes tabs!
