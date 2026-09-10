import { ENV } from '@/config/env';
import { ApiRestaurantRepository } from './ApiRestaurantRepository';
import { MockRestaurantRepository } from './MockRestaurantRepository';
import type { RestaurantRepository } from './RestaurantRepository';

let instance: RestaurantRepository | null = null;

/**
 * 식당 데이터 소스를 고른다.
 * 'kakao' 는 서버(/api/places)를 통해 실제 데이터를 받아오므로 API 주소가 필요하다.
 */
export function getRestaurantRepository(): RestaurantRepository {
  if (instance) return instance;
  instance =
    ENV.placesProvider === 'kakao' && ENV.apiBase
      ? new ApiRestaurantRepository(ENV.apiBase)
      : new MockRestaurantRepository();
  return instance;
}

export { RestaurantSearchError } from './RestaurantRepository';
export type {
  RestaurantCapabilities,
  RestaurantRepository,
} from './RestaurantRepository';
