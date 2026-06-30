import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { error: Error | null };

// Catches render errors anywhere below it and shows a friendly fallback
// instead of a blank white screen.
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface it in the console for debugging.
    console.error('Unhandled UI error:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <main className="app-shell">
          <section className="app-frame">
            <article className="panel" style={{ maxWidth: 520, margin: '40px auto' }}>
              <p className="eyebrow">Something went wrong</p>
              <h2>This page hit an error</h2>
              <p className="muted-copy">Try reloading. If it keeps happening, let the site admin know.</p>
              <div className="button-row">
                <button className="primary-btn" onClick={() => window.location.reload()}>Reload</button>
              </div>
            </article>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}
