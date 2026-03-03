# 🐛 Debugging

Guia de debugging e resolução de problemas.

## Consola do Browser

### Abrir Consola
- **Chrome/Edge**: F12 ou Ctrl+Shift+I
- **Firefox**: F12 ou Ctrl+Shift+K
- **Safari**: Cmd+Option+I

### Verificar Erros
1. Abra a consola (F12)
2. Vá à tab "Console"
3. Procure por erros em vermelho
4. Copie mensagens de erro

## Logs do Backend

### Ver Logs
O backend mostra logs no terminal onde está a correr.

### Ativar Debug
No código Python:
```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

## Verificar API

### Testar Endpoint
```bash
curl http://localhost:8000/api/v1/kpis/all
```

### Documentação Interativa
Aceda a: http://localhost:8000/docs

## Verificar Base de Dados

### Conectar ao DuckDB
```python
import duckdb
conn = duckdb.connect('backend/data/warehouse.duckdb')
result = conn.execute("SELECT * FROM transactions LIMIT 10").fetchall()
print(result)
```

### Verificar Tabelas
```python
conn.execute("SHOW TABLES").fetchall()
```

## Verificar Estado do Frontend

### React DevTools
- Instalar extensão do browser
- Ver estado dos componentes
- Ver props e hooks

### Network Tab
- Ver requests HTTP
- Verificar status codes
- Verificar payloads

## Problemas Comuns

### Request falha
- Verificar se backend está a correr
- Verificar URL da API
- Verificar CORS

### Dados não aparecem
- Verificar se foram carregados
- Verificar filtros aplicados
- Verificar seleção de empresa/marketplace

## Referências

- [Problemas Comuns](./common-issues.md)
- [Upload](./upload.md)

