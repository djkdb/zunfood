/**
 * 환경변수 접근 지점. 코드에 키를 하드코딩하지 않는다.
 * 값이 없으면 앱은 자동으로 로컬(오프라인) 모드로 동작한다.
 */
const raw = import.meta.env;

export const ENV = {
  /**
   * 방 API 주소. Cloudflare Pages 에 배포하면 '/api' 로 두면 된다.
   * 비워두면 같은 기기의 탭끼리만 동기화되는 로컬 모드로 동작한다.
   */
  apiBase: (raw.VITE_API_BASE ?? '').trim(),
  /** 'mock' | 'kakao' — 식당 데이터 소스 */
  placesProvider: (raw.VITE_PLACES_PROVIDER ?? 'mock').trim(),
  kakaoRestApiKey: (raw.VITE_KAKAO_REST_API_KEY ?? '').trim(),
  /** 'mock' | 'http' — AI 판사 제공자 */
  aiJudgeProvider: (raw.VITE_AI_JUDGE_PROVIDER ?? 'mock').trim(),
  /** AI 판결을 대신 호출해주는 서버 엔드포인트 (키는 서버에 보관) */
  aiJudgeEndpoint: (raw.VITE_AI_JUDGE_ENDPOINT ?? '').trim(),
} as const;

/** 서버 백엔드(Neon)를 쓸 수 있는지 — 다른 기기 간 동기화 가능 여부와 같다 */
export const hasRemoteBackend = Boolean(ENV.apiBase);
