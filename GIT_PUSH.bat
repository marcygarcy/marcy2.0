@echo off
echo ========================================
echo Script para fazer Push do Projeto para GitHub
echo ========================================
echo.

REM Verificar se Git está instalado
where git >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] Git nao esta instalado!
    echo.
    echo Por favor instale o Git para Windows:
    echo https://git-scm.com/download/win
    echo.
    pause
    exit /b 1
)

echo [OK] Git encontrado
echo.

REM Navegar para o diretório do projeto
cd /d "%~dp0"
echo Diretorio atual: %CD%
echo.

REM Verificar se já existe repositório Git
if exist .git (
    echo [INFO] Repositorio Git ja existe
    git status
) else (
    echo [INFO] Inicializando novo repositorio Git...
    git init
)

echo.
echo ========================================
echo Adicionando ficheiros ao staging...
echo ========================================
git add .

echo.
echo ========================================
echo Fazendo commit...
echo ========================================
git commit -m "Initial commit: Recebimentos Marketplaces V1.1"

echo.
echo ========================================
echo Configurando remote do GitHub...
echo ========================================
git remote remove origin 2>nul
git remote add origin https://github.com/marcygarcy/marcy.git

echo.
echo ========================================
echo Configurando branch principal...
echo ========================================
git branch -M main

echo.
echo ========================================
echo Fazendo push para o GitHub...
echo ========================================
echo.
echo NOTA: Se for a primeira vez, pode precisar de:
echo 1. Autenticar com GitHub (username e password/token)
echo 2. Se o repositorio ja tem conteudo, pode precisar fazer:
echo    git pull origin main --allow-unrelated-histories
echo.
pause

git push -u origin main

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo [SUCESSO] Projeto enviado para GitHub!
    echo ========================================
    echo.
    echo Repositorio: https://github.com/marcygarcy/marcy.git
) else (
    echo.
    echo ========================================
    echo [ERRO] Falha ao fazer push
    echo ========================================
    echo.
    echo Possiveis causas:
    echo - Repositorio remoto ja tem conteudo (tente: git pull origin main --allow-unrelated-histories)
    echo - Problema de autenticacao (configure token de acesso pessoal)
    echo - Repositorio nao existe ou nao tem permissao
)

echo.
pause

