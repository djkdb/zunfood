import type { Restaurant, RestaurantQuery } from '@/types/restaurant';

/**
 * 식당 데이터 접근 계층.
 * UI/게임 로직은 이 인터페이스에만 의존한다.
 * 실제 지도/플레이스 API 는 이 인터페이스를 구현해 교체한다.
 */
export interface RestaurantRepository {
  /** 데이터 출처 표시용 */
  readonly source: 'mock' | 'kakao' | string;
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
