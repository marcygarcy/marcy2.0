@echo off
title Iniciar Backend + Frontend (porta 3001)
cd /d "%~dp0"

echo.
echo === Backend (porta 8000) ===
start "Backend API" cmd /k "cd /d "%~dp0backend" && python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000 --timeout-keep-alive 30"
echo Backend a iniciar numa nova janela...
timeout /t 4 /nobreak >nul

echo === Frontend (porta 3001) ===
start "Frontend Next.js" cmd /k "cd /d "%~dp0frontend" && npm run dev:3001"
echo Frontend em http://localhost:3001
echo Backend  em http://localhost:8000
echo.
pause
