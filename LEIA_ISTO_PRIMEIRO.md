# ⚠️ LEIA ISTO PRIMEIRO!

## 🚨 PROBLEMA CRÍTICO

Se está a ver erros como:
- `app-index.js:34 API Error: AxiosError`
- `localhost:8000/api/v1/kpis/all`
- `React DevTools`

**Isto significa que está a usar a aplicação ERRADA!**

## ✅ SOLUÇÃO RÁPIDA (3 PASSOS)

### 1️⃣ Fechar TUDO
- Feche **TODAS** as tabs do browser
- Feche completamente o browser (Alt+F4)
- Execute: `PARAR_TUDO.bat`

### 2️⃣ Iniciar a aplicação NOVA
Execute:
```bash
npm start
```

### 3️⃣ Abrir a aplicação CORRETA
- Abra um **NOVO** browser
- Vá para: **http://localhost:3000**
- ⚠️ **NÃO use localhost:3001 ou localhost:8000**

## 🎯 Como Saber se Está Correto

### ✅ CORRETO (porta 3000):
- Não mostra erros de React/Axios
- Não tenta ligar-se a `localhost:8000`
- Interface simples com tabs
- Funciona apenas com upload de ficheiros

### ❌ ERRADO (porta 3001):
- Mostra erros de React DevTools
- Mostra erros de Axios
- Tenta ligar-se a APIs
- Precisa de backend Python

## 📞 Se Continuar a Dar Erro

1. Abra a consola do browser (F12)
2. Copie todos os erros
3. Verifique se está em **http://localhost:3000** (não 3001!)
4. Verifique se o servidor está a correr: `netstat -ano | findstr ":3000"`

---

**LEMBRE-SE**: Use apenas **http://localhost:3000** - essa é a aplicação nova que funciona sem backend!

