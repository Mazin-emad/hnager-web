// Western digits (0123) everywhere, grouped with commas.

const groupFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});

export function fmtNum(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return groupFormatter.format(value);
}

export function fmtMoney(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${groupFormatter.format(value)} ج.م`;
}

/** "2026-09-12" -> "12/09/2026" */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const datePart = iso.slice(0, 10);
  const [y, m, d] = datePart.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

/** ISO datetime -> "12/09/2026 05:00" */
export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const time = iso.slice(11, 16);
  return time ? `${fmtDate(iso)} ${time}` : fmtDate(iso);
}

/** Today as YYYY-MM-DD for date inputs. */
export function todayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
