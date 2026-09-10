import { neon } from '@neondatabase/serverless';
import { handleApi } from '../server/api';
import type { Sql } from '../server/sql';

export interface Env {
  /** 빌드된 정적 파일(dist) 바인딩 */
  ASSETS: Fetcher;
  /** Neon 커넥션 문자열. 대시보드에 Secret 으로 넣는다 (VITE_ 접두사 금지) */
  DATABASE_URL: string;
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
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

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

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}
