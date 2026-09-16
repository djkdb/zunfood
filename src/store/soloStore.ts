import { create } from 'zustand';
import { SEARCH } from '@/config/app';
import { getRestaurantRepository, RestaurantSearchError } from '@/data/restaurants';
import { isPlayable, pickRestaurant, type SoloMethod } from '@/solo/methods';
import { DEFAULT_FILTERS, type PlaceLocation, type Restaurant, type RestaurantFilters } from '@/types/restaurant';

const STORAGE_KEY = 'mealgame:solo';

export type SoloStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

interface Persisted {
  location: PlaceLocation | null;
  radius: number;
  filters: RestaurantFilters;
  method: SoloMethod;
}

interface SoloState extends Persisted {
  status: SoloStatus;
  candidates: Restaurant[];
  result: Restaurant | null;
  reason: string;
  error: string | null;
  /** 직접 플레이하는 방식의 판 배치를 고정하는 시드. 다시 하면 바뀐다 */
  playSeed: number;

  setLocation: (location: PlaceLocation) => void;
  setRadius: (radius: number) => void;
  setFilters: (filters: RestaurantFilters) => void;
  setMethod: (method: SoloMethod) => void;
  /** 후보를 새로 불러와 한 곳을 고른다 */
  decide: () => Promise<void>;
  /** 이미 불러온 후보 안에서 다시 뽑는다 (네트워크 재호출 없음) */
  reroll: () => void;
  /** 직접 플레이하는 방식에서 결과가 정해졌을 때 */
  commit: (winner: Restaurant, reason: string) => void;
  /** "반경 넓히기" 같은 복구 액션 */
  widenRadius: () => Promise<void>;
  reset: () => void;
}

function loadPersisted(): Persisted {
  const fallback: Persisted = {
    location: null,
    radius: SEARCH.defaultRadius,
    filters: { ...DEFAULT_FILTERS, budget: SEARCH.defaultBudget },
    method: 'roulette',
  };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...fallback, ...(JSON.parse(raw) as Partial<Persisted>) } : fallback;
  } catch {
    return fallback;
  }
}

function persist(state: Persisted): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        location: state.location,
        radius: state.radius,
        filters: state.filters,
        method: state.method,
      }),
    );
  } catch {
    // 저장 실패는 무시 — 이번 세션에서만 유지된다
  }
}

/**
 * 혼자 결정하기 상태.
 * 멀티(방) 상태와 완전히 분리되어 있고, 마지막 설정은 기기에 남겨
 * 다음에 열었을 때 바로 결정할 수 있게 한다.
 */
export const useSoloStore = create<SoloState>((set, get) => ({
  ...loadPersisted(),
  status: 'idle',
  candidates: [],
  result: null,
  reason: '',
  error: null,
  playSeed: Date.now(),

  setLocation(location) {
    set({ location });
    persist(get());
  },
  setRadius(radius) {
    set({ radius });
    persist(get());
  },
  setFilters(filters) {
    set({ filters });
    persist(get());
  },
  setMethod(method) {
    set({ method });
    persist(get());
  },

  async decide() {
    const { location, radius, filters, method } = get();
    if (!location) {
      set({ status: 'error', error: '먼저 위치를 정해주세요.' });
      return;
    }

    set({ status: 'loading', error: null, result: null });
    try {
      const candidates = await getRestaurantRepository().search({
        location,
        radius,
        filters,
        // 후보는 넉넉할수록 좋다 — 월드컵·스와이프 같은 방식이 고를 거리가 생긴다
        limit: 90,
      });

      if (candidates.length === 0) {
        set({ status: 'empty', candidates: [] });
        return;
      }

      // 직접 플레이하는 방식은 화면에서 결정한다 — 여기서 미리 뽑지 않는다
      if (isPlayable(method)) {
        set({ candidates, status: 'ready', result: null, reason: '', playSeed: Date.now() });
        return;
      }

      const pick = pickRestaurant(method, candidates, Date.now(), filters.budget);
      set({
        candidates,
        status: 'ready',
        result: pick?.winner ?? null,
        reason: pick?.reason ?? '',
      });
    } catch (error) {
      set({
        status: 'error',
        error:
          error instanceof RestaurantSearchError
            ? error.message
            : '식당 정보를 불러오지 못했어요.',
      });
    }
  },

  reroll() {
    const { candidates, method, filters } = get();
    if (candidates.length === 0) {
      void get().decide();
      return;
    }
    // 플레이하는 방식은 "다시 뽑기" 가 곧 새 판이다
    if (isPlayable(method)) {
      set({ result: null, reason: '', status: 'ready', playSeed: Date.now() });
      return;
    }
    const pick = pickRestaurant(method, candidates, Date.now(), filters.budget);
    set({ result: pick?.winner ?? null, reason: pick?.reason ?? '', status: 'ready' });
  },

  commit(winner, reason) {
    set({ result: winner, reason, status: 'ready' });
  },

  async widenRadius() {
    const next = SEARCH.radiusOptions.find((r) => r > get().radius);
    if (next) {
      set({ radius: next });
      persist(get());
    }
    await get().decide();
  },

  reset() {
    set({ status: 'idle', candidates: [], result: null, reason: '', error: null });
  },
}));
