"""
Fase 4: Motor de Sincronização Noturna (Midnight Sync) e Orquestrador.
Executa diariamente às 00:00; suporta sync manual por fornecedor (sync-now).
Suporta ficheiro CSV em data/temp_scrapes/prices_{supplier_id}.csv para testes (seeding).
"""
from __future__ import annotations

import csv
import logging
import os
import time
import threading
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional

from app.config.database import get_db_connection

# Diretório base do backend (para data/temp_scrapes independente do cwd)
_BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
_TEMP_SCRAPES_DIR = _BACKEND_DIR / "data" / "temp_scrapes"
from app.services.security_service import decrypt_password
from app.services.scraper_factory import get_scraper
from app.services.price_sync_service import update_sku_costs
from app.services.accounting_match_service import AccountingMatchService

logger = logging.getLogger(__name__)

# Scheduler é inicializado em main.py (startup) para evitar import circular
_scheduler = None


def get_scheduler():
    """Devolve o scheduler de background (APScheduler)."""
    global _scheduler
    if _scheduler is None:
        try:
            from apscheduler.schedulers.background import BackgroundScheduler
            _scheduler = BackgroundScheduler()
        except ImportError:
            logger.warning("APScheduler não instalado: pip install apscheduler")
            return None
    return _scheduler


def _get_empresa_id(supplier_id: int) -> int | None:
    """Obtém empresa_id do fornecedor."""
    conn = get_db_connection()
    try:
        r = conn.execute("SELECT empresa_id FROM suppliers WHERE id = ?", [supplier_id]).fetchone()
        return int(r[0]) if r and r[0] is not None else None
    finally:
        conn.close()


def _log_sync(
    supplier_id: int,
    sync_type: str,
    status: str,
    message: str = None,
    records_updated: int = None,
    empresa_id: int = None,
    duration_seconds: float = None,
):
    """Regista uma entrada em sync_history (Fase 4: empresa_id, duration_seconds)."""
    conn = get_db_connection()
    try:
        eid = empresa_id if empresa_id is not None else _get_empresa_id(supplier_id)
        next_id = conn.execute("SELECT COALESCE(MAX(id), 0) + 1 FROM sync_history").fetchone()[0]
        conn.execute(
            """
            INSERT INTO sync_history (id, supplier_id, empresa_id, sync_type, started_at, finished_at, status, message, records_updated, duration_seconds)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?, ?, ?, ?)
            """,
            [next_id, supplier_id, eid, sync_type, status, message or "", records_updated, duration_seconds],
        )
        conn.commit()
    except Exception as e:
        logger.exception("Erro ao gravar sync_history: %s", e)
    finally:
        conn.close()


def _load_prices_from_temp_scrapes(supplier_id: int) -> Optional[List[Dict[str, Any]]]:
    """
    Se existir data/temp_scrapes/prices_{supplier_id}.csv, lê e devolve lista [{"sku", "price"}, ...].
    Permite testar o ciclo completo (seed + sync) sem Playwright.
    """
    path = _TEMP_SCRAPES_DIR / f"prices_{supplier_id}.csv"
    if not path.is_file():
        return None
    rows: List[Dict[str, Any]] = []
    try:
        with open(path, "r", encoding="utf-8-sig", newline="", errors="ignore") as f:
            reader = csv.DictReader(f)
            for row in reader:
                sku = (row.get("sku") or row.get("SKU") or row.get("sku_fornecedor") or "").strip()
                price_str = row.get("price") or row.get("Price") or row.get("custo")
                if not sku or price_str is None:
                    continue
                try:
                    price = float(str(price_str).replace(",", "."))
                    rows.append({"sku": sku, "price": price})
                except (TypeError, ValueError):
                    continue
        return rows if rows else None
    except Exception as e:
        logger.warning("_load_prices_from_temp_scrapes %s: %s", path, e)
        return None


def _queue_invoices_for_validation(supplier_id: int) -> None:
    """
    Fase 6: Em vez de criar lançamento ledger automaticamente, coloca as faturas
    em quarentena em supplier_invoices com status='pendente_validacao'.
    O utilizador valida manualmente no Inbox de Faturas (Finanças Globais).
    Apenas na aprovação manual é que o lançamento vai para supplier_ledger.
    """
    try:
        conn = get_db_connection()
        rows = conn.execute(
            """
            SELECT po.id, po.empresa_id, po.supplier_id, po.total_final,
                   po.invoice_pdf_url, po.invoice_ref, po.invoice_amount,
                   po.supplier_order_id
            FROM purchase_orders po
            WHERE po.supplier_id = ?
              AND po.invoice_pdf_url IS NOT NULL
              AND NOT EXISTS (
                  SELECT 1 FROM supplier_invoices si
                  WHERE si.purchase_order_id = po.id
              )
            """,
            [supplier_id],
        ).fetchall()

        queued = 0
        for (po_id, eid, sid, total_po, pdf_url, inv_ref, inv_amount, sup_ord_id) in rows:
            if not (eid and sid and inv_ref):
                continue
            valor_fat = float(inv_amount or total_po or 0)
            valor_po  = float(total_po or 0)
            diferenca = round(valor_fat - valor_po, 2)
            next_id   = conn.execute("SELECT COALESCE(MAX(id), 0) + 1 FROM supplier_invoices").fetchone()[0]
            conn.execute(
                """
                INSERT INTO supplier_invoices
                  (id, empresa_id, supplier_id, purchase_order_id, supplier_order_id,
                   invoice_ref, valor_fatura, valor_po, diferenca, flag_divergencia,
                   invoice_pdf_url, status, source)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
                """,
                [next_id, eid, sid, po_id, sup_ord_id,
                 inv_ref, valor_fat, valor_po, diferenca,
                 abs(diferenca) > 0.01, pdf_url, "pendente_validacao", "robot"],
            )
            queued += 1
            logger.info("Fase6 queue: Fatura %s (PO #%s) em quarentena para validação", inv_ref, po_id)

        if queued:
            conn.commit()
            logger.info("Fase6 queue: %d fatura(s) em espera de validação (supplier %s)", queued, supplier_id)
        conn.close()
    except Exception as e:
        logger.warning("_queue_invoices_for_validation erro: %s", e)


def _run_supplier_sync(
    supplier_id: int,
    url_site: str,
    login_user: str,
    password_encrypted: str,
    auto_prices: bool,
    auto_trackings: bool,
    auto_invoices: bool,
) -> None:
    """
    Executa sync para um fornecedor (Prices, Tracking, Invoices).
    Usado pelo job das 00:00 e pelo endpoint sync-now.
    """
    # Modo teste/seeding: se existe CSV de preços, não precisa de password para executar
    has_price_csv = (_TEMP_SCRAPES_DIR / f"prices_{supplier_id}.csv").is_file()
    password = decrypt_password(password_encrypted)
    if not password and not has_price_csv:
        _log_sync(supplier_id, "all", "error", "Falha ao desencriptar password")
        return
    scraper = get_scraper(url_site)
    if not hasattr(scraper, "download_price_list"):
        scraper = __import__("app.services.supplier_scraper", fromlist=["SupplierScraper"]).SupplierScraper()

    if auto_prices:
        t0 = time.time()
        try:
            # Teste/seeding: ler CSV em data/temp_scrapes/prices_{supplier_id}.csv se existir
            new_prices = _load_prices_from_temp_scrapes(supplier_id)
            if not new_prices:
                new_prices = scraper.download_price_list(supplier_id)
            dur = round(time.time() - t0, 2)
            if new_prices:
                updated = update_sku_costs(supplier_id, new_prices)
                _log_sync(supplier_id, "Prices", "success", f"Preços atualizados: {updated} SKUs", updated, duration_seconds=dur)
                # Fase 5: verificar alertas de margem após atualização de preços
                try:
                    acct = AccountingMatchService()
                    alerted = acct.check_and_flag_margin_alerts(supplier_id, new_prices)
                    if alerted:
                        logger.info("Fase5 margin_alert: %d itens pendentes com risco de prejuízo (supplier %s)", alerted, supplier_id)
                    acct.close()
                except Exception as ae:
                    logger.warning("Fase5 margin_alert erro: %s", ae)
            else:
                _log_sync(supplier_id, "Prices", "success", "Nenhum preço obtido", 0, duration_seconds=dur)
        except Exception as e:
            logger.exception("Price sync supplier %s: %s", supplier_id, e)
            _log_sync(supplier_id, "Prices", "error", str(e), duration_seconds=round(time.time() - t0, 2))

    if auto_trackings or auto_invoices:
        t0 = time.time()
        try:
            result = scraper.sync_orders_and_invoices(supplier_id)
            dur = round(time.time() - t0, 2)
            err = result.get("error")
            if err:
                _log_sync(supplier_id, "Tracking", "error", err, duration_seconds=dur)
                _log_sync(supplier_id, "Invoices", "error", err, duration_seconds=0)
            else:
                t = result.get("trackings_updated", 0) or 0
                i = result.get("invoices_downloaded", 0) or 0
                if auto_trackings:
                    _log_sync(supplier_id, "Tracking", "success", f"Trackings capturados: {t}", t, duration_seconds=dur)
                if auto_invoices:
                    _log_sync(supplier_id, "Invoices", "success", f"Faturas: {i}", i, duration_seconds=dur)
                    # Fase 6: colocar faturas em quarentena para validação manual (não auto-ledger)
                    if i > 0:
                        try:
                            _queue_invoices_for_validation(supplier_id)
                        except Exception as le:
                            logger.warning("Fase6 queue_invoices erro: %s", le)
        except Exception as e:
            logger.exception("Order/Invoice sync supplier %s: %s", supplier_id, e)
            _log_sync(supplier_id, "trackings_invoices", "error", str(e), duration_seconds=round(time.time() - t0, 2))

    try:
        c = get_db_connection()
        c.execute("UPDATE supplier_access SET last_sync = CURRENT_TIMESTAMP WHERE supplier_id = ?", [supplier_id])
        c.commit()
        c.close()
    except Exception:
        pass
    if hasattr(scraper, "close"):
        scraper.close()


def midnight_job():
    """
    MidnightSyncOrchestrator: tarefa às 00:00.
    Para cada fornecedor com Acessos preenchidos e Sincronização Automática ativa,
    instancia scraper (Factory) e executa Prices, Tracking, Invoices.
    """
    conn = get_db_connection()
    try:
        rows = conn.execute(
            """
            SELECT id, supplier_id, url_site, login_user, password_encrypted,
                   auto_sync_prices, auto_sync_trackings, auto_sync_invoices
            FROM supplier_access
            WHERE (auto_sync_prices = TRUE OR auto_sync_trackings = TRUE OR auto_sync_invoices = TRUE)
            """
        ).fetchall()
    finally:
        conn.close()

    for row in rows:
        access_id, supplier_id, url_site, login_user, password_encrypted, auto_prices, auto_trackings, auto_invoices = row
        if not url_site or not login_user or not password_encrypted:
            _log_sync(supplier_id, "all", "error", "Credenciais em falta (url_site/login/password)")
            continue
        _run_supplier_sync(
            supplier_id,
            url_site,
            login_user,
            password_encrypted,
            bool(auto_prices),
            bool(auto_trackings),
            bool(auto_invoices),
        )

    logger.info("Midnight Sync concluído.")


def run_sync_now_async(supplier_id: int) -> None:
    """
    Dispara sincronização manual para um fornecedor em background (não bloqueia a API).
    """
    conn = get_db_connection()
    try:
        row = conn.execute(
            """
            SELECT supplier_id, url_site, login_user, password_encrypted,
                   COALESCE(auto_sync_prices, FALSE), COALESCE(auto_sync_trackings, FALSE), COALESCE(auto_sync_invoices, FALSE)
            FROM supplier_access
            WHERE supplier_id = ?
            """,
            [supplier_id],
        ).fetchone()
    finally:
        conn.close()
    if not row:
        return
    _, url_site, login_user, password_encrypted, auto_prices, auto_trackings, auto_invoices = row
    if not url_site or not login_user or not password_encrypted:
        _log_sync(supplier_id, "all", "error", "Credenciais em falta")
        return

    def _job():
        _run_supplier_sync(
            supplier_id,
            url_site,
            login_user,
            password_encrypted,
            bool(auto_prices) or True,
            bool(auto_trackings) or True,
            bool(auto_invoices) or True,
        )

    thread = threading.Thread(target=_job, daemon=True)
    thread.start()


def start_scheduler():
    """Adiciona o job às 00:00 e arranca o scheduler."""
    sched = get_scheduler()
    if sched is None:
        return
    sched.add_job(midnight_job, "cron", hour=0, minute=0, id="midnight_sync")
    sched.start()
    logger.info("Scheduler iniciado: Midnight Sync às 00:00.")


def stop_scheduler():
    """Para o scheduler (ex.: no shutdown da app)."""
    global _scheduler
    if _scheduler is not None:
        try:
            _scheduler.shutdown(wait=False)
        except Exception:
            pass
        _scheduler = None
