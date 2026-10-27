import Dexie, { type Table } from 'dexie';
import { weekStartOf } from './lib/dates';
import {
  checkInId, DEFAULT_SETTINGS,
  type AppData, type CheckIn, type Habit, type HabitType, type ISODate, type Settings, type Subtask, type TargetHistory,
} from './lib/types';

class HabitDB extends Dexie {
  habits!: Table<Habit, string>;
  subtasks!: Table<Subtask, string>;
  targets!: Table<TargetHistory, string>;
  checkIns!: Table<CheckIn, string>;
  settings!: Table<Settings, string>;

  constructor() {
    super('habit-tracker');
    this.version(1).stores({
      habits: 'id, sortOrder',
      subtasks: 'id, habitId',
      targets: 'id, habitId',
      checkIns: 'id, habitId, date',
      settings: 'id',
    });
  }
}

export const db = new HabitDB();

const uuid = () => crypto.randomUUID();

export async function loadAll(): Promise<AppData> {
  const [habits, subtasks, targets, checkIns, settings] = await Promise.all([
    db.habits.toArray(), db.subtasks.toArray(), db.targets.toArray(), db.checkIns.toArray(), db.settings.get('settings'),
  ]);
  return { habits, subtasks, targets, checkIns, settings: settings ?? DEFAULT_SETTINGS };
}

export async function toggleCheck(habitId: string, subtaskId: string, date: ISODate): Promise<void> {
  const id = checkInId(habitId, subtaskId, date);
  await db.transaction('rw', db.checkIns, async () => {
    if (await db.checkIns.get(id)) await db.checkIns.delete(id);
    else await db.checkIns.put({ id, habitId, subtaskId, date });
  });
}

export interface HabitInput {
  name: string;
  color: string;
  type: HabitType;
  target: number;
  /** Existing subtasks keep their id; new ones have none. Order = list order. */
  subtasks: { id?: string; name: string }[];
}

export async function createHabit(input: HabitInput, today: ISODate): Promise<string> {
  const id = uuid();
  await db.transaction('rw', db.habits, db.subtasks, db.targets, async () => {
    const last = await db.habits.orderBy('sortOrder').last();
    await db.habits.put({
      id, name: input.name.trim(), color: input.color, type: input.type,
      sortOrder: (last?.sortOrder ?? 0) + 1, createdOn: today, archivedOn: null, sourceTemplateHabitId: null,
    });
    await db.subtasks.bulkPut(input.subtasks.map((s, i) => ({
      id: uuid(), habitId: id, name: s.name.trim(), sortOrder: i, createdOn: today, archivedOn: null,
    })));
    if (input.type === 'weekly') {
      const ws = weekStartOf(today);
      await db.targets.put({ id: `${id}|${ws}`, habitId: id, weekStart: ws, target: input.target });
    }
  });
  return id;
}

/** Applies edits from today on; past days keep their recorded result. Type can't change. */
export async function updateHabit(id: string, input: HabitInput, today: ISODate): Promise<void> {
  await db.transaction('rw', db.habits, db.subtasks, db.targets, async () => {
    const habit = await db.habits.get(id);
    if (!habit) return;
    await db.habits.update(id, { name: input.name.trim(), color: input.color });

    if (habit.type === 'weekly') {
      const ws = weekStartOf(today);
      await db.targets.put({ id: `${id}|${ws}`, habitId: id, weekStart: ws, target: input.target });
    }

    const existing = (await db.subtasks.where('habitId').equals(id).toArray()).filter((s) => !s.archivedOn || s.archivedOn > today);
    const keep = new Set(input.subtasks.map((s) => s.id).filter(Boolean));
    for (const s of existing) {
      if (keep.has(s.id)) continue;
      // Removed: drop it entirely if it was created today, otherwise archive it to keep history.
      if (s.createdOn === today) await db.subtasks.delete(s.id);
      else await db.subtasks.update(s.id, { archivedOn: today });
    }
    for (const [i, s] of input.subtasks.entries()) {
      if (s.id) await db.subtasks.update(s.id, { name: s.name.trim(), sortOrder: i });
      else await db.subtasks.put({ id: uuid(), habitId: id, name: s.name.trim(), sortOrder: i, createdOn: today, archivedOn: null });
    }
  });
}

export async function archiveHabit(id: string, today: ISODate): Promise<void> {
  await db.habits.update(id, { archivedOn: today });
}

export async function deleteHabit(id: string): Promise<void> {
  await db.transaction('rw', db.habits, db.subtasks, db.targets, db.checkIns, async () => {
    await db.habits.delete(id);
    await db.subtasks.where('habitId').equals(id).delete();
    await db.targets.where('habitId').equals(id).delete();
    await db.checkIns.where('habitId').equals(id).delete();
  });
}

export async function moveHabit(id: string, direction: -1 | 1, today: ISODate): Promise<void> {
  await db.transaction('rw', db.habits, async () => {
    const target = await db.habits.get(id);
    if (!target) return;
    const list = (await db.habits.orderBy('sortOrder').toArray())
      .filter((h) => h.type === target.type && (!h.archivedOn || h.archivedOn > today));
    const i = list.findIndex((h) => h.id === id);
    const j = i + direction;
    if (j < 0 || j >= list.length) return;
    await db.habits.update(list[i].id, { sortOrder: list[j].sortOrder });
    await db.habits.update(list[j].id, { sortOrder: list[i].sortOrder });
  });
}

export async function updateSettings(patch: Partial<Omit<Settings, 'id'>>): Promise<void> {
  const current = (await db.settings.get('settings')) ?? DEFAULT_SETTINGS;
  await db.settings.put({ ...current, ...patch });
}

const EXPORT_VERSION = 1;

export async function exportJSON(): Promise<string> {
  const data = await loadAll();
  return JSON.stringify({ app: 'habit-tracker', version: EXPORT_VERSION, exportedAt: new Date().toISOString(), data }, null, 2);
}

/** Replaces all local data with the contents of an export file. */
export async function importJSON(text: string): Promise<void> {
  const parsed = JSON.parse(text);
  if (parsed?.app !== 'habit-tracker' || !parsed.data) throw new Error('This file is not a Habit Tracker export.');
  const d = parsed.data as AppData;
  for (const k of ['habits', 'subtasks', 'targets', 'checkIns'] as const) {
    if (!Array.isArray(d[k])) throw new Error(`The export is missing "${k}".`);
  }
  await db.transaction('rw', [db.habits, db.subtasks, db.targets, db.checkIns, db.settings], async () => {
    await Promise.all([db.habits.clear(), db.subtasks.clear(), db.targets.clear(), db.checkIns.clear(), db.settings.clear()]);
    await db.habits.bulkPut(d.habits);
    await db.subtasks.bulkPut(d.subtasks);
    await db.targets.bulkPut(d.targets);
    await db.checkIns.bulkPut(d.checkIns);
    await db.settings.put({ ...DEFAULT_SETTINGS, ...(d.settings ?? {}), id: 'settings' });
  });
}
