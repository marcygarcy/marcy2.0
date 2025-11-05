@echo off
echo ========================================
echo Renomear Projeto para v2
echo ========================================
echo.

REM Verificar se estamos no diretório correto
if not exist "backend" (
    echo ERRO: Este script deve ser executado dentro do diretório do projeto!
    echo Diretório atual: %CD%
    pause
    exit /b 1
)

echo Parando todos os servidores...
echo.

REM Parar servidores nas portas 8000, 3000, 3001, 3002
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
echo Aguardando processos terminarem...
timeout /t 3 /nobreak >nul

echo.
echo Navegando para o diretório pai...
cd ..

echo.
echo Renomeando diretório...
if exist "new - Copy" (
    if exist "pagamentos-marketplace-v2" (
        echo ERRO: O diretório "pagamentos-marketplace-v2" já existe!
        echo Por favor, elimine ou renomeie o diretório existente primeiro.
        pause
        exit /b 1
    )
    ren "new - Copy" "pagamentos-marketplace-v2"
    echo Diretório renomeado com sucesso!
    echo.
    echo Novo caminho: %CD%\pagamentos-marketplace-v2
) else (
    echo AVISO: O diretório "new - Copy" não foi encontrado.
    echo Verificando se já foi renomeado...
    if exist "pagamentos-marketplace-v2" (
        echo O diretório já se chama "pagamentos-marketplace-v2"
    ) else (
        echo ERRO: Não foi possível encontrar o diretório para renomear.
    )
)

echo.
echo ========================================
echo Processo concluído!
echo ========================================
echo.
echo NOTA: Lembre-se de atualizar o caminho no seu editor/IDE
echo para o novo nome do diretório: pagamentos-marketplace-v2
echo.
pause

