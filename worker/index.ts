import { neon } from '@neondatabase/serverless';
import { handleApi } from '../server/api';
import { handlePlaces, probeKakao } from '../server/places';
import { diagnoseEnv } from './diagnose';
import { renderStatusPage } from './status-page';
import { fetchPhoto, probeGoogle } from '../server/places-google';
import type { Sql } from '../server/sql';

export interface Env {
  /** 빌드된 정적 파일(dist) 바인딩 */
  ASSETS: Fetcher;
  /** Neon 커넥션 문자열. 대시보드에 Secret 으로 넣는다 (VITE_ 접두사 금지) */
  DATABASE_URL: string;
  /** 카카오 REST API 키 (이름·카테고리·거리만) */
  KAKAO_REST_API_KEY?: string;
  /** 구글 Places API 키 (평점·가격대·영업여부·사진). 있으면 이쪽을 우선 쓴다 */
  GOOGLE_PLACES_API_KEY?: string;
  /**
   * 구글 월 호출 상한. 넘으면 카카오로 자동 전환한다.
   * 구글 무료 한도가 월 1,000건이라 기본값은 여유를 둔 900.
   */
  GOOGLE_MONTHLY_LIMIT?: string;
}

/**
 * MEALGAME Worker.
 *
 * 하나의 Worker 가 두 가지를 한다:
 *   /api/*  → 방 API (Neon)
 *   그 외    → 빌드된 SPA. 없는 경로는 index.html 로 넘겨서 새로고침해도 앱이 뜨게 한다.
 *
 * 해시가 붙은 정적 자산(/assets/*)은 자산 계층에서 바로 나가고 Worker 는 실행되지 않는다.
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    /**
     * 설정 진단용.
     *
     * 기본은 "무엇이 Worker 에 도달했는지"(이름·길이·형식)만 본다 — 값은 한 글자도 내보내지 않는다.
     * ?probe=1 을 붙이면 그 키로 카카오에 실제 호출을 한 번 넣어보고,
     * 카카오가 왜 거부하는지(키 오류 / 카카오맵 미사용 / 한도 초과)까지 알려준다.
     */
    // 사람이 읽는 설정 점검 페이지. 폰에서 열어 한눈에 보라고 만든 것이다.
    // (SPA 라우트보다 먼저 잡아야 앱이 가로채지 않는다)
    if (url.pathname === '/status') {
      const diagnosis = diagnoseEnv(env as unknown as Record<string, unknown>);
      return new Response(
        renderStatusPage({
          host: url.host,
          database: Boolean(env.DATABASE_URL),
          kakao: Boolean(env.KAKAO_REST_API_KEY),
          google: Boolean(env.GOOGLE_PLACES_API_KEY),
          diagnosis,
        }),
        {
          status: 200,
          headers: {
            'content-type': 'text/html; charset=utf-8',
            'cache-control': 'no-store',
            'x-robots-tag': 'noindex',
          },
        },
      );
    }

    if (url.pathname === '/api/status') {
      const diagnosis = diagnoseEnv(env as unknown as Record<string, unknown>);
      const body: Record<string, unknown> = {
        ok: true,
        statusVersion: 3,
        // 어느 Worker 를 보고 있는지 — 여러 개 만들었을 때 헷갈리지 않게
        host: url.host,
        database: Boolean(env.DATABASE_URL),
        places: {
          kakao: Boolean(env.KAKAO_REST_API_KEY),
          google: Boolean(env.GOOGLE_PLACES_API_KEY),
        },
        summary: diagnosis.summary,
        bindings: diagnosis.bindings,
        shapes: diagnosis.shapes,
      };

      if (url.searchParams.get('probe') === '1') {
        // 설정된 제공자만 시험한다 — 없는 키로 외부 호출을 낭비하지 않는다
        const [kakao, google] = await Promise.all([
          env.KAKAO_REST_API_KEY
            ? probeKakao(env.KAKAO_REST_API_KEY)
            : Promise.resolve({
                ok: false,
                status: 0,
                diagnosis:
                  'KAKAO_REST_API_KEY 가 Worker 에 없습니다. 빌드 변수에 넣고 다시 배포하세요.',
              }),
          env.GOOGLE_PLACES_API_KEY ? probeGoogle(env.GOOGLE_PLACES_API_KEY) : null,
        ]);
        body.probe = google ? { kakao, google } : { kakao };
      }

      // 진단 결과는 캐시되면 안 된다 — 설정을 고친 직후에 다시 물어보게 된다
      return json(body, 200, { 'cache-control': 'no-store' });
    }

    // 식당 사진 프록시 — 구글 키를 노출하지 않고 이미지를 중계한다.
    // 사진은 결과 화면에서 한 장만 요청하고, 오래 캐시해서 이미지 과금을 줄인다.
    if (url.pathname === '/api/places/photo') {
      if (!env.GOOGLE_PLACES_API_KEY) return new Response(null, { status: 404 });

      const cache = caches.default;
      const cached = await cache.match(request);
      if (cached) return cached;

      const response = await fetchPhoto(
        url.searchParams.get('name') ?? '',
        Number(url.searchParams.get('w')) || 480,
        env.GOOGLE_PLACES_API_KEY,
      );
      if (response.ok) ctx.waitUntil(cache.put(request, response.clone()));
      return response;
    }

    // 식당 검색 프록시 — API 키를 브라우저에 내보내지 않기 위해 서버에서만 부른다
    if (url.pathname === '/api/places') {
      const cache = caches.default;
      const cached = await cache.match(request);
      if (cached) return cached;

      const response = await handlePlaces(
        request,
        { kakao: env.KAKAO_REST_API_KEY, google: env.GOOGLE_PLACES_API_KEY },
        {
          // 사용량 카운터는 방 DB 를 그대로 쓴다
          sql: env.DATABASE_URL ? (neon(env.DATABASE_URL) as unknown as Sql) : undefined,
          googleMonthlyLimit: Number(env.GOOGLE_MONTHLY_LIMIT) || 900,
        },
      );
      // 같은 좌표를 다시 검색해도 외부 API 할당량을 다시 쓰지 않게 잠깐 저장해둔다
      if (response.ok && request.method === 'GET') {
        ctx.waitUntil(cache.put(request, response.clone()));
      }
      return response;
    }

    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      if (!env.DATABASE_URL) {
        return json(
          { error: 'unknown', message: 'DATABASE_URL 이 설정되지 않았습니다.' },
          500,
        );
      }
      // Neon HTTP 드라이버 — Workers 런타임에서 fetch 기반으로 동작한다
      const sql = neon(env.DATABASE_URL) as unknown as Sql;
      return handleApi(request, sql);
    }

    const asset = await env.ASSETS.fetch(request);
    if (asset.status !== 404) return asset;

    // SPA 폴백 — /room/A7K3 같은 주소를 새로고침해도 앱이 뜨게 한다.
    //
    // 주의: /index.html 을 그대로 요청하면 자산 계층이 '/' 로 307 리다이렉트한다.
    // 그 응답을 흘려보내면 주소창이 '/' 로 바뀌어 초대 링크의 방 코드가 사라진다.
    // 그래서 루트 문서를 받아 원래 주소에 200 으로 실어 보낸다.
    const index = await env.ASSETS.fetch(new Request(new URL('/', url.origin)));
    return new Response(index.body, { status: 200, headers: index.headers });
  },
} satisfies ExportedHandler<Env>;

function json(
  body: unknown,
  status: number,
  extra: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...extra },
  });
}
