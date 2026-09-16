import type { EnvDiagnosis } from './diagnose';

interface StatusPageInput {
  host: string;
  database: boolean;
  kakao: boolean;
  google: boolean;
  diagnosis: EnvDiagnosis;
}

/**
 * 사람이 읽는 설정 점검 페이지 (/status).
 *
 * /api/status 가 돌려주는 JSON 과 같은 내용이지만, 배포 설정을 만지는 사람은
 * 보통 폰으로 확인한다. JSON 을 눈으로 훑고 옮겨 적게 하는 대신 한눈에
 * 무엇이 빠졌고 어디를 눌러야 하는지 보여준다.
 *
 * 키 값은 담지 않는다 — 있음/없음과 바인딩 이름만 나온다.
 */
export function renderStatusPage(input: StatusPageInput): string {
  const { host, database, kakao, google, diagnosis } = input;
  // 값이 다 있어도 형식 문제(공백·따옴표·키 모양)가 남아 있을 수 있다
  const required = database && kakao;
  const healthy = required && diagnosis.problems.length === 0;

  const rows = [
    row('식당 데이터 (카카오)', kakao, 'KAKAO_REST_API_KEY', '없으면 예시 데이터로 나옵니다'),
    row('방 동기화 (Neon)', database, 'DATABASE_URL', '없으면 친구들과 결정하기가 안 됩니다'),
    row('평점·사진 (구글, 선택)', google, 'GOOGLE_PLACES_API_KEY', '없어도 됩니다', true),
  ].join('');

  const bindings = diagnosis.bindings.length
    ? diagnosis.bindings.map((n) => `<code>${esc(n)}</code>`).join(' ')
    : '<em>없음</em>';

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>MEALGAME 설정 점검</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 24px 16px 56px;
    font: 15px/1.6 -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo",
      "Pretendard", "Malgun Gothic", sans-serif;
    color: #101828; background: #f6f7f9;
    word-break: keep-all; overflow-wrap: break-word;
  }
  .wrap { max-width: 440px; margin: 0 auto; }
  h1 { font-size: 22px; margin: 0 0 4px; letter-spacing: -0.02em; }
  .host { font-size: 13px; color: #667085; margin: 0 0 20px; }
  .verdict {
    border-radius: 14px; padding: 16px; margin-bottom: 20px;
    font-weight: 700; line-height: 1.5;
  }
  .ok  { background: #e7f7ee; color: #05603a; }
  .bad { background: #fff1f0; color: #b42318; }
  .warn { background: #fffaeb; color: #b54708; }
  .card { background: #fff; border-radius: 14px; overflow: hidden; margin-bottom: 20px; }
  .row { display: flex; gap: 12px; padding: 14px 16px; border-bottom: 1px solid #f0f1f3; }
  .row:last-child { border-bottom: 0; }
  .row.optional { opacity: .65; }
  .mark { font-size: 18px; line-height: 1.35; }
  .name { font-weight: 700; }
  .meta { font-size: 13px; color: #667085; margin-top: 2px; }
  code {
    font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace;
    background: #f0f1f3; padding: 1px 5px; border-radius: 5px;
  }
  h2 { font-size: 15px; margin: 0 0 8px; }
  ol { margin: 0; padding-left: 20px; }
  li { margin-bottom: 8px; }
  .strong { background: #fffaeb; padding: 0 3px; border-radius: 4px; font-weight: 700; }
  button {
    width: 100%; height: 48px; border: 0; border-radius: 12px;
    background: #2f6bff; color: #fff; font-size: 15px; font-weight: 700;
    cursor: pointer; font-family: inherit;
  }
  button:disabled { opacity: .5; }
  pre {
    background: #fff; border-radius: 12px; padding: 14px; margin: 12px 0 0;
    font: 12px/1.6 ui-monospace, SFMono-Regular, Menlo, monospace;
    white-space: pre-wrap; word-break: break-all;
  }
  .foot { font-size: 12px; color: #98a2b3; margin-top: 28px; text-align: center; }
</style>
</head>
<body>
<div class="wrap">
  <h1>설정 점검</h1>
  <p class="host">${esc(host)}</p>

  <div class="verdict ${healthy ? 'ok' : required ? 'warn' : 'bad'}">
    ${
      healthy
        ? '✅ 필요한 값이 모두 들어와 있어요.'
        : required
          ? '⚠️ 값은 들어왔는데 손볼 곳이 있어요.'
          : '❌ 아직 Worker 에 값이 안 들어왔어요.'
    }
    <div style="font-weight:400;margin-top:6px;font-size:14px">
      ${
        healthy
          ? '아래 버튼으로 카카오가 이 키를 실제로 받아주는지까지 확인해 보세요.'
          : diagnosis.problems.map((problem) => esc(problem)).join('<br>')
      }
    </div>
  </div>

  <div class="card">${rows}</div>

  ${required ? probeSection(google) : fixSection()}

  <div class="card" style="padding:14px 16px">
    <h2>Worker 에 도달한 바인딩</h2>
    <div style="font-size:13px">${bindings}</div>
    <p class="meta" style="margin-top:8px">
      값은 표시하지 않습니다. 이름만 보여줍니다.
    </p>
  </div>

  <p class="foot">이 페이지는 설정 확인용입니다. 검색에 노출되지 않습니다.</p>
</div>

<script>
  var btn = document.getElementById('probe');
  if (btn) btn.addEventListener('click', async function () {
    btn.disabled = true;
    btn.textContent = '카카오에 물어보는 중…';
    var out = document.getElementById('probe-out');
    try {
      var res = await fetch('/api/status?probe=1');
      var data = await res.json();
      var probe = data.probe || {};
      var labels = { kakao: '카카오', google: '구글' };
      var lines = Object.keys(probe).map(function (name) {
        var p = probe[name] || {};
        return '[' + (labels[name] || name) + '] ' +
          (p.ok ? '✅ ' : '❌ ') + (p.diagnosis || '응답 없음') +
          (p.status ? '\\nHTTP ' + p.status : '') +
          (p.message ? '\\n' + p.message : '');
      });
      out.textContent = lines.join('\\n\\n');
    } catch (err) {
      out.textContent = '❌ 요청에 실패했습니다: ' + err;
    }
    btn.textContent = '다시 확인';
    btn.disabled = false;
  });
</script>
</body>
</html>`;
}

function row(
  label: string,
  present: boolean,
  key: string,
  hint: string,
  optional = false,
): string {
  return `<div class="row${optional ? ' optional' : ''}">
    <span class="mark">${present ? '✅' : optional ? '➖' : '❌'}</span>
    <div>
      <div class="name">${esc(label)}</div>
      <div class="meta"><code>${esc(key)}</code> · ${esc(present ? '들어와 있음' : hint)}</div>
    </div>
  </div>`;
}

function probeSection(hasGoogle: boolean): string {
  return `<div class="card" style="padding:16px">
    <h2>키가 실제로 받아들여지는지</h2>
    <p class="meta" style="margin:0 0 12px">
      설정된 ${hasGoogle ? '카카오와 구글에' : '카카오에'} 검색을 한 번씩 넣어봅니다.
      각 할당량에서 1건을 씁니다.
    </p>
    <button id="probe" type="button">확인해보기</button>
    <pre id="probe-out">아직 확인하지 않았습니다.</pre>
  </div>`;
}

function fixSection(): string {
  return `<div class="card" style="padding:16px">
    <h2>넣는 곳</h2>
    <ol>
      <li>Cloudflare → <strong>Workers &amp; Pages</strong> → <code>zunfood</code></li>
      <li><strong>Settings</strong> 탭</li>
      <li><strong>Variables and Secrets</strong>
        <div class="meta">
          <span class="strong">Build 안에 있는 같은 이름의 칸이 아닙니다.</span>
          Build 쪽 값은 빌드 중에만 존재해서 여기에 안 나타납니다.
        </div>
      </li>
      <li><strong>+ Add</strong> → <span class="strong">Type 을 Secret 으로</span>
        <div class="meta">기본값이 Text 입니다. Text 로 넣으면 다음 배포 때 지워집니다.</div>
      </li>
      <li>Name / Value 입력 → <span class="strong">Deploy 버튼까지 클릭</span></li>
      <li>이 페이지를 새로고침</li>
    </ol>
  </div>`;
}

/** 바인딩 이름은 설정에서 오지만, 그대로 HTML 에 넣지 않는다 */
function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
