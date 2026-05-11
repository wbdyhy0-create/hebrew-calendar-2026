import { Component, type ErrorInfo, type ReactNode, useEffect, useState } from 'react';
import { Calendar } from './components/Calendar';
import { WebTrialExpiredOverlay } from '@hc2026-root/components/WebTrialExpiredOverlay.tsx';
import {
  computeTrialStatus,
  getOrCreateWebInstallYmd,
  readWebLicensedFlag,
  writeWebLicensedFlag,
  type WebTrialComputed,
} from '@hc2026-root/utils/webTrialLicense.ts';

type BoundaryState = { error?: Error };

class AppErrorBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  override state: BoundaryState = {};

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
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
  const [showSplash, setShowSplash] = useState(true);
  const [trial, setTrial] = useState<
    | {
        ok: true;
        trialDays: number;
        installYmd: string;
        nowYmd: string;
        daysUsed: number;
        daysLeft: number;
        expired: boolean;
      }
    | { ok: false; error: string }
    | null
  >(null);

  const [webLicensed, setWebLicensed] = useState(() => readWebLicensedFlag());
  const [webTrial, setWebTrial] = useState<WebTrialComputed | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setShowSplash(false), 5000);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') setShowSplash(false);
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', onKey, true);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const desktopTrial = window.HebrewGregorianDesktop?.trial?.getStatus;
      if (typeof desktopTrial === 'function') {
        try {
          const st = await desktopTrial();
          if (alive) setTrial(st);
        } catch {
          // ignore (desktop build)
        }
        return;
      }

      // Auto-unlock when embedded from a trusted origin (e.g. your Footnote Wizard page).
      // This keeps the license scoped to the embed entrypoint without requiring users to enter a code.
      try {
        const embedded = typeof window !== 'undefined' && window.self !== window.top;
        if (embedded && !readWebLicensedFlag()) {
          const r = await fetch('/api/validate-calendar-license', {
            method: 'POST',
            headers: { 'content-type': 'application/json; charset=utf-8' },
            // Empty code: server may allow trusted embeds based on document.referrer (parent URL).
            body: JSON.stringify({ embedReferrer: typeof document !== 'undefined' ? document.referrer : '' }),
          });
          const j = (await r.json().catch(() => ({}))) as { ok?: boolean };
          if (r.ok && j?.ok === true) {
            writeWebLicensedFlag();
            if (alive) {
              setWebLicensed(true);
              setWebTrial(null);
            }
            return;
          }
        }
      } catch {
        // ignore
      }

      if (readWebLicensedFlag()) {
        if (alive) {
          setWebLicensed(true);
          setWebTrial(null);
        }
        return;
      }

      const installYmd = getOrCreateWebInstallYmd();
      if (alive) {
        setWebLicensed(false);
        setWebTrial(computeTrialStatus(installYmd));
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const showWebTrialLock =
    typeof window.HebrewGregorianDesktop?.trial?.getStatus !== 'function' &&
    webTrial?.expired === true &&
    !webLicensed;

  const onWebLicensed = () => {
    writeWebLicensedFlag();
    setWebLicensed(true);
  };

  return (
    <AppErrorBoundary>
      <main className="min-h-screen bg-white relative">
        <Calendar />

        {showSplash ? (
          <div
            className="fixed inset-0 z-[210] bg-black flex items-center justify-center"
            role="dialog"
            aria-modal="true"
            aria-label="מסך פתיחה"
            onMouseDown={() => setShowSplash(false)}
          >
            <video
              className="w-full h-full object-cover"
              src={`${import.meta.env.BASE_URL}splash.webm.mp4`}
              autoPlay
              muted
              playsInline
              preload="auto"
            />
          </div>
        ) : null}

        {showWebTrialLock && webTrial ? (
          <WebTrialExpiredOverlay status={webTrial} onLicensed={onWebLicensed} />
        ) : null}

        {trial && trial.ok && trial.expired ? (
          <div
            className="fixed inset-0 z-[200] bg-white/95 backdrop-blur-sm flex items-center justify-center p-6"
            dir="rtl"
          >
            <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-xl p-6 text-center">
              <div className="text-xl font-bold text-slate-900">StyleCal – סטודיו אישי לעיצוב לוחות שנה</div>
              <div className="mt-2 text-base font-semibold text-rose-700">תקופת הניסיון הסתיימה 🛑</div>
              <div className="mt-4 text-sm text-slate-700 leading-relaxed">
                נשמח שתמשיך ליצור ולעצב לוחות שנה בסטייל הייחודי שלך!
                <br />
                כדי לפתוח את הנעילה ולהמשיך להשתמש בתוכנה, יש לרכוש רישיון שימוש.
              </div>
              <div className="mt-4 text-sm text-slate-900 font-semibold">
                לרכישה ולקבלת קוד הפעלה, נא ליצור קשר: <span className="font-mono">0522284432</span>
              </div>
              <div className="mt-4 text-xs text-slate-500">
                (תאריך התקנה: {trial.installYmd} • עברו {trial.daysUsed} ימים)
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </AppErrorBoundary>
  );
}
