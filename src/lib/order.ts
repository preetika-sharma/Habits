interface Ordered {
  id: string;
  sortOrder: number;
}

/** Display order: sortOrder, then id so habits that share a sortOrder (e.g. added on two devices) stay put. */
export const byOrder = (a: Ordered, b: Ordered) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id);

/**
 * Moves one item up (-1) or down (+1) and renumbers the list 0..n-1, so duplicate
 * sortOrders are repaired on the way. Returns only the items whose sortOrder changes,
 * or null when the move isn't possible.
 */
export function moveInOrder<T extends Ordered>(list: T[], id: string, direction: -1 | 1): { item: T; sortOrder: number }[] | null {
  const sorted = [...list].sort(byOrder);
  const i = sorted.findIndex((x) => x.id === id);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= sorted.length) return null;
  [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
  return sorted
    .map((item, k) => ({ item, sortOrder: k }))
    .filter(({ item, sortOrder }) => item.sortOrder !== sortOrder);
}

/**
 * If any items share a sortOrder, renumbers the whole list 0..n-1 in its current
 * display order. Returns the changes, or [] when every sortOrder is already unique.
 * Deterministic (byOrder breaks ties by id), so every device makes the same repair.
 */
export function repairOrder<T extends Ordered>(list: T[]): { item: T; sortOrder: number }[] {
  if (new Set(list.map((x) => x.sortOrder)).size === list.length) return [];
  return [...list].sort(byOrder)
    .map((item, k) => ({ item, sortOrder: k }))
    .filter(({ item, sortOrder }) => item.sortOrder !== sortOrder);
}
