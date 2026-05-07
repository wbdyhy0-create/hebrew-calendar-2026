/// <reference types="vite/client" />

declare global {
  const __APP_BUILD__: string;

  interface Window {
    HebrewGregorianDesktop?: {
      files?: {
        saveJson: (opts: { suggestedName?: string; content: string }) => Promise<
          | { ok: true; canceled: true }
          | { ok: true; canceled: false; filePath: string }
          | { ok: false; error: string }
        >;
        openJson: () => Promise<
          | { ok: true; canceled: true }
          | { ok: true; canceled: false; filePath: string; content: string }
          | { ok: false; error: string }
        >;
      };
      trial?: {
        getStatus: () => Promise<
          | {
              ok: true;
              enabled: boolean;
              trialDays: number;
              installYmd: string;
              nowYmd: string;
              daysUsed: number;
              daysLeft: number;
              expired: boolean;
            }
          | { ok: false; error: string }
        >;
      };
    };
  }
}

export {}

