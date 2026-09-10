import type { Restaurant, RestaurantQuery } from '@/types/restaurant';
import {
  RestaurantSearchError,
  type RestaurantCapabilities,
  type RestaurantRepository,
} from './RestaurantRepository';

/** 카카오 로컬 API 가 실제로 제공하는 정보 */
const KAKAO_CAPABILITIES: RestaurantCapabilities = {
  rating: false,
  price: false,
  openNow: false,
  photo: false,
};

const ERROR_MESSAGE: Record<string, string> = {
  auth: '식당 데이터 연결에 문제가 있어요. 잠시 후 다시 시도해 주세요.',
  quota: '오늘 식당 검색 한도를 다 썼어요. 내일 다시 시도해 주세요.',
  network: '식당 정보를 불러오지 못했어요.',
  bad_request: '위치 정보가 올바르지 않아요. 위치를 다시 정해주세요.',
};

/**
 * 서버(/api/places)를 통해 실제 식당 데이터를 가져온다.
 *
 * 브라우저는 카카오를 직접 부르지 않는다 — REST 키가 노출되기 때문이다.
 * 어떤 제공자를 쓸지는 서버가 정하고, 여기서는 정규화된 결과만 받는다.
 */
export class ApiRestaurantRepository implements RestaurantRepository {
  readonly source = 'kakao' as const;
  readonly capabilities = KAKAO_CAPABILITIES;
  private readonly base: string;

  constructor(apiBase: string) {
    this.base = apiBase.replace(/\/$/, '');
  }

  async search(query: RestaurantQuery): Promise<Restaurant[]> {
    const url = new URL(`${this.base}/places`, window.location.origin);
    url.searchParams.set('lat', String(query.location.latitude));
    url.searchParams.set('lng', String(query.location.longitude));
    url.searchParams.set('radius', String(query.radius));
    url.searchParams.set('limit', String(query.limit ?? 30));

    let response: Response;
    try {
      response = await fetch(url.toString());
    } catch {
      throw new RestaurantSearchError('network', ERROR_MESSAGE.network);
    }

    if (!response.ok) {
      let code = 'unknown';
      try {
        code = ((await response.json()) as { error?: string }).error ?? 'unknown';
      } catch {
        // 본문이 없으면 아래 기본 메시지를 쓴다
      }
      throw new RestaurantSearchError(
        code === 'auth' ? 'auth' : code === 'network' ? 'network' : 'unknown',
        ERROR_MESSAGE[code] ?? ERROR_MESSAGE.network,
      );
    }

    const body = (await response.json()) as { restaurants?: Restaurant[] };
    const restaurants = body.restaurants ?? [];
    const { filters } = query;

    // 서버가 좌표 반경으로 이미 걸러왔으니, 여기서는 사용자가 고른 음식 종류만 반영한다.
    // 평점·가격 필터는 이 소스에 해당 데이터가 없으므로 적용하지 않는다.
    return restaurants
      .filter((r) => !filters.excludedCategories.includes(r.category))
      .filter(
        (r) => filters.categories.length === 0 || filters.categories.includes(r.category),
      );
  }
}
