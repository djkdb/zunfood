import type { FoodCategory, Restaurant } from '@/types/restaurant';
import { CATEGORY_LABEL } from '@/types/restaurant';
import { walkingMinutes } from '@/lib/geo';
import { hashString } from '@/lib/random';
import type { JudgeProvider, JudgeRequest, JudgeVerdict, JudgeWish } from './JudgeProvider';

/** 자주 쓰는 음식 키워드 → 카테고리 매핑 (판결 근거 계산용) */
const KEYWORD_CATEGORY: [string, FoodCategory][] = [
  ['삼겹', 'meat'], ['고기', 'meat'], ['갈비', 'meat'], ['곱창', 'meat'],
  ['족발', 'meat'], ['보쌈', 'meat'], ['목살', 'meat'],
  ['치킨', 'chicken'], ['닭', 'chicken'], ['닭갈비', 'chicken'],
  ['마라', 'chinese'], ['짜장', 'chinese'], ['짬뽕', 'chinese'],
  ['탕수육', 'chinese'], ['양꼬치', 'chinese'], ['중식', 'chinese'],
  ['초밥', 'japanese'], ['스시', 'japanese'], ['라멘', 'japanese'],
  ['돈까스', 'japanese'], ['돈카츠', 'japanese'], ['우동', 'japanese'], ['일식', 'japanese'],
  ['파스타', 'western'], ['피자', 'western'], ['버거', 'western'],
  ['스테이크', 'western'], ['양식', 'western'],
  ['떡볶이', 'snack'], ['김밥', 'snack'], ['분식', 'snack'], ['토스트', 'snack'],
  ['국밥', 'korean'], ['백반', 'korean'], ['찌개', 'korean'],
  ['비빔밥', 'korean'], ['한식', 'korean'], ['해장', 'korean'],
  ['카페', 'cafe'], ['커피', 'cafe'], ['디저트', 'cafe'], ['브런치', 'cafe'],
  ['쌀국수', 'etc'], ['케밥', 'etc'], ['커리', 'etc'], ['샐러드', 'etc'],
];

const ANYTHING = ['아무거나', '아무', '상관없', '몰라', '알아서'];

/**
 * 결정론적 목업 판결.
 * 같은 입력이면 항상 같은 결과가 나오므로, 모든 참가자가 동일한 판결을 본다.
 */
export class MockJudgeProvider implements JudgeProvider {
  readonly source = 'mock';

  async judge(request: JudgeRequest): Promise<JudgeVerdict> {
    return computeVerdict(request);
  }
}

export function computeVerdict(request: JudgeRequest): JudgeVerdict {
  const { candidates, wishes, budget } = request;
  if (candidates.length === 0) {
    throw new Error('판결할 후보 식당이 없습니다.');
  }

  const parsedWishes = wishes.map((wish) => ({
    ...wish,
    isAnything: ANYTHING.some((word) => wish.text.includes(word)) || wish.text.trim() === '',
    categories: categoriesFor(wish.text),
  }));

  const scored = candidates.map((restaurant) => {
    let score = 0;
    const supporters: string[] = [];

    for (const wish of parsedWishes) {
      if (wish.isAnything) {
        score += 4; // 아무거나 = 약한 지지
        continue;
      }
      if (matchesText(restaurant, wish.text)) {
        score += 34;
        supporters.push(wish.nickname);
      } else if (wish.categories.includes(restaurant.category)) {
        score += 24;
        supporters.push(wish.nickname);
      }
    }

    // 예산 적합도
    if (restaurant.priceRange > 0) {
      score += restaurant.priceRange <= budget ? 14 : -18;
    }
    // 평점 / 거리 / 영업 여부
    score += restaurant.rating * 4;
    score += Math.max(0, 12 - restaurant.distance / 120);
    score += restaurant.isOpen ? 8 : -25;
    // 동점 방지를 위한 결정론적 흔들기
    score += (hashString(restaurant.id) % 100) / 100;

    return { restaurant, score, supporters: [...new Set(supporters)] };
  });

  scored.sort((a, b) => b.score - a.score);
  const winner = scored[0];

  return {
    restaurantId: winner.restaurant.id,
    headline: `오늘은 ${headlineFor(winner.restaurant)}입니다.`,
    reasons: buildReasons(winner, parsedWishes, budget),
    scores: scored.map((s) => ({ restaurantId: s.restaurant.id, score: Math.round(s.score) })),
  };
}

function headlineFor(restaurant: Restaurant): string {
  const signature = restaurant.menu[0]?.name;
  return signature ? `${signature}` : restaurant.name;
}

function matchesText(restaurant: Restaurant, text: string): boolean {
  const q = text.trim();
  if (q.length < 2) return false;
  const haystack = [restaurant.name, ...restaurant.tags, ...restaurant.menu.map((m) => m.name)]
    .join(' ');
  return haystack.includes(q) || q.split(/\s+/).some((t) => t.length >= 2 && haystack.includes(t));
}

function categoriesFor(text: string): FoodCategory[] {
  const hits = KEYWORD_CATEGORY.filter(([keyword]) => text.includes(keyword)).map(
    ([, category]) => category,
  );
  return [...new Set(hits)];
}

function buildReasons(
  winner: { restaurant: Restaurant; supporters: string[] },
  wishes: (JudgeWish & { isAnything: boolean })[],
  budget: number,
): string[] {
  const { restaurant, supporters } = winner;
  const reasons: string[] = [];
  const total = wishes.length;

  if (supporters.length > 0) {
    reasons.push(`${total}명 중 ${supporters.length}명이 선호 (${supporters.join(', ')})`);
  } else {
    const anything = wishes.filter((w) => w.isAnything).length;
    reasons.push(
      anything > 0
        ? `"아무거나" ${anything}명 — 판사가 대신 골랐습니다`
        : '모두의 요청을 절충한 결과',
    );
  }

  if (restaurant.priceRange > 0) {
    reasons.push(
      restaurant.priceRange <= budget
        ? `1인 약 ${restaurant.priceRange.toLocaleString('ko-KR')}원 · 예산 조건 충족`
        : `1인 약 ${restaurant.priceRange.toLocaleString('ko-KR')}원 · 예산보다 조금 높음`,
    );
  }

  reasons.push(`도보 약 ${walkingMinutes(restaurant.distance)}분 거리`);
  reasons.push(
    restaurant.isOpen
      ? `현재 영업 중 · ${CATEGORY_LABEL[restaurant.category]}`
      : `지금은 영업 종료 · ${CATEGORY_LABEL[restaurant.category]}`,
  );

  return reasons;
}
