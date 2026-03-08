@echo off
title Iniciar Backend + Frontend
cd /d "%~dp0"

echo.
echo === Backend (porta 8000) ===
start "Backend API" cmd /k "cd /d "%~dp0backend" && python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000 --timeout-keep-alive 30"
echo Backend a iniciar numa nova janela...
echo.

timeout /t 4 /nobreak >nul

echo === Frontend (porta 3000; se der erro use INICIAR_TUDO_3001.bat) ===
start "Frontend Next.js" cmd /k "cd /d "%~dp0frontend" && npm run dev"
echo Frontend a iniciar numa nova janela...
echo.
echo Quando ambas estiverem prontas:
echo   Backend:  http://localhost:8000   (docs: http://localhost:8000/docs)
echo   Frontend: http://localhost:3000
echo.
echo Se a porta 3000 estiver ocupada, execute INICIAR_TUDO_3001.bat
echo.
pause
