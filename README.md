# 🍜 MEALGAME

> **오늘 뭐 먹지?** — 친구들이랑 게임으로 결정하세요.

밥집을 못 정할 때 방을 만들고 친구를 초대해서, 미니게임 결과로 **오늘 갈 식당**을 정하는 모바일 웹앱입니다.
회원가입 없이 링크/QR 하나로 2~8명이 각자 휴대폰에서 참여합니다.

```
방 만들기 → 친구 초대 → 위치·조건 설정 → 게임 선택
        → 각자 휴대폰에서 실시간 참여 → 게임 진행 → 최종 식당 결정 → 지도 확인
```

---

## 빠른 시작

```bash
npm install
npm run dev          # http://localhost:5173
```

**설정이 하나도 없어도 그대로 돌아갑니다.** Supabase 값이 없으면 자동으로 *로컬 모드*로 동작하고,
식당 데이터는 내장 목업을 사용합니다.

### 혼자서 4인 플레이 테스트하기

로컬 모드는 같은 브라우저의 **탭 사이**를 실시간 동기화합니다.
참가자 신원은 탭 단위(`sessionStorage`)로 저장되므로, 탭을 4개 열면 4명이 됩니다.

1. 탭 1 → 방 만들기 → 방 코드 확인 (예: `A7K3`)
2. 탭 2~4 → `http://localhost:5173/join/A7K3` → 각자 다른 닉네임으로 입장
3. 탭 1에서 게임 시작 → 네 탭 모두에서 진행 상황이 실시간으로 바뀝니다

> 서로 다른 **기기**끼리 플레이하려면 아래 Supabase 설정이 필요합니다.

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

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | (없음) | 있으면 기기 간 실시간 동기화 사용 |
| `VITE_SUPABASE_ANON_KEY` | (없음) | 위와 함께 설정 |
| `VITE_PLACES_PROVIDER` | `mock` | `mock` \| `kakao` |
| `VITE_KAKAO_REST_API_KEY` | (없음) | `kakao` 일 때만 필요 |
| `VITE_AI_JUDGE_PROVIDER` | `mock` | `mock` \| `http` |
| `VITE_AI_JUDGE_ENDPOINT` | (없음) | 판결을 위임할 서버 URL (LLM 키는 **서버에** 보관) |

### Supabase 연결 (기기 간 실시간)

1. Supabase 프로젝트 생성
2. SQL Editor 에서 [`src/supabase/schema.sql`](src/supabase/schema.sql) 실행
3. `.env` 에 URL / anon key 입력 후 재시작

스키마는 `rooms` · `players` · `game_actions` 세 테이블과 Realtime 발행 설정을 포함합니다.
MVP 는 로그인이 없어 anon 정책이 열려 있습니다 — 운영 전에 RLS 를 조여야 합니다(아래 *다음 단계* 참고).

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
├─ realtime/        RoomBackend ← LocalRoomBackend / SupabaseRoomBackend
│  └─ HostEngine    호스트에서 도는 게임 런타임 (권위 있는 상태)
├─ games/           게임별 순수 로직(logic.ts) + 화면(View.tsx)
├─ store/           zustand 방 스토어 · 탭 단위 신원
├─ components/      UI 프리미티브
└─ screens/         화면 (홈/생성/참가/대기실/게임선택/플레이/결과)
```

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
* 백엔드는 `RoomBackend` 인터페이스 하나로 추상화되어 있어, Supabase 없이도 로컬 모드가 동일하게 동작합니다.

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

## 구현된 게임

| 게임 | 방식 | 연출 |
| --- | --- | --- |
| 🎰 **음식 룰렛** | 후보 8곳을 룰렛에 올려 한 번에 결정 | 3·2·1 카운트다운 → 회전 → 포인터 정지 |
| ⚔️ **음식 배틀** | 8강 → 4강 → 결승 토너먼트 투표 | 라운드별 카운트다운, 15초 타이머, 동시 공개, 탈락 연출 |
| ⚖️ **AI 판사** | 각자 먹고 싶은 음식을 적으면 판결 | 심리 애니메이션 → 판결문 + 근거 |
| 🎲 **운명 랜덤** | 전원이 "운명 맡기기" 를 누르면 추첨 | 화면 흔들림 → 슬롯머신 릴 → 당첨 |

동점·무투표는 시드로 결정되어 모든 참가자가 같은 결과를 봅니다.

---

## 처리하는 예외 상황

위치 권한 거부 / 위치 API 실패 / 조건에 맞는 식당 없음 / 없는 방 코드 / 만료된 방 /
중복 닉네임 / 방 가득 참 / 게임 중 참가자 이탈 / 호스트 이탈(방장 자동 승계) /
네트워크 끊김(연결 상태 표시 + 폴링 보정) / 새로고침 후 복귀 / 클립보드·공유 실패 /
QR 생성 실패 / 렌더 오류(ErrorBoundary) — 각각 사람이 읽을 수 있는 한국어 메시지를 보여줍니다.

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
2. **RLS 조이기** — 현재 anon 전면 허용. 방 코드 기반 접근 제어나 Edge Function 경유 쓰기로 변경.
3. **투표 비밀성 서버 강제** — 지금은 화면 단계에서 가려집니다. Edge Function 에서 집계하면
   DB 를 직접 보는 것도 막을 수 있습니다.
4. **게임 확장** — 사다리, 가위바위보, 예산 생존게임 등 (`GameMode` 만 추가하면 됨).
5. **결과 이미지 저장/공유** — 결과 화면을 이미지로 내보내 스토리에 바로 올리기.
6. **PWA** — 홈 화면 추가 + 오프라인 셸.

---

## 기술 스택

React 18 · TypeScript · Vite 5 · Tailwind CSS 3 · Zustand · Framer Motion ·
Supabase(Postgres + Realtime) · qrcode · canvas-confetti
