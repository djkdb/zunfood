import type { GeoPoint } from '@/types/restaurant';

const EARTH_RADIUS_M = 6_371_000;

/** 두 좌표 사이 거리(m) — Haversine */
export function distanceInMeters(a: GeoPoint, b: GeoPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return Math.round(2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h)));
}

/** 도보 예상 시간(분). 성인 보행 속도 약 67m/분 */
export function walkingMinutes(meters: number): number {
  return Math.max(1, Math.round(meters / 67));
}

export type GeolocationErrorCode = 'denied' | 'unavailable' | 'timeout' | 'unsupported';

export class GeolocationFailure extends Error {
  code: GeolocationErrorCode;
  constructor(code: GeolocationErrorCode, message: string) {
    super(message);
    this.name = 'GeolocationFailure';
    this.code = code;
  }
}

const GEO_MESSAGES: Record<GeolocationErrorCode, string> = {
  denied: '위치 권한이 거부됐어요. 학교를 선택하거나 장소를 검색해 주세요.',
  unavailable: '위치를 찾을 수 없어요. 학교를 선택하거나 장소를 검색해 주세요.',
  timeout: '위치를 가져오는 데 너무 오래 걸려요. 다시 시도하거나 장소를 검색해 주세요.',
  unsupported: '이 브라우저는 위치 기능을 지원하지 않아요. 장소를 검색해 주세요.',
};

export function geolocationMessage(code: GeolocationErrorCode): string {
  return GEO_MESSAGES[code];
}

/** 현재 위치 요청. 실패 시 GeolocationFailure 를 던진다. */
export function getCurrentPosition(timeoutMs = 8_000): Promise<GeoPoint> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new GeolocationFailure('unsupported', GEO_MESSAGES.unsupported));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      (err) => {
        const code: GeolocationErrorCode =
          err.code === err.PERMISSION_DENIED
            ? 'denied'
            : err.code === err.TIMEOUT
              ? 'timeout'
              : 'unavailable';
        reject(new GeolocationFailure(code, GEO_MESSAGES[code]));
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60_000 },
    );
  });
}
