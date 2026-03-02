"""Serviço de cache simples para KPIs e dados frequentes."""
from datetime import datetime, timedelta
from typing import Any, Optional
from functools import wraps


class CacheService:
    """Serviço de cache em memória para otimizar performance."""
    
    _cache: dict[str, Any] = {}
    _cache_time: dict[str, datetime] = {}
    
    @staticmethod
    def get(key: str, max_age_seconds: int = 300) -> Optional[Any]:
        """
        Obtém valor do cache se ainda válido.
        
        Args:
            key: Chave do cache
            max_age_seconds: Idade máxima em segundos (padrão: 5 minutos)
        
        Returns:
            Valor do cache ou None se expirado/não existir
        """
        if key not in CacheService._cache:
            return None
        
        if key in CacheService._cache_time:
            age = datetime.now() - CacheService._cache_time[key]
            if age < timedelta(seconds=max_age_seconds):
                return CacheService._cache[key]
            else:
                # Cache expirado, remover
                del CacheService._cache[key]
                del CacheService._cache_time[key]
                return None
        
        return CacheService._cache[key]
    
    @staticmethod
    def set(key: str, value: Any) -> None:
        """
        Define valor no cache.
        
        Args:
            key: Chave do cache
            value: Valor a guardar
        """
        CacheService._cache[key] = value
        CacheService._cache_time[key] = datetime.now()
    
    @staticmethod
    def clear(key: Optional[str] = None) -> None:
        """
        Limpa cache.
        
        Args:
            key: Chave específica a limpar (None para limpar tudo)
        """
        if key:
            CacheService._cache.pop(key, None)
            CacheService._cache_time.pop(key, None)
        else:
            CacheService._cache.clear()
            CacheService._cache_time.clear()
    
    @staticmethod
    def cache_result(max_age_seconds: int = 300, key_prefix: str = ""):
        """
        Decorator para cachear resultados de funções.
        
        Args:
            max_age_seconds: Idade máxima do cache em segundos
            key_prefix: Prefixo para a chave do cache
        """
        def decorator(func):
            @wraps(func)
            def wrapper(*args, **kwargs):
                # Criar chave única baseada na função e argumentos
                cache_key = f"{key_prefix}{func.__name__}_{hash(str(args) + str(kwargs))}"
                
                # Tentar obter do cache
                cached = CacheService.get(cache_key, max_age_seconds)
                if cached is not None:
                    return cached
                
                # Executar função e guardar no cache
                result = func(*args, **kwargs)
                CacheService.set(cache_key, result)
                return result
            
            return wrapper
        return decorator

