import { neon } from '@neondatabase/serverless';
import { handleApi } from '../../server/api';
import type { Sql } from '../../server/sql';

interface Env {
  /** Neon 커넥션 문자열. Cloudflare 대시보드에 Secret 으로 넣는다 (절대 VITE_ 로 노출 금지) */
  DATABASE_URL: string;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const url = context.env.DATABASE_URL;
  if (!url) {
    return new Response(
      JSON.stringify({ error: 'unknown', message: 'DATABASE_URL 이 설정되지 않았습니다.' }),
      { status: 500, headers: { 'content-type': 'application/json; charset=utf-8' } },
    );
  }

  // Neon HTTP 드라이버 — Workers 런타임에서 fetch 기반으로 동작한다
  const sql = neon(url) as unknown as Sql;
  return handleApi(context.request, sql);
};
