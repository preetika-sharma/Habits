import { describe, expect, it } from 'vitest';
import { addDays, isoWeek, weekStartOf } from './dates';
import { Scorer, canEdit } from './scoring';
import { checkInId, DEFAULT_SETTINGS, type AppData, type Habit, type Subtask } from './types';

const habit = (id: string, type: Habit['type'], createdOn: string, extra: Partial<Habit> = {}): Habit => ({
  id, name: id, color: '#000', type, sortOrder: 0, createdOn, archivedOn: null, sourceTemplateHabitId: null, ...extra,
});
const sub = (id: string, habitId: string, createdOn: string, archivedOn: string | null = null): Subtask => ({
  id, habitId, name: id, sortOrder: 0, createdOn, archivedOn,
});
const ci = (habitId: string, date: string, subtaskId = '') => ({ id: checkInId(habitId, subtaskId, date), habitId, subtaskId, date });

function data(p: Partial<AppData>): AppData {
  return { habits: [], subtasks: [], targets: [], checkIns: [], settings: DEFAULT_SETTINGS, ...p };
}

// 2026-10-26 is a Monday.
const MON = '2026-10-26';

describe('dates', () => {
  it('weeks start on Monday', () => {
    expect(weekStartOf('2026-11-01')).toBe(MON); // Sunday
    expect(weekStartOf(MON)).toBe(MON);
    expect(weekStartOf('2026-11-02')).toBe('2026-11-02');
  });
  it('computes ISO week numbers', () => {
    expect(isoWeek(MON)).toBe(44);
    expect(isoWeek('2026-01-01')).toBe(1);
  });
});

describe('subtasks', () => {
  const h = habit('m', 'daily', MON);
  const subs = [sub('a', 'm', MON), sub('b', 'm', MON)];
  it('parent is done only when all subtasks are checked', () => {
    const s1 = new Scorer(data({ habits: [h], subtasks: subs, checkIns: [ci('m', MON, 'a')] }));
    expect(s1.isDone(h, MON)).toBe(false);
    expect(s1.subtaskProgress(h, MON)).toEqual({ done: 1, total: 2 });
    const s2 = new Scorer(data({ habits: [h], subtasks: subs, checkIns: [ci('m', MON, 'a'), ci('m', MON, 'b')] }));
    expect(s2.isDone(h, MON)).toBe(true);
  });
  it('subtask changes only apply from their date on', () => {
    const tue = addDays(MON, 1);
    const withNew = [...subs, sub('c', 'm', tue)];
    const s = new Scorer(data({ habits: [h], subtasks: withNew, checkIns: [ci('m', MON, 'a'), ci('m', MON, 'b')] }));
    expect(s.isDone(h, MON)).toBe(true); // c didn't exist on Monday
    const archived = [sub('a', 'm', MON, tue), sub('b', 'm', MON)];
    const s2 = new Scorer(data({ habits: [h], subtasks: archived, checkIns: [ci('m', tue, 'b')] }));
    expect(s2.isDone(h, tue)).toBe(true); // a was removed on Tuesday
  });
});

describe('daily score and day streak', () => {
  const w = habit('w', 'daily', MON);
  const r = habit('r', 'daily', MON);
  const run = habit('run', 'weekly', MON);
  it('ignores weekly habits and respects the threshold', () => {
    const d = data({ habits: [w, r, run], checkIns: [ci('w', MON), ci('run', MON)] });
    expect(new Scorer(d).dailyScore(MON)).toBe(0.5);
    expect(new Scorer(d).dayHit(MON)).toBe(false);
    expect(new Scorer({ ...d, settings: { ...DEFAULT_SETTINGS, dailyThreshold: 50 } }).dayHit(MON)).toBe(true);
  });
  it('habits added mid-week are only due from their creation date', () => {
    const late = habit('late', 'daily', addDays(MON, 2));
    const s = new Scorer(data({ habits: [w, late], checkIns: [ci('w', MON)] }));
    expect(s.dailyScore(MON)).toBe(1);
  });
  it("today doesn't break the day streak until it ends", () => {
    const days = [0, 1, 2].map((i) => addDays(MON, i));
    const checks = days.flatMap((d) => [ci('w', d), ci('r', d)]);
    const today = addDays(MON, 3);
    const s = new Scorer(data({ habits: [w, r], checkIns: checks }));
    expect(s.dayStreak(today)).toBe(3);
    const s2 = new Scorer(data({ habits: [w, r], checkIns: [...checks, ci('w', today), ci('r', today)] }));
    expect(s2.dayStreak(today)).toBe(4);
  });
});

describe('habit streaks', () => {
  it('counts consecutive daily check-ins and the best run', () => {
    const h = habit('h', 'daily', MON);
    const checks = [0, 1, 3, 4, 5].map((i) => ci('h', addDays(MON, i)));
    const s = new Scorer(data({ habits: [h], checkIns: checks }));
    expect(s.dailyStreak(h, addDays(MON, 6))).toBe(3);
    expect(s.dailyStreak(h, addDays(MON, 7))).toBe(0);
    expect(s.bestDailyStreak(h, addDays(MON, 7))).toBe(3);
  });
  it('weekly streaks count weeks that hit the target, using the target in effect that week', () => {
    const h = habit('run', 'weekly', addDays(MON, -14));
    const targets = [
      { id: '1', habitId: 'run', weekStart: addDays(MON, -14), target: 2 },
      { id: '2', habitId: 'run', weekStart: MON, target: 3 },
    ];
    const checks = [
      ci('run', addDays(MON, -14)), ci('run', addDays(MON, -13)), // week -2: 2/2 hit
      ci('run', addDays(MON, -7)), ci('run', addDays(MON, -6)), // week -1: 2/2 hit
      ci('run', MON), ci('run', addDays(MON, 1)), // this week: 2/3 so far
    ];
    const s = new Scorer(data({ habits: [h], targets, checkIns: checks }));
    const today = addDays(MON, 2);
    expect(s.targetFor('run', addDays(MON, -7))).toBe(2);
    expect(s.targetFor('run', MON)).toBe(3);
    expect(s.weeklyCount(h, MON)).toBe(2);
    expect(s.weeklyStreak(h, today)).toBe(2); // current week still open
    const s2 = new Scorer(data({ habits: [h], targets, checkIns: [...checks, ci('run', today)] }));
    expect(s2.weeklyStreak(h, today)).toBe(3);
    expect(s2.bestWeeklyStreak(h, today)).toBe(3);
  });
});

describe('editing window', () => {
  it('allows only the current week up to today', () => {
    const today = addDays(MON, 3);
    expect(canEdit(MON, today)).toBe(true);
    expect(canEdit(today, today)).toBe(true);
    expect(canEdit(addDays(today, 1), today)).toBe(false);
    expect(canEdit(addDays(MON, -1), today)).toBe(false);
  });
});
