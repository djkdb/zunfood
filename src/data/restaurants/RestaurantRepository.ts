import type { Restaurant, RestaurantQuery } from '@/types/restaurant';

/**
 * 이 데이터 소스가 실제로 제공하는 정보.
 *
 * 제공자마다 주는 필드가 다르다. 예를 들어 카카오 로컬 API 는 이름·카테고리·좌표·거리만
 * 주고 평점/가격/영업시간은 주지 않는다. 없는 값을 채워 넣는 대신, 무엇을 모르는지
 * UI 에 알려서 해당 항목을 아예 감추게 한다.
 */
export interface RestaurantCapabilities {
  rating: boolean;
  /** 1인 금액(원)을 아는가 */
  price: boolean;
  /** 가격대 등급(₩~₩₩₩₩)을 아는가 */
  priceLevel: boolean;
  openNow: boolean;
  photo: boolean;
}

/**
 * 식당 데이터 접근 계층.
 * UI/게임 로직은 이 인터페이스에만 의존한다.
 * 실제 지도/플레이스 API 는 이 인터페이스를 구현해 교체한다.
 */
export interface RestaurantRepository {
  /** 데이터 출처 표시용 */
  readonly source: 'mock' | 'kakao' | string;
  /** 이 소스가 제공하는 정보 — UI 가 없는 항목을 감추는 데 쓴다 */
  readonly capabilities: RestaurantCapabilities;
  search(query: RestaurantQuery): Promise<Restaurant[]>;
}

export class RestaurantSearchError extends Error {
  code: 'network' | 'auth' | 'empty' | 'unknown';
  constructor(code: RestaurantSearchError['code'], message: string) {
    super(message);
    this.name = 'RestaurantSearchError';
    this.code = code;
  }
}
