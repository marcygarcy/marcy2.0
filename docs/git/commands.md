# 📝 Comandos Git

Comandos úteis para trabalhar com Git no projeto.

## Comandos Básicos

### Status
```bash
git status
```

### Adicionar Ficheiros
```bash
git add .
git add arquivo_especifico.txt
```

### Commit
```bash
git commit -m "Descrição das alterações"
```

### Push
```bash
git push origin main
```

### Pull
```bash
git pull origin main
```

## Comandos Úteis

### Ver Histórico
```bash
git log --oneline
git log --graph --oneline --all
```

### Ver Diferenças
```bash
git diff
git diff arquivo.txt
```

### Ver Remotes
```bash
git remote -v
```

### Adicionar Remote
```bash
git remote add origin https://github.com/marcygarcy/marcy.git
```

### Configurar Branch
```bash
git branch -M main
```

## Workflow Básico

### Fazer Push de Alterações
```bash
git add .
git commit -m "Descrição das alterações"
git push origin main
```

### Fazer Pull de Alterações
```bash
git pull origin main
```

### Se houver conflitos
```bash
git pull origin main --allow-unrelated-histories
```

## Autenticação GitHub

### Personal Access Token
1. GitHub → Settings → Developer settings
2. Personal access tokens → Generate new token
3. Permissões: `repo`
4. Use o token como password

### SSH (Alternativa)
```bash
git remote set-url origin git@github.com:marcygarcy/marcy.git
```

## Referências

- [Git Setup](./setup.md)
- [Workflow](./workflow.md)

