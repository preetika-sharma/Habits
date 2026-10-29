import { addDays, weekDays, weekStartOf } from './dates';
import { byOrder } from './order';
import { checkInId, type AppData, type Habit, type ISODate, type Subtask } from './types';

/** Anything with an active date range. */
interface Dated {
  createdOn: ISODate;
  archivedOn: ISODate | null;
}

export function isActiveOn(x: Dated, d: ISODate): boolean {
  return x.createdOn <= d && (!x.archivedOn || d < x.archivedOn);
}

/** True when `d` is in the current week and not in the future. Past weeks are read-only. */
export function canEdit(d: ISODate, today: ISODate): boolean {
  return d <= today && weekStartOf(d) === weekStartOf(today);
}

/**
 * Pure scoring over a snapshot of the data. All rules from the PRD's
 * "Core concepts and rules" live here so they can be unit-tested.
 */
export class Scorer {
  private checked: Set<string>;
  private subsByHabit = new Map<string, Subtask[]>();
  private targetsByHabit = new Map<string, { weekStart: ISODate; target: number }[]>();

  constructor(private data: AppData) {
    this.checked = new Set(data.checkIns.map((c) => c.id));
    for (const s of [...data.subtasks].sort((a, b) => a.sortOrder - b.sortOrder)) {
      const list = this.subsByHabit.get(s.habitId) ?? [];
      list.push(s);
      this.subsByHabit.set(s.habitId, list);
    }
    for (const t of data.targets) {
      const list = this.targetsByHabit.get(t.habitId) ?? [];
      list.push(t);
      this.targetsByHabit.set(t.habitId, list);
    }
    for (const list of this.targetsByHabit.values()) list.sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  }

  get threshold(): number {
    return this.data.settings.dailyThreshold;
  }

  isChecked(habitId: string, subtaskId: string, d: ISODate): boolean {
    return this.checked.has(checkInId(habitId, subtaskId, d));
  }

  activeSubtasks(habitId: string, d: ISODate): Subtask[] {
    return (this.subsByHabit.get(habitId) ?? []).filter((s) => isActiveOn(s, d));
  }

  subtaskProgress(h: Habit, d: ISODate): { done: number; total: number } {
    const subs = this.activeSubtasks(h.id, d);
    return { done: subs.filter((s) => this.isChecked(h.id, s.id, d)).length, total: subs.length };
  }

  /** A habit with subtasks is done only when every subtask active that day is checked. */
  isDone(h: Habit, d: ISODate): boolean {
    const subs = this.activeSubtasks(h.id, d);
    if (subs.length) return subs.every((s) => this.isChecked(h.id, s.id, d));
    return this.isChecked(h.id, '', d);
  }

  habitsOn(d: ISODate, type?: Habit['type']): Habit[] {
    return this.data.habits
      .filter((h) => isActiveOn(h, d) && (!type || h.type === type))
      .sort(byOrder);
  }

  /** Fraction (0–1) of daily habits due on `d` that are done, or null when none are due. */
  dailyScore(d: ISODate): number | null {
    const due = this.habitsOn(d, 'daily');
    if (!due.length) return null;
    return due.filter((h) => this.isDone(h, d)).length / due.length;
  }

  dayHit(d: ISODate): boolean {
    const s = this.dailyScore(d);
    return s !== null && s * 100 >= this.threshold - 1e-9;
  }

  targetFor(habitId: string, weekStart: ISODate): number {
    const list = this.targetsByHabit.get(habitId) ?? [];
    let t = list[0]?.target ?? 1;
    for (const e of list) if (e.weekStart <= weekStart) t = e.target;
    return t;
  }

  weeklyCount(h: Habit, weekStart: ISODate): number {
    return weekDays(weekStart).filter((d) => isActiveOn(h, d) && this.isDone(h, d)).length;
  }

  weeklyHit(h: Habit, weekStart: ISODate): boolean {
    return this.weeklyCount(h, weekStart) >= this.targetFor(h.id, weekStart);
  }

  /** Consecutive done days ending today; today doesn't break the streak until it ends. */
  dailyStreak(h: Habit, today: ISODate): number {
    let d = this.isDone(h, today) ? today : addDays(today, -1);
    let n = 0;
    while (d >= h.createdOn && this.isDone(h, d)) {
      n++;
      d = addDays(d, -1);
    }
    return n;
  }

  bestDailyStreak(h: Habit, today: ISODate): number {
    let best = 0;
    let run = 0;
    for (let d = h.createdOn; d <= today; d = addDays(d, 1)) {
      run = this.isDone(h, d) ? run + 1 : 0;
      best = Math.max(best, run);
    }
    return best;
  }

  /** Consecutive weeks with the target hit; the current week doesn't break it until it ends. */
  weeklyStreak(h: Habit, today: ISODate): number {
    const first = weekStartOf(h.createdOn);
    let ws = weekStartOf(today);
    if (!this.weeklyHit(h, ws)) ws = addDays(ws, -7);
    let n = 0;
    while (ws >= first && this.weeklyHit(h, ws)) {
      n++;
      ws = addDays(ws, -7);
    }
    return n;
  }

  bestWeeklyStreak(h: Habit, today: ISODate): number {
    let best = 0;
    let run = 0;
    for (let ws = weekStartOf(h.createdOn); ws <= weekStartOf(today); ws = addDays(ws, 7)) {
      run = this.weeklyHit(h, ws) ? run + 1 : 0;
      best = Math.max(best, run);
    }
    return best;
  }

  /** Consecutive days hit (daily habits only). Today doesn't break it until it ends. */
  dayStreak(today: ISODate): number {
    const first = this.data.habits.filter((h) => h.type === 'daily').map((h) => h.createdOn).sort()[0];
    if (!first) return 0;
    let d = this.dayHit(today) ? today : addDays(today, -1);
    let n = 0;
    while (d >= first && this.dayHit(d)) {
      n++;
      d = addDays(d, -1);
    }
    return n;
  }
}
