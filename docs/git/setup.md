# 🔧 Git Setup

Guia de configuração do Git para o projeto.

## Instalar Git

### Windows
1. Download: https://git-scm.com/download/win
2. Instalar com opções padrão
3. Verificar: `git --version`

### Linux
```bash
sudo apt-get update
sudo apt-get install git
```

### macOS
```bash
brew install git
```

## Configuração Inicial

### Configurar Identidade
```bash
git config --global user.name "Seu Nome"
git config --global user.email "seu.email@exemplo.com"
```

### Verificar Configuração
```bash
git config --list
```

## Repositório

### URL do Repositório
```
https://github.com/marcygarcy/marcy.git
```

### Clonar
```bash
git clone https://github.com/marcygarcy/marcy.git
cd marcy
```

### Verificar Status
```bash
git status
```

### Ver Remotes
```bash
git remote -v
```

## Próximos Passos

- [Comandos Git](./commands.md)
- [Workflow](./workflow.md)

