import { ENV } from '@/config/env';
import { KakaoRestaurantRepository } from './KakaoRestaurantRepository';
import { MockRestaurantRepository } from './MockRestaurantRepository';
import type { RestaurantRepository } from './RestaurantRepository';

let instance: RestaurantRepository | null = null;

/** 환경 설정에 따라 식당 데이터 소스를 선택한다. */
export function getRestaurantRepository(): RestaurantRepository {
  if (instance) return instance;
  instance =
    ENV.placesProvider === 'kakao' && ENV.kakaoRestApiKey
      ? new KakaoRestaurantRepository(ENV.kakaoRestApiKey)
      : new MockRestaurantRepository();
  return instance;
}

export { RestaurantSearchError } from './RestaurantRepository';
export type { RestaurantRepository } from './RestaurantRepository';
