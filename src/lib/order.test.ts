import { describe, expect, it } from 'vitest';
import { byOrder, moveInOrder } from './order';

const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

describe('moveInOrder', () => {
  it('moves an item and renumbers, repairing duplicate sortOrders', () => {
    // Two habits share sortOrder 1, as happens when they're added on different devices.
    const list = [
      { id: 'snack', sortOrder: 1 },
      { id: 'protein', sortOrder: 1 },
      { id: 'steps', sortOrder: 2 },
    ];
    const before = [...list].sort(byOrder);
    expect(ids(before)).toEqual(['protein', 'snack', 'steps']); // tie broken by id

    const changes = moveInOrder(list, 'snack', -1)!;
    const after = list.map((x) => ({ ...x, sortOrder: changes.find((c) => c.item.id === x.id)?.sortOrder ?? x.sortOrder })).sort(byOrder);
    expect(ids(after)).toEqual(['snack', 'protein', 'steps']);
    expect(new Set(after.map((x) => x.sortOrder)).size).toBe(3);
  });

  it('refuses moves past either end', () => {
    const list = [{ id: 'a', sortOrder: 0 }, { id: 'b', sortOrder: 1 }];
    expect(moveInOrder(list, 'a', -1)).toBeNull();
    expect(moveInOrder(list, 'b', 1)).toBeNull();
  });

  it('only returns items whose position actually changes', () => {
    const list = [{ id: 'a', sortOrder: 0 }, { id: 'b', sortOrder: 1 }, { id: 'c', sortOrder: 2 }];
    expect(moveInOrder(list, 'c', -1)!.map((c) => [c.item.id, c.sortOrder])).toEqual([['c', 1], ['b', 2]]);
  });
});
