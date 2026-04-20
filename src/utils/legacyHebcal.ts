import Hebcal from 'hebcal';

/**
 * The modern implementation uses `@hebcal/core`.
 * This module exists to ensure the legacy `hebcal` package is present/usable
 * (some projects still rely on it), per the requested stack.
 */
export function getLegacyHebcal(): unknown {
  return Hebcal;
}

