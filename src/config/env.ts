/**
 * 환경변수 접근 지점. 코드에 키를 하드코딩하지 않는다.
 *
 * 배포(프로덕션 빌드)에서는 이 저장소가 곧 Worker 이므로 `/api` 가 항상 존재한다.
 * 그래서 기본값만으로도 동작하도록 잡아두고, 별도 설정 없이 배포할 수 있게 한다.
 * 로컬 `vite dev` 에는 `/api` 가 없으므로 로컬 모드로 떨어진다.
 */
const raw = import.meta.env;

/** 값을 지정하지 않았을 때만 기본값을 쓴다 (빈 문자열로 명시하면 그 뜻을 존중한다) */
function withDefault(value: string | undefined, fallback: string): string {
  return (value === undefined ? fallback : value).trim();
}

export const ENV = {
  /**
   * 방 API 주소.
   * 배포 빌드에서는 기본 '/api', 로컬 개발에서는 기본 '' (로컬 모드).
   * 명시적으로 '' 를 주면 배포에서도 로컬 모드로 둘 수 있다.
   */
  apiBase: withDefault(raw.VITE_API_BASE, raw.PROD ? '/api' : ''),
  /**
   * 'mock' | 'kakao' | 'google' — 식당 데이터 소스.
   * 기본은 카카오(무료, 일 10만). 서버에 키가 없으면 목업 데이터로 자동 폴백한다.
   */
  placesProvider: withDefault(raw.VITE_PLACES_PROVIDER, 'kakao'),
  /** 'mock' | 'http' — AI 판사 제공자 */
  aiJudgeProvider: withDefault(raw.VITE_AI_JUDGE_PROVIDER, 'mock'),
  /** AI 판결을 대신 호출해주는 서버 엔드포인트 (키는 서버에 보관) */
  aiJudgeEndpoint: withDefault(raw.VITE_AI_JUDGE_ENDPOINT, ''),
} as const;

/** 서버 백엔드(Neon)를 쓸 수 있는지 — 다른 기기 간 동기화 가능 여부와 같다 */
export const hasRemoteBackend = Boolean(ENV.apiBase);
