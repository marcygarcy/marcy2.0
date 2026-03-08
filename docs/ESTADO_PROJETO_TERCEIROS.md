# Estado do projeto – Gestão de Terceiros e visão geral

## Onde está o projeto

- **Produto:** ERP de Dropshipping multi-empresa e multi-canal (Recebimentos Marketplaces).
- **Stack:** Backend FastAPI + DuckDB, Frontend Next.js (React/TypeScript).
- **Documentação de handoff geral:** `PROMPT_HANDOFF_CONTINUAR_DESENVOLVIMENTO.md` descreve as **Fases 1 a 5** (Fundação, Vendas, Compras, Midnight Sync/RPA, Ciclo Financeiro). O projeto está ativo; as fases 1–5 estão implementadas.

---

## O que foi feito no módulo Gestão de Terceiros

### Backend
- **API** em `backend/app/api/v1/terceiros.py`:
  - `GET /terceiros/grupos` – lista grupos de terceiro (GT).
  - `POST /terceiros/movimentos` – cria movimentos GT (corpo: `empresa_id`, `linhas`).
  - `GET /terceiros/movimentos` – lista movimentos com paginação.
- **Serviço** `backend/app/services/terceiros_service.py`: usa tabelas DuckDB `gt_grupos` e `gt_movimentos`; `create_movimentos` insere em `gt_movimentos` (data_mov, grupo_terceiro, valor, conta_contabilidade, descricao).

### Frontend – Gestão de Terceiros (`frontend/src/components/terceiros/GestaoTerceirosView.tsx`)

- **Módulo principal** na sidebar: “D · Gestão de Terceiros” (pilar D).
- **Abas:** Visão geral, Fornecedores de serviços, Parceiros, Documentos (conteúdo maioritariamente “Em desenvolvimento”).
- **Dropdown Tabelas:** Diários (Inserção/Consulta/Listar), Plano de Contas (Inserção/Consulta), Centros de Custo (Listar/Novo) – modais básicos, alguns com guardar local/mock.
- **Dropdown Terceiros:**
  - **Movimentos → Inserção:** abre janela **Introdução de Movimentos** (arrastável, redimensionável):
    - Cabeçalho: Tip Ter, Diário, Bancos, Data CTB, Número (sem datas pré-preenchidas).
    - Tabela com 7 linhas, estilo grelha: Cód Grupo, Código Entidade, Tipo Doc, Descrição, Nº Doc., Data Doc., Data Lim. Pag., Valor, D/C (todos para preenchimento; ao preencher Data Doc., Data Lim. Pag. é preenchida por defeito com o mesmo valor).
    - Rodapé: totais Débitos/Créditos/Saldo; botões Extrato, Seleção Mov. Regularizar, **Contrapartidas CTB**, Fechar, Guardar.
    - **Guardar** chama `POST /terceiros/movimentos` com as linhas preenchidas.
  - **Movimentos → Consulta:** abre janela Consulta Movimentos (filtros e resultados, com F8 para pesquisa).
- **Janela Contrapartidas CTB** (abre ao clicar em “Contrapartidas CTB” na Introdução de Movimentos):
  - Barra azul “Contrapartidas CTB”, cabeçalho com Tip Ter, Diário, Bancos, Data CTB, Número (herdados da introdução).
  - Tabela: Cod Mov, Descrição, Conta, D/C, Centro Custo, D/C, Sub-Centro, Valor, D/C (7 linhas; D/C para preenchimento).
  - Painel de totais: CTB Geral e CTB Analít (Débito/Crédito/Saldo) – valores exemplo.
  - Botões: **Extrato** (Em desenvolvimento), **Voltar** (seta) – fecha e volta à Introdução, **Confirmar movimento** (Em desenvolvimento).

---

## Onde ficou / o que falta

1. **Contrapartidas CTB – lógica real**
   - “Confirmar movimento” ainda mostra “Em desenvolvimento”. Falta: validar linhas, enviar contrapartidas para o backend (ou persistir em `gt_movimentos`/tabela de contrapartidas) e fechar/voltar à Introdução conforme regra de negócio.
   - Totais CTB Geral / CTB Analít estão fixos; devem ser calculados a partir das linhas da tabela (e eventualmente do backend).

2. **Backend – contrapartidas**
   - Não existe endpoint para “contrapartidas CTB”. Pode ser necessário: novo endpoint (ex.: `POST /terceiros/contrapartidas` ou extensão de `movimentos`) e tabela(s) em DuckDB para contrapartidas contabilísticas.

3. **Consulta Movimentos**
   - Ligar à API `GET /terceiros/movimentos` em vez de dados apenas locais/mock.

4. **Diários / Plano de Contas / Centros de Custo**
   - Persistência em backend (tabelas e endpoints) e ligação ao frontend para guardar e listar.

5. **Outras melhorias (handoff geral)**
   - Ver `PROMPT_HANDOFF_CONTINUAR_DESENVOLVIMENTO.md`: alertas de prejuízo Fase 4, integração banco/reconciliação Fase 5, relatórios por empresa, etc.

---

## Ficheiros principais para continuar

| Área | Ficheiros |
|-----|-----------|
| Frontend Terceiros | `frontend/src/components/terceiros/GestaoTerceirosView.tsx` |
| API Terceiros | `backend/app/api/v1/terceiros.py` |
| Serviço Terceiros | `backend/app/services/terceiros_service.py` |
| Cliente API | `frontend/src/lib/api/terceiros.ts` |
| Roteamento / Sidebar | `frontend/src/app/page.tsx`, `frontend/src/components/layout/Sidebar.tsx` |
| Handoff geral | `PROMPT_HANDOFF_CONTINUAR_DESENVOLVIMENTO.md` |

---

*Última atualização: estado após implementação da janela Contrapartidas CTB, botões Voltar (seta) e Confirmar movimento, e D/C apenas para preenchimento.*
