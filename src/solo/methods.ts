import { createRandom, hashString, seededShuffle } from '@/lib/random';
import { walkingMinutes } from '@/lib/geo';
import { CATEGORY_LABEL, type Restaurant } from '@/types/restaurant';

export type SoloMethod = 'roulette' | 'fate' | 'category' | 'best' | 'popular';

export interface SoloMethodMeta {
  id: SoloMethod;
  title: string;
  blurb: string;
  emoji: string;
}

/** 혼자 정할 때 고를 수 있는 결정 방식 */
export const SOLO_METHODS: SoloMethodMeta[] = [
  { id: 'roulette', title: '랜덤 룰렛', blurb: '조건 안에서 아무거나', emoji: '🎰' },
  { id: 'fate', title: '오늘의 운명', blurb: '오늘은 여기로 정해져 있어요', emoji: '🍀' },
  { id: 'category', title: '카테고리 뽑기', blurb: '종류부터 정하고 고르기', emoji: '🎲' },
  { id: 'best', title: '조건 추천', blurb: '예산·거리·평점 종합', emoji: '🎯' },
  { id: 'popular', title: '근처 인기', blurb: '평점 높은 순으로', emoji: '🔥' },
];

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
      return {
        winner,
        reason: `예산·거리·평점을 종합하면 여기 (걸어서 ${walkingMinutes(winner.distance)}분)`,
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
  let value = restaurant.rating * 10;
  if (restaurant.priceRange > 0) value += restaurant.priceRange <= budget ? 12 : -14;
  value += Math.max(0, 14 - restaurant.distance / 100);
  value += restaurant.isOpen ? 10 : -20;
  return value;
}

/** 결과 공개 전 화면에 빠르게 지나갈 후보 순서 */
export function reelOrder(candidates: Restaurant[], seed: number): Restaurant[] {
  return seededShuffle(candidates, seed).slice(0, 10);
}
