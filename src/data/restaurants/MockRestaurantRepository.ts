import type { Restaurant, RestaurantQuery } from '@/types/restaurant';
import { distanceInMeters } from '@/lib/geo';
import { createRandom, hashString } from '@/lib/random';
import { RESTAURANT_TEMPLATES, type RestaurantTemplate } from './fixtures';
import type { RestaurantRepository } from './RestaurantRepository';

const METERS_PER_DEG_LAT = 111_320;
const MAX_SPREAD_M = 2_000;

/**
 * 내장 픽스처를 기준 좌표 주변에 결정론적으로 배치하는 목업 저장소.
 *
 * - 이름/메뉴/평점은 fixtures.ts 의 고정 목록에서만 가져온다 (런타임 생성 금지).
 * - 좌표는 "기준 위치 + 시드 기반 오프셋"으로 계산해서, 같은 위치에서는 항상 같은
 *   결과가 나오도록 한다. 특정 학교/지역에 종속되지 않는다.
 */
export class MockRestaurantRepository implements RestaurantRepository {
  readonly source = 'mock' as const;

  async search(query: RestaurantQuery): Promise<Restaurant[]> {
    // 실제 네트워크 호출처럼 보이도록 아주 짧은 지연을 준다.
    await new Promise((resolve) => setTimeout(resolve, 220));

    const { location, radius, filters, limit } = query;
    const anchorSeed = hashString(
      `${location.latitude.toFixed(3)}:${location.longitude.toFixed(3)}`,
    );
    const hour = new Date().getHours();

    const all = RESTAURANT_TEMPLATES.map((template) =>
      placeTemplate(template, query, anchorSeed, hour),
    );

    const matched = all
      .filter((r) => r.distance <= radius)
      .filter((r) => r.priceRange <= filters.budget * 1.2)
      .filter((r) => r.rating >= filters.minRating)
      .filter((r) => !filters.excludedCategories.includes(r.category))
      .filter(
        (r) => filters.categories.length === 0 || filters.categories.includes(r.category),
      )
      .filter((r) => !filters.openNowOnly || r.isOpen)
      .sort((a, b) => a.distance - b.distance);

    return typeof limit === 'number' ? matched.slice(0, limit) : matched;
  }
}

function placeTemplate(
  template: RestaurantTemplate,
  query: RestaurantQuery,
  anchorSeed: number,
  hour: number,
): Restaurant {
  const rand = createRandom(anchorSeed ^ hashString(template.key));
  const bearing = rand() * Math.PI * 2;
  // 실제 대학가/번화가처럼 기준 위치 가까이에 밀집시킨다.
  // (기본 반경 500m 안에 약 40%, 300m 안에 약 25%가 들어온다)
  const spread = 60 + rand() ** 1.6 * (MAX_SPREAD_M - 60);

  const dLat = (Math.cos(bearing) * spread) / METERS_PER_DEG_LAT;
  const dLon =
    (Math.sin(bearing) * spread) /
    (METERS_PER_DEG_LAT * Math.cos((query.location.latitude * Math.PI) / 180));

  const latitude = query.location.latitude + dLat;
  const longitude = query.location.longitude + dLon;
  const [open, close] = template.hours;
  const normalizedHour = hour < open && close > 24 ? hour + 24 : hour;

  return {
    id: `mock_${template.key}`,
    name: template.name,
    category: template.category,
    latitude,
    longitude,
    address: '데모 데이터 · 실제 주소 아님',
    rating: template.rating,
    priceRange: template.priceRange,
    isOpen: normalizedHour >= open && normalizedHour < close,
    distance: distanceInMeters(query.location, { latitude, longitude }),
    menu: template.menu,
    tags: template.tags,
  };
}
