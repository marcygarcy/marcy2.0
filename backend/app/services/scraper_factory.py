"""
Fase 4: Fábrica de scrapers (Factory Pattern).
Por URL/domínio devolve MiraklScraper ou SupplierScraper genérico.
"""
from __future__ import annotations

from typing import Optional, Union
from .supplier_scraper import SupplierScraper
from .base_scraper import BaseScraper


def get_scraper(url_site: Optional[str]) -> Union[SupplierScraper, BaseScraper]:
    """
    Devolve o scraper adequado ao URL do fornecedor.
    Portais Mirakl -> MiraklScraper; resto -> SupplierScraper (genérico Playwright).
    """
    url = (url_site or "").lower()
    if "mirakl" in url:
        from .mirakl_scraper import MiraklScraper
        return MiraklScraper()
    return SupplierScraper()
