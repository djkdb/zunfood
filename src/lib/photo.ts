import { ENV } from '@/config/env';
import type { Restaurant } from '@/types/restaurant';

/**
 * 식당 사진 URL.
 *
 * 사진은 요청 한 건마다 비용이 들 수 있어서, 결과 화면처럼 꼭 필요한 곳에서만 부른다.
 * 목록 카드에서는 호출하지 않는다 (한 판에 이미지 요청이 10배로 늘어난다).
 */
export function photoUrl(restaurant: Restaurant, width = 480): string | undefined {
  if (restaurant.thumbnail) return restaurant.thumbnail;
  if (!restaurant.photoRef || !ENV.apiBase) return undefined;
  const params = new URLSearchParams({ name: restaurant.photoRef, w: String(width) });
  return `${ENV.apiBase.replace(/\/$/, '')}/places/photo?${params}`;
}
