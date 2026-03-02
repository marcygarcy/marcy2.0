"""
SupplierScraper: automação para obter dados do fornecedor (login, perfil, preços).
Estrutura preparada para: API, Web Scraping/RPA (Playwright), ou portais Mirakl.
Midnight Sync: download_price_list, sync_orders_and_invoices.
"""
from __future__ import annotations

from typing import Optional, Dict, Any, List
from app.config.database import get_db_connection
from app.services.security_service import decrypt_password


class SupplierScraper:
    """
    Serviço que usa credenciais em supplier_access para:
    - Via API: obter token e sacar dados (NIF, morada, preços).
    - Via RPA (Playwright): login automático, navegar a "Dados da Conta", extrair campos.
    - Via Mirakl Connect: reutilizar integração para vários fornecedores.
    """

    def __init__(self):
        self.conn = get_db_connection()

    def get_access(self, supplier_id: int) -> Optional[Dict[str, Any]]:
        """Obtém registo de supplier_access para o fornecedor (senha desencriptada em memória)."""
        try:
            r = self.conn.execute("DESCRIBE supplier_access").fetchall()
            cols = [c[0] for c in r]
        except Exception:
            cols = []
        sel = """
            SELECT id, supplier_id, url_site, login_user, password_encrypted, api_key, last_sync
            FROM supplier_access WHERE supplier_id = ?
        """
        row = self.conn.execute(sel, [supplier_id]).fetchone()
        if not row:
            return None
        password = decrypt_password(row[4]) if row[4] else None
        out = {
            "id": row[0],
            "supplier_id": row[1],
            "url_site": row[2],
            "login_user": row[3],
            "login_password": password,
            "api_key": row[5],
            "last_sync": row[6],
        }
        if "auto_sync_prices" in cols and "auto_sync_trackings" in cols and "auto_sync_invoices" in cols:
            r2 = self.conn.execute(
                "SELECT auto_sync_prices, auto_sync_trackings, auto_sync_invoices FROM supplier_access WHERE supplier_id = ?",
                [supplier_id],
            ).fetchone()
            if r2:
                out["auto_sync_prices"] = bool(r2[0])
                out["auto_sync_trackings"] = bool(r2[1])
                out["auto_sync_invoices"] = bool(r2[2])
        return out

    def fetch_supplier_profile(self, supplier_id: int) -> Dict[str, Any]:
        """
        Faz login automático no URL do fornecedor, navega à página de dados da conta,
        extrai NIF, Morada e Nome Legal e devolve para atualizar a tabela suppliers.
        Estrutura preparada para Playwright; sem Playwright instalado devolve dados atuais da BD.
        """
        access = self.get_access(supplier_id)
        if not access or not access.get("url_site"):
            return {
                "success": False,
                "error": "Sem credenciais ou URL em supplier_access",
                "updated": None,
            }
        # Opcional: usar Playwright para login e extração
        try:
            return self._fetch_via_playwright(access)
        except ImportError:
            # Playwright não instalado: devolver dados atuais do fornecedor (sem alterar nada)
            row = self.conn.execute(
                """
                SELECT designacao_social, nif_cif, morada, codigo_postal, localidade, pais
                FROM suppliers WHERE id = ?
                """,
                [supplier_id],
            ).fetchone()
            return {
                "success": True,
                "message": "Playwright não instalado; dados atuais da ficha (sem scraping).",
                "updated": {
                    "designacao_social": row[0] if row else None,
                    "nif_cif": row[1] if row else None,
                    "morada": row[2] if row else None,
                    "codigo_postal": row[3] if row else None,
                    "localidade": row[4] if row else None,
                    "pais": row[5] if row else None,
                } if row else None,
            }

    def _fetch_via_playwright(self, access: Dict[str, Any]) -> Dict[str, Any]:
        """
        Exemplo: login no url_site com login_user/login_password,
        navegar a "Dados da Conta" ou "Perfil", extrair NIF, Morada, Nome Legal.
        """
        try:
            from playwright.sync_api import sync_playwright
        except ImportError:
            raise ImportError("playwright not installed")
        url = (access.get("url_site") or "").strip()
        user = (access.get("login_user") or "").strip()
        password = access.get("login_password") or ""
        if not url or not user:
            return {"success": False, "error": "URL e utilizador obrigatórios", "updated": None}
        supplier_id = access["supplier_id"]
        extracted = {}
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            try:
                page = browser.new_page()
                page.goto(url, wait_until="domcontentloaded", timeout=15000)
                # Exemplo genérico: preencher campos de login (selectors a ajustar por site)
                page.fill('input[name="username"], input[name="user"], input[type="email"]', user)
                page.fill('input[name="password"], input[type="password"]', password)
                page.click('button[type="submit"], input[type="submit"], a:has-text("Entrar")')
                page.wait_for_load_state("networkidle", timeout=10000)
                # Navegar a perfil/dados fiscais (selectors dependem do site)
                for link_text in ["Dados da Conta", "Perfil", "Dados de Faturação", "Mi cuenta", "Profile"]:
                    try:
                        page.click(f"text={link_text}", timeout=3000)
                        break
                    except Exception:
                        continue
                page.wait_for_load_state("domcontentloaded", timeout=5000)
                # Extração genérica por labels (ajustar ao HTML real)
                for label, name in [
                    ("NIF", "nif_cif"), ("NIF/CIF", "nif_cif"), ("Morada", "morada"),
                    ("Razão Social", "designacao_social"), ("Nome Legal", "designacao_social"),
                ]:
                    try:
                        el = page.locator(f"text={label}").locator("..").locator("input, .value, td").first
                        if el.count():
                            extracted[name] = el.input_value() if "input" in str(el) else el.text_content()
                    except Exception:
                        pass
                browser.close()
            except Exception as e:
                browser.close()
                return {"success": False, "error": str(e), "updated": None}
        if not extracted:
            return {"success": True, "message": "Login OK; nenhum campo extraído (ajustar selectors).", "updated": None}
        # Atualizar suppliers com os dados extraídos
        updates = []
        params = []
        if extracted.get("nif_cif"):
            updates.append("nif_cif = ?")
            params.append(extracted["nif_cif"])
        if extracted.get("morada"):
            updates.append("morada = ?")
            params.append(extracted["morada"])
        if extracted.get("designacao_social"):
            updates.append("designacao_social = ?")
            params.append(extracted["designacao_social"])
        if updates:
            params.append(supplier_id)
            self.conn.execute(
                f"UPDATE suppliers SET {', '.join(updates)} WHERE id = ?",
                params,
            )
            self.conn.execute(
                "UPDATE supplier_access SET last_sync = CURRENT_TIMESTAMP WHERE supplier_id = ?",
                [supplier_id],
            )
            self.conn.commit()
        return {
            "success": True,
            "updated": extracted,
            "message": "Dados do site sincronizados para a ficha do fornecedor.",
        }

    def download_price_list(self, supplier_id: int) -> List[Dict[str, Any]]:
        """
        Faz login no portal do fornecedor, descarrega a tabela de preços (CSV/XLSX ou página)
        e devolve lista [{ "sku": str, "price": float }, ...].
        Sem Playwright: devolve lista vazia.
        """
        access = self.get_access(supplier_id)
        if not access or not access.get("url_site"):
            return []
        try:
            return self._download_prices_playwright(access)
        except ImportError:
            return []

    def _download_prices_playwright(self, access: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Exemplo: navegar à página de preços ou link de download CSV e extrair SKU + preço."""
        try:
            from playwright.sync_api import sync_playwright
        except ImportError:
            return []
        url = (access.get("url_site") or "").strip()
        user = (access.get("login_user") or "").strip()
        password = access.get("login_password") or ""
        if not url or not user:
            return []
        results = []
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            try:
                page = browser.new_page()
                page.goto(url, wait_until="domcontentloaded", timeout=15000)
                page.fill('input[name="username"], input[name="user"], input[type="email"]', user)
                page.fill('input[name="password"], input[type="password"]', password)
                page.click('button[type="submit"], input[type="submit"]')
                page.wait_for_load_state("networkidle", timeout=10000)
                # Exemplo: procurar link "Preços" / "Price list" ou tabela
                # results = extrair da página ou descarregar CSV e parsear
                # Por agora devolve vazio; cada portal terá selectors diferentes
                browser.close()
            except Exception:
                browser.close()
        return results

    def sync_orders_and_invoices(self, supplier_id: int) -> Dict[str, Any]:
        """
        Entra em "As Minhas Encomendas", extrai tracking e links de faturas PDF,
        atualiza purchase_orders (tracking_number, invoice_pdf_url) onde supplier_order_id coincide.
        Devolve {"trackings_updated": int, "invoices_downloaded": int, "error": str ou None}.
        """
        access = self.get_access(supplier_id)
        if not access or not access.get("url_site"):
            return {"trackings_updated": 0, "invoices_downloaded": 0, "error": "Sem credenciais"}
        try:
            return self._sync_orders_invoices_playwright(access)
        except ImportError:
            return {"trackings_updated": 0, "invoices_downloaded": 0, "error": "Playwright não instalado"}

    def _sync_orders_invoices_playwright(self, access: Dict[str, Any]) -> Dict[str, Any]:
        """Exemplo: área de encomendas do fornecedor; extrair tracking e URL da fatura por order_id."""
        try:
            from playwright.sync_api import sync_playwright
        except ImportError:
            return {"trackings_updated": 0, "invoices_downloaded": 0, "error": "Playwright não instalado"}
        url = (access.get("url_site") or "").strip()
        user = (access.get("login_user") or "").strip()
        password = access.get("login_password") or ""
        supplier_id = access["supplier_id"]
        if not url or not user:
            return {"trackings_updated": 0, "invoices_downloaded": 0, "error": "URL/utilizador em falta"}
        trackings_updated = 0
        invoices_downloaded = 0
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            try:
                page = browser.new_page()
                page.goto(url, wait_until="domcontentloaded", timeout=15000)
                page.fill('input[name="username"], input[name="user"], input[type="email"]', user)
                page.fill('input[name="password"], input[type="password"]', password)
                page.click('button[type="submit"], input[type="submit"]')
                page.wait_for_load_state("networkidle", timeout=10000)
                # Navegar a "As Minhas Encomendas" / "Orders"
                for link in ["As Minhas Encomendas", "Encomendas", "Orders", "My orders"]:
                    try:
                        page.click(f"text={link}", timeout=3000)
                        break
                    except Exception:
                        continue
                page.wait_for_load_state("domcontentloaded", timeout=5000)
                # Exemplo: rows com .order-row; em cada row: .id -> supplier_order_id, .tracking, a.download-invoice
                rows = page.query_selector_all(".order-row, tr[data-order], table.orders tbody tr")
                for row in rows:
                    try:
                        order_id_el = row.query_selector(".id, .order-id, td:first-child")
                        tracking_el = row.query_selector(".tracking, .tracking-number, td:nth-child(3)")
                        invoice_el = row.query_selector("a.download-invoice, a[href*='invoice'], a[href*='.pdf']")
                        order_id = order_id_el.inner_text().strip() if order_id_el else None
                        tracking = tracking_el.inner_text().strip() if tracking_el else None
                        invoice_url = invoice_el.get_attribute("href") if invoice_el else None
                        if order_id and (tracking or invoice_url):
                            if tracking:
                                self.conn.execute(
                                    "UPDATE purchase_orders SET tracking_number = ? WHERE supplier_order_id = ? AND supplier_id = ?",
                                    [tracking, order_id, supplier_id],
                                )
                                trackings_updated += 1
                            if invoice_url:
                                self.conn.execute(
                                    "UPDATE purchase_orders SET invoice_pdf_url = ? WHERE supplier_order_id = ? AND supplier_id = ?",
                                    [invoice_url, order_id, supplier_id],
                                )
                                invoices_downloaded += 1
                    except Exception:
                        continue
                self.conn.commit()
                browser.close()
            except Exception as e:
                browser.close()
                return {"trackings_updated": trackings_updated, "invoices_downloaded": invoices_downloaded, "error": str(e)}
        return {"trackings_updated": trackings_updated, "invoices_downloaded": invoices_downloaded, "error": None}

    def close(self):
        try:
            self.conn.close()
        except Exception:
            pass
