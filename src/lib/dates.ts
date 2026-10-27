import type { ISODate } from './types';

const pad = (n: number) => String(n).padStart(2, '0');

export function toISO(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseISO(s: ISODate): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayISO(): ISODate {
  return toISO(new Date());
}

export function addDays(s: ISODate, n: number): ISODate {
  const d = parseISO(s);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

/** Monday of the week containing `s`. */
export function weekStartOf(s: ISODate): ISODate {
  const dow = (parseISO(s).getDay() + 6) % 7;
  return addDays(s, -dow);
}

export function weekDays(weekStart: ISODate): ISODate[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

/** ISO-8601 week number. */
export function isoWeek(s: ISODate): number {
  const d = parseISO(s);
  const thursday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const jan4 = new Date(thursday.getFullYear(), 0, 4);
  return 1 + Math.round(((thursday.getTime() - jan4.getTime()) / 864e5 - 3 + ((jan4.getDay() + 6) % 7)) / 7);
}

export const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
export const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function formatDay(s: ISODate, opts: Intl.DateTimeFormatOptions): string {
  return parseISO(s).toLocaleDateString(undefined, opts);
}

/** "Oct 26 – Nov 1" */
export function formatWeekRange(weekStart: ISODate): string {
  const end = addDays(weekStart, 6);
  const sameMonth = parseISO(weekStart).getMonth() === parseISO(end).getMonth();
  const a = formatDay(weekStart, { month: 'short', day: 'numeric' });
  const b = sameMonth ? formatDay(end, { day: 'numeric' }) : formatDay(end, { month: 'short', day: 'numeric' });
  return `${a} – ${b}`;
}
