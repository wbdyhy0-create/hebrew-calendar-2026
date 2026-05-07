/// <reference types="vite/client" />

declare const __APP_BUILD__: string;

declare global {
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
    };
  }
}

