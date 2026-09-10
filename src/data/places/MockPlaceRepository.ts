import { CAMPUSES } from './campuses';
import type { PlaceRepository, PlaceSearchResult } from './PlaceRepository';

/** 픽스처 기반 학교/장소 검색. */
export class MockPlaceRepository implements PlaceRepository {
  readonly source = 'mock';

  async searchCampuses(keyword: string): Promise<PlaceSearchResult[]> {
    const q = keyword.trim().toLowerCase();
    const matched = CAMPUSES.filter((campus) => {
      if (!q) return true;
      const haystack = [campus.name, campus.region, ...campus.aliases]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    }).slice(0, 12);

    return matched.map((campus) => ({
      id: campus.id,
      name: campus.name,
      subtitle: campus.region,
      latitude: campus.latitude,
      longitude: campus.longitude,
      source: 'campus' as const,
    }));
  }

  /**
   * 임의 장소 검색.
   * 실제 지오코딩이 없으므로, 픽스처에 있는 학교를 기준으로 "○○ 중문"처럼
   * 사용자가 입력한 키워드를 붙여 반환한다.
   * 좌표는 픽스처의 대표 좌표를 그대로 쓰며, 새 좌표를 지어내지 않는다.
   */
  async searchPlaces(keyword: string): Promise<PlaceSearchResult[]> {
    const q = keyword.trim();
    if (!q) return [];

    const tokens = q.split(/\s+/);
    const base = tokens[0];
    const campusHits = await this.searchCampuses(base);

    if (campusHits.length === 0) return [];

    const suffix = tokens.slice(1).join(' ');
    return campusHits.slice(0, 6).map((hit) => ({
      ...hit,
      id: `${hit.id}:${suffix || 'main'}`,
      name: suffix ? `${hit.name} ${suffix}` : hit.name,
      subtitle: suffix ? `${hit.subtitle} · 대표 좌표 기준` : hit.subtitle,
      source: 'search' as const,
    }));
  }
}
