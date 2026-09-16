import type { Sql } from './sql';

/** 앱이 돌아가려면 있어야 하는 테이블 */
const REQUIRED_TABLES = ['rooms', 'players', 'game_actions', 'api_usage'];

export interface DatabaseProbe {
  ok: boolean;
  status: number;
  message?: string;
  diagnosis: string;
}

/**
 * DATABASE_URL 이 "있다" 와 "쓸 수 있다" 는 다르다.
 *
 * 연결 문자열이 멀쩡해도 스키마를 한 번도 적용하지 않았으면 테이블이 없다.
 * 그 상태는 키 문제처럼 보이지 않아서 찾기 어렵다 — 어떤 테이블이 없는지 직접 알려준다.
 */
export async function probeDatabase(
  /** 드라이버 생성도 실패할 수 있다 (연결 문자열 형식이 틀린 경우) */
  connect: () => Sql,
  connectionString: string,
): Promise<DatabaseProbe> {
  let sql: Sql;
  try {
    sql = connect();
  } catch (error) {
    return {
      ok: false,
      status: 0,
      message: redact(String(error), connectionString).slice(0, 300),
      diagnosis:
        'DATABASE_URL 의 형식이 올바르지 않습니다. postgresql://사용자:비밀번호@호스트/DB이름 형태여야 합니다 (Neon 콘솔의 Connection string 을 그대로 붙여넣으세요).',
    };
  }

  let rows: Record<string, unknown>[];
  try {
    rows = await sql`
      select table_name from information_schema.tables where table_schema = 'public'`;
  } catch (error) {
    return {
      ok: false,
      status: 0,
      // 드라이버 오류 문구에 접속 정보가 섞여 나올 수 있다
      message: redact(String(error), connectionString).slice(0, 300),
      diagnosis:
        '데이터베이스에 연결하지 못했습니다. DATABASE_URL 이 Neon 의 connection string 이 맞는지, 프로젝트가 잠들지 않았는지 확인하세요.',
    };
  }

  const present = new Set(rows.map((row) => String(row.table_name)));
  const missing = REQUIRED_TABLES.filter((table) => !present.has(table));

  if (missing.length > 0) {
    return {
      ok: false,
      status: 200,
      message: `없는 테이블: ${missing.join(', ')}`,
      diagnosis:
        'Neon 에 스키마가 적용되지 않았습니다. Neon 콘솔의 SQL Editor 에서 저장소의 neon/schema.sql 전체를 붙여넣고 실행하세요.',
    };
  }

  return { ok: true, status: 200, diagnosis: '데이터베이스 연결과 테이블이 모두 정상입니다.' };
}

function redact(text: string, secret: string): string {
  return secret ? text.split(secret).join('***') : text;
}
