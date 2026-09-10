import type { Restaurant, RestaurantQuery } from '@/types/restaurant';
import {
  RestaurantSearchError,
  type RestaurantCapabilities,
  type RestaurantRepository,
} from './RestaurantRepository';

/** 제공자별로 실제 내려주는 정보가 다르다 */
const CAPABILITIES: Record<string, RestaurantCapabilities> = {
  // 카카오 로컬 API: 이름·카테고리·좌표·거리만
  kakao: { rating: false, price: false, priceLevel: false, openNow: false, photo: false },
  // 구글 Places(New): 평점·가격대·영업여부·사진까지 (금액은 등급으로만)
  google: { rating: true, price: false, priceLevel: true, openNow: true, photo: true },
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
  readonly source: string;
  readonly capabilities: RestaurantCapabilities;
  private readonly base: string;

  constructor(apiBase: string, provider: string) {
    this.base = apiBase.replace(/\/$/, '');
    this.source = provider;
    this.capabilities = CAPABILITIES[provider] ?? CAPABILITIES.kakao;
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

    // 서버가 좌표 반경으로 이미 걸러왔으니, 여기서는 사용자 조건만 반영한다.
    // 데이터가 없는 항목(평점 0 / 등급 null)은 필터에서 제외 사유로 쓰지 않는다.
    return restaurants
      .filter((r) => !filters.excludedCategories.includes(r.category))
      .filter(
        (r) => filters.categories.length === 0 || filters.categories.includes(r.category),
      )
      .filter((r) => !this.capabilities.rating || r.rating === 0 || r.rating >= filters.minRating)
      .filter((r) => !this.capabilities.openNow || !filters.openNowOnly || r.isOpen !== false)
      .filter(
        (r) =>
          !filters.maxPriceLevel ||
          r.priceLevel === null ||
          r.priceLevel <= filters.maxPriceLevel,
      );
  }
}
