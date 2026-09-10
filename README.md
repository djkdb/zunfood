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

**설정이 하나도 없어도 그대로 돌아갑니다.** API 주소가 없으면 자동으로 *로컬 모드*로 동작하고,
식당 데이터는 내장 목업을 사용합니다.

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
| `VITE_API_BASE` | 클라이언트 | (없음) | 방 API 주소. 배포에서는 `/api`. 비우면 로컬 모드 |
| `DATABASE_URL` | **서버 전용** | (없음) | Neon 커넥션 문자열. `VITE_` 를 붙이면 안 됨 |
| `VITE_PLACES_PROVIDER` | 클라이언트 | `mock` | `mock` \| `kakao` |
| `VITE_KAKAO_REST_API_KEY` | 클라이언트 | (없음) | `kakao` 일 때만 필요 |
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
VITE_API_BASE = /api
NODE_VERSION  = 22
```

**② 런타임 시크릿** (Worker 의 Settings → *Variables and Secrets*)
배포된 Worker 가 실행 중에 읽는 값입니다. **Secret(암호화)** 로 추가하세요.

```
DATABASE_URL = postgresql://...@ep-xxxx.neon.tech/mealgame?sslmode=require
```

`DATABASE_URL` 에 `VITE_` 를 붙이면 브라우저 번들에 DB 비밀번호가 박힙니다. 절대 붙이지 마세요.
반대로 `VITE_API_BASE` 를 런타임 변수에만 넣으면 빌드가 못 보고 로컬 모드로 배포됩니다.

저장하면 빌드 후 `https://<worker>.<계정>.workers.dev` 로 올라갑니다.
이후 브랜치에 푸시할 때마다 자동 배포됩니다.

### 2) CLI 로 배포

```bash
npx wrangler login
npx wrangler secret put DATABASE_URL   # 런타임 시크릿 등록 (최초 1회)
npm run deploy                          # 빌드 후 wrangler deploy
```

로컬에서 Worker 까지 그대로 띄워보려면:

```bash
cp .dev.vars.example .dev.vars   # DATABASE_URL 채우기
npm run dev:worker               # 빌드 후 wrangler dev
```

### 환경변수 주의점

`VITE_` 접두사 값은 **빌드 시점에 번들에 박히고 브라우저에 공개**됩니다.

* `DATABASE_URL` 은 **`VITE_` 가 없으므로 서버에만 남습니다.** 브라우저 번들에 들어가지 않습니다.
  (Supabase 처럼 anon key 를 공개하고 RLS 로 막는 구조가 아니라, 애초에 DB 에 직접 접근하지 않습니다.)
* `VITE_` 값을 바꾸면 **재배포(재빌드)** 해야 반영됩니다. 런타임에 읽지 않습니다.
* 카카오 REST 키(`VITE_KAKAO_REST_API_KEY`)는 그대로 노출됩니다.
  실제 운영에서는 Worker 안에 `/api/places` 프록시를 두고 키는 Cloudflare Secret 에 넣은 뒤,
  `RestaurantRepository` 구현만 그 URL 을 보게 바꾸세요.

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
   (안 되면 `VITE_API_BASE` 또는 `DATABASE_URL` 미설정)
4. 초대 링크를 새 탭에 붙여넣어 새로고침 → 404 가 아니라 앱이 뜨는지

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

server/             방 API (DB 접근·권한 검증) — 브라우저에서 import 하지 않는다
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
  search(query: RestaurantQuery): Promise<Restaurant[]>;
}
```

* **런타임에서 식당 이름이나 좌표를 새로 만들어내지 않습니다.**
  목업은 `src/data/restaurants/fixtures.ts` 의 고정 목록만 사용하고, 기준 좌표 주변에
  시드 기반으로 배치합니다(같은 위치 → 항상 같은 결과). 특정 학교/지역에 종속되지 않습니다.
* AI 판사도 **주어진 후보 안에서만** 고릅니다. 외부 서버가 후보에 없는 식당을 반환하면
  그 응답은 버리고 로컬 판결로 대체합니다 (`HttpJudgeProvider`).

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

* **식당 데이터** — `fixtures.ts` 의 가상 가게 31곳. 실제 데이터는 `VITE_PLACES_PROVIDER=kakao`
  또는 다른 `RestaurantRepository` 구현으로 교체합니다.
* **장소/학교 검색** — 내장 대학 좌표 픽스처(근사값). 실제 지오코딩 API 로 교체 가능.
* **AI 판사** — 결정론적 로컬 판결. `VITE_AI_JUDGE_ENDPOINT` 로 실제 LLM 서버 연결 가능.
* **지도** — 외부 지도 링크로 이동. 인앱 지도는 아직 없습니다.

## 다음 단계 추천

1. **실제 Places API 연결** — 카카오 REST 키를 노출하지 않도록 서버 프록시를 두고
   `RestaurantRepository` 구현만 교체 (평점·가격은 별도 소스 필요).
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
