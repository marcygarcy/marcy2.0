# 📜 Scripts Utilitários

Documentação dos scripts Python utilitários.

## Scripts Disponíveis

### `seed_empresas.py`
Popular empresas e marketplaces iniciais.

**Uso**:
```bash
cd backend
python scripts/seed_empresas.py
```

**Opções**:
- `--force` - Recriar mesmo se já existirem

### `migrate_to_pixmania.py`
Associar dados históricos ao marketplace Pixmania.

**Uso**:
```bash
cd backend
python scripts/migrate_to_pixmania.py
```

**O que faz**:
- Atualiza `empresa_id` e `marketplace_id` em dados existentes
- Associa a "Teste 123" / "Pixmania"

## Criar Novos Scripts

### Estrutura Base
```python
#!/usr/bin/env python3
"""Descrição do script."""

from app.config.database import get_db_connection

def main():
    conn = get_db_connection()
    try:
        # Seu código aqui
        pass
    finally:
        conn.close()

if __name__ == "__main__":
    main()
```

## Referências

- [Backend](./backend.md)
- [Base de Dados](../architecture/database.md)

