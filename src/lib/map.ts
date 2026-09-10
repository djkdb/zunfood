import type { Restaurant } from '@/types/restaurant';

/**
 * 지도 링크 생성.
 * 데이터 소스가 자체 상세 페이지(placeUrl)를 주면 그걸 우선 사용한다.
 */
export function mapUrl(restaurant: Restaurant): string {
  if (restaurant.placeUrl) return restaurant.placeUrl;
  const { name, latitude, longitude } = restaurant;
  return `https://map.kakao.com/link/map/${encodeURIComponent(name)},${latitude},${longitude}`;
}

/** 길찾기 (범용 — 안드로이드/iOS 모두 동작) */
export function directionsUrl(restaurant: Restaurant): string {
  const { latitude, longitude, name } = restaurant;
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&destination_place_id=&travelmode=walking#${encodeURIComponent(
    name,
  )}`;
}
