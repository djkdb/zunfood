import { useCallback, useState } from 'react';
import { GeolocationFailure, getCurrentPosition } from '@/lib/geo';
import type { PlaceLocation } from '@/types/restaurant';

interface State {
  loading: boolean;
  error: string | null;
}

/** 현재 위치 요청 훅 — 권한 거부/실패 메시지를 사람이 읽을 수 있게 돌려준다. */
export function useGeolocation() {
  const [state, setState] = useState<State>({ loading: false, error: null });

  const request = useCallback(async (): Promise<PlaceLocation | null> => {
    setState({ loading: true, error: null });
    try {
      const point = await getCurrentPosition();
      setState({ loading: false, error: null });
      return { ...point, name: '현재 위치', source: 'current' };
    } catch (error) {
      const message =
        error instanceof GeolocationFailure
          ? error.message
          : '위치를 가져오지 못했어요. 장소를 검색해 주세요.';
      setState({ loading: false, error: message });
      return null;
    }
  }, []);

  const clearError = useCallback(() => setState((s) => ({ ...s, error: null })), []);

  return { ...state, request, clearError };
}
