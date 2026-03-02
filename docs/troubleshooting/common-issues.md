# 🔧 Problemas Comuns

Soluções para problemas frequentes no sistema.

## Erros de Inicialização

### "Port already in use"
**Solução**:
```bash
# Windows
PARAR_TUDO.bat

# Linux/macOS
lsof -ti:8000 | xargs kill -9
lsof -ti:3000 | xargs kill -9
```

### "Module not found"
**Solução**:
```bash
# Backend
cd backend
pip install -r requirements.txt

# Frontend
cd frontend
npm install
```

## Erros de Upload

### "Ficheiro inválido"
- Verifique se é XLSX ou CSV
- Verifique se tem as colunas necessárias
- Tente abrir o ficheiro no Excel primeiro

### "Nenhum pedido válido encontrado"
- O ficheiro foi carregado mas não há dados válidos
- Verifique o mapeamento de colunas
- O sistema pode criar IDs temporários

### Upload muito lento
- Ficheiros grandes podem demorar
- Aguarde, o processo continua em background
- Verifique o tamanho do ficheiro

## Erros de API

### "CORS error"
- Verifique se o backend está a correr
- Verifique a configuração de CORS no backend
- Verifique se as portas estão corretas (8000/3000)

### "404 Not Found"
- Verifique se a rota está correta
- Verifique se o backend está a correr
- Verifique a URL da API no frontend (.env.local)

### "500 Internal Server Error"
- Verifique os logs do backend
- Verifique se a base de dados está acessível
- Verifique se há dados carregados

## Erros de Base de Dados

### "Database locked"
- Feche outras conexões à base de dados
- Reinicie o backend
- Verifique se há processos a usar o ficheiro .duckdb

### "Table not found"
- Execute o script de inicialização:
```bash
cd backend
python -c "from app.config.database import init_database; init_database()"
```

## Problemas de Performance

### Sistema lento
- Verifique o tamanho da base de dados
- Limpe dados antigos se necessário
- Verifique recursos do sistema (RAM, CPU)

### Timeout
- Aumente o timeout no backend
- Divida ficheiros grandes em partes menores
- Verifique a rede se for remoto

## Problemas de Interface

### Sidebar não aparece
- Verifique se selecionou empresa/marketplace
- Recarregue a página
- Verifique a consola do browser (F12)

### KPIs não atualizam
- Faça refresh manual
- Verifique se os dados foram carregados
- Verifique se selecionou empresa/marketplace

## Mais Ajuda

- [Debugging](./debugging.md)
- [Upload](./upload.md)
- [Performance](./performance.md)

