/**
 * Ensures this checkout is the `hebrew-calendar-2026` monorepo (shared `src/` next to `hebrew-calendar-suite/`).
 * Vite alias `@hc2026-root` points at that `src` tree; standalone `hebrew-calendar-suite` clones won't have it.
 */
const fs = require('fs');
const path = require('path');
const marker = path.resolve(__dirname, '..', '..', 'src', 'utils', 'webTrialLicense.ts');
if (!fs.existsSync(marker)) {
  console.error(
    '[verify-2026-layout] Expected file missing:\n  ' +
      marker +
      '\nDeploy the `hebrew-calendar-2026` repo with Root Directory `hebrew-calendar-suite` (not the suite-only repo).',
  );
  process.exit(1);
}
