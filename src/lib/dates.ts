/** Local-date helpers (dates are stored as YYYY-MM-DD strings, no timezone shifts). */
export function ymd(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseYmd(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s: string, n: number): string {
  const d = parseYmd(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
}

export function monthRange(month: string): { from: string; to: string; days: string[] } {
  // month = YYYY-MM
  const [y, m] = month.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  const days = Array.from({ length: last }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
  return { from: days[0], to: days[days.length - 1], days };
}

export function fmtDate(s: string | null | undefined): string {
  if (!s) return '—';
  return parseYmd(s.slice(0, 10)).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function fmtMonth(month: string): string {
  return parseYmd(`${month}-01`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}
