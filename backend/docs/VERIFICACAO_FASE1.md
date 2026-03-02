# Verificação dos 3 detalhes críticos (Fase 1)

## 1. Persistent DB
- **Requisito:** DuckDB deve gravar num ficheiro (ex: `warehouse.duckdb`), não em memória.
- **Implementação:** Em `app/config/settings.py`, `database_path` tem valor por defeito `"data/warehouse.duckdb"`. O Pydantic Settings carrega `.env`, pelo que `DATABASE_PATH` no `.env` faz override. Em `app/config/database.py`, `get_db_connection()` usa `duckdb.connect(str(DB_PATH))`, ou seja, conexão a ficheiro. O diretório `data/` é criado em `init_database()` com `DB_PATH.parent.mkdir(parents=True, exist_ok=True)`.
- **Conclusão:** OK — dados persistem em ficheiro.

## 2. FK Constraints
- **Requisito:** A tabela `suppliers` deve ter chave estrangeira para `empresas`.
- **Implementação:** Em `app/config/database.py`, após a criação das tabelas, é executado:
  `ALTER TABLE suppliers ADD CONSTRAINT fk_suppliers_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id)` (em bloco try/except para compatibilidade).
- **Conclusão:** OK — FK `suppliers.empresa_id` → `empresas.id` adicionada.

## 3. Salt/Secret (chave de encriptação)
- **Requisito:** A chave de encriptação deve ser lida de `.env`, nunca hardcoded.
- **Implementação:** Em `app/services/security_service.py`, a chave é obtida com `os.getenv("ENCRYPTION_KEY")`. Não existe nenhuma string literal com a chave no código. O `.env` é carregado via `load_dotenv()` no mesmo módulo.
- **Conclusão:** OK — chave vem do ambiente (`.env`).
