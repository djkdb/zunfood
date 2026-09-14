# 🍜 MEALGAME

> **오늘 뭐 먹지?** — 친구들이랑 고민하지 말고 게임으로 정하세요.

밥집을 못 정할 때 쓰는 모바일 웹앱입니다. 회원가입은 없습니다.

**두 가지 모드**로 나뉩니다.

| 모드 | 누가 | 흐름 |
| --- | --- | --- |
| 👥 **친구들과 결정하기** | 2~8명 | 방 만들기 → 링크·QR로 초대 → 대기실 → 게임 선택 → 각자 폰에서 플레이 → 최종 식당 |
| 🎲 **혼자 결정하기** | 1명 | 위치 → 조건 → 결정 방식 → 10초 안에 한 곳 |

혼자 쓸 때도 단순한 목록이 아니라 **뽑는 재미**로 결정합니다
(랜덤 룰렛 · 오늘의 운명 · 카테고리 뽑기 · 조건 추천 · 근처 인기).

---

## 빠른 시작

```bash
npm install
npm run dev          # http://localhost:5173
```

**설정이 하나도 없어도 그대로 돌아갑니다.** 로컬 개발에서는 *로컬 모드*(같은 기기의 탭끼리 동기화)와
내장 목업 식당 데이터로 동작합니다.

### 혼자서 4인 플레이 테스트하기

로컬 모드는 같은 브라우저의 **탭 사이**를 실시간 동기화합니다.
참가자 신원은 탭 단위(`sessionStorage`)로 저장되므로, 탭을 4개 열면 4명이 됩니다.

1. 탭 1 → 방 만들기 → 방 코드 확인 (예: `A7K3`)
2. 탭 2~4 → `http://localhost:5173/join/A7K3` → 각자 다른 닉네임으로 입장
3. 탭 1에서 게임 시작 → 네 탭 모두에서 진행 상황이 실시간으로 바뀝니다

> 서로 다른 **기기**끼리 플레이하려면 아래 Neon + API 설정이 필요합니다.

### 스크립트

| 명령 | 설명 |
| --- | --- |
| `npm run dev` | 개발 서버 (`--host` 로 같은 와이파이의 휴대폰에서도 접속 가능) |
| `npm run build` | 타입체크 + 프로덕션 빌드 |
| `npm run preview` | 빌드 결과 미리보기 |
| `npm run typecheck` | 타입체크만 |

---

## 환경변수

`.env.example` 을 `.env` 로 복사해서 채웁니다. **API 키는 소스에 넣지 않습니다.**

| 변수 | 어디에 | 기본값 | 설명 |
| --- | --- | --- | --- |
| `VITE_API_BASE` | 클라이언트 | 배포 `/api` · 개발 (없음) | 방 API 주소. **보통 설정할 필요 없음** |
| `DATABASE_URL` | **서버 전용** | (없음) | Neon 커넥션 문자열. `VITE_` 를 붙이면 안 됨 |
| `VITE_PLACES_PROVIDER` | 클라이언트 | `kakao` | `mock` \| `kakao` \| `google`. **보통 설정할 필요 없음** |
| `KAKAO_REST_API_KEY` | **서버 전용** | (없음) | 카카오 REST 키. `VITE_` 를 붙이면 안 됨 |
| `GOOGLE_PLACES_API_KEY` | **서버 전용** | (없음) | 구글 Places 키. 있으면 카카오보다 우선 |
| `GOOGLE_MONTHLY_LIMIT` | **서버 전용** | `900` | 구글 월 상한. 넘으면 카카오로 자동 전환 |
| `VITE_AI_JUDGE_PROVIDER` | 클라이언트 | `mock` | `mock` \| `http` |
| `VITE_AI_JUDGE_ENDPOINT` | 클라이언트 | (없음) | 판결 위임 서버 URL (LLM 키는 **서버에**) |

### Neon 연결 (기기 간 동기화)

1. [Neon](https://neon.tech) 프로젝트 생성 후 커넥션 문자열 복사
2. 스키마 적용
   ```bash
   psql "$DATABASE_URL" -f neon/schema.sql
   ```
3. 서버 시크릿과 클라이언트 API 주소 설정
   * 로컬: `.dev.vars` 에 `DATABASE_URL=...`, `.env` 에 `VITE_API_BASE=/api`
   * 배포: Cloudflare Secret 에 `DATABASE_URL`, 환경변수에 `VITE_API_BASE=/api`
4. 로컬에서 서버까지 돌리려면 `npm run dev:worker` (Vite dev 서버에는 `/api` 가 없습니다)

**Supabase 와의 차이**: Neon 은 실시간 구독이 없고, 커넥션 문자열은 브라우저에 둘 수 없습니다.
그래서 브라우저 → **Cloudflare Worker(`/api`)** → Neon 구조이고,
동기화는 구독 대신 **폴링**으로 합니다(아래 참고). 대신 DB 자격증명이 클라이언트에
전혀 노출되지 않고, 방장 전용 동작을 서버에서 검증합니다.


---

## Cloudflare Workers 배포

> ⚠️ **가장 중요**: `DATABASE_URL` 과 `VITE_API_BASE` 없이 배포하면 *로컬 모드*로 동작합니다.
> 같은 기기의 탭끼리만 동기화되므로, **친구가 각자 휴대폰으로 들어오는 실제 사용은 되지 않습니다.**

### 1) 대시보드에서 Git 연동 (권장)

Cloudflare 대시보드 → **Workers & Pages** → **Create** → **Workers** → **Import a repository**

| 항목 | 값 |
| --- | --- |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Root directory | `/` |

환경변수는 **두 군데에 나눠서** 넣어야 합니다. 여기서 자주 틀립니다.

**① 빌드 변수** (Settings → Build → *Variables and Secrets*)
빌드할 때 번들에 박히는 값입니다.

```
NODE_VERSION = 22
```

`VITE_API_BASE` 와 `VITE_PLACES_PROVIDER` 는 **설정하지 않아도 됩니다.**
배포 빌드는 자동으로 `/api` + 카카오를 씁니다.

**② 런타임 시크릿** (Worker 의 Settings → *Variables and Secrets*)
배포된 Worker 가 실행 중에 읽는 값입니다.

```
DATABASE_URL        = postgresql://...@ep-xxxx.neon.tech/mealgame?sslmode=require
KAKAO_REST_API_KEY  = (카카오 REST API 키 32자리)
```

클릭 순서까지 적으면:

1. **Workers & Pages** → `wrangler.toml` 의 `name` 과 같은 Worker 를 고른다
2. **Settings** 탭 → **Variables and Secrets** → **+ Add**
3. **Type** 을 `Secret` 으로 바꾼다 ← 기본값이 `Text` 라서 그냥 넘기면 안 된다
4. Name / Value 입력 → **Deploy** 버튼까지 누른다 (누르지 않으면 저장되지 않는다)
5. `/api/status` 의 `bindings` 에 이름이 보이는지 확인한다

`DATABASE_URL` 에 `VITE_` 를 붙이면 브라우저 번들에 DB 비밀번호가 박힙니다. 절대 붙이지 마세요.
반대로 `VITE_API_BASE` 를 런타임 변수에만 넣으면 빌드가 못 보고 로컬 모드로 배포됩니다.

저장하면 빌드 후 `https://<worker>.<계정>.workers.dev` 로 올라갑니다.
이후 브랜치에 푸시할 때마다 자동 배포됩니다.

### 2) CLI 로 배포

```bash
npx wrangler login
npx wrangler secret put DATABASE_URL        # 런타임 시크릿 등록 (최초 1회)
npx wrangler secret put KAKAO_REST_API_KEY
npm run deploy                              # 빌드 후 wrangler deploy
```

⚠️ `wrangler` 는 `wrangler.toml` 의 `name` 으로 대상을 정합니다. 그 값이 실제 배포된
Worker 이름과 다르면 **같은 이름의 Worker 를 새로 만들어** 거기에 Secret 을 넣어버리고,
서비스되는 Worker 에는 아무 일도 일어나지 않습니다. `/api/status` 의 `host` 로
지금 어느 Worker 를 보고 있는지 확인할 수 있습니다.

로컬에서 Worker 까지 그대로 띄워보려면:

```bash
cp .dev.vars.example .dev.vars   # DATABASE_URL 채우기
npm run dev:worker               # 빌드 후 wrangler dev
```

### 환경변수 주의점

#### ⚠️ 가장 많이 걸리는 함정: Text 가 아니라 Secret

Cloudflare 대시보드에는 이름이 거의 같은 칸이 **두 개** 있고, 각각 의미가 다릅니다.

| 위치 | 언제 존재하나 | 여기에 넣을 것 |
| --- | --- | --- |
| Settings → **Build** → Variables and secrets | `npm run build` 도는 동안만 | `VITE_...` (보통 불필요) |
| Settings → **Variables and Secrets** | 앱이 실제로 돌 때 | `DATABASE_URL`, `KAKAO_REST_API_KEY` |

그리고 아래쪽 칸에 넣을 때 **Type 을 반드시 `Secret` 으로** 골라야 합니다.

> `Text` 로 넣은 값은 **다음 `wrangler deploy` 때 지워집니다.** wrangler 는 평문 변수의
> 기준을 `wrangler.toml` 의 `[vars]` 로 보기 때문에, 거기에 없는 평문 변수는 배포할 때
> 정리됩니다. `Secret` 은 배포와 무관하게 유지됩니다.
>
> 그래서 "분명히 넣었는데 며칠 뒤 다시 안 된다" = Text 로 넣었고 그 사이 커밋을 푸시했다는
> 뜻입니다. `/api/status` 의 `bindings` 가 `["ASSETS"]` 뿐이면 이 경우입니다.

CLI 로 넣으면 항상 Secret 이라 이 함정이 없습니다:

```bash
npx wrangler secret put DATABASE_URL
npx wrangler secret put KAKAO_REST_API_KEY
```

#### 빌드 시점 값

`VITE_` 접두사 값은 **빌드 시점에 번들에 박히고 브라우저에 공개**됩니다.

* `DATABASE_URL` 은 **`VITE_` 가 없으므로 서버에만 남습니다.** 브라우저 번들에 들어가지 않습니다.
  (Supabase 처럼 anon key 를 공개하고 RLS 로 막는 구조가 아니라, 애초에 DB 에 직접 접근하지 않습니다.)
* `VITE_` 값을 바꾸면 **재배포(재빌드)** 해야 반영됩니다. 런타임에 읽지 않습니다.
* 카카오 REST 키(`VITE_KAKAO_REST_API_KEY`)는 그대로 노출됩니다.
  식당 API 키는 `/api/places` 프록시를 통해 서버에만 두므로 브라우저에 노출되지 않습니다.

### 저장소에 들어 있는 배포 설정

| 파일 | 역할 |
| --- | --- |
| `worker/index.ts` | `/api/*` 는 방 API 로, 나머지는 SPA 로 보내는 Worker 진입점 |
| `public/_headers` | 해시 자산 영구 캐시, `index.html` 무캐시, 보안 헤더, `geolocation=(self)` |
| `wrangler.toml` | Worker 이름·진입점·정적 자산(`dist`) 설정 |
| `.nvmrc` | Node 22 고정 |

SPA 폴백은 `_redirects` 가 아니라 Worker 가 처리합니다.
`/index.html` 을 직접 요청하면 자산 계층이 `/` 로 리다이렉트해서 **초대 링크의 방 코드가 사라지기 때문에**,
루트 문서를 받아 원래 주소에 200 으로 실어 보냅니다.

`Permissions-Policy` 에서 **geolocation 은 반드시 허용**해야 합니다 —
막으면 "현재 위치 사용" 이 조용히 실패합니다.

### 커스텀 도메인

프로젝트 → **Custom domains** → 도메인 추가.
같은 Cloudflare 계정의 도메인이면 DNS 가 자동으로 잡힙니다.
초대 링크(`inviteUrl`)는 `window.location.origin` 을 쓰므로 별도 설정이 필요 없습니다.

### 배포 후 확인

1. `https://<worker>.workers.dev` 접속 → 홈이 Pretendard 로 보이는지
2. `https://<worker>.workers.dev/api/health` 가 `{"ok":true}` 인지 (DB 연결 확인)
3. 방을 만들고 **다른 기기**에서 초대 링크로 입장 → 참가자 목록이 늘어나는지
   (안 되면 `DATABASE_URL` 미설정)
4. 초대 링크를 새 탭에 붙여넣어 새로고침 → 404 가 아니라 앱이 뜨는지

### 설정 진단 — `/api/status`

식당이 "데모 데이터 · 실제 주소 아님" 으로 나온다면 여기부터 본다.

```
GET /api/status            → 어떤 Secret 이 Worker 에 도달했는지 (값은 안 나온다)
GET /api/status?probe=1    → 그 키로 카카오에 실제 호출을 넣어보고 거부 사유까지
```

`?probe=1` 응답 예시:

```json
{
  "ok": true,
  "statusVersion": 3,
  "database": true,
  "places": { "kakao": true, "google": false },
  "probe": {
    "kakao": {
      "ok": false,
      "status": 401,
      "message": "{\"errorType\":\"AccessDeniedError\"}",
      "diagnosis": "REST API 키가 올바르지 않습니다. ..."
    }
  }
}
```

`summary` 에 무엇이 잘못됐고 무엇을 해야 하는지 한 줄로 나옵니다. `bindings` 는
Worker 에 실제로 도달한 변수 **이름**, `shapes` 는 값의 **길이와 형식**만 담습니다
(공백·따옴표·키 형식 오류를 값 없이 잡아내기 위한 것).

읽는 법:

| 응답 | 원인 | 조치 |
| --- | --- | --- |
| `404` 또는 `statusVersion` 없음 | 배포가 이 커밋보다 옛것 | 다시 배포 |
| `bindings: ["ASSETS"]` | 런타임 변수가 하나도 없음 | Type 을 **Secret** 으로 다시 넣기 (위 함정 참고) |
| `bindings` 에 비슷한 이름 | 이름 오타 | `summary` 가 정확한 이름을 알려준다 |
| `shapes` 의 `length ≠ trimmedLength` | 값에 공백·줄바꿈 | 공백 없이 다시 넣기 |
| `probe.kakao.ok: true` | 서버는 정상 | 브라우저에서 **새로고침** (폴백은 페이지 단위로 고정된다) |
| `probe.kakao.status: 401` | 키가 틀림 | REST API 키를 다시 넣기 |
| `probe.kakao.status: 403` | 카카오맵 권한 없음 | 그 앱의 [카카오맵] → 사용 설정 ON |
| `diagnosis` 에 "한도" | 오늘 호출 다 씀 | 다음 날 자동 복구 |

키 값은 어떤 경우에도 응답에 담기지 않는다. 카카오 응답 본문에 키가 섞여 나오면
`***` 로 가린 뒤 300자까지만 싣는다. `probe=1` 은 카카오 호출을 1건 쓰므로
평소에는 붙이지 않는다.

---

## 아키텍처

```
src/
├─ config/          서비스명·타이밍·환경변수 (서비스명은 config/app.ts 한 곳에서 변경)
├─ types/           도메인 타입 (Room / Player / Restaurant / GameMode)
├─ data/            ── 데이터 계층 (UI 와 완전히 분리) ──
│  ├─ restaurants/    RestaurantRepository ← Mock / Kakao 구현
│  ├─ places/         PlaceRepository (학교·장소 검색)
│  └─ ai/             JudgeProvider ← Mock / HTTP 구현
├─ realtime/        RoomBackend ← LocalRoomBackend / NeonRoomBackend
│  └─ HostEngine    호스트에서 도는 게임 런타임 (권위 있는 상태)
├─ games/           게임별 순수 로직(logic.ts) + 화면(View.tsx)
├─ solo/            혼자 결정하기 로직 (결정 방식 5종)
├─ store/           roomStore(멀티) · soloStore(싱글) · toastStore · 탭 단위 신원
├─ components/ui/   디자인 시스템 프리미티브
└─ screens/         화면 (홈/솔로/생성/참가/대기실/게임선택/플레이/결과)

server/             방 API + 식당 API 프록시(카카오/구글) — 브라우저에서 import 하지 않는다
worker/             Cloudflare Worker 진입점 (/api 라우팅 + SPA 서빙)
neon/schema.sql     Neon(Postgres) 스키마
```

싱글과 멀티의 상태는 스토어 단위로 완전히 분리되어 있습니다.
`soloStore` 는 위치·조건·결과만, `roomStore` 는 방·참가자·게임 상태만 다룹니다.

### 디자인 시스템

토큰은 `tailwind.config.js` 한 곳에 있습니다. 색·타이포·라운드·그림자·모션 모두 여기서 나옵니다.

* **앱 셸은 밝게, 게임은 어둡게** — `<Screen variant="app" | "arena">`.
  일상 화면은 오프화이트/딥네이비, 게임 중에는 화면 전체가 아레나로 바뀌어 몰입을 만듭니다.
  두 문맥이 같은 accent·타이포를 공유해서 하나의 서비스로 읽힙니다.
* **색은 3개만** — 파랑(primary) · 주황(accent) · 잉크(텍스트/면). 상태색(success/danger)은 의미가 있을 때만.
* **그림자는 3단계**(`sm` / `md` / `lift`), **라운드는 6단계**. 모든 것을 똑같이 둥글게 만들지 않습니다.
* 버튼은 `primary / accent / secondary / ghost / danger` × `light / dark` 표면.
* 목록은 카드를 쌓지 않고 `.group-list`(구분선 그룹)로 묶습니다.

### 실시간 모델 — "호스트가 심판"

```
참가자 ──액션(투표/입력)──▶ 백엔드 ──▶ 호스트 HostEngine
                                          │  GameMode.handleAction / tick  (순수 함수)
                                          ▼
                              공개 상태만 방에 브로드캐스트 ──▶ 모든 참가자 화면
```

* 게임 상태 계산은 **호스트 한 곳**에서만 일어나므로 참가자 간 상태가 어긋나지 않습니다.
* 결과는 항상 **시드(seed)** 로부터 계산합니다 → 모두가 같은 룰렛 칸, 같은 당첨을 봅니다.
* `GameMode.toPublicState()` 가 비밀 정보를 지웁니다. 음식 배틀에서 **누가 뭘 골랐는지는
  전원 투표 전까지 어떤 화면에도 내려가지 않습니다** (집계만 공개).
* 백엔드는 `RoomBackend` 인터페이스 하나로 추상화되어 있어, 서버 없이도 로컬 모드가 동일하게 동작합니다.

### 동기화 방식 — 폴링 (Neon 에는 실시간 구독이 없다)

```
참가자 ──POST /api/.../actions──▶ Neon
방장   ──GET  /api/.../actions?after=N──▶ 새 액션만 수신 → HostEngine 계산
       ──PUT  /api/.../state──▶ 공개 상태 저장
모두   ──GET  /api/rooms/:id?rev=N──▶ rev 가 그대로면 204(본문 없음)
```

* 방의 모든 변경은 `rev` 를 1 올립니다. 클라이언트가 아는 `rev` 를 같이 보내므로,
  바뀐 게 없으면 서버가 **204** 로 끊어 폴링을 싸게 만듭니다.
* 후보 식당 목록은 거의 안 바뀌므로 `candidates_rev` 로 따로 추적해서 **바뀔 때만** 내려보냅니다.
* 주기는 상태에 따라 바뀝니다 — 대기실 2.5초, 게임 중 1초(액션은 0.6초), 결과 4초.
  액션 폴링은 **게임 중에만**, **방장만** 합니다.

실측: 대기실에 4명이 있을 때 **초당 약 2건**, 10분 세션이면 약 1,200건입니다.
Cloudflare Workers 무료 한도(하루 10만 요청) 기준으로 하루 수십 세션 규모입니다.

투표 → 화면 반영까지는 최악 약 1.6초(액션 폴링 0.6초 + 스냅샷 1초)입니다.
카운트다운은 서버 시각 기준으로 계산하므로 폴링 지연과 무관하게 모두 같은 숫자를 봅니다.

더 낮은 지연이 필요해지면 Cloudflare **Durable Objects** 로 방마다 WebSocket 허브를 두고
Neon 은 영속 저장만 맡기는 구조로 확장할 수 있습니다. `RoomBackend` 구현만 바꾸면 됩니다.

### 새 게임 추가하기

`GameMode` 를 구현하고 두 곳에 등록하면 끝입니다. **방/실시간 시스템은 건드리지 않습니다.**

```ts
// src/games/ladder/logic.ts
export const ladderGame: GameMode<LadderState> = {
  id: 'ladder', title: '사다리 게임', /* ... */
  createInitialState(ctx) { /* ... */ },
  handleAction(state, action, ctx) { /* ... */ },   // 참가자 액션
  tick(state, ctx) { /* ... */ },                    // 타이머 진행
  toPublicState(state) { /* 비밀 정보 제거 */ },
  getWinner(state) { /* 식당 id */ },
  isFinished(state) { /* ... */ },
  // 외부 API 가 필요하면 getEffectKey + runEffect 사용 (AI 판사 참고)
};
```

1. `src/games/registry.ts` 의 `GAMES` 배열에 추가
2. `src/games/views.tsx` 의 `GAME_VIEWS` 에 화면 등록

### 식당 데이터

`RestaurantRepository` 인터페이스 뒤에 있습니다.

```ts
interface RestaurantRepository {
  readonly capabilities: RestaurantCapabilities;  // 이 소스가 실제로 주는 정보
  search(query: RestaurantQuery): Promise<Restaurant[]>;
}
```

* **런타임에서 식당 이름이나 좌표를 새로 만들어내지 않습니다.**
  목업은 `src/data/restaurants/fixtures.ts` 의 고정 목록만 사용하고, 기준 좌표 주변에
  시드 기반으로 배치합니다(같은 위치 → 항상 같은 결과). 특정 학교/지역에 종속되지 않습니다.
* AI 판사도 **주어진 후보 안에서만** 고릅니다. 외부 서버가 후보에 없는 식당을 반환하면
  그 응답은 버리고 로컬 판결로 대체합니다 (`HttpJudgeProvider`).

#### 실제 데이터 붙이기

제공자에 따라 받을 수 있는 정보가 다릅니다.

| | 이름·카테고리·거리 | 평점 | 가격 | 영업여부 | 사진 |
| --- | --- | --- | --- | --- | --- |
| `mock` | ✓ | ✓ | ✓ (원) | ✓ | — |
| `kakao` | ✓ | — | — | — | — |
| `google` | ✓ | ✓ | ✓ (등급) | ✓ | ✓ |

**비용부터 정하세요.** 릴스처럼 트래픽이 갑자기 몰릴 수 있다면 이게 제일 중요합니다.

| | 무료 한도 | 초과하면 | 릴스 배포 |
| --- | --- | --- | --- |
| **카카오** | **일 10만 / 월 300만** | 429 (요금 없음) | ✅ 안전 |
| **구글** | 월 1,000건 | **과금** | ⚠️ 위험 |

검색 1건 = 게임 1판입니다. 카카오는 **하루 10만 판**까지 무료라 사실상 걱정할 일이 없고,
결제 수단을 등록하지 않으므로 청구서가 나올 수 없습니다.
구글은 월 1,000판을 넘는 순간부터 돈이 나갑니다.

**두 키를 다 넣는 게 가장 좋습니다.** 평소에는 구글의 풍부한 데이터를 쓰다가,
월 한도(`GOOGLE_MONTHLY_LIMIT`, 기본 900)에 닿으면 **자동으로 카카오로 내려갑니다.**
구글이 오류(429/인증 실패)를 내도 카카오로 폴백해서 게임은 끊기지 않습니다.
사용량은 `/api/health` 의 `usage` 로 확인할 수 있습니다.

```jsonc
// GET /api/health
{ "ok": true, "usage": { "google": 412 } }   // 이번 달 구글 호출 수
```

**구글 (평점·가격대·사진까지)**

```
VITE_PLACES_PROVIDER  = google    ← 빌드 변수
VITE_API_BASE         = /api      ← 빌드 변수
GOOGLE_PLACES_API_KEY = ...       ← 런타임 Secret (VITE_ 금지)
```

GCP 에서 **Places API (New)** 를 켜고 키를 발급받아 Worker Secret 으로 넣습니다.

* 평점을 포함한 요청은 Enterprise 등급으로 과금되며 **월 1,000건 무료**입니다.
  `/api/places` 응답을 5분 캐시하므로 같은 자리에서 연달아 하는 판은 추가 호출이 없습니다.
  월 상한에 닿으면 카카오로 자동 전환되므로 예상치 못한 청구는 나오지 않습니다.
* 가격은 금액이 아니라 **등급(₩~₩₩₩₩)** 으로만 옵니다. 등급을 원으로 환산하는 건
  값을 지어내는 것이라, `priceRange`(원)와 `priceLevel`(등급)을 분리해 두고
  등급이 있을 때는 ₩ 표기로 보여줍니다.
* 사진은 **결과 화면에서 한 장만** 요청합니다. 목록 카드까지 띄우면 판당 이미지
  요청이 10배가 됩니다. `/api/places/photo` 프록시가 키를 감추고 7일 캐시합니다.

**카카오 (기본값 — 무료, 대신 이름·거리만)**

```
KAKAO_REST_API_KEY = ...          ← 런타임 Secret. 이것만 넣으면 됩니다
```

기본 제공자가 카카오라서 빌드 변수는 손댈 필요가 없습니다.

[카카오 개발자센터](https://developers.kakao.com)에서:

1. **내 애플리케이션 → 애플리케이션 추가하기** (개인 개발자도 가능, 사업자등록번호 불필요)
2. **앱 → 플랫폼 키** 에서 **REST API 키** 복사
3. **제품 설정 → 카카오맵 → 사용 설정 ON**

> 2025년 12월 3일 앱 키 구조가 개편되면서 예전의 **[앱 키]** 탭이 **[플랫폼 키]** 로 바뀌었습니다.
> 이제 앱 하나에 플랫폼 환경별로 키를 최대 5개까지 만들 수 있으니, 없으면 새로 만들고
> **타입이 REST API 인 키**를 쓰세요. 서버(Worker)에서 호출하므로 웹 도메인 등록은 필요 없습니다.

**비즈니스 앱(비즈앱) 전환은 필요 없습니다.** 비즈앱은 카카오톡 메시지 발송·카카오싱크·
친구 목록처럼 카카오톡 계정을 건드리는 기능용이고, 사업자등록번호가 필요합니다.
로컬 API 는 해당되지 않습니다.

⚠️ **무료 쿼터는 개발자 계정에서 카카오맵을 처음 활성화한 앱 1개에만 적용됩니다.**
이미 다른 앱에서 카카오맵을 켜두셨다면, 그 앱의 REST API 키를 쓰시거나
이 서비스용 앱을 첫 활성화 앱으로 만드세요.

키를 아직 안 넣었다면 앱은 **내장 데모 식당 데이터로 동작합니다.**
게임은 그대로 돌아가고, 콘솔에 안내 경고만 뜹니다. 키를 넣는 순간 실제 데이터로 바뀝니다.

두 키가 다 있으면 평소에는 구글, 한도를 넘으면 카카오를 씁니다.
이때는 `VITE_PLACES_PROVIDER=google` 을 빌드 변수로 넣어주세요
(화면이 평점·가격대 항목을 보여줄지 이 값으로 정합니다).
카카오로 내려간 뒤에는 평점·가격이 비어 오는데, 값이 없는 항목은 어차피 화면에서
자동으로 빠지므로 깨지지 않습니다.

**없는 값은 감춥니다.** 어떤 제공자든 모르는 항목은 `rating: 0` / `priceLevel: null` /
`isOpen: null` 로 두고, `capabilities` 를 보고 화면이 해당 UI 를 **아예 없앱니다** —
카카오를 쓰면 가격·평점·영업중 필터가 사라지고 결과 통계가 "걸어서 / 거리" 로 바뀝니다.
`⭐ 0.0` 이나 근거 없는 "영업종료" 는 나오지 않습니다.

#### 네이버는 왜 안 쓰나

네이버 지역 검색 API 는 **한 번에 최대 5건**만 반환하고, 좌표+반경 검색이 아니라
키워드 검색입니다. 음식 배틀은 8강이라 후보가 최소 8곳 필요해서 이 게임에는 맞지 않습니다.
평점·가격·영업시간을 주지 않는 것은 카카오와 같습니다.
(네이버 지도 API 는 지도 렌더링·지오코딩용이라 장소 메타데이터 검색과는 다릅니다.)

---

## 화면 흐름

```
홈 ─┬─ 친구들과 결정하기 → 방 만들기 → 대기실(초대) → 게임 선택(미리보기) → 게임 → 결과
    └─ 혼자 결정하기   → 조건 설정 → 뽑는 연출 → 결과
```

게임 중에는 앱 내비게이션을 걷어내고 화면 전체를 게임에 씁니다(상단은 진행률과 나가기만).

## 구현된 게임

| 게임 | 방식 | 연출 |
| --- | --- | --- |
| 🎰 **음식 룰렛** | 후보 8곳을 룰렛에 올려 한 번에 결정 | 3·2·1 카운트다운 → 회전 → 포인터 정지 |
| ⚔️ **음식 배틀** | 8강 → 4강 → 결승 토너먼트 투표 | 라운드별 카운트다운, 15초 타이머, 동시 공개, 탈락 연출 |
| ⚖️ **AI 판사** | 각자 먹고 싶은 음식을 적으면 판결 | 심리 애니메이션 → 판결문 + 근거 |
| 🎲 **운명 랜덤** | 전원이 "운명 맡기기" 를 누르면 추첨 | 화면 흔들림 → 슬롯머신 릴 → 당첨 |
| 💰 **음식 경매** | 각자 100포인트를 몰래 나눠 걸고 한 번에 공개 | 40초 입찰 → 동시 공개 → 합산 막대 |

동점·무투표는 시드로 결정되어 모든 참가자가 같은 결과를 봅니다.

---

## 처리하는 상태

모든 실패 상태는 **무엇이 잘못됐는지 + 다음에 뭘 누르면 되는지**를 함께 보여줍니다.

| 상황 | 화면 |
| --- | --- |
| 조건에 맞는 식당 없음 | "조건을 조금만 넓혀볼까요?" + `반경 1km로 늘리기` 버튼 |
| 위치 권한 거부/실패 | 이유 안내 + 장소 검색으로 바로 전환 |
| 네트워크 오류 | "잠시 연결이 끊겼어요" + `다시 시도` |
| 없는 방 코드 · 만료된 방 | 코드로 다시 참가 / 처음으로 |
| 중복 닉네임 · 방 가득 참 | 토스트로 즉시 안내 |
| 참가자 이탈 | 투표 대기에서 자동 제외 |
| 호스트 이탈 | 남은 사람 중 방장 자동 승계 |
| 렌더 오류 | ErrorBoundary 복구 화면 |

위치 권한은 브라우저 팝업을 갑자기 띄우지 않고, **왜 필요한지 먼저 설명한 뒤** 요청합니다.

## 접근성

키보드 포커스 링(`:focus-visible`) · 세그먼티드 컨트롤 `radiogroup/radio` ·
시트 `dialog`/`aria-modal` · 토스트 `aria-live` · 진행바 `progressbar` ·
아이콘 버튼 `aria-label` 필수 · 최소 터치 영역 40~54px ·
상태를 색으로만 구분하지 않음(WIN/탈락, 완료/고민중 등 글자 병기) ·
`prefers-reduced-motion` 은 CSS와 `MotionConfig reducedMotion="user"` 양쪽에서 존중.

## 성능

첫 로딩에 받는 JS는 **약 102KB(gzip)** 입니다.

* 라우트 단위 코드 분할 — 홈 밖의 화면은 필요할 때 로드
* DB 클라이언트가 번들에 없습니다. 브라우저는 `fetch` 로 `/api` 만 호출하므로
  무거운 DB SDK 를 내려받지 않습니다 (Supabase 를 쓰던 때는 이것만 59KB gz 였습니다)
* QR·컨페티 라이브러리는 실제로 쓰이는 순간 동적 로드
* react / framer-motion 은 벤더 청크로 분리해 캐시 유지

### 서체

Pretendard 를 **번들에 포함**해서 제공합니다(CDN 의존 없음).
외부 CDN 이 막히거나 느리면 서비스 전체가 다른 폰트로 보이기 때문입니다.
dynamic subset 이라 92개 조각 중 화면에 실제로 쓰인 글자가 든 것만 내려받습니다
(첫 화면 기준 11개 / 약 25KB).

---

## 아직 목업인 부분

* **식당 데이터** — 기본값은 `fixtures.ts` 의 가상 가게 31곳입니다.
  `VITE_PLACES_PROVIDER` 를 `google`(평점·가격대·사진 포함) 또는 `kakao` 로 바꾸면
  실제 데이터를 씁니다.
* **장소/학교 검색** — 내장 대학 좌표 픽스처(근사값). 실제 지오코딩 API 로 교체 가능.
* **AI 판사** — 결정론적 로컬 판결. `VITE_AI_JUDGE_ENDPOINT` 로 실제 LLM 서버 연결 가능.
  판결문은 "이 방에서 무슨 일이 일어났는지"(만장일치 / 한 명 편들기 / 전원 아무거나)로
  쓰고, 근거는 **데이터 소스가 실제로 준 값만** 인용합니다. 카카오처럼 평점·가격·영업시간이
  없는 소스에서는 그 항목을 말하지 않고, 대신 거리 순위·종류 희소성·실제로 일치한 문구를
  씁니다. 없는 값을 지어내지 않습니다.
* **지도** — 외부 지도 링크로 이동. 인앱 지도는 아직 없습니다.

## 다음 단계 추천

1. **메뉴·1인 금액** — 구글도 원 단위 금액과 메뉴는 주지 않습니다(등급만).
   필요하면 사용자가 직접 남기는 기록을 쌓는 방향이 현실적입니다.
2. **레이트 리밋** — `/api` 에 방 코드/IP 기준 제한을 걸어 무차별 코드 추측을 막기.
3. **투표 비밀성 서버 강제** — 지금도 서버가 공개 상태만 내려주므로 화면에는 새지 않습니다.
   더 엄격히 하려면 집계를 서버로 옮기면 됩니다.
4. **게임 확장** — 사다리, 가위바위보, 예산 생존게임 등 (`GameMode` 만 추가하면 됨).
5. **결과 이미지 저장/공유** — 결과 화면을 이미지로 내보내 스토리에 바로 올리기.
6. **PWA** — 홈 화면 추가 + 오프라인 셸.
7. **결과 공유 카드 이미지화** — 지금은 텍스트로 공유합니다. 같은 레이아웃을 캔버스로 그려
   이미지로 저장하면 스토리에 바로 올릴 수 있습니다.

---

## 기술 스택

React 18 · TypeScript · Vite 5 · Tailwind CSS 3 · Zustand · Framer Motion ·
Neon(Postgres) · Cloudflare Workers · Pretendard · qrcode · canvas-confetti
