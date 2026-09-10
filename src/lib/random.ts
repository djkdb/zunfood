/**
 * 시드 기반 난수 (mulberry32).
 * 모든 참가자가 같은 결과를 보도록, 게임 결과는 항상 시드로부터 계산한다.
 */
export function createRandom(seed: number): () => number {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const rand = createRandom(seed);
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function seededPick<T>(items: readonly T[], seed: number): T {
  const rand = createRandom(seed);
  return items[Math.floor(rand() * items.length)];
}

/** 문자열 → 안정적인 정수 해시 (결정론적 mock 판결 등에 사용) */
export function hashString(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
