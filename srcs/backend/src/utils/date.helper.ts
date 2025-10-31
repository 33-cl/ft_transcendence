/**
 * Formate une date pour SQLite
 * Format : YYYY-MM-DD HH:MM:SS (UTC)
 * @param d - Date à formater
 * @returns String formatée pour SQLite
 */
export function fmtSqliteDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}
