# Script PowerShell para instalar Git e fazer push do projeto
# Requer permissões de administrador

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Instalador Git e Push para GitHub" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar se Git já está instalado
$gitPath = Get-Command git -ErrorAction SilentlyContinue
if ($gitPath) {
    Write-Host "[OK] Git já está instalado!" -ForegroundColor Green
    Write-Host "Localização: $($gitPath.Source)" -ForegroundColor Gray
    Write-Host ""
    
    # Continuar com push
    $continuePush = Read-Host "Deseja continuar com o push para GitHub? (S/N)"
    if ($continuePush -ne "S" -and $continuePush -ne "s") {
        Write-Host "Operação cancelada." -ForegroundColor Yellow
        exit
    }
} else {
    Write-Host "[INFO] Git não encontrado. Precisamos instalá-lo primeiro." -ForegroundColor Yellow
    Write-Host ""
    
    # Verificar se Chocolatey está instalado (gerenciador de pacotes)
    $chocoPath = Get-Command choco -ErrorAction SilentlyContinue
    
    if ($chocoPath) {
        Write-Host "[INFO] Chocolatey encontrado. Instalando Git via Chocolatey..." -ForegroundColor Cyan
        Write-Host ""
        
        # Verificar se está a executar como administrador
        $isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
        
        if (-not $isAdmin) {
            Write-Host "[ERRO] Precisa de permissões de administrador para instalar Git." -ForegroundColor Red
            Write-Host "Por favor, execute este script como administrador." -ForegroundColor Yellow
            Write-Host ""
            Write-Host "Ou instale manualmente:" -ForegroundColor Yellow
            Write-Host "1. Aceda a: https://git-scm.com/download/win" -ForegroundColor Cyan
            Write-Host "2. Baixe e instale o Git" -ForegroundColor Cyan
            Write-Host "3. Execute novamente este script" -ForegroundColor Cyan
            exit 1
        }
        
        try {
            choco install git -y
            Write-Host "[OK] Git instalado com sucesso!" -ForegroundColor Green
            Write-Host ""
            Write-Host "[INFO] Atualizando PATH..." -ForegroundColor Cyan
            $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
            RefreshEnv
        } catch {
            Write-Host "[ERRO] Falha ao instalar Git via Chocolatey." -ForegroundColor Red
            Write-Host "Por favor, instale manualmente: https://git-scm.com/download/win" -ForegroundColor Yellow
            exit 1
        }
    } else {
        Write-Host "[INFO] Chocolatey não encontrado." -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Opções:" -ForegroundColor Cyan
        Write-Host "1. Instalar Chocolatey (recomendado):" -ForegroundColor Yellow
        Write-Host "   Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))" -ForegroundColor Gray
        Write-Host ""
        Write-Host "2. Instalar Git manualmente:" -ForegroundColor Yellow
        Write-Host "   Aceda a: https://git-scm.com/download/win" -ForegroundColor Cyan
        Write-Host ""
        
        $continue = Read-Host "Deseja abrir o site de download do Git? (S/N)"
        if ($continue -eq "S" -or $continue -eq "s") {
            Start-Process "https://git-scm.com/download/win"
        }
        
        Write-Host ""
        Write-Host "Após instalar o Git, feche e reabra o terminal, depois execute:" -ForegroundColor Yellow
        Write-Host "  .\GIT_PUSH.bat" -ForegroundColor Cyan
        exit
    }
}

# Agora que Git está instalado, fazer push
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Configurando repositório Git..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Navegar para o diretório do projeto
Set-Location $PSScriptRoot

# Verificar se já existe repositório
if (Test-Path .git) {
    Write-Host "[INFO] Repositório Git já existe" -ForegroundColor Yellow
    git status
} else {
    Write-Host "[INFO] Inicializando novo repositório Git..." -ForegroundColor Cyan
    git init
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Adicionando ficheiros..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
git add .

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Fazendo commit..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Verificar se já existe commit
$hasCommits = git log -1 --oneline 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "[INFO] Já existe commit. Criando novo commit..." -ForegroundColor Yellow
    git commit -m "Update: Recebimentos Marketplaces V1.1"
} else {
    git commit -m "Initial commit: Recebimentos Marketplaces V1.1"
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Configurando remote..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Remover remote existente se houver
git remote remove origin 2>$null

# Adicionar novo remote
git remote add origin https://github.com/marcygarcy/marcy.git

# Configurar branch
git branch -M main

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Fazendo push para GitHub..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "NOTA: Se for a primeira vez, pode precisar de autenticar." -ForegroundColor Yellow
Write-Host "Use seu username do GitHub e um Personal Access Token como password." -ForegroundColor Yellow
Write-Host ""

# Tentar fazer push
git push -u origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "[SUCESSO] Projeto enviado para GitHub!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Repositório: https://github.com/marcygarcy/marcy.git" -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "[ERRO] Falha ao fazer push" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Possíveis causas:" -ForegroundColor Yellow
    Write-Host "- Repositório remoto já tem conteúdo (tente: git pull origin main --allow-unrelated-histories)" -ForegroundColor Gray
    Write-Host "- Problema de autenticação (configure token de acesso pessoal)" -ForegroundColor Gray
    Write-Host "- Repositório não existe ou não tem permissão" -ForegroundColor Gray
    Write-Host ""
    
    # Tentar pull se necessário
    $tryPull = Read-Host "O repositório remoto já tem conteúdo? Deseja fazer pull primeiro? (S/N)"
    if ($tryPull -eq "S" -or $tryPull -eq "s") {
        Write-Host "Fazendo pull..." -ForegroundColor Cyan
        git pull origin main --allow-unrelated-histories
        Write-Host "Fazendo push novamente..." -ForegroundColor Cyan
        git push -u origin main
    }
}

Write-Host ""
Write-Host "Pressione qualquer tecla para continuar..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

