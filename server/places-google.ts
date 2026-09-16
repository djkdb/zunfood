import type { FoodCategory, PriceLevel, Restaurant } from '../src/types/restaurant';

/**
 * 구글 Places API (New) — Nearby Search.
 *
 * 카카오와 달리 평점·가격대·영업여부·사진을 준다.
 *
 * 💰 과금 주의: 요청의 필드 마스크에 무엇을 넣느냐로 과금 등급이 정해진다.
 * rating 을 넣으면 Enterprise 등급이 된다. 여기서는 게임에 실제로 쓰는 필드만 요청한다.
 * 사진은 "참조(photoRef)"만 받아두고, 실제 이미지는 결과 화면에서 한 장만 요청한다
 * (목록 카드까지 사진을 띄우면 판당 이미지 요청이 10배로 늘어난다).
 */

const ENDPOINT = 'https://places.googleapis.com/v1/places:searchNearby';
const PHOTO_ENDPOINT = 'https://places.googleapis.com';
const MAX_RADIUS_M = 50_000;

const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.location',
  'places.formattedAddress',
  'places.primaryType',
  'places.types',
  'places.rating',
  'places.userRatingCount',
  'places.priceLevel',
  'places.currentOpeningHours.openNow',
  'places.googleMapsUri',
  'places.photos',
].join(',');

export class GooglePlacesError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

interface GooglePlace {
  id: string;
  displayName?: { text?: string };
  location?: { latitude?: number; longitude?: number };
  formattedAddress?: string;
  primaryType?: string;
  types?: string[];
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  currentOpeningHours?: { openNow?: boolean };
  googleMapsUri?: string;
  photos?: { name?: string }[];
}

export async function searchGoogle(input: {
  lat: number;
  lng: number;
  radius: number;
  limit: number;
  apiKey: string;
}): Promise<Restaurant[]> {
  const { lat, lng, radius, limit, apiKey } = input;

  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify({
        includedTypes: ['restaurant', 'cafe'],
        // 한 번에 받을 수 있는 상한이 20 이다
        maxResultCount: Math.min(20, Math.max(1, limit)),
        rankPreference: 'DISTANCE',
        languageCode: 'ko',
        regionCode: 'KR',
        locationRestriction: {
          circle: {
            center: { latitude: lat, longitude: lng },
            radius: Math.min(MAX_RADIUS_M, radius),
          },
        },
      }),
    });
  } catch {
    throw new GooglePlacesError(502, 'network', '식당 정보를 불러오지 못했어요.');
  }

  if (response.status === 401 || response.status === 403) {
    throw new GooglePlacesError(502, 'auth', '식당 데이터 API 인증에 실패했어요.');
  }
  if (response.status === 429) {
    throw new GooglePlacesError(503, 'quota', '오늘 식당 검색 한도를 다 썼어요.');
  }
  if (!response.ok) {
    throw new GooglePlacesError(502, 'unknown', '식당 정보를 불러오지 못했어요.');
  }

  const body = (await response.json()) as { places?: GooglePlace[] };
  const origin = { latitude: lat, longitude: lng };

  return (body.places ?? [])
    .map((place) => toRestaurant(place, origin))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);
}

export function toRestaurant(
  place: GooglePlace,
  origin: { latitude: number; longitude: number },
): Restaurant {
  const latitude = place.location?.latitude ?? 0;
  const longitude = place.location?.longitude ?? 0;

  return {
    id: `google_${place.id}`,
    name: place.displayName?.text ?? '이름 없음',
    category: mapCategory(place.primaryType, place.types),
    latitude,
    longitude,
    address: place.formattedAddress ?? '',
    rating: place.rating ?? 0,
    ratingCount: place.userRatingCount ?? 0,
    // 구글은 금액이 아니라 등급만 준다 — 원 단위로 환산하지 않는다
    priceRange: 0,
    priceLevel: mapPriceLevel(place.priceLevel),
    isOpen: place.currentOpeningHours?.openNow ?? null,
    // 구글은 거리를 주지 않으므로 좌표로 계산한다
    distance: distanceInMeters(origin, { latitude, longitude }),
    menu: [],
    tags: [],
    placeUrl: place.googleMapsUri,
    photoRef: place.photos?.[0]?.name,
  };
}

/** 사진 프록시 — 키를 노출하지 않고 이미지를 중계한다 */
export async function fetchPhoto(
  photoName: string,
  maxWidthPx: number,
  apiKey: string,
): Promise<Response> {
  // photoName 형식: places/{placeId}/photos/{photoReference}
  if (!/^places\/[\w-]+\/photos\/[\w-]+$/.test(photoName)) {
    return new Response(JSON.stringify({ error: 'bad_request' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  const url = new URL(`${PHOTO_ENDPOINT}/v1/${photoName}/media`);
  url.searchParams.set('maxWidthPx', String(Math.min(1600, Math.max(80, maxWidthPx))));
  url.searchParams.set('key', apiKey);

  const upstream = await fetch(url.toString());
  if (!upstream.ok) {
    return new Response(null, { status: upstream.status === 404 ? 404 : 502 });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      'content-type': upstream.headers.get('content-type') ?? 'image/jpeg',
      // 사진은 잘 바뀌지 않는다 — 오래 캐시해서 이미지 요청 비용을 줄인다
      'cache-control': 'public, max-age=604800, immutable',
    },
  });
}

/**
 * 두 좌표 사이 거리(m). 구글은 거리를 주지 않아 직접 계산한다.
 * 서버는 브라우저 코드(src/lib/geo 는 navigator 를 쓴다)에 의존하지 않는다.
 */
function distanceInMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude));
  return Math.round(2 * 6_371_000 * Math.asin(Math.sqrt(h)));
}

const PRICE_LEVELS: Record<string, PriceLevel> = {
  PRICE_LEVEL_FREE: 1,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

export function mapPriceLevel(value?: string): PriceLevel | null {
  return value ? (PRICE_LEVELS[value] ?? null) : null;
}

/** 구글 place type → 앱 카테고리 */
const TYPE_RULES: [RegExp, FoodCategory][] = [
  [/^(cafe|coffee_shop|bakery|dessert|ice_cream|tea_house|juice)/, 'cafe'],
  [/chicken|fried_chicken/, 'chicken'],
  [/chinese|dim_sum|asian_restaurant$/, 'chinese'],
  [/japanese|sushi|ramen/, 'japanese'],
  [/pizza|italian|american|hamburger|steak|french|mediterranean|spanish/, 'western'],
  [/korean_barbecue|barbecue|meat/, 'meat'],
  [/korean/, 'korean'],
  [/vietnamese|thai|indian|mexican|indonesian|middle_eastern|asian|sandwich|deli/, 'etc'],
];

export function mapCategory(primaryType?: string, types: string[] = []): FoodCategory {
  const candidates = [primaryType, ...types].filter(Boolean) as string[];
  for (const [pattern, category] of TYPE_RULES) {
    if (candidates.some((type) => pattern.test(type))) return category;
  }
  return 'etc';
}

/**
 * 설정된 구글 키로 실제 호출을 한 번 넣어보고 결과를 알려준다.
 *
 * 구글은 실패 사유를 본문에 꽤 정확히 적어준다 ("API has not been used in
 * project ... before or it is disabled" 등). 그대로 옮겨주면 콘솔에서 무엇을
 * 켜야 하는지 바로 알 수 있다.
 *
 * 필드 마스크를 id 하나로 줄여 가장 싼 등급으로 호출한다 — 진단 때문에
 * Enterprise 호출을 쓰면 아깝다.
 */
export async function probeGoogle(apiKey: string): Promise<{
  ok: boolean;
  status: number;
  message?: string;
  diagnosis: string;
}> {
  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.id',
      },
      body: JSON.stringify({
        includedTypes: ['restaurant'],
        maxResultCount: 1,
        locationRestriction: {
          circle: { center: { latitude: 37.5665, longitude: 126.978 }, radius: 500 },
        },
      }),
    });
  } catch {
    return {
      ok: false,
      status: 0,
      diagnosis: 'Worker 에서 places.googleapis.com 에 연결하지 못했습니다.',
    };
  }

  const raw = await response.text().catch(() => '');
  const message = redact(raw, apiKey).slice(0, 400);

  if (response.ok) {
    return { ok: true, status: 200, diagnosis: '구글 키가 정상 동작합니다.' };
  }
  return { ok: false, status: response.status, message, diagnosis: diagnoseGoogle(message) };
}

/** 구글이 보낸 사유 → 콘솔에서 할 일 */
function diagnoseGoogle(body: string): string {
  if (/has not been used in project|is disabled/.test(body)) {
    return 'Places API (New) 가 이 프로젝트에서 켜져 있지 않습니다. Google Cloud 콘솔 → API 및 서비스 → 라이브러리 → [Places API (New)] → 사용 설정.';
  }
  if (/API key not valid|API_KEY_INVALID/.test(body)) {
    return '키가 올바르지 않습니다. 값에 공백이 섞이지 않았는지, 이 프로젝트의 키가 맞는지 확인하세요.';
  }
  if (/referer|referrer|IP address|API_KEY_HTTP_REFERRER_BLOCKED|API_KEY_IP_ADDRESS_BLOCKED/i.test(body)) {
    return '키에 걸린 애플리케이션 제한(웹사이트/IP) 때문에 막혔습니다. 서버에서 호출하므로 애플리케이션 제한은 [없음] 이어야 하고, [API 제한사항] 으로만 Places API (New) 를 지정하세요.';
  }
  if (/billing|BILLING_DISABLED/i.test(body)) {
    return '결제 계정이 연결되어 있지 않습니다. Google Cloud 콘솔 → 결제 에서 프로젝트에 결제 계정을 연결하세요.';
  }
  if (/RESOURCE_EXHAUSTED|quota|rateLimitExceeded/i.test(body)) {
    return '할당량을 다 썼습니다. 콘솔의 할당량 설정이나 무료 한도를 확인하세요.';
  }
  if (/PERMISSION_DENIED/.test(body)) {
    return '권한이 거부됐습니다. 키의 [API 제한사항] 에 Places API (New) 가 포함되어 있는지 확인하세요.';
  }
  return '알 수 없는 응답입니다. 아래 message 에 구글이 보낸 내용이 그대로 들어 있습니다.';
}

/** 응답에 키가 섞여 나오더라도 밖으로 내보내지 않는다 */
function redact(text: string, secret: string): string {
  return secret ? text.split(secret).join('***') : text;
}
