import { GooglePlacesError, searchGoogle } from './places-google.ts';
import type { Sql } from './sql';
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

export interface PlacesOptions {
  /** 사용량 카운터를 저장할 DB (없으면 한도 검사를 건너뛴다) */
  sql?: Sql;
  /** 구글 월 호출 상한. 넘으면 무료 제공자(카카오)로 자동 전환한다 */
  googleMonthlyLimit?: number;
}

/**
 * 이번 달 구글 호출을 한 건 예약한다.
 *
 * 한도 안이면 카운터를 올리고 true, 한도를 넘었으면 올리지 않고 false 를 반환한다.
 * 한 문장으로 처리해서 동시에 여러 요청이 와도 한도를 넘기지 않는다.
 */
export async function reserveGoogleCall(sql: Sql, limit: number): Promise<boolean> {
  const period = new Date().toISOString().slice(0, 7);
  const rows = await sql`
    insert into api_usage (provider, period, count)
    values ('google', ${period}, 1)
    on conflict (provider, period) do update
      set count = api_usage.count + 1
      where api_usage.count < ${limit}
    returning count`;
  return rows.length > 0;
}

/** 이번 달 사용량 조회 (운영 확인용) */
export async function readUsage(sql: Sql): Promise<Record<string, number>> {
  const period = new Date().toISOString().slice(0, 7);
  const rows = await sql`select provider, count from api_usage where period = ${period}`;
  return Object.fromEntries(rows.map((r) => [String(r.provider), Number(r.count)]));
}

/**
 * GET /api/places?lat=&lng=&radius=&limit=
 *
 * 구글 키가 있으면 구글(평점·가격대·영업여부·사진), 없으면 카카오를 쓴다.
 */
export async function handlePlaces(
  request: Request,
  keys: PlacesKeys | string,
  options: PlacesOptions = {},
): Promise<Response> {
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
  if (!resolved.google && !resolved.kakao) {
    return json({ error: 'auth', message: '식당 데이터 API 키가 설정되지 않았습니다.' }, 500);
  }

  // 구글은 무료 한도를 넘으면 과금된다. 한도에 닿으면 카카오로 조용히 내려간다.
  let useGoogle = Boolean(resolved.google);
  if (useGoogle && options.sql && options.googleMonthlyLimit) {
    const allowed = await reserveGoogleCall(options.sql, options.googleMonthlyLimit);
    if (!allowed && resolved.kakao) useGoogle = false;
  }

  const provider = useGoogle ? 'google' : 'kakao';

  try {
    let restaurants: Restaurant[];
    if (provider === 'google') {
      try {
        restaurants = await searchGoogle({
          lat, lng, radius, limit, apiKey: resolved.google as string,
        });
      } catch (error) {
        // 구글이 실패해도 카카오가 있으면 게임은 계속되게 한다
        if (!resolved.kakao) throw error;
        return json(
          { provider: 'kakao', restaurants: await searchKakao({ lat, lng, radius, limit, apiKey: resolved.kakao }) },
          200,
          { 'cache-control': 'public, max-age=300' },
        );
      }
    } else {
      restaurants = await searchKakao({ lat, lng, radius, limit, apiKey: resolved.kakao as string });
    }

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

      // 오류 분류는 한 곳에서만 한다 — 상태 코드와 본문을 함께 봐야 정확하다
      if (!response.ok) {
        throw new PlacesError(...(await classifyKakaoFailure(response)));
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

/**
 * 카카오 오류 응답 분류.
 *
 * 카카오는 쿼터 초과를 429 로만 주지 않는다. 4xx 본문에 코드 -10 과
 * "API limit has been exceeded" 로 오기도 해서, 상태 코드보다 본문을 먼저 본다.
 * 원인별로 다른 메시지를 줘야 사용자가 뭘 해야 할지 알 수 있다.
 */
async function classifyKakaoFailure(
  response: Response,
): Promise<[number, string, string]> {
  let body = '';
  try {
    body = await response.text();
  } catch {
    // 본문을 못 읽으면 상태 코드만으로 판단한다
  }

  if (
    response.status === 429 ||
    body.includes('"code":-10') ||
    body.includes('limit has been exceeded') ||
    body.includes('quota')
  ) {
    return [503, 'quota', '오늘 식당 검색 한도를 다 썼어요. 내일 다시 시도해 주세요.'];
  }

  // 앱에서 카카오맵 API [사용 설정] 을 켜지 않은 경우도 인증 문제로 묶는다
  if (response.status === 401 || response.status === 403 || body.includes('disabled')) {
    return [502, 'auth', '식당 데이터 API 인증에 실패했어요.'];
  }

  return [502, 'unknown', '식당 정보를 불러오지 못했어요.'];
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

/* ------------------------------------------------------------------ *
 * 설정 진단
 * ------------------------------------------------------------------ */

export interface ProbeResult {
  ok: boolean;
  /** 카카오가 돌려준 HTTP 상태. 0 이면 요청 자체가 나가지 못한 것 */
  status: number;
  /** 카카오 응답 본문 일부. 키가 섞여 나올 경우를 대비해 가려서 넣는다 */
  message?: string;
  /** 사람이 읽고 바로 조치할 수 있는 설명 */
  diagnosis: string;
}

/**
 * 설정된 카카오 키로 실제 호출을 한 번 넣어보고 결과를 알려준다.
 *
 * "키가 있다/없다"만으로는 원인을 못 가린다. 키가 Worker 에 들어와 있어도
 * 앱에서 카카오맵을 켜지 않았거나, 다른 앱의 키를 넣었거나, 한도를 다 썼을 수 있다.
 * 셋은 조치가 전혀 다르므로 카카오가 실제로 뭐라고 하는지 그대로 확인한다.
 *
 * 키 값은 어떤 경우에도 응답에 담기지 않는다.
 */
export async function probeKakao(apiKey: string): Promise<ProbeResult> {
  // 가장 싼 요청 — 한 건만 받아온다 (좌표는 서울 시청, 결과 유무는 상관없다)
  const url = new URL(ENDPOINT);
  url.searchParams.set('category_group_code', 'FD6');
  url.searchParams.set('x', '126.9780');
  url.searchParams.set('y', '37.5665');
  url.searchParams.set('radius', '500');
  url.searchParams.set('size', '1');

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      headers: { Authorization: `KakaoAK ${apiKey}` },
    });
  } catch {
    return {
      ok: false,
      status: 0,
      diagnosis: 'Worker 에서 dapi.kakao.com 에 연결하지 못했습니다.',
    };
  }

  const raw = await response.text().catch(() => '');
  const body = redact(raw, apiKey).slice(0, 300);

  if (response.ok) {
    let found = 0;
    try {
      found = (JSON.parse(raw) as { documents?: unknown[] }).documents?.length ?? 0;
    } catch {
      // 건수는 참고용이라 못 읽어도 넘어간다
    }
    return {
      ok: true,
      status: 200,
      diagnosis: `카카오 키가 정상 동작합니다 (시청 주변 ${found}건 응답).`,
    };
  }

  return {
    ok: false,
    status: response.status,
    message: body,
    diagnosis: diagnoseKakao(response.status, body),
  };
}

/** 카카오 거부 사유 → 카카오 개발자 콘솔에서 할 일 */
function diagnoseKakao(status: number, body: string): string {
  if (
    status === 429 ||
    body.includes('"code":-10') ||
    body.includes('limit has been exceeded') ||
    body.includes('quota')
  ) {
    return '키는 정상인데 오늘 호출 한도를 다 썼습니다. 내일 다시 시도하면 됩니다.';
  }
  if (body.includes('disabled') || body.includes('not exist') || body.includes('deactivated')) {
    return '이 키의 앱에서 카카오맵(로컬) API 가 꺼져 있습니다. [내 애플리케이션] → 해당 앱 → [카카오맵] → 사용 설정을 켜주세요.';
  }
  if (status === 401) {
    return 'REST API 키가 올바르지 않습니다. Cloudflare Secret 값에 공백이나 줄바꿈이 섞이지 않았는지, 그리고 JavaScript 키가 아니라 REST API 키인지 확인하세요. ([앱 설정] → [플랫폼 키])';
  }
  if (status === 403) {
    return '키는 인식됐지만 로컬(카카오맵) API 권한이 없습니다. Cloudflare 에 넣은 키가 카카오맵을 켜둔 그 앱의 키가 맞는지 확인하세요.';
  }
  return '알 수 없는 응답입니다. 아래 message 에 카카오가 보낸 내용이 그대로 들어 있습니다.';
}

/** 응답에 키가 섞여 나오더라도 밖으로 내보내지 않는다 */
function redact(text: string, secret: string): string {
  return secret ? text.split(secret).join('***') : text;
}
