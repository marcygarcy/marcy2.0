# ⚙️ Configuração

Guia de configuração do ambiente do projeto.

## Variáveis de Ambiente

### Frontend

Criar ficheiro `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Backend

Criar ficheiro `backend/.env` (opcional):

```env
DATABASE_PATH=./data/warehouse.duckdb
DEBUG=True
```

## Configuração da Base de Dados

A base de dados DuckDB é criada automaticamente em:
- `backend/data/warehouse.duckdb`

Para mudar a localização, edite `backend/app/config/database.py`.

## Configuração de Empresas e Marketplaces

### Dados Iniciais

Execute o script de seed:
```bash
cd backend
python scripts/seed_empresas.py
```

### Empresas Padrão

- teste 369
- Teste 123
  - Pixmania
  - Worten
- testes xyz
- Teste 123
- testes xyz

### Associar Dados Existentes

Para associar dados históricos a uma empresa/marketplace:
```bash
cd backend
python scripts/migrate_to_pixmania.py
```

## Configuração de Portas

### Backend (padrão: 8000)

Editar `backend/app/main.py` ou usar variável de ambiente:
```bash
export PORT=8000
```

### Frontend (padrão: 3000)

Editar `frontend/package.json`:
```json
{
  "scripts": {
    "dev": "next dev -p 3000"
  }
}
```

## Scripts de Inicialização

### Windows

`start_completo.bat` - Inicia backend e frontend

### Linux/macOS

Criar script similar ou usar:
```bash
# Terminal 1
cd backend && uvicorn app.main:app --reload

# Terminal 2
cd frontend && npm run dev
```

## Configuração de CORS

Para desenvolvimento, CORS está configurado para permitir todas as origens.

Para produção, editar `backend/app/main.py`:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://seu-dominio.com"],  # Especificar origens
    allow_credentials=True,
    ...
)
```

## Próximos Passos

- [Estrutura de Ficheiros](./file-structure.md)
- [Como Usar](../usage/how-to-use.md)

