# 02 - Quick Start (Setup rápido)

Este guia rápido ajuda a pôr o projecto a correr localmente em ~5 minutos.

Pré-requisitos
- Python 3.9+
- Node.js (LTS)

Passos principais
1. Backend
```
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

2. Frontend
```
cd frontend
npm install
npm run dev
```

3. Verificar serviços
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs (Swagger): http://localhost:8000/docs

Problemas comuns
- Porta ocupada: alterar porta do uvicorn ou frontend
- Erro de módulos: reinstalar `pip install -r requirements.txt` ou `npm install`
