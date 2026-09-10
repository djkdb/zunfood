import { GooglePlacesError, searchGoogle } from './places-google.ts';
import type { FoodCategory, Restaurant } from '../src/types/restaurant';

/**
 * 카카오 로컬 API 프록시.
 *
 * 키는 서버에만 둔다. 브라우저가 dapi.kakao.com 을 직접 부르면 REST 키가 그대로 노출된다.
 *
 * ⚠️ 카카오 로컬 API 가 주지 않는 것: 평점, 가격, 영업시간, 사진.
 * (평점·가격대·사진이 필요하면 구글 키를 넣으면 된다 — places-google.ts)
 * 없는 값을 지어내지 않고 "모름"(rating 0 / priceRange 0 / isOpen null)으로 내려보낸다.
 * 화면은 capabilities 를 보고 해당 항목을 감춘다.
 */

const ENDPOINT = 'https://dapi.kakao.com/v2/local/search/category.json';
/** FD6 = 음식점, CE7 = 카페 */
const CATEGORY_GROUPS = ['FD6', 'CE7'] as const;
const MAX_RADIUS_M = 20_000;

export interface KakaoPlace {
  id: string;
  place_name: string;
  category_name: string;
  road_address_name?: string;
  address_name?: string;
  x: string;
  y: string;
  place_url?: string;
  distance?: string;
}

export class PlacesError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export interface PlacesKeys {
  kakao?: string;
  google?: string;
}

/**
 * GET /api/places?lat=&lng=&radius=&limit=
 *
 * 구글 키가 있으면 구글(평점·가격대·영업여부·사진), 없으면 카카오를 쓴다.
 */
export async function handlePlaces(request: Request, keys: PlacesKeys | string): Promise<Response> {
  // 문자열로 오면 카카오 키로 간주한다 (이전 호출부 호환)
  const resolved: PlacesKeys = typeof keys === 'string' ? { kakao: keys } : keys;
  const params = new URL(request.url).searchParams;
  const lat = Number(params.get('lat'));
  const lng = Number(params.get('lng'));
  const radius = Math.min(MAX_RADIUS_M, Math.max(50, Number(params.get('radius')) || 500));
  const limit = Math.min(45, Math.max(1, Number(params.get('limit')) || 30));

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return json({ error: 'bad_request', message: '좌표가 올바르지 않습니다.' }, 400);
  }
  const provider = resolved.google ? 'google' : resolved.kakao ? 'kakao' : null;
  if (!provider) {
    return json({ error: 'auth', message: '식당 데이터 API 키가 설정되지 않았습니다.' }, 500);
  }

  try {
    const restaurants =
      provider === 'google'
        ? await searchGoogle({ lat, lng, radius, limit, apiKey: resolved.google as string })
        : await searchKakao({ lat, lng, radius, limit, apiKey: resolved.kakao as string });

    return json(
      { provider, restaurants },
      200,
      // 같은 지점을 다시 검색해도 카카오 할당량을 다시 쓰지 않도록 잠깐 캐시한다
      { 'cache-control': 'public, max-age=300' },
    );
  } catch (error) {
    if (error instanceof PlacesError || error instanceof GooglePlacesError) {
      return json({ error: error.code, message: error.message }, error.status);
    }
    return json({ error: 'network', message: '식당 정보를 불러오지 못했어요.' }, 502);
  }
}

export async function searchKakao(input: {
  lat: number;
  lng: number;
  radius: number;
  limit: number;
  apiKey: string;
}): Promise<Restaurant[]> {
  const { lat, lng, radius, limit, apiKey } = input;
  const seen = new Set<string>();
  const collected: Restaurant[] = [];

  for (const group of CATEGORY_GROUPS) {
    // 음식점은 후보가 많아야 하므로 최대 2페이지까지 본다 (카페는 1페이지면 충분)
    const pages = group === 'FD6' ? 2 : 1;

    for (let page = 1; page <= pages; page += 1) {
      const url = new URL(ENDPOINT);
      url.searchParams.set('category_group_code', group);
      url.searchParams.set('x', String(lng));
      url.searchParams.set('y', String(lat));
      url.searchParams.set('radius', String(radius));
      url.searchParams.set('sort', 'distance');
      url.searchParams.set('size', '15');
      url.searchParams.set('page', String(page));

      let response: Response;
      try {
        response = await fetch(url.toString(), {
          headers: { Authorization: `KakaoAK ${apiKey}` },
        });
      } catch {
        throw new PlacesError(502, 'network', '식당 정보를 불러오지 못했어요.');
      }

      if (response.status === 401 || response.status === 403) {
        throw new PlacesError(502, 'auth', '식당 데이터 API 인증에 실패했어요.');
      }
      if (response.status === 429) {
        throw new PlacesError(503, 'quota', '오늘 식당 검색 한도를 다 썼어요.');
      }
      if (!response.ok) {
        throw new PlacesError(502, 'unknown', '식당 정보를 불러오지 못했어요.');
      }

      const body = (await response.json()) as {
        documents?: KakaoPlace[];
        meta?: { is_end?: boolean };
      };

      for (const doc of body.documents ?? []) {
        if (seen.has(doc.id)) continue;
        seen.add(doc.id);
        collected.push(toRestaurant(doc));
      }

      if (body.meta?.is_end) break;
    }
  }

  return collected.sort((a, b) => a.distance - b.distance).slice(0, limit);
}

export function toRestaurant(doc: KakaoPlace): Restaurant {
  return {
    id: `kakao_${doc.id}`,
    name: doc.place_name,
    category: mapCategory(doc.category_name),
    latitude: Number(doc.y),
    longitude: Number(doc.x),
    address: doc.road_address_name || doc.address_name || '',
    // 카카오 로컬 API 는 아래 셋을 제공하지 않는다. 지어내지 않고 "모름"으로 둔다.
    rating: 0,
    priceRange: 0,
    priceLevel: null,
    isOpen: null,
    distance: doc.distance ? Number(doc.distance) : 0,
    menu: [],
    tags: doc.category_name
      .split('>')
      .map((part) => part.trim())
      .filter(Boolean)
      .slice(1),
    placeUrl: doc.place_url,
  };
}

/** 카카오 카테고리 문자열 → 앱 카테고리 */
const CATEGORY_RULES: [RegExp, FoodCategory][] = [
  [/카페|디저트|베이커리|커피|빙수|제과/, 'cafe'],
  [/치킨|닭강정|닭발|찜닭/, 'chicken'],
  [/중식|중국|마라|양꼬치|딤섬/, 'chinese'],
  [/일식|초밥|스시|돈까스|돈카츠|라멘|우동|규동|덮밥/, 'japanese'],
  [/양식|피자|파스타|햄버거|스테이크|이탈리|프랑스/, 'western'],
  [/분식|떡볶이|김밥|만두|칼국수|국수/, 'snack'],
  [/육류|고기|곱창|삼겹|갈비|족발|보쌈|steak|barbecue/i, 'meat'],
  [/한식|국밥|백반|찌개|해장|한정식|죽|칼국수|추어탕|보리밥/, 'korean'],
  [/아시아|베트남|태국|인도|멕시코|뷔페|샐러드|샌드위치/, 'etc'],
];

export function mapCategory(categoryName: string): FoodCategory {
  for (const [pattern, category] of CATEGORY_RULES) {
    if (pattern.test(categoryName)) return category;
  }
  return 'etc';
}

function json(body: unknown, status: number, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...extra },
  });
}
