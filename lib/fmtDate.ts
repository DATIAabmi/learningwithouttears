/** Format a YYYY-MM-DD (or ISO) date string as MM-DD-YY. */
export function fmtDate(v: unknown): string {
  if (!v) return "—";
  const s = String(v);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[2]}-${m[3]}-${m[1].slice(2)}`;
  return s;
}
