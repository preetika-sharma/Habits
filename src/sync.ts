import { useSyncExternalStore } from 'react';
import { claimLocalData, dataTable, db, getMeta, onLocalChange, setMeta } from './db';
import { collapseOutbox, planPull, pullCursor, recordKey, type RemoteRecord } from './lib/sync';
import { supabase } from './supabase';

export interface SyncState {
  phase: 'idle' | 'syncing' | 'offline' | 'error';
  /** Local changes not yet on the server. */
  pending: number;
  lastSyncedAt: string | null;
  error: string | null;
}

const PUSH_BATCH = 500;
const PULL_PAGE = 1000;
const POLL_MS = 60_000;

/**
 * Local-first sync: the app reads and writes IndexedDB only. This engine pushes
 * the outbox to `public.records` and pulls rows changed since the last pull.
 */
class SyncEngine {
  private state: SyncState = { phase: 'idle', pending: 0, lastSyncedAt: null, error: null };
  private listeners = new Set<() => void>();
  private userId: string | null = null;
  private running = false;
  private again = false;
  private timer: number | undefined;
  private cleanup: (() => void)[] = [];

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getState = () => this.state;

  private set(patch: Partial<SyncState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }

  /** Binds local data to the user, then syncs in the background. Resolves once the app can render. */
  async start(userId: string): Promise<void> {
    this.stop();
    this.userId = userId;
    await claimLocalData(userId);
    this.set({ pending: await db.outbox.count(), lastSyncedAt: await getMeta('lastSyncedAt'), error: null });

    const now = () => this.schedule(0);
    const onVisible = () => { if (document.visibilityState === 'visible') now(); };
    this.cleanup.push(onLocalChange(() => this.schedule(800)));
    window.addEventListener('online', now);
    document.addEventListener('visibilitychange', onVisible);
    const poll = window.setInterval(() => { if (document.visibilityState === 'visible') now(); }, POLL_MS);
    this.cleanup.push(() => {
      window.removeEventListener('online', now);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(poll);
    });
    now();
  }

  stop() {
    this.cleanup.forEach((c) => c());
    this.cleanup = [];
    window.clearTimeout(this.timer);
    this.userId = null;
  }

  schedule(delayMs: number) {
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => void this.sync(), delayMs);
  }

  async sync(): Promise<void> {
    if (!supabase || !this.userId) return;
    if (this.running) { this.again = true; return; }
    this.running = true;
    const userId = this.userId;
    try {
      if (!navigator.onLine) {
        this.set({ phase: 'offline', pending: await db.outbox.count() });
        return;
      }
      this.set({ phase: 'syncing' });
      await this.push(userId);
      await this.pull();
      const at = new Date().toISOString();
      await setMeta('lastSyncedAt', at);
      this.set({ phase: 'idle', lastSyncedAt: at, error: null, pending: await db.outbox.count() });
    } catch (e) {
      const offline = !navigator.onLine || (e instanceof TypeError && /fetch/i.test(e.message));
      this.set({
        phase: offline ? 'offline' : 'error',
        error: offline ? null : e instanceof Error ? e.message : String(e),
        pending: await db.outbox.count(),
      });
    } finally {
      this.running = false;
      if (this.again && this.userId) { this.again = false; this.schedule(0); }
    }
  }

  private async push(userId: string) {
    for (;;) {
      const entries = await db.outbox.orderBy('seq').limit(PUSH_BATCH).toArray();
      if (!entries.length) return;
      const { records, maxSeq } = collapseOutbox(entries);
      const { error } = await supabase!.from('records')
        .upsert(records.map((r) => ({ ...r, user_id: userId })), { onConflict: 'user_id,kind,id' });
      if (error) throw new Error(error.message);
      // Only drop what was sent; anything queued meanwhile has a higher seq and goes next round.
      await db.outbox.where('seq').belowOrEqual(maxSeq).delete();
    }
  }

  private async pull() {
    let cursor = pullCursor(await getMeta('lastPulledAt'));
    for (;;) {
      const { data, error } = await supabase!.from('records')
        .select('kind,id,data,deleted,updated_at')
        .gt('updated_at', cursor)
        .order('updated_at', { ascending: true })
        .limit(PULL_PAGE);
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as RemoteRecord[];
      if (!rows.length) return;

      await db.transaction('rw', [db.habits, db.subtasks, db.targets, db.checkIns, db.settings, db.outbox, db.meta], async () => {
        const pending = new Set((await db.outbox.toArray()).map((e) => recordKey(e.kind, e.id)));
        for (const a of planPull(rows, pending)) {
          if (a.op === 'put') await dataTable(a.kind).put(a.row);
          else await dataTable(a.kind).delete(a.id);
        }
        await setMeta('lastPulledAt', rows[rows.length - 1].updated_at!);
      });
      if (rows.length < PULL_PAGE) return;
      cursor = rows[rows.length - 1].updated_at!;
    }
  }
}

export const syncEngine = new SyncEngine();

export function useSyncState(): SyncState {
  return useSyncExternalStore(syncEngine.subscribe, syncEngine.getState);
}
