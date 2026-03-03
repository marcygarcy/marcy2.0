'use client';

import { useEffect, useState } from 'react';
import { Settings2, Mail, CheckCircle, XCircle, Loader2, Eye, EyeOff } from 'lucide-react';
import { configApi, SmtpConfig } from '@/lib/api/config';

export function SystemConfigView() {
  const [cfg, setCfg] = useState<SmtpConfig>({
    smtp_host: '',
    smtp_port: 587,
    smtp_user: '',
    smtp_from: '',
    smtp_password_set: false,
  });
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);

  useEffect(() => {
    configApi.getSmtp().then((data) => {
      setCfg(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      await configApi.saveSmtp({
        ...cfg,
        ...(password ? { smtp_password: password } : {}),
      });
      setSaveMsg({ ok: true, text: 'Configuração guardada com sucesso.' });
      setPassword('');
      // recarregar para actualizar smtp_password_set
      const updated = await configApi.getSmtp();
      setCfg(updated);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro ao guardar';
      setSaveMsg({ ok: false, text: msg });
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    if (!testEmail.trim()) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await configApi.testSmtp(testEmail.trim());
      setTestResult(res);
    } finally {
      setTesting(false);
    }
  };

  const configured = !!(cfg.smtp_host && cfg.smtp_user);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        A carregar configuração...
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-slate-700 rounded-lg flex items-center justify-center">
          <Settings2 className="w-5 h-5 text-slate-300" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-white">Configuração do Sistema</h1>
          <p className="text-xs text-slate-400">Parâmetros globais — SMTP e outras definições</p>
        </div>
      </div>

      {/* SMTP card */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-5">
        <div className="flex items-center gap-2 border-b border-slate-700 pb-4">
          <Mail className="w-4 h-4 text-slate-400" />
          <h2 className="font-medium text-white">Configuração SMTP</h2>
          {configured ? (
            <span className="ml-auto flex items-center gap-1 text-xs text-emerald-400">
              <CheckCircle className="w-3.5 h-3.5" /> Configurado
            </span>
          ) : (
            <span className="ml-auto flex items-center gap-1 text-xs text-amber-400">
              <XCircle className="w-3.5 h-3.5" /> Não configurado
            </span>
          )}
        </div>

        {!configured && (
          <div className="bg-amber-900/20 border border-amber-600/30 rounded-lg p-3 text-xs text-amber-300">
            Sem SMTP configurado, as contestações de faturas usarão um link <code>mailto:</code>{' '}
            que abre o teu cliente de email (Outlook, Gmail, etc.).
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            label="Host SMTP"
            value={cfg.smtp_host}
            onChange={(v) => setCfg({ ...cfg, smtp_host: v })}
            placeholder="smtp.gmail.com"
          />
          <FormField
            label="Porta"
            value={String(cfg.smtp_port)}
            onChange={(v) => setCfg({ ...cfg, smtp_port: parseInt(v) || 587 })}
            placeholder="587"
            type="number"
          />
          <FormField
            label="Utilizador / Email"
            value={cfg.smtp_user}
            onChange={(v) => setCfg({ ...cfg, smtp_user: v })}
            placeholder="erp@empresa.com"
          />
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">
              Password{cfg.smtp_password_set && !password && ' (definida — deixar em branco para manter)'}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={cfg.smtp_password_set ? '••••••••' : 'password'}
                className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-white pr-9 placeholder-slate-600"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <FormField
            label="Nome/email de origem (From)"
            value={cfg.smtp_from}
            onChange={(v) => setCfg({ ...cfg, smtp_from: v })}
            placeholder="ERP Hub Sales <erp@empresa.com>"
            className="sm:col-span-2"
          />
        </div>

        {saveMsg && (
          <div
            className={`flex items-center gap-2 text-sm p-3 rounded-lg ${
              saveMsg.ok
                ? 'bg-emerald-900/30 border border-emerald-600/30 text-emerald-300'
                : 'bg-rose-900/30 border border-rose-600/30 text-rose-300'
            }`}
          >
            {saveMsg.ok ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            {saveMsg.text}
          </div>
        )}

        <div className="flex justify-end">
          <button
            onClick={save}
            disabled={saving}
            className="px-5 py-2 bg-slate-600 hover:bg-slate-500 disabled:opacity-40 text-white text-sm rounded-lg flex items-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'A guardar...' : 'Guardar'}
          </button>
        </div>
      </div>

      {/* Test connection */}
      {configured && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-4">
          <h2 className="font-medium text-white flex items-center gap-2">
            <Mail className="w-4 h-4 text-slate-400" />
            Testar Ligação SMTP
          </h2>
          <p className="text-xs text-slate-400">
            Envia um email de teste para confirmar que a configuração está correcta.
          </p>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-xs text-slate-400 mb-1.5">Email de destino</label>
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="teste@empresa.com"
                className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-white"
              />
            </div>
            <button
              onClick={test}
              disabled={testing || !testEmail.trim()}
              className="px-4 py-2 bg-sky-700 hover:bg-sky-600 disabled:opacity-40 text-white text-sm rounded-lg flex items-center gap-2 shrink-0"
            >
              {testing && <Loader2 className="w-4 h-4 animate-spin" />}
              {testing ? 'A testar...' : 'Enviar teste'}
            </button>
          </div>

          {testResult && (
            <div
              className={`flex items-start gap-2 p-3 rounded-lg text-sm ${
                testResult.success
                  ? 'bg-emerald-900/30 border border-emerald-600/30 text-emerald-300'
                  : 'bg-rose-900/30 border border-rose-600/30 text-rose-300'
              }`}
            >
              {testResult.success ? (
                <><CheckCircle className="w-4 h-4 mt-0.5 shrink-0" /> Email enviado com sucesso! Verifica a caixa de entrada.</>
              ) : (
                <><XCircle className="w-4 h-4 mt-0.5 shrink-0" /> Falhou: {testResult.error}</>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FormField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  className = '',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-xs text-slate-400 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-white placeholder-slate-600"
      />
    </div>
  );
}
