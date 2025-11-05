@echo off
echo ========================================
echo Marketplace Payments App - Versao Completa
echo ========================================
echo.
echo Iniciando Backend e Frontend...
echo.

REM Parar servidores antigos primeiro
echo Parando servidores antigos...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8000 ^| findstr LISTENING') do (
    echo Parando processo %%a na porta 8000
    taskkill /F /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
    echo Parando processo %%a na porta 3000
    taskkill /F /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3001 ^| findstr LISTENING') do (
    echo Parando processo %%a na porta 3001
    taskkill /F /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3002 ^| findstr LISTENING') do (
    echo Parando processo %%a na porta 3002
    taskkill /F /PID %%a >nul 2>&1
)

echo.
echo Aguardando 2 segundos...
timeout /t 2 /nobreak >nul

echo.
echo ========================================
echo Iniciando Backend FastAPI (porta 8000)
echo ========================================
echo.

cd backend
start "Backend FastAPI" cmd /k "python -m uvicorn app.main:app --reload --port 8000"
cd ..

echo.
echo Aguardando backend iniciar...
timeout /t 3 /nobreak >nul

echo.
echo ========================================
echo Iniciando Frontend Next.js (porta 3002)
echo ========================================
echo.

cd frontend
start "Frontend Next.js - Pagamentos Marketplace v2" cmd /k "npm run dev"
cd ..

echo.
echo ========================================
echo Servidores iniciados!
echo ========================================
echo.
echo Backend API: http://localhost:8000
echo Backend Docs: http://localhost:8000/docs
echo Frontend: http://localhost:3002
echo.
echo Pressione qualquer tecla para fechar esta janela...
pause >nul

