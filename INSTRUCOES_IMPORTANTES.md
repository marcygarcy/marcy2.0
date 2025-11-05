# ⚠️ INSTRUÇÕES IMPORTANTES

## 🚨 PROBLEMA: Ainda está a usar a aplicação antiga!

Os erros que está a ver (`localhost:8000`, `AxiosError`, `React DevTools`) significam que ainda está a aceder à **aplicação antiga** (Next.js/React) na porta **3001**.

## ✅ SOLUÇÃO

### 1. Fechar todas as tabs do browser
   - Feche **TODAS** as tabs com `localhost:3001` ou `localhost:8000`
   - Feche completamente o browser (Ctrl+Shift+Q ou Alt+F4)

### 2. Parar servidores antigos
   Execute:
   ```bash
   PARAR_SERVIDORES_ANTIGOS.bat
   ```

### 3. Abrir a aplicação CORRETA
   - Abra um novo browser
   - Vá para: **http://localhost:3000**
   - ⚠️ **NÃO use localhost:3001 ou localhost:8000**

## 🔍 Como identificar a aplicação correta

A aplicação **NOVA e CORRETA**:
- ✅ URL: **http://localhost:3000**
- ✅ Não mostra erros de React/Next.js
- ✅ Não mostra erros de Axios
- ✅ Não tenta ligar-se a `localhost:8000`
- ✅ Interface simples com tabs na parte superior
- ✅ Funciona apenas com upload de ficheiros no browser

A aplicação **ANTIGA** (não usar):
- ❌ URL: `localhost:3001` ou `localhost:8000`
- ❌ Mostra erros de React DevTools
- ❌ Mostra erros de Axios
- ❌ Tenta ligar-se a APIs
- ❌ Interface com React/Next.js

## 🎯 Verificar se está correto

1. Abra **http://localhost:3000**
2. Verifique a consola do browser (F12)
3. **NÃO deve aparecer**:
   - "React DevTools"
   - "AxiosError"
   - "localhost:8000"
   - "api/v1"

4. **Deve aparecer**:
   - "✅ XLSX carregado"
   - "✅ PapaParse carregado"
   - Tabs: Upload, KPIs, Resumo, etc.

## 🔄 Se ainda não funcionar

1. Limpe o cache do browser (Ctrl+Shift+Delete)
2. Feche completamente o browser
3. Execute `PARAR_SERVIDORES_ANTIGOS.bat`
4. Execute `npm start` (ou `start.bat`)
5. Abra http://localhost:3000 em uma nova janela

