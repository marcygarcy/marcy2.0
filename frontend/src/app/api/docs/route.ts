import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DOCS_DIR = path.join(process.cwd(), '..', 'docs');

const ALLOWED_FILES = [
  'FEATURES.md',
  'SYSTEM_DOCUMENTATION_FULL.md',
  'CHANGELOG.md',
];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const file = searchParams.get('file');

  if (!file) {
    // List available files
    const files = ALLOWED_FILES.map((name) => {
      const filePath = path.join(DOCS_DIR, name);
      let size = 0;
      let mtime = '';
      try {
        const stat = fs.statSync(filePath);
        size = stat.size;
        mtime = stat.mtime.toISOString();
      } catch {
        // file might not exist
      }
      return { name, size, mtime, exists: size > 0 };
    });
    return NextResponse.json({ files });
  }

  // Security: only allow whitelisted files, no path traversal
  if (!ALLOWED_FILES.includes(file) || file.includes('..') || file.includes('/')) {
    return NextResponse.json({ error: 'Ficheiro não permitido' }, { status: 403 });
  }

  const filePath = path.join(DOCS_DIR, file);
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return new NextResponse(content, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  } catch {
    return NextResponse.json({ error: 'Ficheiro não encontrado' }, { status: 404 });
  }
}
