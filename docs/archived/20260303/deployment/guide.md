# 🚀 Deployment

Guia de deployment do projeto.

## Pré-requisitos

- Servidor com Python 3.8+
- Servidor com Node.js 18+
- Base de dados DuckDB (não precisa de servidor separado)

## Configuração de Produção

### Backend

1. **Variáveis de Ambiente**
```bash
export DATABASE_PATH=/path/to/warehouse.duckdb
export DEBUG=False
```

2. **CORS**
Editar `backend/app/main.py`:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://seu-dominio.com"],
    allow_credentials=True,
    ...
)
```

3. **Executar**
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Frontend

1. **Build**
```bash
cd frontend
npm run build
```

2. **Variáveis de Ambiente**
Criar `.env.production`:
```
NEXT_PUBLIC_API_URL=https://api.seu-dominio.com
```

3. **Executar**
```bash
npm start
```

## Process Manager

### PM2 (Node.js)

```bash
npm install -g pm2
pm2 start npm --name "frontend" -- start
```

### Systemd (Linux)

Criar serviço systemd para backend e frontend.

## Nginx

Configuração de reverse proxy:

```nginx
server {
    listen 80;
    server_name seu-dominio.com;

    location / {
        proxy_pass http://localhost:3000;
    }

    location /api {
        proxy_pass http://localhost:8000;
    }
}
```

## SSL/HTTPS

Usar Let's Encrypt:
```bash
certbot --nginx -d seu-dominio.com
```

## Backup

### Base de Dados
```bash
cp backend/data/warehouse.duckdb backup/warehouse-$(date +%Y%m%d).duckdb
```

### Automatizar
Criar cron job para backup diário.

## Monitorização

- Logs do sistema
- Uptime monitoring
- Error tracking (opcional)

## Referências

- [Produção](./production.md)
- [Docker](./docker.md)

