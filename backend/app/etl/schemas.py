"""Schemas DuckDB e definições de tabelas."""
from typing import Dict, List

# Mapeamento de normalização de colunas (baseado na estrutura real do ficheiro)
COLUMN_RENAMES: Dict[str, str] = {
    # Encoding issues
    "CrÃ©dito": "Crédito",
    "DÃ©bito": "Débito",
    "DescriÃ§Ã£o": "Descrição",
    "Data Criao": "Data Criação",
    "Data Transao": "Data Transação",
    "NÃºmero da fatura": "Nº da fatura",
    "NÃºmero da transaÃ§Ã£o": "Nº da transação",
    "NÃº Pedido": "Nº Pedido",
    "RÃ³tulo da categoria": "Rótulo da categoria",
    "Rtulos de Linha": "Rótulos de Linha",
    # Mapeamento direto para estrutura da base de dados
    "Número da fatura": "Nº da fatura",
    "Número da transação": "Nº da transação",
}

# Colunas numéricas esperadas (baseado no ficheiro real)
NUMERIC_COLUMNS = ["Crédito", "Débito", "Valor", "Saldo", "Quantidade"]

# Colunas de data esperadas (baseado no ficheiro real)
DATE_COLUMNS = [
    "Data Criação",
    "Data Recebida",
    "Data Transação",
    "Data do ciclo de faturamento",
]

# Colunas do ficheiro real que precisam ser mapeadas
FILE_COLUMNS = [
    "Data Criação",
    "Data Recebida",
    "Data Transação",
    "Loja",
    "Nº Pedido",
    "Nº da fatura",
    "Nº da transação",
    "Quantidade",
    "Rótulo da categoria",
    "SKU da oferta",
    "Descrição",
    "Tipo",
    "Status do pagamento",
    "Valor",
    "Débito",
    "Crédito",
    "Saldo",
    "Moeda",
    "Referência do pedido do cliente",
    "Referência do pedido loja",
    "Data do ciclo de faturamento",
    "dias",
    "ID de loja",
    "ID da linha do pedido",
    "ID do reembolso",
    "Canal de vendas",
    "Ciclo Pagamento",
    "Dias",
]

# Estrutura esperada para transações
TRANSACTION_COLUMNS = [
    "Ciclo Pagamento",
    "Data do ciclo de faturamento",
    "Data Criação",
    "Canal de vendas",
    "Tipo",
    "Crédito",
    "Débito",
    "real",
    "Descrição",
    "Nº Pedido",
    "Nº da fatura",
    "Nº da transação",
    "Rótulo da categoria",
    "SKU da oferta",
    "Moeda",
]

