# ⚡ Performance

Guia de otimização e problemas de performance.

## Problemas Comuns

### Sistema Lento

**Causas possíveis**:
- Base de dados muito grande
- Queries complexas
- Ficheiros muito grandes no upload

**Soluções**:
- Limpar dados antigos
- Otimizar queries
- Dividir ficheiros grandes

### Upload Lento

**Causas**:
- Ficheiro muito grande
- Processamento pesado
- Encoding correction (se ativado)

**Soluções**:
- Dividir ficheiro em partes
- Aguardar processamento
- Desativar encoding correction se muito lento

### KPIs Lentos

**Causas**:
- Muitos dados
- Queries não otimizadas
- Filtros complexos

**Soluções**:
- Adicionar índices (se necessário)
- Cachear resultados
- Otimizar queries

## Otimizações

### Base de Dados
- DuckDB já otimizado para analytics
- Queries eficientes
- Índices automáticos quando necessário

### Frontend
- React otimizado
- Componentes memoizados quando necessário
- Lazy loading de dados

### Backend
- FastAPI otimizado
- Processamento assíncrono
- Caching quando possível

## Monitorização

### Verificar Recursos
- RAM utilizada
- CPU utilizada
- Espaço em disco

### Verificar Tamanho da BD
```bash
ls -lh backend/data/warehouse.duckdb
```

## Referências

- [Problemas Comuns](./common-issues.md)
- [Debugging](./debugging.md)

