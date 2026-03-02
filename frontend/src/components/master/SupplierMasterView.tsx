'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { User, CreditCard, Truck, Loader2, Plus, Pencil, Download, Upload, Key } from 'lucide-react';
import { suppliersApi, type SupplierMaster, type OfficeLocation } from '@/lib/api/suppliers';
import { empresasApi, type Empresa } from '@/lib/api/empresas';
import { paymentMethodsApi, type PaymentMethod } from '@/lib/api/paymentMethods';
import { SupplierAccessTab } from './SupplierAccessTab';
import { AutomationStatusCard } from './AutomationStatusCard';

const REGIME_IVA_OPTS = ['Nacional', 'Intracomunitario', 'Extracomunitario'];
const METODO_PAGAMENTO_OPTS = ['Transferencia', 'Cartao', 'DebitoDireto'];
const PRAZO_PAGAMENTO_OPTS = ['Antecipado', '7 dias', '30 dias'];
const SHIPPING_TYPE_OPTS = ['Dropshipping', 'Escritorio'];

export function SupplierMasterView() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [list, setList] = useState<SupplierMaster[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState<Partial<SupplierMaster>>({ ativo: true });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [tabForm, setTabForm] = useState<'geral' | 'fiscal' | 'logistica' | 'acessos'>('geral');
  const [offices, setOffices] = useState<OfficeLocation[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ inserted: number; errors: string[] } | null>(null);

  const empresaId = form.empresa_id ?? 0;
  const tipoEnvio = form.tipo_envio ?? form.default_shipping_type ?? '';
  const isEscritorio = tipoEnvio === 'Escritorio';

  useEffect(() => {
    empresasApi.getAll().then((data) => setEmpresas(Array.isArray(data) ? data : [])).catch(() => setEmpresas([]));
  }, []);

  useEffect(() => {
    setLoading(true);
    suppliersApi.list(empresaId || undefined)
      .then((r) => setList(r.items))
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, [empresaId]);

  useEffect(() => {
    if (selectedId != null) {
      suppliersApi.get(selectedId).then((s) => setForm(s)).catch(() => setForm({}));
    } else {
      setForm({ empresa_id: undefined, nome: '', ativo: true });
    }
  }, [selectedId]);

  useEffect(() => {
    if (!empresaId) { setOffices([]); return; }
    suppliersApi.listOffices(empresaId).then((r) => setOffices(r.items)).catch(() => setOffices([]));
  }, [empresaId]);

  useEffect(() => {
    if (!empresaId) { setPaymentMethods([]); return; }
    paymentMethodsApi.listByEmpresa(empresaId).then(setPaymentMethods).catch(() => setPaymentMethods([]));
  }, [empresaId]);

  const handleDownloadTemplate = async () => {
    try {
      const blob = await suppliersApi.downloadTemplate();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'template_fornecedores.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setMessage(e?.response?.data?.detail || e?.message || 'Erro ao transferir template.');
    }
  };

  const handleImportSubmit = async () => {
    if (!importFile) return;
    setImporting(true);
    setImportResult(null);
    setMessage(null);
    try {
      const res = await suppliersApi.importExcel(importFile);
      setImportResult({ inserted: res.inserted ?? 0, errors: res.errors ?? [] });
      if (res.inserted && res.inserted > 0) {
        suppliersApi.list(empresaId || undefined).then((r) => setList(r.items)).catch(() => {});
      }
      setImportFile(null);
    } catch (e: any) {
      setMessage(e?.response?.data?.detail || e?.message || 'Erro na importação.');
    } finally {
      setImporting(false);
    }
  };

  const handleSave = async () => {
    if (!form.empresa_id) {
      setMessage('Selecione a empresa no separador Geral.');
      return;
    }
    if (!form.nome?.trim()) {
      setMessage('Nome é obrigatório.');
      return;
    }
    const effectiveEmpresaId = form.empresa_id;
    setSaving(true);
    setMessage(null);
    try {
      if (selectedId != null) {
        await suppliersApi.update(selectedId, form);
        setMessage('Fornecedor atualizado.');
        setList((prev) => prev.map((s) => (s.id === selectedId ? { ...s, ...form } : s)));
      } else {
        const { id } = await suppliersApi.create({ ...form, empresa_id: effectiveEmpresaId, nome: form.nome });
        setMessage('Fornecedor criado.');
        setSelectedId(id);
        setList((prev) => [...prev, { ...form, id, empresa_id: effectiveEmpresaId, nome: form.nome } as SupplierMaster]);
      }
    } catch (e: any) {
      setMessage(e?.response?.data?.detail || e?.message || 'Erro ao gravar.');
    } finally {
      setSaving(false);
    }
  };

  const renderField = (
    label: string,
    key: keyof SupplierMaster,
    type: string = 'text',
    options?: string[],
    placeholder?: string
  ) => (
    <div key={String(key)}>
      <label className="block text-xs text-slate-400 mb-1">{label}</label>
      {options ? (
        <select
          value={form[key] as string ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value || null }))}
          className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm"
        >
          <option value="">—</option>
          {options.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      ) : (
        <input
          type={type}
          value={(form[key] as string | number) ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, [key]: type === 'number' ? (e.target.value ? Number(e.target.value) : null) : e.target.value }))}
          placeholder={placeholder}
          className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm"
        />
      )}
    </div>
  );

  return (
    <div className="mt-8 space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Dados Mestres</h1>
        <p className="text-slate-400 text-sm mt-1">Fornecedores, escritórios e configuração de automação (Midnight Sync). Selecione um fornecedor na lista ou crie um novo.</p>
      </div>
      <AutomationStatusCard />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span>Fornecedores</span>
              <button
                type="button"
                onClick={() => { setSelectedId(null); setForm({ empresa_id: undefined, nome: '', ativo: true }); }}
                className="p-1.5 rounded bg-amber-600 text-white hover:bg-amber-500"
                title="Novo fornecedor"
              >
                <Plus className="w-4 h-4" />
              </button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8 text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : list.length === 0 ? (
              <p className="text-slate-500 text-sm">Nenhum fornecedor nesta empresa. Clique em + para criar.</p>
            ) : (
              <ul className="space-y-1">
                {list.map((s) => (
                  <li key={s.id!}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(s.id!)}
                      className={`w-full text-left px-3 py-2 rounded text-sm flex items-center gap-2 ${selectedId === s.id ? 'bg-amber-600/20 text-amber-400' : 'text-slate-300 hover:bg-slate-800'}`}
                    >
                      <Pencil className="w-3 h-3 opacity-70" />
                      {s.nome}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">
              {selectedId != null ? 'Editar ficha de fornecedor' : 'Nova ficha de fornecedor'}
            </CardTitle>
            <p className="text-xs text-slate-500 mt-1">Empresa Associada: selecione no separador Geral.</p>
          </CardHeader>
          <CardContent>
            {(selectedId != null || form.nome !== undefined) && (
              <>
                <Tabs value={tabForm} onValueChange={(v) => setTabForm(v as 'geral' | 'fiscal' | 'logistica' | 'acessos')} className="w-full">
                  <TabsList className="bg-slate-800 border border-slate-600 grid grid-cols-4 w-full">
                    <TabsTrigger value="geral" className="data-[state=active]:bg-amber-600 data-[state=active]:text-white">
                      <User className="w-4 h-4 mr-2" />
                      Geral
                    </TabsTrigger>
                    <TabsTrigger value="fiscal" className="data-[state=active]:bg-amber-600 data-[state=active]:text-white">
                      <CreditCard className="w-4 h-4 mr-2" />
                      Fiscal
                    </TabsTrigger>
                    <TabsTrigger value="logistica" className="data-[state=active]:bg-amber-600 data-[state=active]:text-white">
                      <Truck className="w-4 h-4 mr-2" />
                      Logística
                    </TabsTrigger>
                    <TabsTrigger value="acessos" className="data-[state=active]:bg-amber-600 data-[state=active]:text-white">
                      <Key className="w-4 h-4 mr-2" />
                      Acessos
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="geral" className="mt-4 space-y-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Empresa Associada</label>
                      <select
                        value={form.empresa_id ?? ''}
                        onChange={(e) => setForm((f) => ({ ...f, empresa_id: e.target.value ? Number(e.target.value) : undefined }))}
                        className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm"
                      >
                        <option value="">— Selecione a empresa —</option>
                        {empresas.filter((e) => e.ativo !== false).map((emp) => (
                          <option key={emp.id} value={emp.id}>{emp.nome}</option>
                        ))}
                      </select>
                    </div>
                    {renderField('Nome', 'nome', 'text', undefined, 'Nome ou designação')}
                    {renderField('Designação social', 'designacao_social')}
                    {renderField('NIF/CIF', 'nif_cif')}
                    {renderField('Website / URL login', 'website_url', 'url', undefined, 'https://...')}
                    {renderField('Morada', 'morada')}
                    {renderField('Código postal', 'codigo_postal')}
                    {renderField('Localidade', 'localidade')}
                    {renderField('País', 'pais')}
                    {renderField('Tel', 'tel', 'tel')}
                    {renderField('Email', 'email', 'email')}
                    {renderField('Email comercial (POs)', 'email_comercial', 'email')}
                  </TabsContent>
                  <TabsContent value="fiscal" className="mt-4 space-y-3">
                    {renderField('Regime IVA', 'regime_iva', 'text', REGIME_IVA_OPTS)}
                    {renderField('Taxa IVA padrão (%)', 'taxa_iva_padrao', 'number')}
                    {renderField('Método pagamento', 'metodo_pagamento', 'text', METODO_PAGAMENTO_OPTS)}
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Método de pagamento preferido (ficha)</label>
                      <select
                        value={form.payment_method_id ?? ''}
                        onChange={(e) => setForm((f) => ({ ...f, payment_method_id: e.target.value ? Number(e.target.value) : null }))}
                        className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm"
                      >
                        <option value="">— Nenhum —</option>
                        {paymentMethods.map((pm) => (
                          <option key={pm.id} value={pm.id}>{pm.designacao} ({pm.metodo_tipo})</option>
                        ))}
                      </select>
                      <p className="text-xs text-slate-500 mt-1">Cartão/Banco/PayPal configurados na empresa.</p>
                    </div>
                    {renderField('IBAN', 'iban')}
                    {renderField('Prazo pagamento', 'prazo_pagamento', 'text', PRAZO_PAGAMENTO_OPTS)}
                    {renderField('Cartão (ID)', 'cartao_id', 'number')}
                  </TabsContent>
                  <TabsContent value="logistica" className="mt-4 space-y-3">
                    {renderField('Tipo de envio', 'tipo_envio', 'text', SHIPPING_TYPE_OPTS)}
                    {isEscritorio && (
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Escritório (Lisboa, Huelva, Frankfurt, Paris)</label>
                        <select
                          value={form.office_id ?? ''}
                          onChange={(e) => setForm((f) => ({ ...f, office_id: e.target.value ? Number(e.target.value) : null }))}
                          className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm"
                        >
                          <option value="">— Selecionar escritório —</option>
                          {offices.map((off) => (
                            <option key={off.id} value={off.id}>{off.designacao} ({off.pais})</option>
                          ))}
                        </select>
                      </div>
                    )}
                    {renderField('Lead time (dias)', 'lead_time_estimado', 'number', undefined, 'Ex: 3')}
                    {renderField('Custo envio base (€)', 'custo_envio_base', 'number')}
                    {renderField('Supplier score (futuro)', 'supplier_score', 'number')}
                    <label className="flex items-center gap-2 text-slate-400 text-sm pt-2">
                      <input
                        type="checkbox"
                        checked={form.ativo ?? true}
                        onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked }))}
                        className="rounded"
                      />
                      Ativo
                    </label>
                  </TabsContent>
                  <TabsContent value="acessos" className="mt-0">
                    <SupplierAccessTab
                      key={selectedId ?? 'no-supplier'}
                      supplierId={selectedId}
                      onSyncComplete={() => selectedId != null && suppliersApi.get(selectedId).then(setForm).catch(() => {})}
                    />
                  </TabsContent>
                </Tabs>
                {message && (
                  <div className={`mt-4 px-4 py-2 rounded text-sm ${message.startsWith('Fornecedor') ? 'bg-emerald-900/30 text-emerald-400' : 'bg-red-900/30 text-red-400'}`}>
                    {message}
                  </div>
                )}
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 rounded-lg bg-amber-600 text-white font-medium disabled:opacity-50 flex items-center gap-2"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Gravar
                  </button>
                </div>
              </>
            )}
            {selectedId == null && form.nome === undefined && (
              <p className="text-slate-500 text-sm">Selecione um fornecedor na lista ou clique em + para criar. Na ficha, escolha a empresa no separador Geral.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Importação em lote */}
      <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Importação em lote
            </CardTitle>
            <p className="text-xs text-slate-500">Descarregue o template, preencha no Excel e carregue o ficheiro. Entidade deve ser único; Empresa_ID deve existir.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 text-white hover:bg-slate-600"
              >
                <Download className="w-4 h-4" />
                Baixar Template
              </button>
              <div
                className="border-2 border-dashed border-slate-600 rounded-lg p-6 min-w-[280px] text-center"
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-amber-500'); }}
                onDragLeave={(e) => { e.currentTarget.classList.remove('border-amber-500'); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove('border-amber-500');
                  const f = e.dataTransfer?.files?.[0];
                  if (f && (f.name.endsWith('.xlsx') || f.name.endsWith('.xls'))) setImportFile(f);
                }}
              >
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  id="supplier-import-file"
                  onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
                />
                <label htmlFor="supplier-import-file" className="cursor-pointer text-slate-400 text-sm block">
                  {importFile ? importFile.name : 'Arraste um .xlsx aqui ou clique para escolher'}
                </label>
                <button
                  type="button"
                  onClick={() => document.getElementById('supplier-import-file')?.click()}
                  className="mt-2 text-amber-400 text-sm hover:underline"
                >
                  Selecionar ficheiro
                </button>
              </div>
              <button
                type="button"
                onClick={handleImportSubmit}
                disabled={!importFile || importing}
                className="px-4 py-2 rounded-lg bg-amber-600 text-white font-medium disabled:opacity-50 flex items-center gap-2"
              >
                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Importar
              </button>
            </div>
            {importResult && (
              <div className="text-sm">
                <p className="text-emerald-400">Inseridos: {importResult.inserted}</p>
                {importResult.errors.length > 0 && (
                  <ul className="mt-2 text-red-400 text-xs list-disc pl-4">
                    {importResult.errors.slice(0, 15).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                    {importResult.errors.length > 15 && <li>... e mais {importResult.errors.length - 15} erros</li>}
                  </ul>
                )}
              </div>
            )}
          </CardContent>
        </Card>
    </div>
  );
}
