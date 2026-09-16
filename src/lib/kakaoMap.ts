import { ENV } from '@/config/env';

/**
 * 카카오 지도 JavaScript SDK 로더.
 *
 * 지도는 위치를 고를 때만 필요하므로 앱 시작 시 받지 않는다. 처음 열 때 한 번만
 * 내려받고, 그 다음부터는 같은 약속(promise)을 재사용한다.
 *
 * ⚠️ 여기 쓰는 키는 REST 키가 아니라 JavaScript 키다. 브라우저에 노출되는 게
 * 정상이고, 콘솔 [플랫폼 → Web] 에 등록한 도메인에서만 동작한다.
 */

const SCRIPT_ID = 'kakao-maps-sdk';
/** 이 시간 안에 뜨지 않으면 설정 문제로 본다 */
const LOAD_TIMEOUT_MS = 8_000;

export type KakaoMapErrorCode = 'no-key' | 'blocked' | 'timeout';

export class KakaoMapError extends Error {
  code: KakaoMapErrorCode;
  constructor(code: KakaoMapErrorCode, message: string) {
    super(message);
    this.name = 'KakaoMapError';
    this.code = code;
  }
}

export const KAKAO_MAP_ERROR: Record<KakaoMapErrorCode, string> = {
  'no-key': '지도 기능이 설정되지 않았어요.',
  blocked:
    '지도를 불러오지 못했어요. 카카오 개발자 콘솔 [플랫폼 → Web] 에 이 주소가 등록되어 있는지 확인해 주세요.',
  timeout: '지도를 불러오는 데 너무 오래 걸려요. 잠시 후 다시 시도해 주세요.',
};

/** 우리가 실제로 쓰는 SDK 표면만 선언한다 (전체 타입 패키지를 끌어오지 않는다) */
export interface KakaoLatLng {
  getLat(): number;
  getLng(): number;
}

export interface KakaoMap {
  setCenter(position: KakaoLatLng): void;
  getCenter(): KakaoLatLng;
  setLevel(level: number): void;
  relayout(): void;
}

export interface KakaoCircle {
  setPosition(position: KakaoLatLng): void;
  setRadius(radius: number): void;
  setMap(map: KakaoMap | null): void;
}

export interface KakaoAddress {
  road_address?: { address_name?: string } | null;
  address?: { address_name?: string } | null;
}

export interface KakaoMaps {
  LatLng: new (lat: number, lng: number) => KakaoLatLng;
  Map: new (container: HTMLElement, options: { center: KakaoLatLng; level: number }) => KakaoMap;
  Circle: new (options: {
    center: KakaoLatLng;
    radius: number;
    strokeWeight: number;
    strokeColor: string;
    strokeOpacity: number;
    fillColor: string;
    fillOpacity: number;
  }) => KakaoCircle;
  event: {
    addListener(target: unknown, type: string, handler: () => void): void;
  };
  services: {
    Geocoder: new () => {
      coord2Address(
        lng: number,
        lat: number,
        callback: (result: KakaoAddress[], status: string) => void,
      ): void;
    };
    Status: { OK: string };
  };
}

declare global {
  interface Window {
    kakao?: { maps?: KakaoMaps & { load(callback: () => void): void } };
  }
}

let loading: Promise<KakaoMaps> | null = null;

export function isMapAvailable(): boolean {
  return Boolean(ENV.kakaoJsKey);
}

export function loadKakaoMaps(): Promise<KakaoMaps> {
  if (!ENV.kakaoJsKey) {
    return Promise.reject(new KakaoMapError('no-key', KAKAO_MAP_ERROR['no-key']));
  }
  if (loading) return loading;

  // 이미 올라와 있으면 다시 받지 않는다 (index.html 에서 직접 넣은 경우 포함)
  const already = window.kakao?.maps;
  if (already && typeof already.Map === 'function') {
    loading = Promise.resolve(already);
    return loading;
  }

  loading = new Promise<KakaoMaps>((resolve, reject) => {
    const fail = (error: KakaoMapError) => {
      // 실패한 약속을 남겨두면 다시 시도할 수 없다
      loading = null;
      reject(error);
    };

    const timer = window.setTimeout(
      () => fail(new KakaoMapError('timeout', KAKAO_MAP_ERROR.timeout)),
      LOAD_TIMEOUT_MS,
    );

    const ready = () => {
      const maps = window.kakao?.maps;
      if (!maps) {
        window.clearTimeout(timer);
        fail(new KakaoMapError('blocked', KAKAO_MAP_ERROR.blocked));
        return;
      }
      // autoload=false 로 받았으므로 직접 초기화한다
      maps.load(() => {
        window.clearTimeout(timer);
        resolve(maps);
      });
    };

    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      existing.addEventListener('load', ready);
      existing.addEventListener('error', () => {
        window.clearTimeout(timer);
        fail(new KakaoMapError('blocked', KAKAO_MAP_ERROR.blocked));
      });
      if (window.kakao?.maps) ready();
      return;
    }

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.async = true;
    script.src =
      `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(ENV.kakaoJsKey)}` +
      '&autoload=false&libraries=services';
    script.onload = ready;
    script.onerror = () => {
      window.clearTimeout(timer);
      script.remove();
      fail(new KakaoMapError('blocked', KAKAO_MAP_ERROR.blocked));
    };
    document.head.appendChild(script);
  });

  return loading;
}

/** 좌표 → 주소. 실패해도 위치 선택은 막지 않는다 */
export function coordToAddress(maps: KakaoMaps, lat: number, lng: number): Promise<string> {
  return new Promise((resolve) => {
    try {
      new maps.services.Geocoder().coord2Address(lng, lat, (result, status) => {
        if (status !== maps.services.Status.OK || !result[0]) return resolve('');
        const found = result[0];
        resolve(
          found.road_address?.address_name || found.address?.address_name || '',
        );
      });
    } catch {
      resolve('');
    }
  });
}

/** 긴 주소에서 화면에 보여줄 짧은 이름을 만든다 */
export function shortPlaceName(address: string): string {
  const parts = address.split(' ').filter(Boolean);
  return parts.length > 2 ? parts.slice(-2).join(' ') : address;
}
