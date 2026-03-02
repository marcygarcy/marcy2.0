"""
Dados Mestres ERP: Fichas de Fornecedor e Marketplace.
Lógica de automação: prepare_draft_purchase (custo previsto, tipo envio, morada escritório).
Importação em lote: template Excel + validação + bulk insert.
"""
from __future__ import annotations

import io
from typing import Optional, List, Dict, Any, Tuple

import pandas as pd
from app.config.database import get_db_connection


# Regimes IVA: Nacional = compra com IVA; Intracomunitário = autoliquidação; Extra-comunitário = sem IVA
REGIME_NACIONAL = "Nacional"
REGIME_INTRACOMUNITARIO = "Intracomunitario"
REGIME_EXTRA = "Extracomunitario"

# Tipo envio na ficha fornecedor
SHIPPING_DROPSHIPPING = "Dropshipping"
SHIPPING_ESCRITORIO = "Escritorio"


class MasterDataService:
    """Consulta e lógica baseada nas fichas de Fornecedor e Marketplace."""

    def __init__(self):
        self.conn = get_db_connection()

    def get_supplier_master(self, supplier_id: int) -> Optional[Dict[str, Any]]:
        """Devolve a ficha completa do fornecedor (Master Data)."""
        try:
            row = self.conn.execute(
                """
                SELECT id, empresa_id, nome, codigo, entidade_id, entidade, designacao_social, nif_cif, website_url,
                       morada, codigo_postal, localidade, pais, pais_iva, regime_iva, taxa_iva_padrao,
                       tel, email, email_comercial, metodo_pagamento, iban, cartao_id, prazo_pagamento,
                       default_shipping_type, tipo_envio, office_id, lead_time_estimado, custo_envio_base, supplier_score, ativo, payment_method_id
                FROM suppliers WHERE id = ?
                """,
                [supplier_id],
            ).fetchone()
            cols = [
                "id", "empresa_id", "nome", "codigo", "entidade_id", "entidade", "designacao_social", "nif_cif", "website_url",
                "morada", "codigo_postal", "localidade", "pais", "pais_iva", "regime_iva", "taxa_iva_padrao",
                "tel", "email", "email_comercial", "metodo_pagamento", "iban", "cartao_id", "prazo_pagamento",
                "default_shipping_type", "tipo_envio", "office_id", "lead_time_estimado", "custo_envio_base", "supplier_score", "ativo", "payment_method_id",
            ]
        except Exception:
            row = self.conn.execute(
                """
                SELECT id, empresa_id, nome, codigo, entidade_id, entidade, designacao_social, nif_cif, website_url,
                       morada, codigo_postal, localidade, pais, pais_iva, regime_iva, taxa_iva_padrao,
                       tel, email, email_comercial, metodo_pagamento, iban, cartao_id, prazo_pagamento,
                       default_shipping_type, tipo_envio, office_id, lead_time_estimado, custo_envio_base, supplier_score, ativo
                FROM suppliers WHERE id = ?
                """,
                [supplier_id],
            ).fetchone()
            cols = [
                "id", "empresa_id", "nome", "codigo", "entidade_id", "entidade", "designacao_social", "nif_cif", "website_url",
                "morada", "codigo_postal", "localidade", "pais", "pais_iva", "regime_iva", "taxa_iva_padrao",
                "tel", "email", "email_comercial", "metodo_pagamento", "iban", "cartao_id", "prazo_pagamento",
                "default_shipping_type", "tipo_envio", "office_id", "lead_time_estimado", "custo_envio_base", "supplier_score", "ativo",
            ]
        if not row:
            return None
        out = dict(zip(cols, row))
        out.setdefault("payment_method_id")
        return out

    def get_office_for_empresa(self, empresa_id: int, pais: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        Devolve o escritório de entrega para a empresa.
        Primeiro tenta por empresa_id; depois por pais (ex: PT -> Lisboa).
        """
        # Preferência: escritório associado à empresa
        row = self.conn.execute(
            """
            SELECT id, empresa_id, designacao, morada, codigo_postal, localidade, pais, ativo
            FROM office_locations
            WHERE (empresa_id = ? OR empresa_id IS NULL) AND COALESCE(ativo, TRUE) = TRUE
            ORDER BY empresa_id DESC NULLS LAST
            LIMIT 1
            """,
            [empresa_id],
        ).fetchone()
        if row:
            cols = ["id", "empresa_id", "designacao", "morada", "codigo_postal", "localidade", "pais", "ativo"]
            return dict(zip(cols, row))
        # Fallback: por país da empresa
        if pais:
            row = self.conn.execute(
                """
                SELECT id, empresa_id, designacao, morada, codigo_postal, localidade, pais, ativo
                FROM office_locations
                WHERE pais = ? AND COALESCE(ativo, TRUE) = TRUE
                LIMIT 1
                """,
                [str(pais).strip().upper()[:2]],
            ).fetchone()
            if row:
                cols = ["id", "empresa_id", "designacao", "morada", "codigo_postal", "localidade", "pais", "ativo"]
                return dict(zip(cols, row))
        return None

    def get_empresa_pais(self, empresa_id: int) -> Optional[str]:
        """País da empresa (para seleção de escritório)."""
        row = self.conn.execute("SELECT pais FROM empresas WHERE id = ?", [empresa_id]).fetchone()
        return (row[0].strip().upper()[:2] if row and row[0] else None)

    def _iva_rate_for_regime(self, regime: Optional[str], taxa_iva_padrao: float) -> float:
        """Taxa de IVA a aplicar na compra conforme regime do fornecedor."""
        if not regime or regime == REGIME_EXTRA or regime == REGIME_INTRACOMUNITARIO:
            return 0.0
        if regime == REGIME_NACIONAL:
            return float(taxa_iva_padrao or 0)
        return 0.0

    def prepare_draft_purchase(
        self,
        order_id: int,
    ) -> Dict[str, Any]:
        """
        Dada uma venda (order_id), prepara o rascunho de compra com base nas fichas mestras:
        - Identifica o fornecedor via SKU (sku_mapping).
        - Consulta a ficha do fornecedor: default_shipping_type (Dropshipping / Escritório).
        - Se Escritório: seleciona o endereço do escritório no país da empresa que vendeu.
        - Calcula custo total previsto: Preço Custo + Portes do Fornecedor + IVA conforme Regime Fiscal.
        """
        order_row = self.conn.execute(
            "SELECT id, empresa_id, marketplace_id, sku_oferta, quantidade FROM orders WHERE id = ?",
            [order_id],
        ).fetchone()
        if not order_row:
            return {"success": False, "error": "Ordem não encontrada", "order_id": order_id}
        oid, empresa_id, marketplace_id, sku, qty = order_row[0], order_row[1], order_row[2], order_row[3], order_row[4]
        qty = float(qty or 1)

        # Fornecedor via SKU
        map_row = self.conn.execute(
            """
            SELECT m.supplier_id, m.custo_fornecedor, m.sku_fornecedor, m.nome_produto
            FROM sku_mapping m
            WHERE m.empresa_id = ? AND m.sku_marketplace = ? AND COALESCE(m.ativo, TRUE) = TRUE
            AND (m.marketplace_id IS NULL OR m.marketplace_id = ?)
            ORDER BY m.marketplace_id DESC NULLS LAST
            LIMIT 1
            """,
            [empresa_id, sku or "", marketplace_id or 0],
        ).fetchone()
        if not map_row:
            return {"success": False, "error": "SKU sem fornecedor mapeado", "order_id": order_id}
        supplier_id, custo_unit, sku_fornecedor, nome_produto = map_row[0], float(map_row[1] or 0), map_row[2], map_row[3]

        supplier = self.get_supplier_master(supplier_id)
        if not supplier:
            return {"success": False, "error": "Fornecedor não encontrado", "order_id": order_id}

        default_shipping = (supplier.get("tipo_envio") or supplier.get("default_shipping_type") or "").strip() or SHIPPING_DROPSHIPPING
        custo_envio_base = float(supplier.get("custo_envio_base") or 0)
        regime_iva = (supplier.get("regime_iva") or "").strip()
        taxa_iva = float(supplier.get("taxa_iva_padrao") or 0)
        iva_pct = self._iva_rate_for_regime(regime_iva, taxa_iva)

        # Custo base da linha
        total_base = custo_unit * qty
        portes_linha = custo_envio_base  # simplificado: um envio por linha; em bulk pode ratear
        base_com_portes = total_base + portes_linha
        impostos = base_com_portes * (iva_pct / 100) if iva_pct else 0
        custo_total_previsto = base_com_portes + impostos

        # Morada de entrega: se Escritório, obter escritório do país da empresa
        delivery_address = None
        office = None
        if default_shipping == SHIPPING_ESCRITORIO:
            office_id = supplier.get("office_id")
            if office_id:
                row_off = self.conn.execute(
                    "SELECT id, designacao, morada, codigo_postal, localidade, pais FROM office_locations WHERE id = ?",
                    [office_id],
                ).fetchone()
                if row_off:
                    office = dict(zip(["id", "designacao", "morada", "codigo_postal", "localidade", "pais"], row_off))
                else:
                    office = None
            else:
                office = None
            if not office:
                pais = self.get_empresa_pais(empresa_id)
                office = self.get_office_for_empresa(empresa_id, pais)
            if office:
                delivery_address = {
                    "designacao": office.get("designacao"),
                    "morada": office.get("morada"),
                    "codigo_postal": office.get("codigo_postal"),
                    "localidade": office.get("localidade"),
                    "pais": office.get("pais"),
                }

        return {
            "success": True,
            "order_id": order_id,
            "empresa_id": empresa_id,
            "supplier_id": supplier_id,
            "supplier_nome": supplier.get("nome") or supplier.get("designacao_social"),
            "sku_fornecedor": sku_fornecedor,
            "nome_produto": nome_produto,
            "quantidade": qty,
            "custo_unitario": custo_unit,
            "total_base": total_base,
            "portes_linha": portes_linha,
            "regime_iva": regime_iva,
            "iva_pct": iva_pct,
            "impostos": impostos,
            "custo_total_previsto": custo_total_previsto,
            "default_shipping_type": default_shipping,
            "delivery_address": delivery_address,
            "website_url": supplier.get("website_url"),
        }

    def list_suppliers(self, empresa_id: Optional[int] = None, limit: int = 200) -> List[Dict[str, Any]]:
        """Lista fornecedores (ficha resumida). Ordenação por entidade para pesquisa rápida."""
        q = """
            SELECT id, empresa_id, entidade, nome, codigo, designacao_social, nif_cif, tipo_envio, office_id,
                   default_shipping_type, lead_time_estimado, custo_envio_base, supplier_score, ativo
            FROM suppliers WHERE 1=1
        """
        params = []
        if empresa_id is not None:
            q += " AND empresa_id = ?"
            params.append(empresa_id)
        q += " ORDER BY COALESCE(entidade, id), nome LIMIT ?"
        params.append(limit)
        rows = self.conn.execute(q, params).fetchall()
        cols = ["id", "empresa_id", "entidade", "nome", "codigo", "designacao_social", "nif_cif", "tipo_envio", "office_id",
                "default_shipping_type", "lead_time_estimado", "custo_envio_base", "supplier_score", "ativo"]
        return [dict(zip(cols, row)) for row in rows]

    def list_office_locations(self, empresa_id: Optional[int] = None) -> List[Dict[str, Any]]:
        """Lista escritórios."""
        q = "SELECT id, empresa_id, designacao, morada, codigo_postal, localidade, pais, ativo FROM office_locations WHERE 1=1"
        params = []
        if empresa_id is not None:
            q += " AND (empresa_id = ? OR empresa_id IS NULL)"
            params.append(empresa_id)
        q += " ORDER BY pais, designacao"
        rows = self.conn.execute(q, params).fetchall()
        cols = ["id", "empresa_id", "designacao", "morada", "codigo_postal", "localidade", "pais", "ativo"]
        result = [dict(zip(cols, row)) for row in rows]
        try:
            q2 = "SELECT id, contacto_nome, contacto_tel FROM office_locations WHERE 1=1" + (" AND (empresa_id = ? OR empresa_id IS NULL)" if empresa_id is not None else "") + " ORDER BY pais, designacao"
            ext = self.conn.execute(q2, params).fetchall()
            for i, r in enumerate(ext):
                if i < len(result):
                    result[i]["contacto_nome"] = r[1]
                    result[i]["contacto_tel"] = r[2]
        except Exception:
            for r in result:
                r.setdefault("contacto_nome")
                r.setdefault("contacto_tel")
        return result

    # --- Importação em lote (template + upload) ---
    SUPPLIER_TEMPLATE_COLUMNS = [
        "Entidade", "Empresa_ID", "Designacao_Social", "NIF_CIF", "Morada", "Codigo_Postal", "Localidade", "Pais",
        "Metodo_Pagamento", "IBAN", "Cartao_Vinculado", "Tipo_Envio", "Office_ID", "Contacto_Tel", "Contacto_Email",
    ]

    def generate_suppliers_template(self) -> bytes:
        """Gera um ficheiro Excel vazio com os cabeçalhos exatos para importação de fornecedores."""
        df = pd.DataFrame(columns=self.SUPPLIER_TEMPLATE_COLUMNS)
        buf = io.BytesIO()
        df.to_excel(buf, index=False, sheet_name="Fornecedores", engine="openpyxl")
        buf.seek(0)
        return buf.getvalue()

    def import_suppliers_excel(self, file_content: bytes) -> Dict[str, Any]:
        """
        Lê o Excel, valida entidade único, empresa_id existente, e faz bulk insert.
        Retorna: inserted, errors (lista de mensagens por linha), duplicated_entidades.
        """
        try:
            df = pd.read_excel(io.BytesIO(file_content), sheet_name=0, engine="openpyxl")
        except Exception as e:
            return {"success": False, "error": f"Ficheiro Excel inválido: {e}", "inserted": 0, "errors": []}
        # Normalizar nomes de colunas (strip, maiúsculas para comparação)
        col_map = {str(c).strip(): c for c in df.columns}
        required = ["Entidade", "Empresa_ID", "Designacao_Social"]
        for r in required:
            if r not in col_map:
                return {"success": False, "error": f"Coluna obrigatória em falta: {r}", "inserted": 0, "errors": []}
        errors = []
        inserted = 0
        # Empresas válidas
        empresas_rows = self.conn.execute("SELECT id FROM empresas").fetchall()
        valid_empresa_ids = {int(r[0]) for r in empresas_rows}
        # Entidades já existentes
        existing = set()
        for r in self.conn.execute("SELECT entidade FROM suppliers WHERE entidade IS NOT NULL").fetchall():
            if r[0] is not None:
                existing.add(int(r[0]))
        # Entidades no ficheiro (evitar duplicados no mesmo ficheiro)
        seen_entidades = set()
        next_id = int(self.conn.execute("SELECT COALESCE(MAX(id), 0) + 1 FROM suppliers").fetchone()[0])
        rows_to_insert = []
        for idx, row in df.iterrows():
            line = idx + 2  # 1-based + header
            ent = row.get("Entidade")
            if pd.isna(ent):
                errors.append(f"Linha {line}: Entidade obrigatória em falta")
                continue
            try:
                ent = int(float(ent))
            except (TypeError, ValueError):
                errors.append(f"Linha {line}: Entidade deve ser numérica")
                continue
            if ent in seen_entidades:
                errors.append(f"Linha {line}: Entidade {ent} duplicada no ficheiro")
                continue
            seen_entidades.add(ent)
            if ent in existing:
                errors.append(f"Linha {line}: Entidade {ent} já existe no sistema")
                continue
            emp_id = row.get("Empresa_ID")
            if pd.isna(emp_id):
                errors.append(f"Linha {line}: Empresa_ID obrigatório")
                continue
            try:
                emp_id = int(float(emp_id))
            except (TypeError, ValueError):
                errors.append(f"Linha {line}: Empresa_ID inválido")
                continue
            if emp_id not in valid_empresa_ids:
                errors.append(f"Linha {line}: Empresa_ID {emp_id} não existe")
                continue
            designacao = row.get("Designacao_Social")
            if pd.isna(designacao) or not str(designacao).strip():
                errors.append(f"Linha {line}: Designacao_Social obrigatória")
                continue
            nome = str(designacao).strip()[:500]
            def _val(x):
                if pd.isna(x) or x == "" or (isinstance(x, float) and x != x):
                    return None
                return str(x).strip()[:500] if not isinstance(x, (int, float)) else (int(x) if isinstance(x, float) and x == int(x) else x)
            def _num(x):
                if pd.isna(x) or x == "":
                    return None
                try:
                    return int(float(x))
                except (TypeError, ValueError):
                    return None
            rows_to_insert.append({
                "id": next_id + len(rows_to_insert),
                "entidade": ent,
                "empresa_id": emp_id,
                "nome": nome,
                "designacao_social": nome,
                "nif_cif": _val(row.get("NIF_CIF")),
                "morada": _val(row.get("Morada")),
                "codigo_postal": _val(row.get("Codigo_Postal")),
                "localidade": _val(row.get("Localidade")),
                "pais": _val(row.get("Pais")),
                "metodo_pagamento": _val(row.get("Metodo_Pagamento")),
                "iban": _val(row.get("IBAN")),
                "cartao_id": _num(row.get("Cartao_Vinculado")),
                "tipo_envio": _val(row.get("Tipo_Envio")) or "Dropshipping",
                "office_id": _num(row.get("Office_ID")),
                "tel": _val(row.get("Contacto_Tel")),
                "email": _val(row.get("Contacto_Email")),
                "ativo": True,
            })
        for r in rows_to_insert:
            try:
                self.conn.execute(
                    """
                    INSERT INTO suppliers (
                        id, entidade, empresa_id, nome, designacao_social, nif_cif, morada, codigo_postal, localidade, pais,
                        metodo_pagamento, iban, cartao_id, tipo_envio, default_shipping_type, office_id, tel, email, ativo
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    [
                        r["id"], r["entidade"], r["empresa_id"], r["nome"], r["designacao_social"], r["nif_cif"],
                        r["morada"], r["codigo_postal"], r["localidade"], r["pais"], r["metodo_pagamento"], r["iban"],
                        r["cartao_id"], r["tipo_envio"], r["tipo_envio"], r["office_id"], r["tel"], r["email"], r["ativo"],
                    ],
                )
                inserted += 1
                existing.add(r["entidade"])
            except Exception as e:
                errors.append(f"Entidade {r['entidade']}: {e}")
        self.conn.commit()
        return {"success": True, "inserted": inserted, "errors": errors}
    def close(self):
        try:
            self.conn.close()
        except Exception:
            pass
