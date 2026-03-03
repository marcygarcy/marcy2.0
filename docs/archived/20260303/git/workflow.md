# 🔄 Git Workflow

Fluxo de trabalho recomendado para o projeto.

## Workflow Padrão

### 1. Atualizar Local
```bash
git pull origin main
```

### 2. Fazer Alterações
- Editar ficheiros
- Testar localmente

### 3. Adicionar Alterações
```bash
git add .
```

### 4. Fazer Commit
```bash
git commit -m "Descrição clara das alterações"
```

### 5. Fazer Push
```bash
git push origin main
```

## Boas Práticas

### Mensagens de Commit
- Seja claro e descritivo
- Use português
- Exemplo: "Adicionar filtro por ciclo na listagem de transações"

### Commits Frequentes
- Faça commits pequenos e frequentes
- Não acumule muitas alterações
- Um commit por funcionalidade

### Antes de Push
- Teste localmente
- Verifique se compila
- Verifique se não quebra nada

## Resolver Conflitos

### Se houver conflitos no pull
```bash
git pull origin main
# Resolver conflitos manualmente
git add .
git commit -m "Resolver conflitos"
git push origin main
```

## Referências

- [Comandos Git](./commands.md)
- [Git Setup](./setup.md)

