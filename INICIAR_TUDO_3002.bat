@echo off
title Iniciar Backend + Frontend (porta 3002)
cd /d "%~dp0"

echo === Backend (porta 8000) ===
start "Backend API" cmd /k "cd /d "%~dp0backend" && python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000 --timeout-keep-alive 30"
timeout /t 4 /nobreak >nul

echo === Frontend (porta 3002) ===
start "Frontend Next.js" cmd /k "cd /d "%~dp0frontend" && npm run dev:3002"
echo.
echo Frontend: http://localhost:3002
echo Backend:  http://localhost:8000
echo.
pause
