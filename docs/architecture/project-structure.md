# 📁 Estrutura do Projeto

Organização completa de pastas e ficheiros do projeto.

## Estrutura Raiz

```
projeto/
├── backend/          # Backend FastAPI
├── frontend/         # Frontend Next.js
├── docs/             # Documentação
├── data/             # Dados (opcional)
├── public/           # Ficheiros públicos (legado)
├── scripts/          # Scripts de sistema
└── README.md         # README principal
```

## Backend

```
backend/
├── app/
│   ├── api/
│   │   ├── v1/       # Endpoints da API
│   │   └── deps.py   # Dependências
│   ├── config/       # Configurações
│   ├── etl/          # ETL (Extract, Transform, Load)
│   ├── models/       # Modelos Pydantic
│   ├── services/     # Lógica de negócio
│   └── main.py       # Aplicação principal
├── config/           # Ficheiros YAML de configuração
├── data/             # Base de dados DuckDB
│   └── warehouse.duckdb
├── scripts/          # Scripts Python utilitários
└── requirements.txt  # Dependências Python
```

## Frontend

```
frontend/
├── src/
│   ├── app/          # Páginas (App Router)
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── globals.css
│   ├── components/   # Componentes React
│   │   ├── dashboard/
│   │   ├── layout/
│   │   ├── listings/
│   │   ├── upload/
│   │   └── ui/
│   ├── context/      # Context API
│   ├── lib/          # Utilitários
│   │   ├── api/      # API clients
│   │   ├── hooks/    # React hooks
│   │   └── utils/    # Funções utilitárias
│   └── types/        # TypeScript types
├── public/           # Ficheiros estáticos
├── package.json      # Dependências Node.js
└── tsconfig.json     # Configuração TypeScript
```

## Documentação

```
docs/
├── setup/            # Instalação e configuração
├── usage/             # Guias de uso
├── development/       # Desenvolvimento
├── api/              # Documentação da API
├── architecture/     # Arquitetura
├── troubleshooting/  # Resolução de problemas
├── deployment/       # Deployment
└── git/              # Git e versionamento
```

## Ficheiros Importantes

### Raiz
- `README.md` - Documentação principal
- `start_completo.bat` - Script para iniciar tudo
- `PARAR_TUDO.bat` - Parar servidores
- `.gitignore` - Ficheiros ignorados pelo Git

### Backend
- `backend/app/main.py` - Entry point
- `backend/app/config/database.py` - Configuração DB
- `backend/requirements.txt` - Dependências

### Frontend
- `frontend/src/app/page.tsx` - Página principal
- `frontend/package.json` - Dependências
- `frontend/.env.local` - Variáveis de ambiente

## Convenções

### Nomes de Ficheiros
- Python: `snake_case.py`
- TypeScript/React: `PascalCase.tsx`
- Config: `kebab-case.yaml`

### Organização
- Componentes por funcionalidade
- API clients por recurso
- Services separados por domínio

## Referências

- [Arquitetura](./overview.md)
- [Base de Dados](./database.md)

