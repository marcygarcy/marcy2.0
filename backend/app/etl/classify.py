"""Classificação de transações por buckets contabilísticos."""
import re
from typing import Dict, Optional
from app.config.settings import get_mapping_patterns


def get_bucket_map() -> Dict[str, str]:
    """Retorna mapeamento de buckets."""
    config = get_mapping_patterns()
    return config.get("bucket_map", {})


def get_regex_patterns() -> Dict[str, str]:
    """Retorna padrões regex."""
    config = get_mapping_patterns()
    return config.get("regex", {})


def classify_transaction(tipo: str, descricao: Optional[str] = None) -> str:
    """
    Classifica transação em bucket contabilístico.
    
    Returns:
        Nome do bucket (ex: itens, taxas, refunds_itens, etc.)
    """
    if not tipo:
        return "outros"
    
    tipo_lower = tipo.lower()
    desc_lower = (descricao or "").lower()
    
    # Mapeamento direto
    bucket_map = get_bucket_map()
    for key, bucket in bucket_map.items():
        if key.lower() == tipo_lower:
            return bucket
    
    # Regex patterns
    patterns = get_regex_patterns()
    
    # Taxas
    if re.search(patterns.get("taxas_generico", r"(?i)taxa|taxas"), tipo_lower):
        return "taxas"
    
    if re.search(patterns.get("imposto_taxas", r"(?i)imposto sobre (taxas|comiss|assinatura)"), tipo_lower):
        return "imp_taxas"
    
    # Fatura manual
    if re.search(patterns.get("fatura_manual", r"(?i)fatura manual"), tipo_lower):
        return "fatura_manual"
    
    if re.search(patterns.get("imposto_fatura_manual", r"(?i)imposto sobre fatura manual"), tipo_lower):
        return "imp_fatura_manual"
    
    # Crédito manual
    if re.search(patterns.get("credito_manual", r"(?i)cr.?dito manual"), tipo_lower):
        return "credito_manual"
    
    if re.search(patterns.get("imposto_credito_manual", r"(?i)imposto sobre cr.?dito manual"), tipo_lower):
        return "imp_credito_manual"
    
    # Reembolsos
    if re.search(patterns.get("refunds_itens", r"(?i)valor do pedido de reembolso"), tipo_lower):
        return "refunds_itens"
    
    if re.search(patterns.get("imp_refunds_itens", r"(?i)imposto sobre o valor do pedido de reembolso"), tipo_lower):
        return "imp_refunds_itens"
    
    # Valor do pedido
    if "valor do pedido" in tipo_lower and "reembolso" not in tipo_lower:
        return "itens"
    
    if "imposto sobre o valor do pedido" in tipo_lower and "reembolso" not in tipo_lower:
        return "imp_itens"
    
    # Envio
    if "valor do envio" in tipo_lower:
        return "envio"
    
    if "imposto sobre o valor do envio" in tipo_lower:
        return "imp_envio"
    
    return "outros"

