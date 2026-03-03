# 📦 Instruções para Fazer Push do Projeto para GitHub

## Pré-requisitos

1. **Instalar Git** (se ainda não tiver):
   - Download: https://git-scm.com/download/win
   - Instalar com as opções padrão

## Opção 1: Usar Script Automático (Recomendado)

1. Execute o ficheiro: `GIT_PUSH.bat`
2. Siga as instruções no ecrã

## Opção 2: Comandos Manuais

### Passo 1: Abrir Terminal/PowerShell
Abra PowerShell ou CMD na pasta do projeto:
```
cd "C:\Users\admin\Documents\Marisa\Big\new - Copy"
```

### Passo 2: Verificar se Git está instalado
```powershell
git --version
```

### Passo 3: Configurar Git (apenas primeira vez)
```powershell
git config --global user.name "Seu Nome"
git config --global user.email "seu.email@exemplo.com"
```

### Passo 4: Inicializar repositório Git
```powershell
git init
```

### Passo 5: Adicionar todos os ficheiros
```powershell
git add .
```

### Passo 6: Fazer commit
```powershell
git commit -m "Initial commit: Recebimentos Marketplaces V1.1"
```

### Passo 7: Adicionar remote do GitHub
```powershell
git remote add origin https://github.com/marcygarcy/marcy2.0.git
```

### Passo 8: Configurar branch principal
```powershell
git branch -M main
```

### Passo 9: Fazer push
```powershell
git push -u origin main
```

---

## ⚠️ Se o repositório já tem conteúdo

Se o GitHub já tem ficheiros, faça pull primeiro:

```powershell
git pull origin main --allow-unrelated-histories
```

Depois faça push novamente:
```powershell
git push -u origin main
```

---

## 🔐 Autenticação GitHub

Se pedir username/password:

1. **Username**: Seu username do GitHub
2. **Password**: Use um **Personal Access Token** (não a password normal)
   - Criar token: GitHub → Settings → Developer settings → Personal access tokens → Generate new token
   - Permissões: `repo` (acesso completo a repositórios)

---

## 📋 Verificar Estado

```powershell
# Ver status
git status

# Ver remotes
git remote -v

# Ver histórico
git log --oneline
```

---

## 🔄 Comandos Futuros (após setup inicial)

Para fazer push de alterações futuras:

```powershell
git add .
git commit -m "Descrição das alterações"
git push
```

