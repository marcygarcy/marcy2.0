# 🏢 Arquitetura Multi-tenant

Documentação da estrutura multi-empresa e multi-marketplace.

## Conceito

O sistema suporta múltiplas empresas, cada uma com múltiplos marketplaces.

```
Empresa
  └── Marketplace 1
  └── Marketplace 2
  └── ...
```

## Estrutura

### Empresas
Tabela `empresas`:
- `id` - ID único
- `nome` - Nome da empresa
- `ativo` - Se está ativo

### Marketplaces
Tabela `marketplaces`:
- `id` - ID único
- `nome` - Nome do marketplace
- `empresa_id` - Empresa à qual pertence
- `ativo` - Se está ativo

## Empresas Padrão

1. **teste 369**
2. **Teste 123**
   - Pixmania
   - Worten
3. **testes xyz**
4. **Teste 123**
5. **testes xyz**

## Filtros Automáticos

Todos os dados são filtrados automaticamente por:
- `empresa_id` - Empresa selecionada
- `marketplace_id` - Marketplace selecionado

### Tabelas com Filtros
- `orders`
- `bank_movements`
- `invoices`

### Tabelas Sem Filtros (Históricas)
- `transactions` - Dados históricos (podem ser migrados)

## Seleção no Frontend

O utilizador seleciona:
1. Empresa no sidebar
2. Marketplace no sidebar

O estado é mantido em:
- React Context API
- localStorage (persistência)

## Dados Novos

Novos dados são automaticamente associados à:
- Empresa selecionada
- Marketplace selecionado

## Migração de Dados

Para associar dados históricos:
```bash
cd backend
python scripts/migrate_to_pixmania.py
```

## Referências

- [Base de Dados](./database.md)
- [Arquitetura](./overview.md)

