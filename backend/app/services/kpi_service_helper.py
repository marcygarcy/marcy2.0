"""Helper para construir queries com filtros de empresa/marketplace."""
from typing import Optional, Tuple


def build_filter_clause(empresa_id: Optional[int] = None, marketplace_id: Optional[int] = None) -> Tuple[str, list]:
    """Constrói cláusula WHERE para filtrar por empresa/marketplace."""
    conditions = []
    params = []
    
    if empresa_id is not None:
        conditions.append("empresa_id = ?")
        params.append(empresa_id)
    
    if marketplace_id is not None:
        conditions.append("marketplace_id = ?")
        params.append(marketplace_id)
    
    if conditions:
        return " AND " + " AND ".join(conditions), params
    return "", []

