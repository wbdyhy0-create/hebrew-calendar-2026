import { useState } from 'react';
import type { WebTrialComputed } from '../utils/webTrialLicense';

type Props = {
  status: WebTrialComputed;
  onLicensed: () => void;
};

export function WebTrialExpiredOverlay({ status, onLicensed }: Props) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    const trimmed = code.trim().replace(/\s+/g, '');
    if (!trimmed) {
      setErr('הזינו את קוד הרישיון שקיבלתם ברכישה.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/validate-calendar-license', {
        method: 'POST',
        headers: { 'content-type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ code: trimmed }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.ok && data?.ok === true) {
        onLicensed();
        return;
      }
      setErr(typeof data?.error === 'string' ? data.error : 'אימות הקוד נכשל. נסו שוב או צרו קשר.');
    } catch {
      setErr('אין חיבור לשרת או שגיאת רשת. נסו מאוחר יותר.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] bg-white/95 backdrop-blur-sm flex items-center justify-center p-6"
      dir="rtl"
    >
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-xl p-6 text-center">
        <div className="text-xl font-bold text-slate-900">לוח שנה עברי־לועזי</div>
        <div className="mt-2 text-base font-semibold text-rose-700">תקופת הניסיון הסתיימה</div>
        <p className="mt-4 text-sm text-slate-700 leading-relaxed">
          כבר נהניתם מהלוח בתקופת ניסוי של <span className="font-semibold">{status.trialDays} ימים</span>.
          לשימוש שוטף והפעלה לצמיתות, השתמשו בקוד הרישיון שקיבלתם אחרי הרכישה.
        </p>
        <p className="mt-3 text-sm text-slate-900 font-semibold">
          לרכישה ולקבלת קוד:{' '}
          <a href="tel:0522284432" className="font-mono text-sky-700 underline underline-offset-2">
            052‑228‑4432
          </a>
        </p>
        <p className="mt-4 text-xs text-slate-500">
          תחילת ניסוי: {status.installYmd} • שימוש: {status.daysUsed} ימים
        </p>

        <form onSubmit={submit} className="mt-6 text-right space-y-3">
          <label className="block text-sm font-bold text-slate-800 text-right">קוד רישיון לצמיתות</label>
          <input
            type="text"
            dir="ltr"
            autoComplete="off"
            spellCheck={false}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base font-mono text-slate-900 outline-none focus:ring-2 focus:ring-sky-400"
            placeholder="הדבקו כאן את הקוד"
            disabled={busy}
          />
          {err ? <p className="text-sm text-rose-600 font-semibold">{err}</p> : null}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold py-3 text-base transition-colors"
          >
            {busy ? 'בודק…' : 'הפעל רישיון'}
          </button>
        </form>
      </div>
    </div>
  );
}
