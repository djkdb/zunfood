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

  const parsedWishes: ParsedWish[] = wishes.map((wish) => ({
    ...wish,
    isAnything: ANYTHING.some((word) => wish.text.includes(word)) || wish.text.trim() === '',
    categories: categoriesFor(wish.text),
  }));

  const scored: ScoredCandidate[] = candidates.map((restaurant) => {
    let score = 0;
    const supporters: string[] = [];
    let matchedCategory = false;
    let textMatch: TextMatch | null = null;

    for (const wish of parsedWishes) {
      if (wish.isAnything) {
        score += 4; // 아무거나 = 약한 지지
        continue;
      }
      const hit = findTextMatch(restaurant, wish.text);
      if (hit) {
        score += 34;
        supporters.push(wish.nickname);
        textMatch = textMatch ?? hit;
      } else if (wish.categories.includes(restaurant.category)) {
        score += 24;
        supporters.push(wish.nickname);
        matchedCategory = true;
      }
    }

    // 예산 적합도
    if (restaurant.priceRange > 0) {
      score += restaurant.priceRange <= budget ? 14 : -18;
    }
    // 평점 / 거리 / 영업 여부 — 모르는 값(0, null)은 가감하지 않는다
    score += restaurant.rating * 4;
    score += Math.max(0, 12 - restaurant.distance / 120);
    if (restaurant.isOpen === true) score += 8;
    else if (restaurant.isOpen === false) score -= 25;
    // 동점 방지를 위한 결정론적 흔들기
    score += (hashString(restaurant.id) % 100) / 100;

    return { restaurant, score, supporters: [...new Set(supporters)], matchedCategory, textMatch };
  });

  scored.sort((a, b) => b.score - a.score);
  const winner = scored[0];

  return {
    restaurantId: winner.restaurant.id,
    headline: buildHeadline(winner, parsedWishes, candidates),
    reasons: buildReasons(winner, parsedWishes, candidates, budget),
    scores: scored.map((s) => ({ restaurantId: s.restaurant.id, score: Math.round(s.score) })),
  };
}

interface ScoredCandidate {
  restaurant: Restaurant;
  score: number;
  supporters: string[];
  /** 이름이 아니라 카테고리로 맞은 경우 */
  matchedCategory: boolean;
  /** 요청 문구가 이름이나 태그에 그대로 들어 있던 경우 */
  textMatch: TextMatch | null;
}

interface TextMatch {
  /** 실제로 일치한 말 (사용자가 쓴 그대로) */
  term: string;
  /** 가게 이름에서 맞았는지 (아니면 태그·메뉴) */
  inName: boolean;
}

type ParsedWish = JudgeWish & { isAnything: boolean; categories: FoodCategory[] };

/**
 * 판결 한 줄.
 *
 * 식당 이름을 되풀이하지 않는다 — 이름은 바로 아래 카드에 이미 있다.
 * 대신 "이 방에서 무슨 일이 일어났는지"를 말한다. 만장일치인지, 한 사람 편을
 * 들어준 건지, 아무도 안 골라서 판사가 정한 건지에 따라 문장이 달라져야
 * 판결처럼 읽힌다.
 */
function buildHeadline(
  winner: ScoredCandidate,
  wishes: ParsedWish[],
  candidates: Restaurant[],
): string {
  const total = wishes.length;
  const backed = winner.supporters.length;
  const anything = wishes.filter((w) => w.isAnything).length;

  if (total === 0) return '조건에 가장 맞는 곳으로 정합니다.';

  // 혼자일 때는 "몇 명 중 몇 명" 이 어색하다
  if (total === 1) {
    if (anything === 1) return '"아무거나" 라고 하셨으니 제가 정하겠습니다.';
    return `요청하신 "${wishes[0].text}" 에 가장 가까운 곳입니다.`;
  }

  if (anything === total) return '전원 "아무거나" — 제가 정하겠습니다.';
  if (backed === total) return '만장일치입니다.';
  if (backed === 1) return `${winner.supporters[0]}님의 손을 들어드립니다.`;
  if (backed > 1) return `${total}명 중 ${backed}명의 손을 들어드립니다.`;

  return distanceRank(winner.restaurant, candidates) === 1
    ? '의견이 갈려서, 제일 가까운 곳으로 정합니다.'
    : '의견이 갈려서, 조건을 종합했습니다.';
}

/**
 * 판결 근거.
 *
 * 데이터 소스가 주지 않는 값(평점 0 / 가격 0 / 영업여부 null)은 아예 언급하지
 * 않는다. 카카오 로컬 API 처럼 이름·카테고리·거리만 주는 소스에서도 근거가
 * 빈약해지지 않도록, 아는 값에서 순위와 희소성을 뽑아 쓴다.
 */
function buildReasons(
  winner: ScoredCandidate,
  wishes: ParsedWish[],
  candidates: Restaurant[],
  budget: number,
): string[] {
  const { restaurant, supporters } = winner;
  const reasons: string[] = [];
  const total = wishes.length;
  const anything = wishes.filter((w) => w.isAnything).length;

  // 1) 사람
  if (supporters.length > 0) {
    reasons.push(
      total > 1
        ? `${total}명 중 ${supporters.length}명이 원한 종류 (${supporters.join(', ')})`
        : '요청한 종류와 일치',
    );
  } else if (anything > 0) {
    reasons.push(`"아무거나" ${anything}명 — 판사가 대신 골랐습니다`);
  } else {
    reasons.push('요청과 딱 맞는 곳이 없어 조건으로 판단했습니다');
  }

  // 2) 거리 — 어떤 소스든 항상 아는 값이라 순위까지 말해준다
  const rank = distanceRank(restaurant, candidates);
  const walk = `${walkingMinutes(restaurant.distance)}분`;
  if (rank === 1 && candidates.length > 1) {
    reasons.push(`후보 ${candidates.length}곳 중 가장 가까워요 · 걸어서 ${walk}`);
  } else if (rank <= 3 && candidates.length > 3) {
    reasons.push(`가까운 순 ${rank}번째 · 걸어서 ${walk}`);
  } else {
    reasons.push(`걸어서 ${walk} · ${restaurant.distance}m`);
  }

  // 3) 종류 — 맞췄는지, 아니면 후보 중 얼마나 드문지
  const label = CATEGORY_LABEL[restaurant.category];
  const sameCategory = candidates.filter((c) => c.category === restaurant.category).length;
  if (winner.textMatch) {
    const { term, inName } = winner.textMatch;
    reasons.push(inName ? `이름에 '${term}' 이 들어가요` : `'${term}' 로 분류된 곳`);
  } else if (winner.matchedCategory) {
    reasons.push(`요청한 '${label}' 과 같은 종류`);
  } else if (sameCategory === 1 && candidates.length > 2) {
    reasons.push(`후보 중 유일한 ${label}`);
  } else {
    const tag = restaurant.tags[0];
    reasons.push(tag ? `${label} · ${tag}` : label);
  }

  // 4) 아는 경우에만 덧붙인다 (카카오는 여기까지 오지 않는다)
  if (restaurant.priceRange > 0) {
    reasons.push(
      restaurant.priceRange <= budget
        ? `1인 약 ${restaurant.priceRange.toLocaleString('ko-KR')}원 · 예산 안`
        : `1인 약 ${restaurant.priceRange.toLocaleString('ko-KR')}원 · 예산보다 조금 높음`,
    );
  } else if (restaurant.rating > 0) {
    reasons.push(`평점 ${restaurant.rating.toFixed(1)}`);
  } else if (restaurant.isOpen === true) {
    reasons.push('지금 영업 중');
  }

  return reasons.slice(0, 4);
}

/** 후보 중 가까운 순 순위 (1 = 가장 가까움) */
function distanceRank(restaurant: Restaurant, candidates: Restaurant[]): number {
  return candidates.filter((c) => c.distance < restaurant.distance).length + 1;
}

/**
 * 요청 문구가 이 가게의 이름·태그·메뉴에 실제로 들어 있는지.
 *
 * 맞았다는 사실만이 아니라 "무엇이 맞았는지"를 돌려준다 — 판결 근거에
 * 그대로 쓰기 위해서다. 없는 말을 지어내지 않고 실제 일치한 부분만 인용한다.
 */
function findTextMatch(restaurant: Restaurant, text: string): TextMatch | null {
  const terms = [text.trim(), ...text.trim().split(/\s+/)].filter((t) => t.length >= 2);
  const others = [...restaurant.tags, ...restaurant.menu.map((m) => m.name)].join(' ');

  for (const term of terms) {
    if (restaurant.name.includes(term)) return { term, inName: true };
    if (others.includes(term)) return { term, inName: false };
  }
  return null;
}

function categoriesFor(text: string): FoodCategory[] {
  const hits = KEYWORD_CATEGORY.filter(([keyword]) => text.includes(keyword)).map(
    ([, category]) => category,
  );
  return [...new Set(hits)];
}
