import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: any) {
    console.error("[ErrorBoundary] Caught render error:", error, info);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-white dark:bg-gray-950 flex items-center justify-center p-6" data-testid="error-boundary-fallback">
          <div className="max-w-md w-full text-center">
            <div className="w-16 h-16 bg-red-50 dark:bg-red-950 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <span className="text-3xl">⚠️</span>
            </div>
            <h1 className="text-2xl font-bold text-black dark:text-white mb-2 tracking-tight">
              Something went wrong
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">
              The page hit an unexpected error. Try reloading, or head back home.
            </p>
            {this.state.error?.message && (
              <pre className="text-left text-xs bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-3 mb-6 text-gray-600 dark:text-gray-400 overflow-auto max-h-32">
                {this.state.error.message}
              </pre>
            )}
            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleReload}
                className="littr-btn littr-btn-primary px-5 py-2"
                data-testid="button-error-reload"
              >
                Reload
              </button>
              <button
                onClick={this.handleGoHome}
                className="px-5 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                data-testid="button-error-home"
              >
                Go Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
