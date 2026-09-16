#!/usr/bin/env node
/**
 * Cloudflare 배포 — 빌드 환경변수를 런타임 Secret 으로 승격시킨 뒤 배포한다.
 *
 * 왜 이렇게 하나:
 *   대시보드에서 런타임 Secret 을 넣는 방법은 실패하는 경로가 너무 많다.
 *   이름이 같은 Build 칸에 넣거나, Type 을 Text 로 두거나(다음 배포 때 지워진다),
 *   Deploy 버튼을 안 누르거나, 다른 Worker 에 넣거나.
 *   여기서는 빌드가 볼 수 있는 환경변수를 매 배포마다 Secret 으로 다시 심는다.
 *   그래서 위의 어떤 경우로 값이 사라져도 다음 배포에서 저절로 복구된다.
 *
 * 값은 stdin 으로만 넘긴다 — 명령줄 인자로 주면 빌드 로그와 프로세스 목록에 남는다.
 */
import { spawn } from 'node:child_process';

/** 승격할 환경변수. VITE_ 접두사가 없으므로 브라우저 번들에는 들어가지 않는다. */
const SECRETS = ['DATABASE_URL', 'KAKAO_REST_API_KEY', 'GOOGLE_PLACES_API_KEY'];

const WRANGLER = process.env.WRANGLER_BIN ?? 'wrangler';

function run(args, { input } = {}) {
  return new Promise((resolve) => {
    const child = spawn(WRANGLER, args, {
      stdio: [input === undefined ? 'inherit' : 'pipe', 'inherit', 'inherit'],
    });
    if (input !== undefined) {
      child.stdin.end(input);
    }
    child.on('close', (code) => resolve(code ?? 1));
    child.on('error', () => resolve(1));
  });
}

async function main() {
  // 1) 먼저 배포한다. Worker 가 없으면 secret put 이 실패하므로 순서가 중요하다.
  const deployed = await run(['deploy']);
  if (deployed !== 0) {
    console.error('\n✘ wrangler deploy 실패');
    process.exit(deployed);
  }

  // 2) 빌드 환경에 있는 값만 Secret 으로 심는다. 없는 값은 건드리지 않는다
  //    (이미 들어가 있는 Secret 을 빈 값으로 덮어쓰지 않기 위해서다).
  const present = SECRETS.filter((name) => (process.env[name] ?? '').trim() !== '');
  const missing = SECRETS.filter((name) => !present.includes(name));

  if (present.length === 0) {
    console.warn(
      '\n⚠  빌드 환경에 승격할 값이 없습니다.' +
        '\n   Cloudflare → Workers & Pages → 이 Worker → Settings → Build →' +
        '\n   Variables and Secrets 에 아래 이름으로 넣어주세요:' +
        `\n   ${SECRETS.join(', ')}` +
        '\n   (이미 런타임 Secret 으로 들어가 있다면 이 경고는 무시해도 됩니다.)',
    );
    return;
  }

  for (const name of present) {
    // 값 앞뒤 공백은 흔한 복사 실수다. 여기서 정리해서 넣는다.
    const value = String(process.env[name]).trim();
    console.log(`\n→ ${name} 을(를) 런타임 Secret 으로 심는 중 (${value.length}자)`);
    const code = await run(['secret', 'put', name], { input: value });
    if (code !== 0) {
      // 배포 자체는 이미 끝났다. 여기서 실패해도 앱은 뜬다 — 데이터만 예시로 나온다.
      console.error(`✘ ${name} 등록 실패. /status 에서 확인해 주세요.`);
    }
  }

  if (missing.length > 0) {
    console.log(`\nℹ  빌드 환경에 없어 건드리지 않은 값: ${missing.join(', ')}`);
  }
  console.log('\n✔ 배포 완료. /status 에서 확인하세요.');
}

await main();
