import { createRandom, hashString, seededShuffle } from '@/lib/random';
import { walkingMinutes } from '@/lib/geo';
import { CATEGORY_LABEL, type Restaurant } from '@/types/restaurant';

export type SoloMethod =
  /** 직접 플레이하는 방식 */
  | 'worldcup'
  | 'swipe'
  | 'ladder'
  /** 누르면 바로 결과가 나오는 방식 */
  | 'roulette'
  | 'fate'
  | 'category'
  | 'best'
  | 'popular';

export interface SoloMethodMeta {
  id: SoloMethod;
  title: string;
  blurb: string;
  emoji: string;
  /**
   * play   — 화면에서 직접 고르거나 조작한다. 결과를 내가 만든다.
   * instant — 누르면 바로 결정된다. 맡기는 쪽.
   */
  kind: 'play' | 'instant';
  /** 이 방식이 성립하려면 필요한 최소 후보 수 */
  minCandidates: number;
}

/**
 * 혼자 정할 때 고를 수 있는 방식.
 *
 * 앞의 셋은 실제로 플레이한다 — 내가 고른 결과가 나온다.
 * 뒤의 다섯은 맡기는 쪽이다. 목록에서 두 묶음을 나눠 보여줘서,
 * "어차피 다 랜덤" 으로 보이지 않게 한다.
 */
export const SOLO_METHODS: SoloMethodMeta[] = [
  { id: 'worldcup', title: '음식 월드컵', blurb: '둘 중 하나씩 골라 결승까지', emoji: '🏆', kind: 'play', minCandidates: 4 },
  { id: 'swipe', title: '넘기기', blurb: '한 장씩 넘기다 마음에 들면 멈추기', emoji: '💘', kind: 'play', minCandidates: 3 },
  { id: 'ladder', title: '사다리 타기', blurb: '줄 하나 고르고 따라 내려가기', emoji: '🪜', kind: 'play', minCandidates: 3 },
  { id: 'roulette', title: '랜덤 룰렛', blurb: '조건 안에서 아무거나', emoji: '🎰', kind: 'instant', minCandidates: 1 },
  { id: 'fate', title: '오늘의 운명', blurb: '오늘은 여기로 정해져 있어요', emoji: '🍀', kind: 'instant', minCandidates: 1 },
  { id: 'category', title: '카테고리 뽑기', blurb: '종류부터 정하고 고르기', emoji: '🎲', kind: 'instant', minCandidates: 1 },
  { id: 'best', title: '조건 추천', blurb: '예산·거리·평점 종합', emoji: '🎯', kind: 'instant', minCandidates: 1 },
  { id: 'popular', title: '근처 인기', blurb: '평점 높은 순으로', emoji: '🔥', kind: 'instant', minCandidates: 1 },
];

export function soloMethod(id: SoloMethod): SoloMethodMeta {
  return SOLO_METHODS.find((m) => m.id === id) ?? SOLO_METHODS[0];
}

/** 직접 플레이하는 방식인지 */
export function isPlayable(id: SoloMethod): boolean {
  return soloMethod(id).kind === 'play';
}

/**
 * 종류가 골고루 섞인 후보를 고른다.
 *
 * 그냥 가까운 순으로 자르면 같은 골목의 비슷한 가게만 올라온다. 카테고리별로
 * 돌아가며 가까운 순으로 한 곳씩 뽑아, 고를 맛이 있는 판을 만든다.
 */
export function diversePool(candidates: Restaurant[], size: number, seed: number): Restaurant[] {
  const byCategory = new Map<string, Restaurant[]>();
  for (const restaurant of [...candidates].sort((a, b) => a.distance - b.distance)) {
    const list = byCategory.get(restaurant.category) ?? [];
    list.push(restaurant);
    byCategory.set(restaurant.category, list);
  }

  // 시작 카테고리를 시드로 돌려 매번 같은 조합이 나오지 않게 한다
  const groups = seededShuffle([...byCategory.values()], seed);
  const picked: Restaurant[] = [];

  for (let round = 0; picked.length < size; round += 1) {
    const before = picked.length;
    for (const group of groups) {
      if (picked.length >= size) break;
      const next = group[round];
      if (next) picked.push(next);
    }
    if (picked.length === before) break; // 더 뽑을 게 없다
  }

  return picked;
}

export interface SoloPick {
  winner: Restaurant;
  /** 왜 이 집이 나왔는지 한 줄 */
  reason: string;
}

/**
 * 결정 방식별 선택 로직.
 * 식당을 새로 만들지 않고 주어진 후보 안에서만 고른다.
 */
export function pickRestaurant(
  method: SoloMethod,
  candidates: Restaurant[],
  seed: number,
  budget: number,
): SoloPick | null {
  if (candidates.length === 0) return null;

  switch (method) {
    // 직접 플레이하는 방식은 화면에서 결정한다 — 여기서는 고르지 않는다
    case 'worldcup':
    case 'swipe':
    case 'ladder':
      return null;

    case 'roulette': {
      const pool = candidates.slice(0, 12);
      const rand = createRandom(seed);
      const winner = pool[Math.floor(rand() * pool.length)];
      return { winner, reason: `주변 ${candidates.length}곳 중에서 뽑았어요` };
    }

    case 'fate': {
      // 같은 날·같은 조건이면 항상 같은 집 — "오늘은 여기"라는 느낌
      const today = new Date().toISOString().slice(0, 10);
      const daySeed = hashString(`${today}:${candidates.map((c) => c.id).join(',')}`);
      const rand = createRandom(daySeed);
      const winner = candidates[Math.floor(rand() * candidates.length)];
      return { winner, reason: '오늘 당신의 한 끼로 정해졌어요' };
    }

    case 'category': {
      const categories = [...new Set(candidates.map((c) => c.category))];
      const rand = createRandom(seed);
      const category = categories[Math.floor(rand() * categories.length)];
      const pool = candidates.filter((c) => c.category === category);
      const winner = pool[Math.floor(rand() * pool.length)];
      return { winner, reason: `오늘의 종류는 ${CATEGORY_LABEL[category]}` };
    }

    case 'best': {
      const ranked = [...candidates].sort((a, b) => score(b, budget) - score(a, budget));
      const winner = ranked[0];
      const hasScores = candidates.some((c) => c.rating > 0 || c.priceRange > 0);
      return {
        winner,
        reason: hasScores
          ? `예산·거리·평점을 종합하면 여기 (걸어서 ${walkingMinutes(winner.distance)}분)`
          : `조건 안에서 가장 가까워요 (걸어서 ${walkingMinutes(winner.distance)}분)`,
      };
    }

    case 'popular':
    default: {
      const ranked = [...candidates].sort(
        (a, b) => b.rating - a.rating || a.distance - b.distance,
      );
      const winner = ranked[0];
      return {
        winner,
        reason:
          winner.rating > 0
            ? `주변에서 평점이 가장 높아요 (⭐ ${winner.rating.toFixed(1)})`
            : '주변에서 가장 가까운 인기 식당',
      };
    }
  }
}

function score(restaurant: Restaurant, budget: number): number {
  // 모르는 값(평점 0 / 가격 0 / isOpen null)은 점수에 넣지 않는다.
  // 데이터가 없는 소스에서는 사실상 거리 기준으로 정렬된다.
  let value = restaurant.rating * 10;
  if (restaurant.priceRange > 0) value += restaurant.priceRange <= budget ? 12 : -14;
  value += Math.max(0, 14 - restaurant.distance / 100);
  if (restaurant.isOpen === true) value += 10;
  else if (restaurant.isOpen === false) value -= 20;
  return value;
}

/** 결과 공개 전 화면에 빠르게 지나갈 후보 순서 */
export function reelOrder(candidates: Restaurant[], seed: number): Restaurant[] {
  return seededShuffle(candidates, seed).slice(0, 10);
}
