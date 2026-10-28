/** Local tables that sync to the server; also the `kind` column of `public.records`. */
export type Kind = 'habits' | 'subtasks' | 'targets' | 'checkIns' | 'settings';

export interface OutboxEntry {
  seq?: number;
  kind: Kind;
  id: string;
  deleted: boolean;
  data: unknown | null;
}

/** A row of `public.records` as the client sends and receives it. */
export interface RemoteRecord {
  user_id?: string;
  kind: Kind;
  id: string;
  data: unknown | null;
  deleted: boolean;
  updated_at?: string;
}

export const recordKey = (kind: Kind, id: string) => `${kind}|${id}`;

/**
 * Collapses queued changes to the latest per record, in order, so a record
 * toggled five times offline is sent once with its final state.
 */
export function collapseOutbox(entries: OutboxEntry[]): { records: RemoteRecord[]; maxSeq: number } {
  const latest = new Map<string, OutboxEntry>();
  let maxSeq = 0;
  for (const e of entries) {
    latest.delete(recordKey(e.kind, e.id)); // re-insert so Map order follows the latest change
    latest.set(recordKey(e.kind, e.id), e);
    maxSeq = Math.max(maxSeq, e.seq ?? 0);
  }
  const records = [...latest.values()].map((e) => ({ kind: e.kind, id: e.id, data: e.deleted ? null : e.data, deleted: e.deleted }));
  return { records, maxSeq };
}

export type PullAction =
  | { op: 'put'; kind: Kind; row: { id: string } }
  | { op: 'delete'; kind: Kind; id: string };

/**
 * Decides how to apply pulled server rows locally. Records with changes still
 * waiting to be pushed are skipped: the local edit is newer and will win when it's sent.
 */
export function planPull(remote: RemoteRecord[], pendingKeys: Set<string>): PullAction[] {
  const actions: PullAction[] = [];
  for (const r of remote) {
    if (pendingKeys.has(recordKey(r.kind, r.id))) continue;
    if (r.deleted || r.data == null) actions.push({ op: 'delete', kind: r.kind, id: r.id });
    else actions.push({ op: 'put', kind: r.kind, row: r.data as { id: string } });
  }
  return actions;
}

/**
 * Pull cursor with a safety overlap. Server timestamps come from concurrent
 * transactions that can commit slightly out of order; re-reading the last few
 * seconds is harmless because applying a row is idempotent.
 */
export function pullCursor(lastPulledAt: string | null, overlapMs = 10_000): string {
  if (!lastPulledAt) return new Date(0).toISOString();
  return new Date(Date.parse(lastPulledAt) - overlapMs).toISOString();
}
