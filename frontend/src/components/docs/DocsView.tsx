'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { BookOpen, FileText, List, Zap, Loader2, RefreshCw, ChevronRight, AlertTriangle } from 'lucide-react';

// ─── Doc registry ─────────────────────────────────────────────────────────────

const DOCS = [
  {
    file: 'FEATURES.md',
    label: 'Funcionalidades',
    description: 'Registo de funcionalidades e correcções entregues',
    icon: Zap,
    accent: 'text-amber-400',
    activeBg: 'bg-amber-600',
  },
  {
    file: 'SYSTEM_DOCUMENTATION_FULL.md',
    label: 'Documentação do Sistema',
    description: 'Arquitectura, stack, módulos ERP, API, ETL, deploy',
    icon: BookOpen,
    accent: 'text-sky-400',
    activeBg: 'bg-sky-600',
  },
  {
    file: 'CHANGELOG.md',
    label: 'Changelog',
    description: 'Histórico de alterações por data',
    icon: List,
    accent: 'text-slate-400',
    activeBg: 'bg-slate-600',
  },
] as const;

type DocFile = (typeof DOCS)[number]['file'];

// ─── Markdown renderer ────────────────────────────────────────────────────────

function renderMarkdown(md: string): React.ReactNode[] {
  const lines = md.split('\n');
  const nodes: React.ReactNode[] = [];
  let i = 0;
  let keyIdx = 0;
  const k = () => keyIdx++;

  const inlineRender = (text: string): React.ReactNode => {
    // Process inline markdown: code, bold, italic, links
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let pIdx = 0;

    while (remaining.length > 0) {
      // Inline code
      const codeMatch = remaining.match(/^(.*?)`([^`]+)`/s);
      if (codeMatch) {
        if (codeMatch[1]) parts.push(<span key={pIdx++}>{inlineText(codeMatch[1])}</span>);
        parts.push(<code key={pIdx++} className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 text-xs font-mono border border-slate-700">{codeMatch[2]}</code>);
        remaining = remaining.slice(codeMatch[0].length);
        continue;
      }
      // Bold
      const boldMatch = remaining.match(/^(.*?)\*\*(.+?)\*\*/s);
      if (boldMatch) {
        if (boldMatch[1]) parts.push(<span key={pIdx++}>{inlineText(boldMatch[1])}</span>);
        parts.push(<strong key={pIdx++} className="text-white font-semibold">{boldMatch[2]}</strong>);
        remaining = remaining.slice(boldMatch[0].length);
        continue;
      }
      // Link
      const linkMatch = remaining.match(/^(.*?)\[([^\]]+)\]\(([^)]+)\)/s);
      if (linkMatch) {
        if (linkMatch[1]) parts.push(<span key={pIdx++}>{inlineText(linkMatch[1])}</span>);
        parts.push(<a key={pIdx++} href={linkMatch[3]} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:text-sky-300 underline">{linkMatch[2]}</a>);
        remaining = remaining.slice(linkMatch[0].length);
        continue;
      }
      // No more patterns
      parts.push(<span key={pIdx++}>{inlineText(remaining)}</span>);
      break;
    }
    return parts.length === 1 ? parts[0] : <>{parts}</>;
  };

  const inlineText = (t: string) => t;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      nodes.push(
        <div key={k()} className="my-4 rounded-lg overflow-hidden border border-slate-700">
          {lang && (
            <div className="px-4 py-1.5 bg-slate-800 border-b border-slate-700 text-xs text-slate-400 font-mono">{lang}</div>
          )}
          <pre className="p-4 bg-slate-900/80 text-sm text-slate-300 font-mono overflow-x-auto whitespace-pre leading-relaxed">
            <code>{codeLines.join('\n')}</code>
          </pre>
        </div>
      );
      i++;
      continue;
    }

    // Horizontal rule
    if (/^-{3,}$/.test(line.trim()) || /^_{3,}$/.test(line.trim()) || /^\*{3,}$/.test(line.trim())) {
      nodes.push(<hr key={k()} className="my-6 border-slate-700" />);
      i++;
      continue;
    }

    // Headers
    const h1 = line.match(/^# (.+)/);
    if (h1) {
      nodes.push(
        <h1 key={k()} className="text-2xl font-bold text-white mt-8 mb-4 pb-2 border-b border-slate-700 flex items-center gap-2">
          {inlineRender(h1[1])}
        </h1>
      );
      i++;
      continue;
    }
    const h2 = line.match(/^## (.+)/);
    if (h2) {
      nodes.push(
        <h2 key={k()} className="text-xl font-bold text-slate-100 mt-7 mb-3 pb-1.5 border-b border-slate-800">
          {inlineRender(h2[1])}
        </h2>
      );
      i++;
      continue;
    }
    const h3 = line.match(/^### (.+)/);
    if (h3) {
      nodes.push(
        <h3 key={k()} className="text-base font-semibold text-amber-300 mt-5 mb-2">
          {inlineRender(h3[1])}
        </h3>
      );
      i++;
      continue;
    }
    const h4 = line.match(/^#### (.+)/);
    if (h4) {
      nodes.push(
        <h4 key={k()} className="text-sm font-semibold text-slate-300 uppercase tracking-wide mt-4 mb-1.5">
          {inlineRender(h4[1])}
        </h4>
      );
      i++;
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith('> ')) {
        quoteLines.push(lines[i].slice(2));
        i++;
      }
      nodes.push(
        <blockquote key={k()} className="my-3 pl-4 border-l-4 border-amber-500/50 text-slate-400 italic text-sm">
          {quoteLines.map((ql, qi) => <p key={qi}>{inlineRender(ql)}</p>)}
        </blockquote>
      );
      continue;
    }

    // Table
    if (line.includes('|') && line.trim().startsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i]);
        i++;
      }
      const headerLine = tableLines[0];
      const separatorLine = tableLines[1] ?? '';
      const bodyLines = tableLines.slice(2);

      const isSeparator = separatorLine.includes('---');

      const parseRow = (row: string) =>
        row.split('|').map(c => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);

      const headers = isSeparator ? parseRow(headerLine) : [];
      const rows = isSeparator ? bodyLines.map(parseRow) : tableLines.map(parseRow);

      nodes.push(
        <div key={k()} className="my-4 overflow-x-auto rounded-lg border border-slate-700">
          <table className="w-full text-sm">
            {headers.length > 0 && (
              <thead>
                <tr className="bg-slate-800 border-b border-slate-700">
                  {headers.map((h, hi) => (
                    <th key={hi} className="px-4 py-2.5 text-left text-slate-300 font-semibold text-xs uppercase tracking-wide">
                      {inlineRender(h)}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} className={`border-b border-slate-800 ${ri % 2 === 0 ? 'bg-slate-900/40' : 'bg-slate-900/20'} hover:bg-slate-800/40`}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-4 py-2.5 text-slate-300 align-top">
                      {inlineRender(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Unordered list
    if (/^(\s*)[*\-+] /.test(line)) {
      const listItems: React.ReactNode[] = [];
      while (i < lines.length && /^(\s*)[*\-+] /.test(lines[i])) {
        const indent = lines[i].match(/^(\s*)/)?.[1].length ?? 0;
        const text = lines[i].replace(/^\s*[*\-+] /, '');
        listItems.push(
          <li key={i} className={`flex items-start gap-2 text-slate-300 text-sm ${indent > 0 ? 'ml-5' : ''}`}>
            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
            <span>{inlineRender(text)}</span>
          </li>
        );
        i++;
      }
      nodes.push(<ul key={k()} className="my-3 space-y-1.5">{listItems}</ul>);
      continue;
    }

    // Ordered list
    if (/^\d+\. /.test(line)) {
      const listItems: React.ReactNode[] = [];
      let num = 1;
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        const text = lines[i].replace(/^\d+\. /, '');
        listItems.push(
          <li key={i} className="flex items-start gap-2 text-slate-300 text-sm">
            <span className="mt-0.5 w-5 h-5 rounded-full bg-slate-700 text-slate-400 text-xs flex items-center justify-center shrink-0 font-mono">{num}</span>
            <span>{inlineRender(text)}</span>
          </li>
        );
        num++;
        i++;
      }
      nodes.push(<ol key={k()} className="my-3 space-y-1.5">{listItems}</ol>);
      continue;
    }

    // Empty line
    if (line.trim() === '') {
      nodes.push(<div key={k()} className="h-2" />);
      i++;
      continue;
    }

    // Regular paragraph
    nodes.push(
      <p key={k()} className="text-slate-300 text-sm leading-relaxed my-1">
        {inlineRender(line)}
      </p>
    );
    i++;
  }

  return nodes;
}

// ─── Heading extractor (for TOC) ─────────────────────────────────────────────

function extractHeadings(md: string) {
  return md
    .split('\n')
    .filter(l => /^#{1,3} /.test(l))
    .map(l => {
      const m = l.match(/^(#{1,3}) (.+)/);
      if (!m) return null;
      return { level: m[1].length, text: m[2].replace(/\*\*/g, '') };
    })
    .filter(Boolean) as { level: number; text: string }[];
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DocsView() {
  const [selectedFile, setSelectedFile] = useState<DocFile>('FEATURES.md');
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showToc, setShowToc] = useState(true);

  const loadDoc = useCallback(async (file: DocFile) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/docs?file=${encodeURIComponent(file)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      setContent(text);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar documento');
      setContent('');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDoc(selectedFile);
  }, [selectedFile, loadDoc]);

  const headings = extractHeadings(content);
  const currentDoc = DOCS.find(d => d.file === selectedFile)!;

  return (
    <div className="flex h-[calc(100vh-5rem)] gap-0 mt-4 rounded-xl overflow-hidden border border-slate-700 bg-slate-900">

      {/* ── Left panel: doc selector + TOC ──────────────────────────────── */}
      <div className="w-64 shrink-0 bg-slate-900 border-r border-slate-700 flex flex-col">

        {/* Doc list */}
        <div className="p-3 border-b border-slate-700">
          <p className="text-xs text-slate-500 uppercase tracking-widest font-bold mb-2 px-1">Documentos</p>
          <div className="space-y-1">
            {DOCS.map((doc) => {
              const Icon = doc.icon;
              const active = doc.file === selectedFile;
              return (
                <button
                  key={doc.file}
                  type="button"
                  onClick={() => setSelectedFile(doc.file)}
                  className={`w-full flex items-start gap-2.5 px-3 py-2.5 rounded-lg text-sm text-left transition-colors ${
                    active ? `${doc.activeBg} text-white` : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${active ? 'text-white' : doc.accent}`} />
                  <div>
                    <div className="font-medium leading-tight">{doc.label}</div>
                    <div className={`text-xs mt-0.5 leading-tight ${active ? 'text-white/70' : 'text-slate-500'}`}>
                      {doc.description}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Table of contents */}
        {headings.length > 0 && (
          <div className="flex-1 overflow-y-auto p-3">
            <button
              type="button"
              onClick={() => setShowToc(v => !v)}
              className="flex items-center gap-1 text-xs text-slate-500 uppercase tracking-widest font-bold mb-2 px-1 w-full hover:text-slate-400"
            >
              <ChevronRight className={`w-3 h-3 transition-transform ${showToc ? 'rotate-90' : ''}`} />
              Índice
            </button>
            {showToc && (
              <div className="space-y-0.5">
                {headings.map((h, idx) => (
                  <div
                    key={idx}
                    className={`text-xs text-slate-400 hover:text-slate-200 cursor-default leading-snug py-0.5 ${
                      h.level === 1 ? 'font-semibold text-slate-300' :
                      h.level === 2 ? 'pl-3' : 'pl-6 text-slate-500'
                    }`}
                  >
                    {h.text}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Main content area ────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Toolbar */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-700 bg-slate-800/50 shrink-0">
          <div className="flex items-center gap-3">
            <FileText className={`w-4 h-4 ${currentDoc.accent}`} />
            <span className="text-sm font-semibold text-slate-200">{currentDoc.label}</span>
            <span className="text-xs text-slate-500 font-mono">{currentDoc.file}</span>
          </div>
          <button
            type="button"
            onClick={() => loadDoc(selectedFile)}
            disabled={loading}
            className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
            title="Recarregar"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {loading && (
            <div className="flex items-center justify-center py-20 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin mr-3" />
              A carregar documento…
            </div>
          )}

          {error && !loading && (
            <div className="flex items-start gap-3 bg-red-900/20 border border-red-700/50 rounded-lg px-5 py-4 text-red-400">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Erro ao carregar documento</p>
                <p className="text-sm mt-1 text-red-400/80">{error}</p>
                <p className="text-xs mt-2 text-red-400/60">Certifica-te que o backend/Next.js está a correr e que o ficheiro existe em <code className="font-mono">docs/{selectedFile}</code></p>
              </div>
            </div>
          )}

          {!loading && !error && content && (
            <article className="max-w-4xl">
              {renderMarkdown(content)}
            </article>
          )}
        </div>
      </div>
    </div>
  );
}
