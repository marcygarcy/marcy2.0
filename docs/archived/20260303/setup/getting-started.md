# 🚀 Início Rápido

Guia rápido para começar a usar o projeto **Recebimentos Marketplaces V1.1**.

## Pré-requisitos

- Python 3.8+ (para backend)
- Node.js 18+ (para frontend)
- Git (opcional, para versionamento)

## Instalação Rápida

### 1. Backend

```bash
cd backend
pip install -r requirements.txt
```

### 2. Frontend

```bash
cd frontend
npm install
```

### 3. Iniciar a Aplicação

**Windows:**
```bash
start_completo.bat
```

**Manual:**
```bash
# Terminal 1 - Backend
cd backend
uvicorn app.main:app --reload --port 8000

# Terminal 2 - Frontend
cd frontend
npm run dev
```

### 4. Aceder

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

## Próximos Passos

1. [Configuração](./configuration.md) - Configurar o ambiente
2. [Como Usar](../usage/how-to-use.md) - Guia de utilização
3. [Estrutura de Ficheiros](./file-structure.md) - Entender os formatos esperados

## Problemas?

Consulte a secção [Troubleshooting](../troubleshooting/common-issues.md).

