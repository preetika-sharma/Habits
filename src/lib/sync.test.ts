import { describe, expect, it } from 'vitest';
import { collapseOutbox, planPull, pullCursor, recordKey } from './sync';

describe('collapseOutbox', () => {
  it('keeps only the latest change per record and reports the highest seq', () => {
    const { records, maxSeq } = collapseOutbox([
      { seq: 1, kind: 'checkIns', id: 'a', deleted: false, data: { id: 'a' } },
      { seq: 2, kind: 'habits', id: 'h', deleted: false, data: { id: 'h', name: 'Run' } },
      { seq: 3, kind: 'checkIns', id: 'a', deleted: true, data: null },
      { seq: 4, kind: 'habits', id: 'h', deleted: false, data: { id: 'h', name: 'Run 5k' } },
    ]);
    expect(maxSeq).toBe(4);
    expect(records).toEqual([
      { kind: 'checkIns', id: 'a', data: null, deleted: true },
      { kind: 'habits', id: 'h', data: { id: 'h', name: 'Run 5k' }, deleted: false },
    ]);
  });

  it('treats the same id in different tables as different records', () => {
    const { records } = collapseOutbox([
      { seq: 1, kind: 'habits', id: 'x', deleted: false, data: { id: 'x' } },
      { seq: 2, kind: 'subtasks', id: 'x', deleted: false, data: { id: 'x' } },
    ]);
    expect(records).toHaveLength(2);
  });
});

describe('planPull', () => {
  it('puts live rows, deletes tombstones, and skips records with pending local changes', () => {
    const actions = planPull(
      [
        { kind: 'habits', id: 'h1', data: { id: 'h1' }, deleted: false },
        { kind: 'checkIns', id: 'c1', data: null, deleted: true },
        { kind: 'habits', id: 'h2', data: { id: 'h2', name: 'server' }, deleted: false },
      ],
      new Set([recordKey('habits', 'h2')]),
    );
    expect(actions).toEqual([
      { op: 'put', kind: 'habits', row: { id: 'h1' } },
      { op: 'delete', kind: 'checkIns', id: 'c1' },
    ]);
  });
});

describe('pullCursor', () => {
  it('starts from the epoch and otherwise backs off by the overlap', () => {
    expect(pullCursor(null)).toBe('1970-01-01T00:00:00.000Z');
    expect(pullCursor('2026-10-27T10:00:10.000Z', 10_000)).toBe('2026-10-27T10:00:00.000Z');
  });
});
