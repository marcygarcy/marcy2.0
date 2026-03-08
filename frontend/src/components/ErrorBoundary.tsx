'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/** Se algo correr mal no frontend, mostra o erro em vez de página em branco. */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <div className="min-h-screen bg-slate-900 text-slate-200 p-8 flex items-center justify-center">
          <div className="max-w-xl w-full bg-slate-800 border border-red-500/50 rounded-xl p-6">
            <h1 className="text-xl font-semibold text-amber-400 mb-2">Algo correu mal</h1>
            <p className="text-slate-300 text-sm mb-4">
              (Em desenvolvimento.)
            </p>
            <p className="text-slate-500 text-xs">
              Pode fazer refresh (F5) ou tentar de novo.
            </p>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, error: null })}
              className="mt-4 px-4 py-2 rounded-lg bg-amber-600 text-white text-sm hover:bg-amber-500"
            >
              Tentar de novo
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
