"""Fase 4: Endpoints para Midnight Sync, Status de Automação e sync manual."""
from fastapi import APIRouter, Query
from typing import Optional, List
from app.config.database import get_db_connection
from app.services.automation_service import run_sync_now_async

router = APIRouter(prefix="/automation", tags=["automation"])


@router.post("/sync-now/{supplier_id}")
async def sync_now(supplier_id: int):
    """
    Força sincronização agora para um fornecedor (Prices, Tracking, Invoices).
    Executa em background para não bloquear a API.
    """
    run_sync_now_async(supplier_id)
    return {"success": True, "message": "Sincronização iniciada em background", "supplier_id": supplier_id}


@router.get("/stats")
async def get_automation_stats():
    """
    KPIs do dia para o dashboard: preços atualizados hoje, trackings capturados hoje, faturas descarregadas hoje.
    """
    conn = get_db_connection()
    try:
        today = "CURRENT_DATE"
        prices_today = conn.execute(
            """
            SELECT COALESCE(SUM(records_updated), 0) FROM sync_history
            WHERE CAST(started_at AS DATE) = current_date AND status = 'success' AND sync_type IN ('prices', 'Prices')
            """
        ).fetchone()[0]
        trackings_today = conn.execute(
            """
            SELECT COALESCE(SUM(records_updated), 0) FROM sync_history
            WHERE CAST(started_at AS DATE) = current_date AND status = 'success' AND sync_type IN ('Tracking', 'trackings_invoices')
            """
        ).fetchone()[0]
        invoices_today = conn.execute(
            """
            SELECT COALESCE(SUM(records_updated), 0) FROM sync_history
            WHERE CAST(started_at AS DATE) = current_date AND status = 'success' AND sync_type IN ('Invoices', 'trackings_invoices')
            """
        ).fetchone()[0]
        return {
            "prices_updated_today": int(prices_today or 0),
            "trackings_captured_today": int(trackings_today or 0),
            "invoices_downloaded_today": int(invoices_today or 0),
        }
    except Exception as e:
        return {
            "prices_updated_today": 0,
            "trackings_captured_today": 0,
            "invoices_downloaded_today": 0,
            "error": str(e),
        }
    finally:
        conn.close()


@router.get("/status")
async def get_automation_status():
    """
    Dashboard Status de Automação: última sincronização por tipo,
    faturas recolhidas hoje, trackings atualizados hoje.
    """
    conn = get_db_connection()
    try:
        # Última sync por tipo (prices, trackings_invoices)
        last_prices = conn.execute(
            """
            SELECT sh.supplier_id, s.nome, sh.finished_at, sh.status, sh.records_updated
            FROM sync_history sh
            JOIN suppliers s ON s.id = sh.supplier_id
            WHERE sh.sync_type = 'prices' AND sh.status = 'success'
            ORDER BY sh.finished_at DESC
            LIMIT 10
            """
        ).fetchall()
        last_trackings = conn.execute(
            """
            SELECT sh.supplier_id, s.nome, sh.finished_at, sh.status, sh.records_updated
            FROM sync_history sh
            JOIN suppliers s ON s.id = sh.supplier_id
            WHERE sh.sync_type = 'trackings_invoices' AND sh.status = 'success'
            ORDER BY sh.finished_at DESC
            LIMIT 10
            """
        ).fetchall()
        # Hoje: quantos registos atualizados (aprox. faturas + trackings)
        today = conn.execute(
            """
            SELECT COUNT(*) FROM sync_history
            WHERE DATE(started_at) = CURRENT_DATE AND status = 'success'
            """
        ).fetchone()[0]
        records_today = conn.execute(
            """
            SELECT COALESCE(SUM(records_updated), 0) FROM sync_history
            WHERE DATE(started_at) = CURRENT_DATE AND status = 'success'
            """
        ).fetchone()[0]
        # Fornecedores com auto_sync ativo
        with_auto = conn.execute(
            """
            SELECT COUNT(*) FROM supplier_access
            WHERE auto_sync_prices = TRUE OR auto_sync_trackings = TRUE OR auto_sync_invoices = TRUE
            """
        ).fetchone()[0]
        # Lista de fornecedores com acessos preenchidos (para botão "Forçar Sincronização Agora")
        suppliers_with_access = conn.execute(
            """
            SELECT sa.supplier_id, s.nome
            FROM supplier_access sa
            JOIN suppliers s ON s.id = sa.supplier_id
            WHERE sa.url_site IS NOT NULL AND sa.url_site != ''
              AND sa.login_user IS NOT NULL AND sa.login_user != ''
              AND sa.password_encrypted IS NOT NULL AND sa.password_encrypted != ''
            ORDER BY s.nome
            """
        ).fetchall()
        return {
            "suppliers_with_access": [{"supplier_id": r[0], "supplier_nome": r[1]} for r in suppliers_with_access],
            "last_price_syncs": [
                {"supplier_id": r[0], "supplier_nome": r[1], "finished_at": str(r[2]) if r[2] else None, "status": r[3], "records_updated": r[4]}
                for r in last_prices
            ],
            "last_tracking_syncs": [
                {"supplier_id": r[0], "supplier_nome": r[1], "finished_at": str(r[2]) if r[2] else None, "status": r[3], "records_updated": r[4]}
                for r in last_trackings
            ],
            "syncs_today_count": today,
            "records_updated_today": records_today,
            "suppliers_with_automation": with_auto,
        }
    except Exception as e:
        return {
            "suppliers_with_access": [],
            "last_price_syncs": [],
            "last_tracking_syncs": [],
            "syncs_today_count": 0,
            "records_updated_today": 0,
            "suppliers_with_automation": 0,
            "error": str(e),
        }
    finally:
        conn.close()


@router.get("/history")
async def get_automation_history(
    supplier_id: Optional[int] = Query(None),
    sync_type: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
):
    """Lista o histórico de sincronização (alias para sync-history)."""
    return await get_sync_history(supplier_id, sync_type, limit)


async def get_sync_history(
    supplier_id: Optional[int] = None,
    sync_type: Optional[str] = None,
    limit: int = 50,
):
    """Lista o histórico de sincronizações (para monitorização e debug)."""
    conn = get_db_connection()
    try:
        q = """
            SELECT sh.id, sh.supplier_id, sh.empresa_id, s.nome AS supplier_nome, sh.sync_type, sh.started_at, sh.finished_at, sh.status, sh.message, sh.records_updated, sh.duration_seconds
            FROM sync_history sh
            LEFT JOIN suppliers s ON s.id = sh.supplier_id
            WHERE 1=1
        """
        params: List = []
        if supplier_id is not None:
            q += " AND sh.supplier_id = ?"
            params.append(supplier_id)
        if sync_type:
            q += " AND sh.sync_type = ?"
            params.append(sync_type)
        q += " ORDER BY sh.started_at DESC LIMIT ?"
        params.append(limit)
        rows = conn.execute(q, params).fetchall()
        return {
            "items": [
                {
                    "id": r[0],
                    "supplier_id": r[1],
                    "empresa_id": r[2],
                    "supplier_nome": r[3],
                    "sync_type": r[4],
                    "started_at": str(r[5]) if r[5] else None,
                    "finished_at": str(r[6]) if r[6] else None,
                    "status": r[7],
                    "message": r[8],
                    "records_updated": r[9],
                    "duration_seconds": r[10] if len(r) > 10 else None,
                }
                for r in rows
            ]
        }
    finally:
        conn.close()


@router.get("/sync-history")
async def get_sync_history_endpoint(
    supplier_id: Optional[int] = Query(None),
    sync_type: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
):
    """Lista o histórico de sincronizações."""
    return await get_sync_history(supplier_id, sync_type, limit)
