/** 식당 카테고리 — UI 필터와 데이터 계층이 공유한다. */
export type FoodCategory =
  | 'korean'
  | 'chinese'
  | 'japanese'
  | 'western'
  | 'chicken'
  | 'snack'
  | 'meat'
  | 'cafe'
  | 'etc';

export const FOOD_CATEGORIES: { id: FoodCategory; label: string; emoji: string }[] = [
  { id: 'korean', label: '한식', emoji: '🍚' },
  { id: 'chinese', label: '중식', emoji: '🥟' },
  { id: 'japanese', label: '일식', emoji: '🍣' },
  { id: 'western', label: '양식', emoji: '🍝' },
  { id: 'chicken', label: '치킨', emoji: '🍗' },
  { id: 'snack', label: '분식', emoji: '🍢' },
  { id: 'meat', label: '고기', emoji: '🥓' },
  { id: 'cafe', label: '카페', emoji: '☕' },
  { id: 'etc', label: '기타', emoji: '🍽️' },
];

export const CATEGORY_LABEL: Record<FoodCategory, string> = FOOD_CATEGORIES.reduce(
  (acc, c) => ({ ...acc, [c.id]: c.label }),
  {} as Record<FoodCategory, string>,
);

export const CATEGORY_EMOJI: Record<FoodCategory, string> = FOOD_CATEGORIES.reduce(
  (acc, c) => ({ ...acc, [c.id]: c.emoji }),
  {} as Record<FoodCategory, string>,
);

export interface MenuItem {
  name: string;
  price: number;
}

/**
 * 식당 도메인 모델.
 * 어떤 데이터 소스(mock / 카카오 / 구글 등)를 쓰더라도 이 형태로 정규화한다.
 */
export interface Restaurant {
  id: string;
  name: string;
  category: FoodCategory;
  latitude: number;
  longitude: number;
  address: string;
  /** 0~5. 0 이면 "데이터 없음" (모든 제공자가 평점을 주지는 않는다) */
  rating: number;
  /** 1인 기준 평균 가격(원). 0 이면 "데이터 없음" */
  priceRange: number;
  /** true/false 는 확인된 값, null 은 "알 수 없음" — 모른다고 영업종료로 표시하지 않는다 */
  isOpen: boolean | null;
  /** 기준 좌표로부터의 거리(m). 데이터 계층에서 계산해 채운다. */
  distance: number;
  thumbnail?: string;
  menu: MenuItem[];
  tags: string[];
  /** 외부 지도 링크 (없으면 좌표 기반으로 생성) */
  placeUrl?: string;
}

/** 위/경도 + 사람이 읽는 이름 */
export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface PlaceLocation extends GeoPoint {
  /** 예: "충북대학교 중문" */
  name: string;
  /** 위치를 어떻게 얻었는지 */
  source: 'current' | 'campus' | 'search' | 'default';
  address?: string;
}

/** 식당 검색 조건 */
export interface RestaurantFilters {
  /** 1인 예산 상한(원) */
  budget: number;
  /** 비어 있으면 전체 */
  categories: FoodCategory[];
  /** 제외할 카테고리 (먹기 싫은 음식) */
  excludedCategories: FoodCategory[];
  minRating: number;
  openNowOnly: boolean;
}

export interface RestaurantQuery {
  location: GeoPoint;
  radius: number;
  filters: RestaurantFilters;
  limit?: number;
}

export const DEFAULT_FILTERS: RestaurantFilters = {
  budget: 15_000,
  categories: [],
  excludedCategories: [],
  minRating: 0,
  openNowOnly: false,
};
