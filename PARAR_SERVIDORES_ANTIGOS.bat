@echo off
echo ========================================
echo Parando servidores antigos...
echo ========================================
echo.

echo Procurando processos na porta 8000 (Backend Python)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8000 ^| findstr LISTENING') do (
    echo Parando processo %%a
    taskkill /F /PID %%a >nul 2>&1
)

echo.
echo Procurando processos na porta 3001 (Frontend Next.js)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3001 ^| findstr LISTENING') do (
    echo Parando processo %%a
    taskkill /F /PID %%a >nul 2>&1
)

echo.
echo ========================================
echo Servidores antigos parados!
echo ========================================
echo.
echo Agora pode iniciar o servidor novo:
echo   npm start
echo.
echo Ou abra: start.bat
echo.
pause

