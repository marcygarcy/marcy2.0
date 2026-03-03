# 01 - Executive Summary (Resumo Executivo)

Versão: 1.1 — Documento condensado para Administração e Gestão.

Objetivo
- Transformar o projecto atual (Recebimentos Marketplaces) num ERP de "Business Control & Operations" para dropshipping multi-empresa e multi-canal. O foco é: integração logística, compras, recibos (OCR/LLM), finanças e automação (RPA).

Resumo das alterações propostas
- Nova organização em 4 pilares: SCM, Operações (Logística), Finanças (Ledger & OSS), Automação (RPA).
- Introdução do processo Triple-Match (Order ↔ Invoice ↔ Reception) para controlo de receções.
- Introdução de tabelas logísticas e regras VAT OSS no esquema de dados.

Principais benefícios para Administração
- Visibilidade consolidada por entidade legal (NIF) e escritório.
- Redução de perdas e divergências via Triple-Match.
- Controlos fiscais (OSS) e reports automatizados.

Próximos passos imediatos
1. Validar ambiente local e backup da base `data/warehouse.duckdb`.
2. Criar backlog com prioridades (Segurança, CI, Backups, Autenticação).
3. Implementar provisoriamente o serviço `integrated_reception` e as tabelas logísticas (ver `07_DATA_SCHEMA.sql`).

Referências
- Para detalhes técnicos e guias, ver `03_ARCHITECTURE.md`, `05_DEVELOPERS.md` e `07_DATA_SCHEMA.sql`.
