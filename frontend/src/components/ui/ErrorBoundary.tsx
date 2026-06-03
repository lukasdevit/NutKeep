'use client';

import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches rendering errors in the component tree and shows a fallback.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 text-zinc-100 px-4">
          <div className="max-w-md text-center space-y-4">
            <h1 className="text-xl font-semibold">Something went wrong</h1>
            <p className="text-sm text-zinc-400">
              An unexpected error occurred. Try refreshing the page.
            </p>
            <pre className="text-xs text-red-400 bg-zinc-900 p-3 rounded-lg overflow-auto max-h-32">
              {this.state.error.message}
            </pre>
            <button
              type="button"
              onClick={() => this.setState({ error: null })}
              className="px-4 py-2 rounded-md text-sm font-medium bg-violet-600 hover:bg-violet-500 text-white transition-colors"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
