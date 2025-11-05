# 🚀 Como Usar a Aplicação

## ⚠️ IMPORTANTE: Fechar Aplicações Antigas

Se ainda vê erros relacionados com `localhost:8000` ou `localhost:3001`, isso significa que ainda tem as aplicações antigas abertas no browser.

### Passos para Resolver:

1. **Fechar todas as tabs do browser** com a aplicação antiga
2. **Parar servidores antigos** (se estiverem a correr):
   - Backend Python (porta 8000)
   - Frontend Next.js (porta 3001)

3. **Iniciar o servidor novo**:
   ```bash
   npm start
   ```
   ou
   ```bash
   start.bat
   ```

4. **Abrir a nova aplicação**:
   - Abra o browser
   - Vá para: **http://localhost:3000**
   - ⚠️ **NÃO** use localhost:3001 ou localhost:8000

## ✅ Verificar se está a usar a aplicação correta

A nova aplicação:
- ✅ Não faz chamadas a APIs (tudo é processado localmente)
- ✅ Não mostra erros de CORS
- ✅ Não mostra erros 404 ou 500
- ✅ Funciona apenas com upload de ficheiros no browser

Se ainda vê erros de API, significa que ainda está a usar a aplicação antiga!

## 🔄 Se os erros persistirem

1. Feche completamente o browser
2. Limpe o cache do browser (Ctrl+Shift+Delete)
3. Inicie o servidor: `npm start`
4. Abra uma nova janela e vá para http://localhost:3000

