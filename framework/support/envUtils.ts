export function parseBooleanEnv(v: string | undefined, defaultValue = false): boolean {
  const raw = (v ?? '').toString().trim().toLowerCase();
  if (raw === 'true' || raw === '1' || raw === 'yes') return true;
  if (raw === 'false' || raw === '0' || raw === 'no') return false;
  return defaultValue;
}

export function parseStringEnv(v: string | undefined): string | undefined {
  return v === undefined ? undefined : v.toString().trim();
}
