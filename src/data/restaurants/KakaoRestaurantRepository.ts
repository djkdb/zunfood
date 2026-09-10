import type { FoodCategory, Restaurant, RestaurantQuery } from '@/types/restaurant';
import { distanceInMeters } from '@/lib/geo';
import { RestaurantSearchError, type RestaurantRepository } from './RestaurantRepository';

const ENDPOINT = 'https://dapi.kakao.com/v2/local/search/category.json';
/** FD6 = 음식점, CE7 = 카페 */
const CATEGORY_GROUPS = ['FD6', 'CE7'] as const;

/**
 * 카카오 로컬 API 구현체.
 *
 * 주의: 브라우저에서 직접 호출하면 REST 키가 노출된다.
 * 운영 환경에서는 동일한 인터페이스로 서버 프록시를 두고 그 URL 을 호출하도록 바꾼다.
 * (키는 절대 소스에 하드코딩하지 않고 환경변수로만 주입한다.)
 */
export class KakaoRestaurantRepository implements RestaurantRepository {
  readonly source = 'kakao' as const;
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async search(query: RestaurantQuery): Promise<Restaurant[]> {
    if (!this.apiKey) {
      throw new RestaurantSearchError('auth', '카카오 API 키가 설정되지 않았어요.');
    }

    const results: Restaurant[] = [];
    for (const group of CATEGORY_GROUPS) {
      const url = new URL(ENDPOINT);
      url.searchParams.set('category_group_code', group);
      url.searchParams.set('x', String(query.location.longitude));
      url.searchParams.set('y', String(query.location.latitude));
      url.searchParams.set('radius', String(Math.min(query.radius, 20_000)));
      url.searchParams.set('sort', 'distance');
      url.searchParams.set('size', '15');

      let response: Response;
      try {
        response = await fetch(url.toString(), {
          headers: { Authorization: `KakaoAK ${this.apiKey}` },
        });
      } catch {
        throw new RestaurantSearchError('network', '식당 정보를 불러오지 못했어요.');
      }

      if (response.status === 401 || response.status === 403) {
        throw new RestaurantSearchError('auth', '식당 API 인증에 실패했어요.');
      }
      if (!response.ok) {
        throw new RestaurantSearchError('unknown', '식당 정보를 불러오지 못했어요.');
      }

      const body = (await response.json()) as { documents?: KakaoPlace[] };
      for (const doc of body.documents ?? []) {
        results.push(toRestaurant(doc, query));
      }
    }

    const { filters } = query;
    return results
      .filter((r) => !filters.excludedCategories.includes(r.category))
      .filter(
        (r) => filters.categories.length === 0 || filters.categories.includes(r.category),
      )
      .sort((a, b) => a.distance - b.distance);
  }
}

interface KakaoPlace {
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

function toRestaurant(doc: KakaoPlace, query: RestaurantQuery): Restaurant {
  const latitude = Number(doc.y);
  const longitude = Number(doc.x);
  return {
    id: `kakao_${doc.id}`,
    name: doc.place_name,
    category: mapCategory(doc.category_name),
    latitude,
    longitude,
    address: doc.road_address_name || doc.address_name || '',
    // 카카오 로컬 API 는 평점/가격/영업여부를 제공하지 않는다.
    // 값을 지어내지 않고 "알 수 없음"에 해당하는 중립값을 넣는다.
    rating: 0,
    priceRange: 0,
    isOpen: true,
    distance: doc.distance
      ? Number(doc.distance)
      : distanceInMeters(query.location, { latitude, longitude }),
    menu: [],
    tags: doc.category_name.split('>').map((s) => s.trim()).filter(Boolean).slice(1),
    placeUrl: doc.place_url,
  };
}

const CATEGORY_RULES: [RegExp, FoodCategory][] = [
  [/카페|디저트|베이커리|커피/, 'cafe'],
  [/치킨/, 'chicken'],
  [/중식|중국|마라/, 'chinese'],
  [/일식|초밥|돈까스|라멘|우동/, 'japanese'],
  [/양식|피자|파스타|햄버거|스테이크/, 'western'],
  [/분식|떡볶이|김밥/, 'snack'],
  [/육류|고기|곱창|삼겹|갈비|족발|보쌈/, 'meat'],
  [/한식|국밥|백반|찌개|해장/, 'korean'],
];

function mapCategory(categoryName: string): FoodCategory {
  for (const [pattern, category] of CATEGORY_RULES) {
    if (pattern.test(categoryName)) return category;
  }
  return 'etc';
}
