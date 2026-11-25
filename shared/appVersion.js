// The bundled iPhone app's over-the-air versions (src/lib/appUpdates.js). No imports, so the tests can load it.

/**
 * Versions are 1.YYYYMMDD.HHMMSS (vite.config.js), so newer builds compare higher. Only newer ones
 * are taken: a TestFlight build made from code that isn't deployed yet must not swap itself back to
 * the older live copy. (A rollback deploy is a new build, so it still gets a newer version.)
 */
export function isNewerVersion(candidate, current) {
  const parts = (version) => String(version).split(".").map((part) => Number(part));
  const a = parts(candidate);
  const b = parts(current);
  if (a.some(Number.isNaN)) return false;
  if (b.some(Number.isNaN)) return true;
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  }
  return false;
}
