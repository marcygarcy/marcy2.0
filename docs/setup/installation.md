# 📥 Instalação Completa

Guia passo a passo para instalar o projeto **Recebimentos Marketplaces V1.1**.

## Passo 1: Clonar o Repositório

```bash
git clone https://github.com/marcygarcy/marcy.git
cd marcy
```

Ou se já tem o projeto:
```bash
cd "caminho/para/projeto"
```

## Passo 2: Instalar Backend

```bash
cd backend
pip install -r requirements.txt
```

Se tiver problemas com permissões:
```bash
pip install --user -r requirements.txt
```

## Passo 3: Instalar Frontend

```bash
cd frontend
npm install
```

Se tiver problemas:
```bash
npm install --legacy-peer-deps
```

## Passo 4: Verificar Instalação

### Backend
```bash
cd backend
python -c "import fastapi; print('FastAPI instalado!')"
python -c "import duckdb; print('DuckDB instalado!')"
```

### Frontend
```bash
cd frontend
npm list next react
```

## Passo 5: Inicializar Base de Dados

A base de dados é criada automaticamente na primeira execução.

Para popular com dados iniciais:
```bash
cd backend
python scripts/seed_empresas.py
```

## Passo 6: Testar

### Backend
```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

Aceda a: http://localhost:8000/docs

### Frontend
```bash
cd frontend
npm run dev
```

Aceda a: http://localhost:3000

## Problemas Comuns

### Erro: "command not found"
- Verifique se Python/Node.js estão no PATH
- Reinicie o terminal após instalação

### Erro: "permission denied"
- Use `pip install --user` para Python
- Use `sudo` no Linux/macOS (se necessário)

### Erro: "port already in use"
- Pare outros servidores na porta 8000 ou 3000
- Use `PARAR_TUDO.bat` no Windows

## Próximos Passos

- [Configuração](./configuration.md)
- [Como Usar](../usage/how-to-use.md)

