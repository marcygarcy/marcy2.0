/**
 * API client — Módulo de Faturação AT-compliant (Portugal)
 */
import apiClient from './client';

// ── Tipos ─────────────────────────────────────────────────────────────────

export type TipoDocAT = 'FT' | 'FS' | 'NC' | 'ND' | 'RC';
export type StatusDocAT = 'emitido' | 'anulado';

export interface VATBreakdown {
  taxa: number;
  base: number;
  valor: number;
}

export interface LinhaDocumento {
  descricao: string;
  quantidade: number;
  preco_unitario: number;
  taxa_iva: number;
}

export interface ATDocument {
  id: number;
  empresa_id: number;
  tipo_doc: TipoDocAT;
  serie_id: number;
  numero_sequencial: number;
  numero_documento: string;
  status: StatusDocAT;
  data_emissao: string;
  customer_name: string | null;
  customer_nif: string | null;
  customer_country: string;
  customer_address: string | null;
  linhas: LinhaDocumento[];
  vat_breakdown: VATBreakdown[];
  total_bruto: number;
  total_iva: number;
  total_liquido: number;
  hash_documento: string | null;
  hash_anterior: string | null;
  hash_4chars: string | null;
  atcud: string | null;
  qrcode_data: string | null;
  qrcode_b64: string | null;  // base64 PNG para preview
  pdf_path: string | null;
  num_certificacao: string;
  payment_terms: string | null;
  reference_doc: string | null;
  notes: string | null;
  motivo_anulacao: string | null;
  anulado_em: string | null;
  created_at: string;
}

export interface ATDocumentListItem {
  id: number;
  empresa_id: number;
  tipo_doc: TipoDocAT;
  numero_documento: string;
  status: StatusDocAT;
  data_emissao: string;
  customer_name: string | null;
  customer_nif: string | null;
  total_bruto: number;
  total_iva: number;
  total_liquido: number;
  atcud: string | null;
  hash_4chars: string | null;
  pdf_path: string | null;
  created_at: string;
}

export interface ATDocumentList {
  total: number;
  limit: number;
  offset: number;
  items: ATDocumentListItem[];
}

export interface ATSeries {
  id: number;
  empresa_id: number;
  doc_type: string;
  tipo_doc: string;
  prefix: string;
  year: number;
  last_sequence: number;
  codigo_validacao_at: string;
  ativo: boolean;
  total_docs: number;
  proximo_numero: number;
}

export interface RSAKeyInfo {
  empresa_id: number;
  public_key_pem: string;
  gerado_em?: string;
}

export interface RSAStatus {
  empresa_id: number;
  has_keypair: boolean;
}

export interface SAFTHistoryEntry {
  id: number;
  empresa_id: number;
  periodo_inicio: string;
  periodo_fim: string;
  num_documentos: number;
  xml_hash: string | null;
  exported_at: string;
}

// ── Cliente ─────────────────────────────────────────────────────────────────

export interface EmitirDocumentoPayload {
  empresa_id: number;
  tipo_doc: TipoDocAT;
  cliente: {
    nome?: string;
    nif?: string;
    pais?: string;
    morada?: string;
  };
  linhas: LinhaDocumento[];
  referencia_doc?: string;
  metodo_pagamento?: string;
  notas?: string;
}

export async function listDocuments(params: {
  empresa_id: number;
  tipo_doc?: string;
  data_inicio?: string;
  data_fim?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<ATDocumentList> {
  const q = new URLSearchParams({ empresa_id: String(params.empresa_id) });
  if (params.tipo_doc) q.set('tipo_doc', params.tipo_doc);
  if (params.data_inicio) q.set('data_inicio', params.data_inicio);
  if (params.data_fim) q.set('data_fim', params.data_fim);
  if (params.status) q.set('status', params.status);
  if (params.limit != null) q.set('limit', String(params.limit));
  if (params.offset != null) q.set('offset', String(params.offset));
  const { data } = await apiClient.get<ATDocumentList>(`/api/v1/at-invoices/?${q}`);
  return data;
}

export async function emitDocument(payload: EmitirDocumentoPayload): Promise<ATDocument> {
  const { data } = await apiClient.post<ATDocument>('/api/v1/at-invoices/emit', payload);
  return data;
}

export async function getDocument(docId: number): Promise<ATDocument> {
  const { data } = await apiClient.get<ATDocument>(`/api/v1/at-invoices/${docId}`);
  return data;
}

export function getPdfUrl(docId: number): string {
  const base = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/+$/, '');
  return `${base}/api/v1/at-invoices/${docId}/pdf`;
}

export async function cancelDocument(docId: number, motivo: string): Promise<ATDocument> {
  const { data } = await apiClient.post<ATDocument>(`/api/v1/at-invoices/${docId}/cancel`, { motivo });
  return data;
}

// ── Séries ─────────────────────────────────────────────────────────────────

export async function listSeries(empresa_id: number): Promise<ATSeries[]> {
  const { data } = await apiClient.get<ATSeries[]>(`/api/v1/at-invoices/series/list?empresa_id=${empresa_id}`);
  return data;
}

export async function ensureSeries(empresa_id: number, tipo_doc: string, ano?: number): Promise<ATSeries> {
  const { data } = await apiClient.post<ATSeries>('/api/v1/at-invoices/series/ensure', { empresa_id, tipo_doc, ano });
  return data;
}

export async function updateAtcudCode(serie_id: number, codigo_validacao: string): Promise<ATSeries> {
  const { data } = await apiClient.patch<ATSeries>(`/api/v1/at-invoices/series/${serie_id}/atcud`, { codigo_validacao });
  return data;
}

// ── RSA ─────────────────────────────────────────────────────────────────────

export async function generateRsaKeys(empresa_id: number): Promise<RSAKeyInfo> {
  const { data } = await apiClient.post<RSAKeyInfo>('/api/v1/at-invoices/rsa/generate', { empresa_id });
  return data;
}

export async function getRsaPublicKey(empresa_id: number): Promise<RSAKeyInfo> {
  const { data } = await apiClient.get<RSAKeyInfo>(`/api/v1/at-invoices/rsa/${empresa_id}/public`);
  return data;
}

export async function getRsaStatus(empresa_id: number): Promise<RSAStatus> {
  const { data } = await apiClient.get<RSAStatus>(`/api/v1/at-invoices/rsa/${empresa_id}/status`);
  return data;
}

// ── SAF-T ──────────────────────────────────────────────────────────────────

export async function exportSAFT(empresa_id: number, data_inicio: string, data_fim: string): Promise<Blob> {
  const base = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/+$/, '');
  const res = await fetch(`${base}/api/v1/at-invoices/saft/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ empresa_id, data_inicio, data_fim }),
  });
  if (!res.ok) throw new Error(`SAF-T export falhou: ${res.statusText}`);
  return res.blob();
}

export async function getSAFTHistory(empresa_id: number): Promise<SAFTHistoryEntry[]> {
  const { data } = await apiClient.get<SAFTHistoryEntry[]>(`/api/v1/at-invoices/saft/history?empresa_id=${empresa_id}`);
  return data;
}
