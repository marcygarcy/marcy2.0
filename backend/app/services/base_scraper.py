"""
Fase 4: Classe base abstrata para scrapers RPA (Factory Pattern).
Implementações: MiraklScraper, SupplierScraper (genérico).
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import List, Dict, Any


class BaseScraper(ABC):
    """
    Scraper base com métodos abstratos para login, preços, trackings e faturas.
    Execução em headless=True para não bloquear o servidor.
    """

    @abstractmethod
    def login(self, url: str, user: str, password: str, **kwargs: Any) -> bool:
        """Faz login no portal do fornecedor. Retorna True se sucesso."""
        pass

    @abstractmethod
    def get_prices(self, supplier_id: int, access: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Obtém tabela de preços. Retorna [{\"sku\": str, \"price\": float}, ...]."""
        pass

    @abstractmethod
    def get_tracking_and_invoices(
        self,
        supplier_id: int,
        access: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Extrai tracking e URLs de faturas. Retorna trackings_updated, invoices_downloaded, error."""
        pass

    def run_headless(self) -> bool:
        """Por defeito Playwright corre em headless=True."""
        return True
