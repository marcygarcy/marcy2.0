"""
Fase 5 – Ciclo Financeiro e Reconciliação Total.

Serviços:
  - Conta Corrente (supplier_ledger): criar lançamentos, calcular saldo, extrato.
  - Triple-Match: PO amount vs Invoice vs Movimento Bancário.
  - Aging Report: dívidas a vencer / vencidas < 30d / vencidas > 30d.
  - Net Profitability: lucro real final (GMV - devoluções - comissões - custo real).
  - Cash Flow Forecast: saídas previstas por data de vencimento.
"""
from __future__ import annotations

import logging
from collections import defaultdict
from datetime import date, timedelta
from typing import Any, Dict, List, Optional, Tuple

from app.config.database import get_db_connection

logger = logging.getLogger(__name__)

TIPOS_VALIDOS = {"Fatura", "Nota de Crédito", "Pagamento", "Ajuste"}


def _next_id(conn, table: str) -> int:
    row = conn.execute(f"SELECT COALESCE(MAX(id), 0) + 1 FROM {table}").fetchone()
    return int(row[0]) if row else 1


class AccountingMatchService:
    """Fase 5: Triple-Match, Conta Corrente e BI Financeiro."""

    def __init__(self):
        self.conn = get_db_connection()

    def close(self):
        if self.conn:
            try:
                self.conn.close()
            except Exception:
                pass

    # ─── Conta Corrente (Ledger) ───────────────────────────────────────────────

    def _recalc_balance(self, empresa_id: int, supplier_id: int) -> float:
        """Saldo acumulado actual de um fornecedor (créditos - débitos)."""
        row = self.conn.execute(
            """
            SELECT COALESCE(SUM(valor_credito) - SUM(valor_debito), 0)
            FROM supplier_ledger
            WHERE empresa_id = ? AND supplier_id = ?
            """,
            [empresa_id, supplier_id],
        ).fetchone()
        return float(row[0]) if row else 0.0

    def create_ledger_entry(
        self,
        empresa_id: int,
        supplier_id: int,
        tipo: str,
        valor_credito: float = 0.0,
        valor_debito: float = 0.0,
        documento_ref: Optional[str] = None,
        purchase_order_id: Optional[int] = None,
        notas: Optional[str] = None,
        data_movimento: Optional[date] = None,
    ) -> Dict[str, Any]:
        """Cria um lançamento na conta corrente e recalcula o saldo."""
        if tipo not in TIPOS_VALIDOS:
            raise ValueError(f"Tipo inválido: {tipo}. Use: {TIPOS_VALIDOS}")
        eid = _next_id(self.conn, "supplier_ledger")
        dm = str(data_movimento or date.today())
        saldo = self._recalc_balance(empresa_id, supplier_id) + valor_credito - valor_debito
        self.conn.execute(
            """
            INSERT INTO supplier_ledger
                (id, empresa_id, supplier_id, data_movimento, tipo, documento_ref,
                 purchase_order_id, valor_credito, valor_debito, saldo_acumulado, notas)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [eid, empresa_id, supplier_id, dm, tipo, documento_ref,
             purchase_order_id, valor_credito, valor_debito, saldo, notas],
        )
        self.conn.commit()
        return {"id": eid, "saldo_acumulado": round(saldo, 2)}

    def get_ledger(
        self,
        supplier_id: int,
        empresa_id: Optional[int] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> Tuple[List[Dict], int, float]:
        """Extrato da conta corrente de um fornecedor. Devolve (linhas, total, saldo_actual)."""
        conds = ["sl.supplier_id = ?"]
        params: list = [supplier_id]
        if empresa_id is not None:
            conds.append("sl.empresa_id = ?")
            params.append(empresa_id)
        where = " AND ".join(conds)

        total = self.conn.execute(
            f"SELECT COUNT(*) FROM supplier_ledger sl WHERE {where}", params
        ).fetchone()[0]

        saldo_atual = (
            self._recalc_balance(empresa_id, supplier_id) if empresa_id else 0.0
        )

        rows = self.conn.execute(
            f"""
            SELECT sl.id, sl.empresa_id, sl.supplier_id, sl.data_movimento,
                   sl.tipo, sl.documento_ref, sl.purchase_order_id,
                   sl.valor_credito, sl.valor_debito, sl.saldo_acumulado,
                   sl.notas, sl.created_at,
                   s.nome AS supplier_nome, e.nome AS empresa_nome
            FROM supplier_ledger sl
            LEFT JOIN suppliers s ON s.id = sl.supplier_id
            LEFT JOIN empresas e ON e.id = sl.empresa_id
            WHERE {where}
            ORDER BY sl.data_movimento DESC, sl.id DESC
            LIMIT ? OFFSET ?
            """,
            params + [limit, offset],
        ).fetchall()

        cols = [
            "id", "empresa_id", "supplier_id", "data_movimento", "tipo",
            "documento_ref", "purchase_order_id", "valor_credito", "valor_debito",
            "saldo_acumulado", "notas", "created_at", "supplier_nome", "empresa_nome",
        ]
        return [dict(zip(cols, r)) for r in rows], int(total), round(saldo_atual, 2)

    def get_ledger_extract_by_period(
        self,
        supplier_id: int,
        empresa_id: Optional[int] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Extrato contabilístico por período com Saldo Inicial.
        Devolve: { saldo_inicial, movimentos[], total_creditos, total_debitos,
                   saldo_final, supplier_nome, empresa_nome }
        Convenção: C (Crédito/FT/ND) = aumenta dívida; D (Débito/RE/NC) = reduz dívida.
        """
        # 1. Saldo Inicial: tudo ANTES de start_date
        conds_si = ["supplier_id = ?"]
        params_si: list = [supplier_id]
        if empresa_id is not None:
            conds_si.append("empresa_id = ?")
            params_si.append(empresa_id)
        if start_date:
            conds_si.append("data_movimento < ?")
            params_si.append(start_date)
        row_si = self.conn.execute(
            f"SELECT COALESCE(SUM(valor_credito) - SUM(valor_debito), 0) FROM supplier_ledger WHERE {' AND '.join(conds_si)}",
            params_si,
        ).fetchone()
        saldo_inicial = float(row_si[0] or 0)

        # 2. Movimentos no período via v_extrato_fornecedor (ordem ASC para extrato)
        conds_m = ["sl.supplier_id = ?"]
        params_m: list = [supplier_id]
        if empresa_id is not None:
            conds_m.append("sl.empresa_id = ?")
            params_m.append(empresa_id)
        if start_date:
            conds_m.append("sl.data_movimento >= ?")
            params_m.append(start_date)
        if end_date:
            conds_m.append("sl.data_movimento <= ?")
            params_m.append(end_date)

        raw = self.conn.execute(
            f"""
            SELECT sl.id, sl.data_movimento, sl.tipo, sl.tipo_doc, sl.dc,
                   sl.num_doc, sl.descricao, sl.valor_credito, sl.valor_debito,
                   sl.purchase_order_id, sl.supplier_nome, sl.empresa_nome
            FROM v_extrato_fornecedor sl
            WHERE {' AND '.join(conds_m)}
            ORDER BY sl.data_movimento ASC, sl.id ASC
            """,
            params_m,
        ).fetchall()

        # 3. Calcular saldo corrente a partir do saldo_inicial
        movimentos = []
        saldo_corrente = saldo_inicial
        total_creditos = 0.0
        total_debitos = 0.0
        supplier_nome = None
        empresa_nome = None

        for r in raw:
            credito = float(r[7] or 0)
            debito = float(r[8] or 0)
            saldo_corrente = round(saldo_corrente + credito - debito, 2)
            total_creditos += credito
            total_debitos += debito
            if supplier_nome is None:
                supplier_nome = r[10]
                empresa_nome = r[11]
            movimentos.append({
                "id": r[0],
                "data_movimento": str(r[1])[:10] if r[1] else None,
                "tipo": r[2],
                "tipo_doc": r[3],
                "dc": r[4],
                "num_doc": r[5],
                "descricao": r[6],
                "valor_credito": round(credito, 2),
                "valor_debito": round(debito, 2),
                "saldo_corrente": saldo_corrente,
                "purchase_order_id": r[9],
            })

        # Fallback: obter nome do fornecedor se não há movimentos no período
        if supplier_nome is None:
            row_s = self.conn.execute(
                "SELECT s.nome, e.nome FROM suppliers s LEFT JOIN empresas e ON e.id = ? WHERE s.id = ?",
                [empresa_id, supplier_id],
            ).fetchone()
            if row_s:
                supplier_nome = row_s[0]
                empresa_nome = row_s[1]

        return {
            "saldo_inicial": round(saldo_inicial, 2),
            "movimentos": movimentos,
            "total_creditos": round(total_creditos, 2),
            "total_debitos": round(total_debitos, 2),
            "saldo_final": round(saldo_inicial + total_creditos - total_debitos, 2),
            "supplier_nome": supplier_nome or "?",
            "empresa_nome": empresa_nome,
        }

    # ─── Triple-Match ──────────────────────────────────────────────────────────

    def run_triple_match(self, purchase_order_id: int) -> Dict[str, Any]:
        """Compara PO amount vs Invoice amount vs Movimento Bancário para uma PO."""
        po = self.conn.execute(
            """
            SELECT id, empresa_id, total_final, invoice_ref, invoice_amount, supplier_id
            FROM purchase_orders WHERE id = ?
            """,
            [purchase_order_id],
        ).fetchone()
        if not po:
            return {"error": "PO não encontrada"}

        po_id, empresa_id, total_final, invoice_ref, invoice_amount, supplier_id = po
        po_amount = float(total_final or 0)
        invoice_amount = float(invoice_amount) if invoice_amount is not None else None

        # Movimento bancário: match por valor aproximado (± 0.50 €) e empresa
        bank_row = None
        if empresa_id:
            bank_row = self.conn.execute(
                """
                SELECT id, montante
                FROM bank_movements
                WHERE empresa_id = ?
                  AND ABS(ABS(COALESCE(montante, 0)) - ?) < 0.50
                ORDER BY ABS(ABS(COALESCE(montante, 0)) - ?) ASC
                LIMIT 1
                """,
                [empresa_id, po_amount, po_amount],
            ).fetchone()

        bank_movement_id = bank_row[0] if bank_row else None
        bank_amount = float(bank_row[1]) if bank_row else None

        # Avaliar status e discrepância
        status = "Pending"
        discrepancy = 0.0
        notes_parts: list = []

        if invoice_amount is not None and bank_amount is not None:
            inv_diff = abs(invoice_amount - po_amount)
            bank_diff = abs(abs(bank_amount) - po_amount)
            if inv_diff < 0.01 and bank_diff < 0.01:
                status = "Matched"
            else:
                status = "Discrepancy"
                discrepancy = invoice_amount - po_amount
                if inv_diff >= 0.01:
                    notes_parts.append(
                        f"Fatura {invoice_amount:.2f}€ ≠ PO {po_amount:.2f}€ (diff {invoice_amount - po_amount:+.2f}€)"
                    )
                if bank_diff >= 0.01:
                    notes_parts.append(
                        f"Banco {abs(bank_amount):.2f}€ ≠ PO {po_amount:.2f}€"
                    )
        elif invoice_amount is not None:
            if abs(invoice_amount - po_amount) >= 0.01:
                status = "Discrepancy"
                discrepancy = invoice_amount - po_amount
                notes_parts.append(
                    f"Fatura {invoice_amount:.2f}€ ≠ PO {po_amount:.2f}€ (diff {discrepancy:+.2f}€)"
                )

        notes = "; ".join(notes_parts) if notes_parts else None

        # Upsert em financial_reconciliation
        existing = self.conn.execute(
            "SELECT id FROM financial_reconciliation WHERE purchase_order_id = ?",
            [purchase_order_id],
        ).fetchone()

        if existing:
            self.conn.execute(
                """
                UPDATE financial_reconciliation SET
                    invoice_amount = ?, po_amount = ?,
                    bank_movement_id = ?, bank_amount = ?,
                    status = ?, discrepancy_amount = ?, discrepancy_notes = ?,
                    matched_at = CASE WHEN ? = 'Matched' THEN CURRENT_TIMESTAMP ELSE matched_at END
                WHERE purchase_order_id = ?
                """,
                [invoice_amount, po_amount, bank_movement_id, bank_amount,
                 status, discrepancy, notes, status, purchase_order_id],
            )
        else:
            rid = _next_id(self.conn, "financial_reconciliation")
            self.conn.execute(
                """
                INSERT INTO financial_reconciliation
                    (id, empresa_id, purchase_order_id, invoice_ref, invoice_amount,
                     po_amount, bank_movement_id, bank_amount, status,
                     discrepancy_amount, discrepancy_notes,
                     matched_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                    CASE WHEN ? = 'Matched' THEN CURRENT_TIMESTAMP ELSE NULL END)
                """,
                [rid, empresa_id, purchase_order_id, invoice_ref,
                 invoice_amount, po_amount, bank_movement_id, bank_amount,
                 status, discrepancy, notes, status],
            )
        self.conn.commit()
        return {
            "purchase_order_id": purchase_order_id,
            "po_amount": po_amount,
            "invoice_amount": invoice_amount,
            "bank_amount": bank_amount,
            "status": status,
            "discrepancy_amount": round(discrepancy, 2),
            "discrepancy_notes": notes,
        }

    def get_discrepancies(
        self,
        empresa_id: Optional[int] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> Tuple[List[Dict], int]:
        """Lista de divergências (Discrepancy ou Pending com fatura disponível)."""
        conds = ["(fr.status = 'Discrepancy' OR (fr.status = 'Pending' AND fr.invoice_amount IS NOT NULL))"]
        params: list = []
        if empresa_id is not None:
            conds.append("fr.empresa_id = ?")
            params.append(empresa_id)
        where = " AND ".join(conds)

        total = self.conn.execute(
            f"SELECT COUNT(*) FROM financial_reconciliation fr WHERE {where}", params
        ).fetchone()[0]

        rows = self.conn.execute(
            f"""
            SELECT fr.id, fr.empresa_id, fr.purchase_order_id,
                   fr.invoice_ref, fr.invoice_amount, fr.po_amount,
                   fr.bank_movement_id, fr.bank_amount,
                   fr.status, fr.discrepancy_amount, fr.discrepancy_notes,
                   fr.created_at,
                   po.supplier_order_id, po.data_ordered,
                   s.nome AS supplier_nome, e.nome AS empresa_nome
            FROM financial_reconciliation fr
            LEFT JOIN purchase_orders po ON po.id = fr.purchase_order_id
            LEFT JOIN suppliers s ON s.id = po.supplier_id
            LEFT JOIN empresas e ON e.id = fr.empresa_id
            WHERE {where}
            ORDER BY fr.created_at DESC
            LIMIT ? OFFSET ?
            """,
            params + [limit, offset],
        ).fetchall()

        cols = [
            "id", "empresa_id", "purchase_order_id", "invoice_ref", "invoice_amount",
            "po_amount", "bank_movement_id", "bank_amount", "status",
            "discrepancy_amount", "discrepancy_notes", "created_at",
            "supplier_order_id", "data_ordered", "supplier_nome", "empresa_nome",
        ]
        return [dict(zip(cols, r)) for r in rows], int(total)

    # ─── Aging Report ─────────────────────────────────────────────────────────

    def get_aging_report(
        self, empresa_id: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Aging de dívidas a fornecedores por supplier.
        Buckets: A Vencer | Vencido < 30d | Vencido > 30d.
        Usa purchase_orders.due_date ou (data_ordered + 30 dias) como vencimento.
        """
        today = date.today()
        conds = ["po.status NOT IN ('Paid', 'Cancelled')", "COALESCE(po.total_final, 0) > 0"]
        params: list = []
        if empresa_id is not None:
            conds.append("po.empresa_id = ?")
            params.append(empresa_id)
        where = " AND ".join(conds)

        rows = self.conn.execute(
            f"""
            SELECT
                po.supplier_id,
                s.nome AS supplier_nome,
                po.empresa_id,
                e.nome AS empresa_nome,
                COALESCE(po.total_final, 0) AS total,
                COALESCE(
                    TRY_CAST(po.due_date AS DATE),
                    TRY_CAST(DATE_ADD(CAST(po.data_ordered AS DATE), INTERVAL 30 DAY) AS DATE)
                ) AS vencimento_calc
            FROM purchase_orders po
            LEFT JOIN suppliers s ON s.id = po.supplier_id
            LEFT JOIN empresas e ON e.id = po.empresa_id
            WHERE {where}
            ORDER BY po.supplier_id
            """,
            params,
        ).fetchall()

        aging: Dict[int, Dict] = defaultdict(lambda: {
            "supplier_id": 0, "supplier_nome": "", "empresa_id": 0, "empresa_nome": "",
            "a_vencer": 0.0, "vencido_30": 0.0, "vencido_mais_30": 0.0, "total_divida": 0.0,
        })

        for sid, snom, eid, enom, total, venc in rows:
            total = float(total or 0)
            if sid is None:
                continue
            aging[sid].update({"supplier_id": sid, "supplier_nome": snom or "?",
                                "empresa_id": eid, "empresa_nome": enom or "?"})
            aging[sid]["total_divida"] += total
            if venc is None:
                aging[sid]["a_vencer"] += total
                continue
            try:
                venc_date = venc if isinstance(venc, date) else date.fromisoformat(str(venc)[:10])
                delta = (today - venc_date).days
                if delta <= 0:
                    aging[sid]["a_vencer"] += total
                elif delta <= 30:
                    aging[sid]["vencido_30"] += total
                else:
                    aging[sid]["vencido_mais_30"] += total
            except Exception:
                aging[sid]["a_vencer"] += total

        return [
            {**v,
             "a_vencer": round(v["a_vencer"], 2),
             "vencido_30": round(v["vencido_30"], 2),
             "vencido_mais_30": round(v["vencido_mais_30"], 2),
             "total_divida": round(v["total_divida"], 2)}
            for v in sorted(aging.values(), key=lambda x: -x["total_divida"])
        ]

    # ─── Net Profitability ─────────────────────────────────────────────────────

    def get_profitability(
        self,
        empresa_id: Optional[int] = None,
        data_inicio: Optional[str] = None,
        data_fim: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Lucro Real Final:
        GMV - Devoluções - Comissões - Custo Real (POs Pagas) - Portes Reais
        """
        # Transações: GMV, devoluções, comissões
        conds_t: list = []
        params_t: list = []
        if empresa_id is not None:
            conds_t.append("empresa_id = ?")
            params_t.append(empresa_id)
        if data_inicio:
            conds_t.append('CAST("Data do ciclo de faturamento" AS DATE) >= ?')
            params_t.append(data_inicio)
        if data_fim:
            conds_t.append('CAST("Data do ciclo de faturamento" AS DATE) <= ?')
            params_t.append(data_fim)
        where_t = ("WHERE " + " AND ".join(conds_t)) if conds_t else ""

        tx = self.conn.execute(
            f"""
            SELECT
                COALESCE(SUM(CASE WHEN LOWER(COALESCE(Tipo,'')) LIKE '%valor do pedido%'
                                   AND LOWER(COALESCE(Tipo,'')) NOT LIKE '%reembolso%' THEN real ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN LOWER(COALESCE(Tipo,'')) LIKE '%reembolso%'
                                   OR LOWER(COALESCE(Tipo,'')) LIKE '%devolu%' THEN ABS(real) ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN LOWER(COALESCE(Tipo,'')) LIKE '%taxa%'
                                   OR LOWER(COALESCE(Tipo,'')) LIKE '%comiss%' THEN ABS(real) ELSE 0 END), 0)
            FROM transactions {where_t}
            """,
            params_t,
        ).fetchone()

        gmv = float(tx[0] or 0)
        devolucoes = float(tx[1] or 0)
        comissoes = float(tx[2] or 0)

        # POs pagas: custo real
        conds_po: list = ["po.status = 'Paid'"]
        params_po: list = []
        if empresa_id is not None:
            conds_po.append("po.empresa_id = ?")
            params_po.append(empresa_id)
        if data_inicio:
            conds_po.append("CAST(po.data_paid AS DATE) >= ?")
            params_po.append(data_inicio)
        if data_fim:
            conds_po.append("CAST(po.data_paid AS DATE) <= ?")
            params_po.append(data_fim)
        where_po = " AND ".join(conds_po)

        po_row = self.conn.execute(
            f"""
            SELECT
                COALESCE(SUM(po.total_base), 0),
                COALESCE(SUM(po.portes_totais), 0),
                COALESCE(SUM(po.impostos), 0),
                COALESCE(SUM(po.total_final), 0)
            FROM purchase_orders po
            WHERE {where_po}
            """,
            params_po,
        ).fetchone()

        custo_base = float(po_row[0] or 0)
        portes_reais = float(po_row[1] or 0)
        impostos_po = float(po_row[2] or 0)
        custo_total = float(po_row[3] or 0)

        lucro_real = gmv - devolucoes - comissoes - custo_total
        margem_pct = round(lucro_real / gmv * 100, 2) if gmv > 0 else 0.0

        return {
            "gmv": round(gmv, 2),
            "devolucoes": round(devolucoes, 2),
            "comissoes": round(comissoes, 2),
            "custo_base": round(custo_base, 2),
            "portes_reais": round(portes_reais, 2),
            "impostos_po": round(impostos_po, 2),
            "custo_total": round(custo_total, 2),
            "lucro_real": round(lucro_real, 2),
            "margem_pct": margem_pct,
        }

    # ─── Cash Flow Forecast ───────────────────────────────────────────────────

    def get_cash_flow_forecast(
        self,
        empresa_id: Optional[int] = None,
        days: int = 30,
    ) -> List[Dict[str, Any]]:
        """
        Projeção de saídas de caixa com base nos vencimentos das POs não pagas.
        Devolve lista ordenada por data_vencimento com total_saidas diário.
        """
        today = date.today()
        end_date = today + timedelta(days=days)

        conds = [
            "po.status NOT IN ('Paid', 'Cancelled')",
            "COALESCE(po.total_final, 0) > 0",
        ]
        params: list = []
        if empresa_id is not None:
            conds.append("po.empresa_id = ?")
            params.append(empresa_id)
        where = " AND ".join(conds)

        rows = self.conn.execute(
            f"""
            SELECT
                COALESCE(
                    TRY_CAST(po.due_date AS DATE),
                    TRY_CAST(DATE_ADD(CAST(po.data_ordered AS DATE), INTERVAL 30 DAY) AS DATE)
                ) AS vencimento,
                COALESCE(po.total_final, 0) AS total,
                po.id AS po_id,
                po.empresa_id,
                e.nome AS empresa_nome,
                s.nome AS supplier_nome
            FROM purchase_orders po
            LEFT JOIN empresas e ON e.id = po.empresa_id
            LEFT JOIN suppliers s ON s.id = po.supplier_id
            WHERE {where}
            ORDER BY vencimento
            """,
            params,
        ).fetchall()

        by_date: Dict[str, Dict] = defaultdict(lambda: {
            "data_vencimento": "", "total_saidas": 0.0, "num_pos": 0, "pos": [],
        })

        for venc, total, po_id, eid, enom, snom in rows:
            total = float(total or 0)
            if venc is None:
                continue
            try:
                venc_date = venc if isinstance(venc, date) else date.fromisoformat(str(venc)[:10])
                if venc_date < today or venc_date > end_date:
                    continue
                key = str(venc_date)
                by_date[key]["data_vencimento"] = key
                by_date[key]["total_saidas"] += total
                by_date[key]["num_pos"] += 1
                by_date[key]["pos"].append({
                    "po_id": po_id,
                    "empresa_nome": enom or "?",
                    "supplier_nome": snom or "?",
                    "total": round(total, 2),
                })
            except Exception:
                continue

        return [
            {**v, "total_saidas": round(v["total_saidas"], 2)}
            for v in sorted(by_date.values(), key=lambda x: x["data_vencimento"])
        ]

    def get_cash_flow_projection(
        self,
        empresa_id: Optional[int] = None,
        days: int = 30,
        initial_balance: float = 0.0,
    ) -> List[Dict[str, Any]]:
        """
        v3.0: Projeção diária de saldo (entradas - saídas) para os próximos N dias.
        Usa v_cash_flow_forecast: recebíveis marketplace + pagamentos a fornecedores.
        Devolve lista por data com valor_dia e saldo_acumulado (para AreaChart).
        """
        today = date.today()
        end_date = today + timedelta(days=days)
        conds = ["CAST(v.data_previsa AS DATE) >= ?", "CAST(v.data_previsa AS DATE) <= ?"]
        params: List[Any] = [str(today), str(end_date)]
        if empresa_id is not None:
            conds.append("v.empresa_id = ?")
            params.append(empresa_id)
        where = " AND ".join(conds)
        try:
            rows = self.conn.execute(
                f"""
                SELECT CAST(v.data_previsa AS DATE) AS d, SUM(v.valor) AS total
                FROM v_cash_flow_forecast v
                WHERE {where}
                GROUP BY CAST(v.data_previsa AS DATE)
                ORDER BY d
                """,
                params,
            ).fetchall()
        except Exception as e:
            logger.warning("v_cash_flow_forecast não disponível: %s", e)
            return []
        by_date: Dict[str, float] = {}
        for d, total in rows:
            if d is None:
                continue
            key = str(d)[:10] if hasattr(d, "isoformat") else str(d)
            by_date[key] = float(total or 0)
        out = []
        saldo = initial_balance
        for i in range(days + 1):
            d = today + timedelta(days=i)
            key = d.isoformat()
            valor_dia = by_date.get(key, 0.0)
            saldo += valor_dia
            out.append({
                "data": key,
                "valor_dia": round(valor_dia, 2),
                "saldo_acumulado": round(saldo, 2),
            })
        return out

    # ─── Alerta de Margem ─────────────────────────────────────────────────────

    def check_and_flag_margin_alerts(
        self,
        supplier_id: int,
        new_prices: List[Dict],
        min_margin_pct: float = 5.0,
    ) -> int:
        """
        Após sync de preços, verifica se algum pending_purchase_item fica abaixo
        da margem mínima com o novo custo. Marca margin_alert = TRUE.
        Devolve número de itens alertados.
        """
        alerted = 0
        try:
            for item in new_prices:
                sku = item.get("sku") or item.get("sku_fornecedor")
                new_cost = float(item.get("price") or item.get("custo_fornecedor") or 0)
                if not sku or new_cost <= 0:
                    continue
                rows = self.conn.execute(
                    """
                    SELECT id, unit_price_sale
                    FROM pending_purchase_items
                    WHERE supplier_id = ?
                      AND (sku_supplier = ? OR sku_marketplace = ?)
                      AND status = 'pending'
                    """,
                    [supplier_id, sku, sku],
                ).fetchall()
                for ppi_id, sale_price in rows:
                    sale = float(sale_price or 0)
                    if sale > 0:
                        margem = (sale - new_cost) / sale * 100
                        if margem < min_margin_pct:
                            msg = (
                                f"Preço subiu para {new_cost:.2f}€; "
                                f"margem {margem:.1f}% < {min_margin_pct:.0f}%"
                            )
                            self.conn.execute(
                                "UPDATE pending_purchase_items SET margin_alert = TRUE, margin_alert_msg = ? WHERE id = ?",
                                [msg, ppi_id],
                            )
                            alerted += 1
            if alerted:
                self.conn.commit()
        except Exception as e:
            logger.warning("check_and_flag_margin_alerts: %s", e)
        return alerted

    # ─── Pagamentos: Antecipado, Sugestão, Confirmar no banco ─────────────────

    def get_payments_antecipado(
        self, empresa_id: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """Lista POs com prazo Antecipado ainda não pagas (para bulk pagamento diário)."""
        conds = [
            "po.status NOT IN ('Paid', 'Cancelled')",
            "COALESCE(po.total_final, 0) > 0",
            "(TRIM(COALESCE(s.prazo_pagamento, '')) = 'Antecipado' OR LOWER(TRIM(COALESCE(s.prazo_pagamento, ''))) LIKE '%antecipado%')",
        ]
        params: List[Any] = []
        if empresa_id is not None:
            conds.append("po.empresa_id = ?")
            params.append(empresa_id)
        where = " AND ".join(conds)
        rows = self.conn.execute(
            f"""
            SELECT
                po.id AS purchase_order_id,
                po.empresa_id,
                e.nome AS empresa_nome,
                po.supplier_id,
                s.nome AS supplier_nome,
                COALESCE(po.total_final, 0) AS total_final,
                po.data_ordered,
                po.due_date,
                po.invoice_ref,
                po.status,
                s.prazo_pagamento,
                s.metodo_pagamento
            FROM purchase_orders po
            LEFT JOIN suppliers s ON s.id = po.supplier_id
            LEFT JOIN empresas e ON e.id = po.empresa_id
            WHERE {where}
            ORDER BY po.due_date ASC NULLS LAST, po.id ASC
            """,
            params,
        ).fetchall()
        cols = [
            "purchase_order_id", "empresa_id", "empresa_nome", "supplier_id", "supplier_nome",
            "total_final", "data_ordered", "due_date", "invoice_ref", "status", "prazo_pagamento", "metodo_pagamento",
        ]
        return [
            {
                **dict(zip(cols, row)),
                "total_final": float(row[5] or 0),
                "data_ordered": str(row[6])[:10] if row[6] else None,
                "due_date": str(row[7])[:10] if row[7] else None,
            }
            for row in rows
        ]

    def get_payments_sugestao(
        self,
        empresa_id: Optional[int] = None,
        data_inicio: str = "",
        data_fim: str = "",
    ) -> Tuple[List[Dict[str, Any]], float]:
        """Lista POs com vencimento no intervalo [data_inicio, data_fim] ainda não pagas. Devolve (items, total_valor)."""
        conds = [
            "po.status NOT IN ('Paid', 'Cancelled')",
            "COALESCE(po.total_final, 0) > 0",
        ]
        params: List[Any] = []
        if empresa_id is not None:
            conds.append("po.empresa_id = ?")
            params.append(empresa_id)
        venc_expr = "COALESCE(TRY_CAST(po.due_date AS DATE), TRY_CAST(DATE_ADD(CAST(po.data_ordered AS DATE), INTERVAL 30 DAY) AS DATE))"
        if data_inicio:
            conds.append(f"({venc_expr} >= CAST(? AS DATE))")
            params.append(data_inicio)
        if data_fim:
            conds.append(f"({venc_expr} <= CAST(? AS DATE))")
            params.append(data_fim)
        where = " AND ".join(conds)
        rows = self.conn.execute(
            f"""
            SELECT
                po.id AS purchase_order_id,
                po.empresa_id,
                e.nome AS empresa_nome,
                po.supplier_id,
                s.nome AS supplier_nome,
                COALESCE(po.total_final, 0) AS total_final,
                po.data_ordered,
                {venc_expr} AS due_date,
                po.invoice_ref,
                po.status,
                s.prazo_pagamento,
                s.metodo_pagamento
            FROM purchase_orders po
            LEFT JOIN suppliers s ON s.id = po.supplier_id
            LEFT JOIN empresas e ON e.id = po.empresa_id
            WHERE {where}
            ORDER BY due_date ASC, po.id ASC
            """,
            params,
        ).fetchall()
        cols = [
            "purchase_order_id", "empresa_id", "empresa_nome", "supplier_id", "supplier_nome",
            "total_final", "data_ordered", "due_date", "invoice_ref", "status", "prazo_pagamento", "metodo_pagamento",
        ]
        items = []
        total_valor = 0.0
        for row in rows:
            total_final = float(row[5] or 0)
            total_valor += total_final
            due = row[7]
            items.append({
                **dict(zip(cols, row)),
                "total_final": total_final,
                "data_ordered": str(row[6])[:10] if row[6] else None,
                "due_date": str(due)[:10] if due else None,
            })
        return items, round(total_valor, 2)

    def confirmar_pagamentos(
        self,
        empresa_id: int,
        items: List[Dict[str, Any]],
        data_pagamento: Optional[date] = None,
        criar_movimento_banco: bool = True,
    ) -> Dict[str, Any]:
        """
        Para cada PO em items: cria lançamento Pagamento na conta corrente,
        atualiza PO (status=Paid, data_paid), opcionalmente cria bank_movement e reconciliação.
        items: [ {"purchase_order_id": int, "valor": float opcional} ]
        """
        data_mov = data_pagamento or date.today()
        data_mov_str = str(data_mov)
        created_ledger_ids = []
        updated_po_ids = []
        reconciliation_ids = []
        bank_movement_id_created = None
        total_debito = 0.0

        for it in items:
            po_id = it.get("purchase_order_id") or it.get("po_id")
            if not po_id:
                continue
            row = self.conn.execute(
                """
                SELECT po.id, po.empresa_id, po.supplier_id, COALESCE(po.total_final, 0), po.invoice_ref
                FROM purchase_orders po
                WHERE po.id = ? AND po.empresa_id = ?
                """,
                [po_id, empresa_id],
            ).fetchone()
            if not row:
                continue
            _, eid, sid, valor, invoice_ref = row
            valor = float(it.get("valor") or valor or 0)
            if valor <= 0:
                continue
            # 1. Lançamento na conta corrente (Pagamento = débito)
            res = self.create_ledger_entry(
                empresa_id=eid,
                supplier_id=sid,
                tipo="Pagamento",
                valor_credito=0.0,
                valor_debito=valor,
                documento_ref=invoice_ref or f"PO#{po_id}",
                purchase_order_id=po_id,
                notas=f"Pagamento confirmado no banco (PO #{po_id})",
                data_movimento=data_mov,
            )
            created_ledger_ids.append(res["id"])
            # 2. PO status Paid e data_paid
            self.conn.execute(
                "UPDATE purchase_orders SET status = 'Paid', data_paid = ? WHERE id = ?",
                [data_mov_str, po_id],
            )
            updated_po_ids.append(po_id)
            total_debito += valor
            # 3. Reconciliation: upsert com bank_movement (será preenchido abaixo se criar_movimento_banco)
            existing_fr = self.conn.execute(
                "SELECT id FROM financial_reconciliation WHERE purchase_order_id = ?", [po_id]
            ).fetchone()
            if existing_fr:
                self.conn.execute(
                    """
                    UPDATE financial_reconciliation SET
                        status = 'Matched', matched_at = CURRENT_TIMESTAMP,
                        bank_movement_id = COALESCE(bank_movement_id, ?),
                        bank_amount = COALESCE(bank_amount, ?)
                    WHERE purchase_order_id = ?
                    """,
                    [bank_movement_id_created, -valor, po_id],
                )
                reconciliation_ids.append(existing_fr[0])
            else:
                fr_id = _next_id(self.conn, "financial_reconciliation")
                self.conn.execute(
                    """
                    INSERT INTO financial_reconciliation
                        (id, empresa_id, purchase_order_id, invoice_ref, invoice_amount, po_amount,
                         bank_movement_id, bank_amount, status, matched_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Matched', CURRENT_TIMESTAMP)
                    """,
                    [fr_id, eid, po_id, invoice_ref, valor, valor, bank_movement_id_created, -valor],
                )
                reconciliation_ids.append(fr_id)

        # 4. Um único movimento de banco para o lote (saída = negativo)
        if criar_movimento_banco and total_debito > 0:
            bm_id = _next_id(self.conn, "bank_movements")
            self.conn.execute(
                """
                INSERT INTO bank_movements (id, data_ctb, data_movimento, ciclo, montante, empresa_id)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                [bm_id, data_mov_str, data_mov_str, f"Pagamentos {data_mov_str}", -total_debito, empresa_id],
            )
            bank_movement_id_created = bm_id
            # Atualizar financial_reconciliation com o bank_movement_id para as POs deste lote
            for pid in updated_po_ids:
                self.conn.execute(
                    "UPDATE financial_reconciliation SET bank_movement_id = ?, bank_amount = -po_amount WHERE purchase_order_id = ?",
                    [bm_id, pid],
                )

        self.conn.commit()
        return {
            "created_ledger_ids": created_ledger_ids,
            "updated_po_ids": updated_po_ids,
            "reconciliation_ids": reconciliation_ids,
            "bank_movement_id": bank_movement_id_created,
            "total_pago": round(total_debito, 2),
        }

    def get_payments_historico(
        self,
        empresa_id: Optional[int] = None,
        data_inicio: str = "",
        data_fim: str = "",
        metodo: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Lista pagamentos já confirmados (supplier_ledger tipo=Pagamento) por intervalo de data
        e opcionalmente por método (Cartao, Transferencia, DebitoDireto do fornecedor).
        """
        conds = ["sl.tipo = 'Pagamento'", "sl.valor_debito > 0"]
        params: List[Any] = []
        if empresa_id is not None:
            conds.append("sl.empresa_id = ?")
            params.append(empresa_id)
        if data_inicio:
            conds.append("CAST(sl.data_movimento AS DATE) >= CAST(? AS DATE)")
            params.append(data_inicio)
        if data_fim:
            conds.append("CAST(sl.data_movimento AS DATE) <= CAST(? AS DATE)")
            params.append(data_fim)
        if metodo:
            conds.append("TRIM(COALESCE(s.metodo_pagamento, '')) = ?")
            params.append(metodo.strip())
        where = " AND ".join(conds)
        rows = self.conn.execute(
            f"""
            SELECT
                sl.id AS ledger_id,
                sl.data_movimento,
                sl.empresa_id,
                e.nome AS empresa_nome,
                sl.supplier_id,
                s.nome AS supplier_nome,
                s.metodo_pagamento,
                sl.purchase_order_id,
                sl.documento_ref,
                sl.valor_debito AS valor,
                sl.notas
            FROM supplier_ledger sl
            LEFT JOIN suppliers s ON s.id = sl.supplier_id
            LEFT JOIN empresas e ON e.id = sl.empresa_id
            WHERE {where}
            ORDER BY sl.data_movimento DESC, sl.id DESC
            """,
            params,
        ).fetchall()
        cols = [
            "ledger_id", "data_movimento", "empresa_id", "empresa_nome", "supplier_id", "supplier_nome",
            "metodo_pagamento", "purchase_order_id", "documento_ref", "valor", "notas",
        ]
        return [
            {
                **dict(zip(cols, row)),
                "data_movimento": str(row[1])[:10] if row[1] else None,
                "valor": float(row[9] or 0),
            }
            for row in rows
        ]
