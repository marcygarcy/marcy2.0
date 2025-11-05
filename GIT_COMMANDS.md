# Comandos Git para fazer Push do Projeto

## Passo 1: Verificar se Git está instalado
```bash
git --version
```

Se não estiver instalado, instale o Git para Windows: https://git-scm.com/download/win

## Passo 2: Configurar Git (se ainda não configurou)
```bash
git config --global user.name "Seu Nome"
git config --global user.email "seu.email@exemplo.com"
```

## Passo 3: Inicializar repositório Git (se ainda não estiver inicializado)
```bash
cd "C:\Users\admin\Documents\Marisa\Big\new - Copy"
git init
```

## Passo 4: Adicionar ficheiros ao staging
```bash
git add .
```

## Passo 5: Fazer commit inicial
```bash
git commit -m "Initial commit: Recebimentos Marketplaces V1.1"
```

## Passo 6: Adicionar remote do GitHub
```bash
git remote add origin https://github.com/marcygarcy/marcy.git
```

## Passo 7: Verificar branch principal (geralmente 'main' ou 'master')
```bash
git branch -M main
```

## Passo 8: Fazer push para o GitHub
```bash
git push -u origin main
```

---

## Se já existe um repositório no GitHub com conteúdo

Se o repositório já tem conteúdo, pode precisar fazer pull primeiro:

```bash
git pull origin main --allow-unrelated-histories
```

Depois:
```bash
git push -u origin main
```

---

## Se encontrar conflitos ou problemas de autenticação

### Autenticação GitHub (se necessário):
```bash
# Para HTTPS, pode precisar de token de acesso pessoal
# Ou usar SSH:
git remote set-url origin git@github.com:marcygarcy/marcy.git
```

### Forçar push (apenas se necessário e tiver certeza):
```bash
git push -u origin main --force
```

---

## Comandos úteis para verificar estado

```bash
# Verificar status
git status

# Ver remotes configurados
git remote -v

# Ver histórico de commits
git log --oneline

# Verificar branch atual
git branch
```

