import Dexie, { type Table } from 'dexie';
import { weekStartOf } from './lib/dates';
import type { Kind, OutboxEntry } from './lib/sync';
import {
  checkInId, DEFAULT_SETTINGS,
  type AppData, type CheckIn, type Habit, type HabitType, type ISODate, type Settings, type Subtask, type TargetHistory,
} from './lib/types';

interface Meta {
  key: 'ownerId' | 'lastPulledAt' | 'lastSyncedAt';
  value: string;
}

class HabitDB extends Dexie {
  habits!: Table<Habit, string>;
  subtasks!: Table<Subtask, string>;
  targets!: Table<TargetHistory, string>;
  checkIns!: Table<CheckIn, string>;
  settings!: Table<Settings, string>;
  /** Local changes not yet pushed to the server, in order. */
  outbox!: Table<OutboxEntry, number>;
  meta!: Table<Meta, string>;

  constructor() {
    super('habit-tracker');
    this.version(1).stores({
      habits: 'id, sortOrder',
      subtasks: 'id, habitId',
      targets: 'id, habitId',
      checkIns: 'id, habitId, date',
      settings: 'id',
    });
    this.version(2).stores({
      outbox: '++seq, [kind+id]',
      meta: 'key',
    });
  }
}

export const db = new HabitDB();

const DATA_TABLES = ['habits', 'subtasks', 'targets', 'checkIns', 'settings'] as const satisfies readonly Kind[];

export function dataTable(kind: Kind): Table<{ id: string }, string> {
  return db[kind] as unknown as Table<{ id: string }, string>;
}

const uuid = () => crypto.randomUUID();

// ---- Change notifications (the sync engine listens to push soon after a local write) ----

const listeners = new Set<() => void>();
export function onLocalChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Runs `fn` in one transaction over all data tables + outbox, then notifies listeners. */
async function mutate(fn: () => Promise<void>): Promise<void> {
  await db.transaction('rw', [...DATA_TABLES.map(dataTable), db.outbox], fn);
  listeners.forEach((l) => l());
}

// Inside `mutate` only: write locally and queue the change for the server.
async function put<T extends { id: string }>(kind: Kind, row: T): Promise<void> {
  await dataTable(kind).put(row);
  await db.outbox.add({ kind, id: row.id, deleted: false, data: row });
}
async function remove(kind: Kind, id: string): Promise<void> {
  await dataTable(kind).delete(id);
  await db.outbox.add({ kind, id, deleted: true, data: null });
}
async function patch<T extends { id: string }>(kind: Kind, id: string, changes: Partial<T>): Promise<void> {
  const row = (await dataTable(kind).get(id)) as T | undefined;
  if (row) await put(kind, { ...row, ...changes });
}

// ---- Reads ----

export async function loadAll(): Promise<AppData> {
  const [habits, subtasks, targets, checkIns, settings] = await Promise.all([
    db.habits.toArray(), db.subtasks.toArray(), db.targets.toArray(), db.checkIns.toArray(), db.settings.get('settings'),
  ]);
  return { habits, subtasks, targets, checkIns, settings: settings ?? DEFAULT_SETTINGS };
}

// ---- Writes ----

export async function toggleCheck(habitId: string, subtaskId: string, date: ISODate): Promise<void> {
  const id = checkInId(habitId, subtaskId, date);
  await mutate(async () => {
    if (await db.checkIns.get(id)) await remove('checkIns', id);
    else await put<CheckIn>('checkIns', { id, habitId, subtaskId, date });
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
  await mutate(async () => {
    const last = await db.habits.orderBy('sortOrder').last();
    await put<Habit>('habits', {
      id, name: input.name.trim(), color: input.color, type: input.type,
      sortOrder: (last?.sortOrder ?? 0) + 1, createdOn: today, archivedOn: null, sourceTemplateHabitId: null,
    });
    for (const [i, s] of input.subtasks.entries()) {
      await put<Subtask>('subtasks', { id: uuid(), habitId: id, name: s.name.trim(), sortOrder: i, createdOn: today, archivedOn: null });
    }
    if (input.type === 'weekly') {
      const ws = weekStartOf(today);
      await put<TargetHistory>('targets', { id: `${id}|${ws}`, habitId: id, weekStart: ws, target: input.target });
    }
  });
  return id;
}

/** Applies edits from today on; past days keep their recorded result. Type can't change. */
export async function updateHabit(id: string, input: HabitInput, today: ISODate): Promise<void> {
  await mutate(async () => {
    const habit = await db.habits.get(id);
    if (!habit) return;
    await put<Habit>('habits', { ...habit, name: input.name.trim(), color: input.color });

    if (habit.type === 'weekly') {
      const ws = weekStartOf(today);
      await put<TargetHistory>('targets', { id: `${id}|${ws}`, habitId: id, weekStart: ws, target: input.target });
    }

    const existing = (await db.subtasks.where('habitId').equals(id).toArray()).filter((s) => !s.archivedOn || s.archivedOn > today);
    const keep = new Set(input.subtasks.map((s) => s.id).filter(Boolean));
    for (const s of existing) {
      if (keep.has(s.id)) continue;
      // Removed: drop it entirely if it was created today, otherwise archive it to keep history.
      if (s.createdOn === today) await remove('subtasks', s.id);
      else await put<Subtask>('subtasks', { ...s, archivedOn: today });
    }
    for (const [i, s] of input.subtasks.entries()) {
      if (s.id) await patch<Subtask>('subtasks', s.id, { name: s.name.trim(), sortOrder: i });
      else await put<Subtask>('subtasks', { id: uuid(), habitId: id, name: s.name.trim(), sortOrder: i, createdOn: today, archivedOn: null });
    }
  });
}

export async function archiveHabit(id: string, today: ISODate): Promise<void> {
  await mutate(() => patch<Habit>('habits', id, { archivedOn: today }));
}

export async function deleteHabit(id: string): Promise<void> {
  await mutate(async () => {
    await remove('habits', id);
    for (const kind of ['subtasks', 'targets', 'checkIns'] as const) {
      const ids = await (db[kind] as Table<{ id: string; habitId: string }, string>).where('habitId').equals(id).primaryKeys();
      for (const k of ids) await remove(kind, k);
    }
  });
}

export async function moveHabit(id: string, direction: -1 | 1, today: ISODate): Promise<void> {
  await mutate(async () => {
    const target = await db.habits.get(id);
    if (!target) return;
    const list = (await db.habits.orderBy('sortOrder').toArray())
      .filter((h) => h.type === target.type && (!h.archivedOn || h.archivedOn > today));
    const i = list.findIndex((h) => h.id === id);
    const j = i + direction;
    if (j < 0 || j >= list.length) return;
    await put<Habit>('habits', { ...list[i], sortOrder: list[j].sortOrder });
    await put<Habit>('habits', { ...list[j], sortOrder: list[i].sortOrder });
  });
}

export async function updateSettings(changes: Partial<Omit<Settings, 'id'>>): Promise<void> {
  await mutate(async () => {
    const current = (await db.settings.get('settings')) ?? DEFAULT_SETTINGS;
    await put<Settings>('settings', { ...current, ...changes });
  });
}

const EXPORT_VERSION = 1;

export async function exportJSON(): Promise<string> {
  const data = await loadAll();
  return JSON.stringify({ app: 'habit-tracker', version: EXPORT_VERSION, exportedAt: new Date().toISOString(), data }, null, 2);
}

/** Replaces all habits and history with the contents of an export file (and syncs that replacement). */
export async function importJSON(text: string): Promise<void> {
  const parsed = JSON.parse(text);
  if (parsed?.app !== 'habit-tracker' || !parsed.data) throw new Error('This file is not a Habit Tracker export.');
  const d = parsed.data as AppData;
  for (const k of ['habits', 'subtasks', 'targets', 'checkIns'] as const) {
    if (!Array.isArray(d[k])) throw new Error(`The export is missing "${k}".`);
  }
  await mutate(async () => {
    for (const kind of DATA_TABLES) {
      for (const id of await dataTable(kind).toCollection().primaryKeys()) await remove(kind, id);
    }
    for (const kind of ['habits', 'subtasks', 'targets', 'checkIns'] as const) {
      for (const row of d[kind]) await put(kind, row);
    }
    await put<Settings>('settings', { ...DEFAULT_SETTINGS, ...(d.settings ?? {}), id: 'settings' });
  });
}

// ---- Sync support ----

export async function getMeta(key: Meta['key']): Promise<string | null> {
  return (await db.meta.get(key))?.value ?? null;
}
export async function setMeta(key: Meta['key'], value: string): Promise<void> {
  await db.meta.put({ key, value });
}

/**
 * Binds this device's data to a signed-in user.
 * - Never bound (data from before accounts): keep it and queue all of it for upload.
 * - Bound to someone else: wipe it, then the first pull downloads this user's data.
 */
export async function claimLocalData(userId: string): Promise<void> {
  const owner = await getMeta('ownerId');
  if (owner === userId) return;
  if (owner) {
    await clearLocal();
  } else {
    await db.transaction('rw', [...DATA_TABLES.map(dataTable), db.outbox], async () => {
      for (const kind of DATA_TABLES) {
        for (const row of await dataTable(kind).toArray()) await db.outbox.add({ kind, id: row.id, deleted: false, data: row });
      }
    });
  }
  await setMeta('ownerId', userId);
}

/** Removes everything stored on this device (used on sign-out and when another user signs in). */
export async function clearLocal(): Promise<void> {
  await db.transaction('rw', [...DATA_TABLES.map(dataTable), db.outbox, db.meta], async () => {
    await Promise.all([...DATA_TABLES.map((k) => dataTable(k).clear()), db.outbox.clear(), db.meta.clear()]);
  });
}
