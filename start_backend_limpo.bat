@echo off
echo ========================================
echo Reiniciando Backend Limpo
echo ========================================

REM Matar processos Python que possam estar a correr na porta 8000
echo Parando processos existentes...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000 ^| findstr LISTENING') do taskkill /F /PID %%a 2>nul

timeout /t 2 /nobreak >nul

echo.
echo Iniciando backend...
cd backend
start "Backend API" cmd /k "python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000 --timeout-keep-alive 30"

echo.
echo Backend iniciado!
echo Aguarde 5 segundos para o servidor inicializar...
timeout /t 5 /nobreak >nul

echo.
echo Verificando se o backend está a correr...
netstat -ano | findstr :8000 | findstr LISTENING

echo.
echo ========================================
echo Backend deve estar disponível em:
echo http://127.0.0.1:8000
echo http://127.0.0.1:8000/docs
echo ========================================
pause

