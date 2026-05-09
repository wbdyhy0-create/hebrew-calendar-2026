/** Web build: mirrors `electron/main.cjs` trial math (UTC calendar days). */
export const TRIAL_DAYS_WEB = 14;

const LS_LICENSE_V1 = 'hebrew-gregorian-calendar:license:v1';

/** Legacy keys — migrated once into `LS_LICENSE_V1`, then removed. */
const LS_LEGACY_INSTALL_YMD = 'hc2026_trial_install_ymd';
const LS_LEGACY_PERPETUAL = 'hc2026_perpetual_licensed';

export type WebTrialComputed = {
  trialDays: number;
  installYmd: string;
  nowYmd: string;
  daysUsed: number;
  daysLeft: number;
  expired: boolean;
};

type StoredLicenseV1 = {
  trialInstallYmd?: string;
  perpetualLicensed?: boolean;
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

function stripLegacyKeys(ls: Storage) {
  try {
    ls.removeItem(LS_LEGACY_INSTALL_YMD);
    ls.removeItem(LS_LEGACY_PERPETUAL);
  } catch {
    /* ignore */
  }
}

function readParsedV1(raw: string | null): StoredLicenseV1 {
  if (!raw?.trim()) return {};
  try {
    const j = JSON.parse(raw) as unknown;
    if (!j || typeof j !== 'object' || Array.isArray(j)) return {};
    const o = j as Record<string, unknown>;
    const trialInstallYmd =
      typeof o.trialInstallYmd === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.trialInstallYmd)
        ? o.trialInstallYmd
        : undefined;
    const perpetualLicensed =
      typeof o.perpetualLicensed === 'boolean' ? o.perpetualLicensed : undefined;
    return { trialInstallYmd, perpetualLicensed };
  } catch {
    return {};
  }
}

function persistV1(next: StoredLicenseV1) {
  const ls = window.localStorage;
  ls.setItem(LS_LICENSE_V1, JSON.stringify(next));
}

/**
 * מאחד v1 מהדיסק + מפתחות ישנים. אם יש ישנים — כותב v1 פעם אחת ומוחק אותם (מיגציה).
 */
function readMergedLicense(): StoredLicenseV1 {
  if (typeof window === 'undefined') return {};
  try {
    const ls = window.localStorage;
    const fromDisk = readParsedV1(ls.getItem(LS_LICENSE_V1));

    const legacyInstallRaw = ls.getItem(LS_LEGACY_INSTALL_YMD);
    const legacyInstall =
      legacyInstallRaw && /^\d{4}-\d{2}-\d{2}$/.test(legacyInstallRaw) ? legacyInstallRaw : undefined;
    const legacyPerm = ls.getItem(LS_LEGACY_PERPETUAL) === '1';

    const merged: StoredLicenseV1 = {
      trialInstallYmd: fromDisk.trialInstallYmd ?? legacyInstall,
      perpetualLicensed: Boolean(fromDisk.perpetualLicensed) || legacyPerm,
    };

    const hasLegacy =
      ls.getItem(LS_LEGACY_INSTALL_YMD) !== null || ls.getItem(LS_LEGACY_PERPETUAL) !== null;

    if (hasLegacy) {
      persistV1(merged);
      stripLegacyKeys(ls);
    }

    return merged;
  } catch {
    return {};
  }
}

export function readWebLicensedFlag(): boolean {
  try {
    return readMergedLicense().perpetualLicensed === true;
  } catch {
    return false;
  }
}

export function writeWebLicensedFlag(): void {
  try {
    const cur = readMergedLicense();
    const next: StoredLicenseV1 = {
      ...cur,
      perpetualLicensed: true,
    };
    persistV1(next);
    stripLegacyKeys(window.localStorage);
  } catch {
    /* ignore quota / privacy mode */
  }
}

export function getOrCreateWebInstallYmd(): string {
  try {
    const cur = readMergedLicense();
    if (cur.trialInstallYmd && /^\d{4}-\d{2}-\d{2}$/.test(cur.trialInstallYmd)) {
      return cur.trialInstallYmd;
    }
    const ymd = toYmdUtc(Date.now());
    persistV1({ ...cur, trialInstallYmd: ymd });
    stripLegacyKeys(window.localStorage);
    return ymd;
  } catch {
    return toYmdUtc(Date.now());
  }
}
