import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Calendar } from './components/Calendar';

type BoundaryState = { error?: Error };

class AppErrorBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  override state: BoundaryState = {};

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error(error, info.componentStack);
  }

  override render() {
    if (this.state.error) {
      return (
        <main className="min-h-screen bg-white p-6" dir="rtl">
          <h1 className="text-lg font-normal text-red-700">שגיאה בטעינת הלוח</h1>
          <pre className="mt-4 max-w-3xl overflow-auto rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-900 whitespace-pre-wrap">
            {this.state.error.message}
          </pre>
          <p className="mt-4 max-w-xl text-sm text-slate-600">
            אם השגיאה נמשכת אחרי רענון, נסו &quot;איפוס&quot; בתוך הגדרות העיצוב, או מחיקת נתוני האתר עבור כתובת זו מהדפדפן (לעיתים נשמר JSON פגום ב־localStorage).
          </p>
        </main>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <AppErrorBoundary>
      <main className="min-h-screen bg-white">
        <Calendar />
      </main>
    </AppErrorBoundary>
  );
}
