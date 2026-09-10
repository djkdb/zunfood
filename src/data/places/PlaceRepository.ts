import type { PlaceLocation } from '@/types/restaurant';

export interface PlaceSearchResult extends PlaceLocation {
  id: string;
  /** 부가 설명 (지역/도로명 주소 등) */
  subtitle?: string;
}

/**
 * 장소/학교 검색 계층.
 * 지금은 내장 픽스처 기반이고, 실제 지오코딩 API 로 교체할 수 있다.
 */
export interface PlaceRepository {
  readonly source: string;
  searchCampuses(keyword: string): Promise<PlaceSearchResult[]>;
  searchPlaces(keyword: string): Promise<PlaceSearchResult[]>;
}
