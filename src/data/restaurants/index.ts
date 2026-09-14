import { ENV } from '@/config/env';
import { markDemoData } from '@/store/dataSourceStore';
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
  const remote = ENV.placesProvider === 'kakao' || ENV.placesProvider === 'google';
  if (remote && ENV.apiBase) {
    instance = new ApiRestaurantRepository(ENV.apiBase, ENV.placesProvider);
  } else {
    // 서버가 없는 환경(로컬 개발 등) — 화면에서 예시 데이터임을 밝힌다
    markDemoData('no-backend');
    instance = new MockRestaurantRepository();
  }
  return instance;
}

export { RestaurantSearchError } from './RestaurantRepository';
export type {
  RestaurantCapabilities,
  RestaurantRepository,
} from './RestaurantRepository';
