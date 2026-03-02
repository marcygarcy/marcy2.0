# Iniciar o frontend (porta 3002)

## Erro 404 em http://localhost:3002/

Se vês **404 (Not Found)** na página ou em ficheiros `_next/static/chunks/...`, normalmente é porque:

1. **Estás a usar `npm start` sem ter feito build**  
   `npm start` serve a versão *produção* a partir da pasta `.next`. Se não correres `npm run build` antes, essa pasta não tem os ficheiros e o servidor devolve 404.

2. **O servidor de desenvolvimento não está a correr**  
   Na fase de desenvolvimento deves usar **`npm run dev`**, que compila e serve a app na porta 3002.

## Solução: usar sempre `npm run dev` em desenvolvimento

Na pasta **frontend**:

```bash
cd frontend
npm run dev
```

Aguarda até aparecer algo como:

```
▲ Next.js 14.x.x
- Local:        http://localhost:3002
✓ Ready in 2.1s
```

Depois abre no browser: **http://localhost:3002**

- Não uses `npm start` a não ser que tenhas corrido `npm run build` antes (para testar a versão de produção).
- Se a porta 3002 estiver ocupada por outro processo, para-o ou usa outra porta, por exemplo: `npm run dev:3000` (porta 3000).
