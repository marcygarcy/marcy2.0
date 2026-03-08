# Como iniciar a aplicação

## Opção 1: Um único script (recomendado)

**Execute `INICIAR_TUDO.bat`** (duplo clique ou a partir da pasta do projeto).

- Abre duas janelas: **Backend** (API) e **Frontend** (interface).
- **Backend:** http://localhost:8000 (documentação: http://localhost:8000/docs)
- **Frontend:** http://localhost:3000

Se aparecer erro **"address already in use"** no frontend:
- Feche outras janelas do frontend/Next.js que estejam a correr, **ou**
- Use **`INICIAR_TUDO_3001.bat`** → frontend em http://localhost:3001  
- Ou **`INICIAR_TUDO_3002.bat`** → frontend em http://localhost:3002  

(O backend continua sempre em http://localhost:8000.)

## Opção 2: Iniciar manualmente

1. **Backend** (num terminal):
   ```
   cd backend
   python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
   ```

2. **Frontend** (noutro terminal):
   ```
   cd frontend
   npm run dev
   ```
   Depois abra http://localhost:3000

Se a porta 3000 estiver ocupada: `npm run dev:3001` → http://localhost:3001

## Verificar se está a funcionar

- Backend: abra http://localhost:8000/health → deve mostrar `{"status":"ok"}`
- Frontend: abra http://localhost:3000 (ou 3001/3002 conforme o que usou)

O frontend comunica com o backend através da variável `NEXT_PUBLIC_API_URL` (em `frontend/.env.local`). Por defeito é `http://localhost:8000`.
