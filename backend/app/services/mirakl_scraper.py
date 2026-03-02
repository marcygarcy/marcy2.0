"""
Fase 4: MiraklScraper — implementação Playwright para portais Mirakl.
Login, download CSV de preços, trackings e faturas (headless=True).
"""
from __future__ import annotations

import io
import csv
import logging
from typing import List, Dict, Any, Optional

from app.config.database import get_db_connection
from app.services.base_scraper import BaseScraper

logger = logging.getLogger(__name__)


class MiraklScraper(BaseScraper):
    """
    Scraper para portais baseados em Mirakl.
    Utiliza Playwright em headless=True para não bloquear o servidor.
    """

    def __init__(self):
        self.conn = get_db_connection()

    def login(self, url: str, user: str, password: str, **kwargs: Any) -> bool:
        """Login no portal Mirakl (selectors típicos)."""
        try:
            from playwright.sync_api import sync_playwright
        except ImportError:
            logger.warning("Playwright não instalado")
            return False
        url = (url or "").strip()
        if not url or not user:
            return False
        try:
            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True)
                try:
                    page = browser.new_page()
                    page.goto(url, wait_until="domcontentloaded", timeout=20000)
                    page.fill('input[name="email"], input[type="email"], input[name="username"]', user)
                    page.fill('input[name="password"], input[type="password"]', password)
                    page.click('button[type="submit"], input[type="submit"], button:has-text("Login")')
                    page.wait_for_load_state("networkidle", timeout=15000)
                    browser.close()
                    return True
                except Exception as e:
                    logger.exception("MiraklScraper login: %s", e)
                    browser.close()
                    return False
        except Exception as e:
            logger.exception("MiraklScraper login: %s", e)
            return False

    def get_prices(self, supplier_id: int, access: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Navega à área de preços/catálogo, descarrega CSV ou extrai tabela
        e devolve lista [{sku, price}] para update sku_mapping.
        """
        try:
            from playwright.sync_api import sync_playwright
        except ImportError:
            return []
        url = (access.get("url_site") or "").strip()
        user = (access.get("login_user") or "").strip()
        password = access.get("login_password") or ""
        if not url or not user:
            return []
        results: List[Dict[str, Any]] = []
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            try:
                page = browser.new_page()
                page.goto(url, wait_until="domcontentloaded", timeout=20000)
                page.fill('input[name="email"], input[type="email"], input[name="username"]', user)
                page.fill('input[name="password"], input[type="password"]', password)
                page.click('button[type="submit"], input[type="submit"]')
                page.wait_for_load_state("networkidle", timeout=15000)
                # Mirakl: link típico "Exportar preços" / "Price list" / "Download catalog"
                for link_text in ["Export", "Preços", "Price list", "Download", "Catalog", "Exportar"]:
                    try:
                        link = page.locator(f"a:has-text('{link_text}'), button:has-text('{link_text}')").first
                        if link.count():
                            with page.expect_download(timeout=15000) as download_info:
                                link.click()
                            download = download_info.value
                            path = download.path()
                            if path and path.endswith(".csv"):
                                with open(path, "r", encoding="utf-8-sig", errors="ignore") as f:
                                    content = f.read()
                                for delim in (";", ","):
                                    try:
                                        reader = csv.DictReader(io.StringIO(content), delimiter=delim)
                                        for row in reader:
                                            sku = row.get("sku") or row.get("SKU") or row.get("product_id") or row.get("Product ID")
                                            price_str = row.get("price") or row.get("Price") or row.get("unit_price")
                                            if sku and price_str:
                                                try:
                                                    results.append({"sku": str(sku).strip(), "price": float(str(price_str).replace(",", "."))})
                                                except (TypeError, ValueError):
                                                    pass
                                        if results:
                                            break
                                    except Exception:
                                        continue
                            break
                    except Exception:
                        continue
                # Fallback: extrair tabela HTML com colunas sku/preço
                if not results:
                    rows = page.query_selector_all("table tbody tr, .product-row, [data-sku]")
                    for row in rows:
                        try:
                            sku_el = row.query_selector("[data-sku], .sku, td:first-child")
                            price_el = row.query_selector(".price, [data-price], td:nth-child(2)")
                            if sku_el and price_el:
                                sku = sku_el.get_attribute("data-sku") or sku_el.inner_text()
                                price_str = price_el.get_attribute("data-price") or price_el.inner_text()
                                if sku and price_str:
                                    results.append({"sku": str(sku).strip(), "price": float(str(price_str).replace(",", "").replace(" ", ""))})
                        except Exception:
                            continue
                browser.close()
            except Exception as e:
                logger.exception("MiraklScraper get_prices: %s", e)
                browser.close()
        return results

    def get_tracking_and_invoices(
        self,
        supplier_id: int,
        access: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Área de encomendas: extrai tracking_number e URL de PDF de fatura,
        atualiza purchase_orders (tracking_number, invoice_pdf_url).
        """
        try:
            from playwright.sync_api import sync_playwright
        except ImportError:
            return {"trackings_updated": 0, "invoices_downloaded": 0, "error": "Playwright não instalado"}
        url = (access.get("url_site") or "").strip()
        user = (access.get("login_user") or "").strip()
        password = access.get("login_password") or ""
        if not url or not user:
            return {"trackings_updated": 0, "invoices_downloaded": 0, "error": "URL/utilizador em falta"}
        trackings_updated = 0
        invoices_downloaded = 0
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            try:
                page = browser.new_page()
                page.goto(url, wait_until="domcontentloaded", timeout=20000)
                page.fill('input[name="email"], input[type="email"], input[name="username"]', user)
                page.fill('input[name="password"], input[type="password"]', password)
                page.click('button[type="submit"], input[type="submit"]')
                page.wait_for_load_state("networkidle", timeout=15000)
                for link_text in ["Orders", "Encomendas", "As minhas encomendas", "Commandes"]:
                    try:
                        page.click(f"a:has-text('{link_text}'), button:has-text('{link_text}')", timeout=5000)
                        page.wait_for_load_state("domcontentloaded", timeout=8000)
                        break
                    except Exception:
                        continue
                rows = page.query_selector_all("table tbody tr, .order-row, [data-order-id]")
                for row in rows:
                    try:
                        order_id_el = row.query_selector("[data-order-id], .order-id, td:first-child")
                        tracking_el = row.query_selector(".tracking, .tracking-number, [data-tracking], td:nth-child(3)")
                        invoice_el = row.query_selector("a[href*='invoice'], a[href*='.pdf'], a[download]")
                        order_id = order_id_el.get_attribute("data-order-id") if order_id_el else (order_id_el.inner_text().strip() if order_id_el else None)
                        if not order_id and order_id_el:
                            order_id = order_id_el.inner_text().strip()
                        tracking = tracking_el.inner_text().strip() if tracking_el else None
                        invoice_url = invoice_el.get_attribute("href") if invoice_el else None
                        if order_id and (tracking or invoice_url):
                            if tracking:
                                self.conn.execute(
                                    "UPDATE purchase_orders SET tracking_number = ? WHERE supplier_order_id = ? AND supplier_id = ?",
                                    [tracking, str(order_id).strip(), supplier_id],
                                )
                                trackings_updated += 1
                            if invoice_url:
                                if not invoice_url.startswith("http"):
                                    invoice_url = url.rstrip("/") + ("/" if not url.endswith("/") else "") + invoice_url.lstrip("/")
                                self.conn.execute(
                                    "UPDATE purchase_orders SET invoice_pdf_url = ? WHERE supplier_order_id = ? AND supplier_id = ?",
                                    [invoice_url, str(order_id).strip(), supplier_id],
                                )
                                invoices_downloaded += 1
                    except Exception:
                        continue
                self.conn.commit()
                browser.close()
            except Exception as e:
                logger.exception("MiraklScraper get_tracking_and_invoices: %s", e)
                try:
                    browser.close()
                except Exception:
                    pass
                return {"trackings_updated": trackings_updated, "invoices_downloaded": invoices_downloaded, "error": str(e)}
        return {"trackings_updated": trackings_updated, "invoices_downloaded": invoices_downloaded, "error": None}

    def get_access(self, supplier_id: int) -> Optional[Dict[str, Any]]:
        """Obtém supplier_access com password desencriptada (compatível com automation_service)."""
        from app.services.security_service import decrypt_password
        row = self.conn.execute(
            "SELECT id, supplier_id, url_site, login_user, password_encrypted FROM supplier_access WHERE supplier_id = ?",
            [supplier_id],
        ).fetchone()
        if not row:
            return None
        pw = decrypt_password(row[4]) if row[4] else None
        return {
            "url_site": row[2],
            "login_user": row[3],
            "login_password": pw,
        }

    def download_price_list(self, supplier_id: int) -> List[Dict[str, Any]]:
        """Compatível com automation_service: devolve lista [{sku, price}]."""
        access = self.get_access(supplier_id)
        if not access:
            return []
        return self.get_prices(supplier_id, access)

    def sync_orders_and_invoices(self, supplier_id: int) -> Dict[str, Any]:
        """Compatível com automation_service: devolve trackings_updated, invoices_downloaded, error."""
        access = self.get_access(supplier_id)
        if not access:
            return {"trackings_updated": 0, "invoices_downloaded": 0, "error": "Sem acesso"}
        return self.get_tracking_and_invoices(supplier_id, access)

    def close(self):
        try:
            if self.conn:
                self.conn.close()
        except Exception:
            pass
