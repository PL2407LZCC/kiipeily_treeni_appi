/** Aikaleima- ja päivämääräapurit (ISO-muoto). */

/** ISO-datetime nyt, esim. 2026-06-23T12:34:56.000Z. */
export function nowIso(): string {
  return new Date().toISOString();
}

/** Paikallinen ISO-päivä YYYY-MM-DD. */
export function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Paikallinen ISO-päivä N päivää sitten (YYYY-MM-DD). */
export function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Muotoile ISO-päivä suomalaiseen muotoon, esim. "23.6.2026". */
export function formatDateFi(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  return `${Number(d)}.${Number(m)}.${y}`;
}

/** Muotoile ISO-datetime kellonajaksi "12:34". */
export function formatTimeFi(iso: string): string {
  const d = new Date(iso);
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${min}`;
}
