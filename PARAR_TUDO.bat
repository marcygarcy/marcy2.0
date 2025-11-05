@echo off
echo ========================================
echo Parando TODOS os servidores antigos
echo ========================================
echo.

echo Parando processos na porta 3001 (Next.js)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3001 ^| findstr LISTENING') do (
    echo Parando processo %%a
    taskkill /F /PID %%a >nul 2>&1
)

echo.
echo Parando processos na porta 8000 (Python Backend)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8000 ^| findstr LISTENING') do (
    echo Parando processo %%a
    taskkill /F /PID %%a >nul 2>&1
)

echo.
echo Parando processos Node.js que não sejam o servidor na porta 3000...
for /f "tokens=2" %%a in ('tasklist ^| findstr node.exe') do (
    echo Verificando processo %%a...
    for /f "tokens=5" %%b in ('netstat -ano ^| findstr %%a ^| findstr LISTENING') do (
        set port=%%b
        if not "!port!"=="3000" (
            echo Parando processo %%a na porta !port!
            taskkill /F /PID %%a >nul 2>&1
        )
    )
)

echo.
echo ========================================
echo Servidores antigos parados!
echo ========================================
echo.
echo Agora:
echo 1. Feche TODAS as tabs do browser
echo 2. Execute: npm start (ou start.bat)
echo 3. Abra: http://localhost:3000
echo.
pause

