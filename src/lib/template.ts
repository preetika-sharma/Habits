import type { HabitType } from './types';

/** One habit in the default list. Order in the array is the order new users get. */
export interface TemplateHabit {
  name: string;
  type: HabitType;
  /** Check-ins per week; only meaningful for weekly habits. */
  target: number;
  steps: string[];
}

/** Cleans up a list read from the server or edited in the app. Drops anything malformed. */
export function normalizeTemplate(raw: unknown): TemplateHabit[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((h): TemplateHabit[] => {
    if (!h || typeof h !== 'object') return [];
    const o = h as Record<string, unknown>;
    const name = typeof o.name === 'string' ? o.name.trim() : '';
    if (!name) return [];
    const type: HabitType = o.type === 'weekly' ? 'weekly' : 'daily';
    const target = type === 'weekly' ? Math.min(7, Math.max(1, Math.round(Number(o.target) || 1))) : 1;
    const steps = Array.isArray(o.steps)
      ? o.steps.filter((s): s is string => typeof s === 'string').map((s) => s.trim()).filter(Boolean)
      : [];
    return [{ name, type, target, steps }];
  });
}

/** One line per habit for summaries: "Run · 3× a week · 2 steps". */
export function describeTemplateHabit(h: TemplateHabit): string {
  const parts = [h.type === 'daily' ? 'every day' : `${h.target}× a week`];
  if (h.steps.length) parts.push(`${h.steps.length} step${h.steps.length === 1 ? '' : 's'}`);
  return parts.join(' · ');
}

/** "3 daily habits and 1 weekly target" */
export function summarizeTemplate(list: TemplateHabit[]): string {
  const daily = list.filter((h) => h.type === 'daily').length;
  const weekly = list.length - daily;
  const bits = [];
  if (daily) bits.push(`${daily} daily habit${daily === 1 ? '' : 's'}`);
  if (weekly) bits.push(`${weekly} weekly target${weekly === 1 ? '' : 's'}`);
  return bits.join(' and ') || 'no habits yet';
}
