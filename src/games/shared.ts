import type { Restaurant } from '@/types/restaurant';

export function findRestaurant(candidates: Restaurant[], id: string | null): Restaurant | null {
  if (!id) return null;
  return candidates.find((c) => c.id === id) ?? null;
}

/** 후보 id 배열 → 식당 배열 (없는 id 는 제외) */
export function resolveAll(candidates: Restaurant[], ids: string[]): Restaurant[] {
  return ids
    .map((id) => candidates.find((c) => c.id === id))
    .filter((r): r is Restaurant => Boolean(r));
}
