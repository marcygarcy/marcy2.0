# 💳 Recebimentos Marketplaces V1.1

Sistema completo para gestão e análise de recebimentos de marketplaces multi-tenant.

## 🚀 Início Rápido

### Instalação
```bash
# Backend
cd backend
pip install -r requirements.txt

# Frontend
cd frontend
npm install
```

### Executar
```bash
# Windows
start_completo.bat

# Manual
# Terminal 1 — Backend com --reload (reinicia sozinho ao alterar ficheiros)
cd backend && python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

# Terminal 2 — Frontend em modo dev (atualiza ao alterar; evita página em branco ao dar refresh)
cd frontend && npm run dev
```

**Desenvolvimento:** Usa sempre `npm run dev` no frontend (e backend com `--reload`). Assim não precisas de reiniciar ao alterar código; um refresh (F5) mostra as alterações. Se a página ficar em branco, aparece agora uma mensagem de erro com detalhes (ou verifica a consola do browser, F12).

### Aceder
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

## 📚 Documentação

A documentação completa está organizada em `/docs`:

- **[📖 Documentação Completa](./docs/README.md)** - Índice principal
- **[🚀 Início Rápido](./docs/setup/getting-started.md)** - Começar a usar
- **[📖 Como Usar](./docs/usage/how-to-use.md)** - Guia de utilização
- **[🏗️ Arquitetura](./docs/architecture/overview.md)** - Estrutura do sistema

## ✨ Funcionalidades

- ✅ **Multi-tenant**: Múltiplas empresas e marketplaces
- ✅ **KPIs Automáticos**: Cálculo de métricas em tempo real
- ✅ **Upload de Dados**: Transações, transferências, orders
- ✅ **Listagens**: Transações, pedidos, pendentes
- ✅ **Gestão Bancária**: Movimentos bancários
- ✅ **Conciliação**: Net vs Transferências
- ✅ **Análises**: Gráficos e relatórios

## 🏢 Empresas Suportadas

- teste 369
- Teste 123 (Pixmania, Worten)
- testes xyz
- Teste 123
- testes xyz

## 🛠️ Tecnologias

- **Backend**: FastAPI (Python)
- **Frontend**: Next.js (React + TypeScript)
- **Base de Dados**: DuckDB (SQL in-process)
- **ETL**: Pandas

## 📝 Estrutura

```
projeto/
├── backend/      # FastAPI backend
├── frontend/      # Next.js frontend
├── docs/          # Documentação completa
└── README.md      # Este ficheiro
```

## 🔗 Links Úteis

- [Documentação Completa](./docs/README.md)
- [Setup e Instalação](./docs/setup/getting-started.md)
- [Troubleshooting](./docs/troubleshooting/common-issues.md)
- [API Documentation](./docs/api/overview.md)

## 📞 Suporte

Para problemas, consulte:
- [Troubleshooting](./docs/troubleshooting/common-issues.md)
- [LEIA ISTO PRIMEIRO](./docs/troubleshooting/LEIA_ISTO_PRIMEIRO.md)

---

**Versão**: V1.1  
**Última atualização**: 2024
