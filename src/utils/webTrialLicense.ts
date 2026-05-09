/** Web build: mirrors `electron/main.cjs` trial math (UTC calendar days). */
export const TRIAL_DAYS_WEB = 14;

const LS_INSTALL_YMD = 'hc2026_trial_install_ymd';
const LS_PERPETUAL = 'hc2026_perpetual_licensed';

export type WebTrialComputed = {
  trialDays: number;
  installYmd: string;
  nowYmd: string;
  daysUsed: number;
  daysLeft: number;
  expired: boolean;
};

function toYmdUtc(d: number | Date): string {
  const dt = new Date(d);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const day = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function computeTrialStatus(installYmd: string, trialDays: number = TRIAL_DAYS_WEB): WebTrialComputed {
  const installMs = Date.parse(`${installYmd}T00:00:00.000Z`);
  const nowYmd = toYmdUtc(Date.now());
  const nowMs = Date.parse(`${nowYmd}T00:00:00.000Z`);
  const daysUsed = Math.max(0, Math.floor((nowMs - installMs) / 86400000));
  const daysLeft = Math.max(0, trialDays - daysUsed);
  return {
    trialDays,
    installYmd,
    nowYmd,
    daysUsed,
    daysLeft,
    expired: daysUsed >= trialDays,
  };
}

export function readWebLicensedFlag(): boolean {
  try {
    return typeof window !== 'undefined' && window.localStorage.getItem(LS_PERPETUAL) === '1';
  } catch {
    return false;
  }
}

export function writeWebLicensedFlag(): void {
  try {
    window.localStorage.setItem(LS_PERPETUAL, '1');
  } catch {
    /* ignore quota / privacy mode */
  }
}

export function getOrCreateWebInstallYmd(): string {
  try {
    const existing = typeof window !== 'undefined' ? window.localStorage.getItem(LS_INSTALL_YMD) : null;
    if (existing && /^\d{4}-\d{2}-\d{2}$/.test(existing)) return existing;
    const ymd = toYmdUtc(Date.now());
    window.localStorage.setItem(LS_INSTALL_YMD, ymd);
    return ymd;
  } catch {
    return toYmdUtc(Date.now());
  }
}
