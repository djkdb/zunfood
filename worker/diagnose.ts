/**
 * Worker 설정 진단.
 *
 * "키가 있다/없다"만으로는 원인을 못 가린다. 실제로 자주 나는 일은 이렇다:
 *   - 대시보드에서 Type 을 Text 로 넣었다 → 다음 배포 때 지워진다
 *   - 이름을 비슷하게 적었다 (KAKAO_API_KEY / KAKAO_REST_KEY ...)
 *   - 값을 복사할 때 앞뒤 공백이나 따옴표가 붙었다
 *   - REST API 키 대신 JavaScript 키를 넣었다
 *
 * 그래서 "무엇이 들어왔는지(이름)"와 "어떤 모양인지(길이/공백/형식)"만 본다.
 * 값 자체는 한 글자도 내보내지 않는다.
 */

/** 이 Worker 가 런타임에 기대하는 Secret 이름 */
const EXPECTED = ['DATABASE_URL', 'KAKAO_REST_API_KEY', 'GOOGLE_PLACES_API_KEY'] as const;
/** 변수가 아니라 바인딩이라 값이 문자열이 아니다 */
const NON_SECRET_BINDINGS = ['ASSETS'];
/** 카카오 REST API 키는 32자리 16진수다 */
const KAKAO_KEY_PATTERN = /^[0-9a-f]{32}$/i;

export interface ValueShape {
  length: number;
  /** 앞뒤 공백을 뺀 길이. length 와 다르면 복사할 때 공백이 붙었다 */
  trimmedLength: number;
  /** 값이 "..." 나 '...' 로 감싸여 있는지 */
  quoted: boolean;
}

export interface EnvDiagnosis {
  /** Worker 에 실제로 도달한 바인딩 이름 (값은 없다) */
  bindings: string[];
  shapes: Record<string, ValueShape>;
  /** 발견된 문제들. 비어 있으면 설정이 온전하다는 뜻이다 */
  problems: string[];
  /** problems 를 한 줄로 합친 것 */
  summary: string;
}

const ALL_GOOD = '필요한 Secret 이 모두 정상 형식으로 도달했습니다.';

export function diagnoseEnv(env: Record<string, unknown>): EnvDiagnosis {
  const bindings = Object.keys(env).sort();
  const shapes: Record<string, ValueShape> = {};

  for (const name of bindings) {
    const value = env[name];
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    shapes[name] = {
      length: value.length,
      trimmedLength: trimmed.length,
      quoted: trimmed.length >= 2 && /^["'].*["']$/.test(trimmed),
    };
  }

  const problems = findProblems(env, bindings, shapes);
  return {
    bindings,
    shapes,
    problems,
    summary: problems.length === 0 ? ALL_GOOD : problems.join(' / '),
  };
}

function findProblems(
  env: Record<string, unknown>,
  bindings: string[],
  shapes: Record<string, ValueShape>,
): string[] {
  const problems: string[] = [];
  const present = (name: string) => typeof env[name] === 'string' && String(env[name]).trim() !== '';

  // 1) 런타임 변수가 아예 없다 — 가장 흔한 원인은 Text 타입으로 넣은 것이다
  const stringVars = bindings.filter((n) => !NON_SECRET_BINDINGS.includes(n) && typeof env[n] === 'string');
  if (stringVars.length === 0) {
    return [
      'Worker 에 런타임 변수가 하나도 도달하지 않았습니다. ' +
      'Settings → Variables and Secrets 에서 Type 을 반드시 [Secret] 으로 넣어주세요 — ' +
      'Text 로 넣은 값은 다음 배포 때 지워집니다. ' +
      'Build 쪽 Variables 칸은 빌드 중에만 존재하므로 여기서는 보이지 않습니다.',
    ];
  }

  // 2) 이름이 비슷하지만 다른 변수
  for (const name of stringVars) {
    if ((EXPECTED as readonly string[]).includes(name)) continue;
    const match = EXPECTED.find((e) => normalize(e) === normalize(name));
    if (match) problems.push(`'${name}' 은 이름이 다릅니다. 정확히 '${match}' 여야 합니다.`);
  }

  // 3) 필수 항목 누락
  if (!present('DATABASE_URL')) {
    problems.push("DATABASE_URL 이 없습니다 — 친구들과 결정(방 만들기)이 동작하지 않습니다.");
  }
  if (!present('KAKAO_REST_API_KEY')) {
    problems.push('KAKAO_REST_API_KEY 가 없습니다 — 식당이 데모 데이터로 나옵니다.');
  }

  // 4) 값의 모양
  for (const name of EXPECTED) {
    const shape = shapes[name];
    if (!shape) continue;
    if (shape.quoted) problems.push(`${name} 값이 따옴표로 감싸여 있습니다. 따옴표 없이 넣어주세요.`);
    else if (shape.length !== shape.trimmedLength) {
      problems.push(`${name} 값에 앞뒤 공백이나 줄바꿈이 섞여 있습니다.`);
    }
  }

  const kakao = env.KAKAO_REST_API_KEY;
  if (typeof kakao === 'string' && kakao.trim() !== '' && !KAKAO_KEY_PATTERN.test(kakao.trim())) {
    problems.push(
      `KAKAO_REST_API_KEY 가 카카오 REST API 키 형식(32자리 16진수)이 아닙니다 (현재 ${kakao.trim().length}자). ` +
        'JavaScript 키나 네이티브 앱 키를 넣으셨을 수 있습니다 — [앱 설정] → [플랫폼 키] 의 REST API 키를 넣어주세요.',
    );
  }

  const database = env.DATABASE_URL;
  if (typeof database === 'string' && database.trim() !== '' && !/^postgres(ql)?:\/\//.test(database.trim())) {
    problems.push("DATABASE_URL 이 'postgresql://' 로 시작하지 않습니다. Neon 의 connection string 을 그대로 넣어주세요.");
  }

  return problems;
}

/** 이름 비교용 — 대소문자와 구분기호 차이를 무시한다 */
function normalize(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}
