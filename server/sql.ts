/**
 * 서버에서 쓰는 최소 SQL 인터페이스.
 *
 * Neon 의 `neon()` 태그드 템플릿과 동일한 시그니처라, 프로덕션에서는 Neon 을 그대로 꽂고
 * 테스트에서는 일반 Postgres 클라이언트를 꽂을 수 있다.
 */
export type Sql = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<Record<string, unknown>[]>;
