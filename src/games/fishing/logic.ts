import { TIMING } from '@/config/app';
import { createRandom, hashString, seededShuffle } from '@/lib/random';
import type { GameAction, GameContext, GameMode } from '@/types/game';

/** 연못에 있는 물고기(후보) 수 */
const POND_SIZE = 8;
/** 입질이 오는 횟수 */
export const NIBBLE_COUNT = 10;
/** 입질 하나가 유지되는 시간(ms) — 이 안에 챔질해야 한다 */
export const NIBBLE_MS = 900;
/** 입질과 입질 사이 (ms) */
export const GAP_MS = 800;
const RESULT_HOLD_MS = 4_200;

export interface Catch {
  playerId: string;
  /** 챔질한 입질 번호 */
  index: number;
  /** 그때 물고 있던 곳 */
  optionId: string;
  /** 진짜 입질이었는지 */
  real: boolean;
}

export interface FishingState {
  phase: 'countdown' | 'casting' | 'reveal' | 'done';
  optionIds: string[];
  catches: Catch[];
  strikedPlayerIds: string[];
  winnerId: string | null;
  phaseStartedAt: number;
}

/**
 * 음식 낚시.
 *
 * 입질이 차례로 온다. 어떤 건 진짜고 어떤 건 헛입질이다 — 챔질은 딱 한 번뿐.
 * 그래서 이 게임의 실력은 빠르기가 아니라 **참는 것**이다. 마음에 드는 곳이
 * 물었을 때, 그게 진짜이길 바라며 당긴다.
 *
 * 입질 순서와 진짜/가짜는 사람마다 다르게 시드로 정해진다. 옆 사람 화면을
 * 봐도 소용없고, 같은 판을 다시 열면 같은 순서가 나온다.
 */
export const fishingGame: GameMode<FishingState> = {
  id: 'fishing',
  title: '음식 낚시',
  tagline: '헛입질을 참고 진짜에 챔질',
  description: '입질이 오면 당긴다 — 기회는 한 번',
  emoji: '🎣',
  tint: 'bg-[#E4F3FF]',
  howTo: [
    '입질이 하나씩 와요 — 어떤 곳이 물었는지 보여줘요',
    '헛입질도 섞여 있고, 챔질은 한 번뿐이에요',
    '가장 많이 낚인 곳으로 갑니다',
  ],
  minPlayers: 1,
  maxPlayers: 8,
  candidateCount: POND_SIZE,

  createInitialState(ctx: GameContext): FishingState {
    const pond = seededShuffle(ctx.candidates, ctx.seed ^ 0xf154).slice(0, POND_SIZE);
    const optionIds = pond.map((r) => r.id);

    if (optionIds.length < 2) {
      return {
        phase: 'done',
        optionIds,
        catches: [],
        strikedPlayerIds: [],
        winnerId: optionIds[0] ?? null,
        phaseStartedAt: ctx.now,
      };
    }

    return {
      phase: 'countdown',
      optionIds,
      catches: [],
      strikedPlayerIds: [],
      winnerId: null,
      phaseStartedAt: ctx.now,
    };
  },

  handleAction(state, action: GameAction, ctx) {
    if (action.type !== 'strike' || state.phase !== 'casting') return state;
    if (!ctx.players.some((p) => p.id === action.playerId)) return state;
    // 챔질은 한 번뿐이다
    if (state.strikedPlayerIds.includes(action.playerId)) return state;

    const index = Number(action.payload?.index);
    if (!Number.isInteger(index) || index < 0 || index >= NIBBLE_COUNT) return state;

    // 무엇이 물었고 진짜였는지는 서버가 시드로 다시 계산한다 — 보내온 값을 믿지 않는다
    const nibble = nibbleFor(state.optionIds, ctx.seed, action.playerId, index);

    const catches = [...state.catches, { playerId: action.playerId, index, ...nibble }];
    const strikedPlayerIds = [...new Set([...state.strikedPlayerIds, action.playerId])];
    const next: FishingState = { ...state, catches, strikedPlayerIds };

    const everyone =
      ctx.players.length > 0 && ctx.players.every((p) => strikedPlayerIds.includes(p.id));
    return everyone ? reveal(next, ctx) : next;
  },

  tick(state, ctx) {
    const elapsed = ctx.now - state.phaseStartedAt;

    if (state.phase === 'countdown' && elapsed >= TIMING.countdownMs) {
      return { ...state, phase: 'casting', phaseStartedAt: ctx.now };
    }

    if (state.phase === 'casting') {
      const everyone =
        ctx.players.length > 0 &&
        ctx.players.every((p) => state.strikedPlayerIds.includes(p.id));
      if (everyone || elapsed >= castingMs()) return reveal(state, ctx);
    }

    if (state.phase === 'reveal' && elapsed >= RESULT_HOLD_MS) {
      return { ...state, phase: 'done', phaseStartedAt: ctx.now };
    }

    return null;
  },

  toPublicState(state) {
    // 결과는 감추지 않는다. 다만 각자의 입질 순서는 애초에 상태에 없다(시드로 계산).
    return state;
  },

  getWinner(state) {
    return state.winnerId;
  },

  isFinished(state) {
    return state.phase === 'done';
  },

  getProgress(state) {
    const order = { countdown: 0.1, casting: 0.55, reveal: 1, done: 1 } as const;
    return order[state.phase];
  },
};

/** 입질이 다 지나가는 데 걸리는 시간 */
export function castingMs(): number {
  return NIBBLE_COUNT * (NIBBLE_MS + GAP_MS);
}

/**
 * 지금 몇 번째 입질인지, 입질 중인지.
 * 화면과 판정이 같은 함수를 쓴다 — 보이는 것과 잡히는 게 달라지면 안 된다.
 */
export function nibbleWindow(elapsedMs: number): { index: number; biting: boolean } {
  const cycle = NIBBLE_MS + GAP_MS;
  const index = Math.floor(elapsedMs / cycle);
  const within = elapsedMs - index * cycle;
  return { index, biting: within < NIBBLE_MS };
}

/** 이 사람의 이 입질에 무엇이 물었고 진짜인지 */
export function nibbleFor(
  optionIds: string[],
  seed: number,
  playerId: string,
  index: number,
): { optionId: string; real: boolean } {
  const roll = hashString(`${playerId}:${seed}:${index}`);
  const optionId = optionIds[roll % optionIds.length];
  // 약 45% 만 진짜 — 헛입질이 더 많아야 참는 게 게임이 된다
  const real = createRandom(roll)() < 0.45;
  return { optionId, real };
}

function reveal(state: FishingState, ctx: GameContext): FishingState {
  const caught = state.catches.filter((c) => c.real);
  const counts = new Map<string, { count: number; first: number }>(
    state.optionIds.map((id) => [id, { count: 0, first: Infinity }]),
  );

  for (const item of caught) {
    const entry = counts.get(item.optionId);
    if (!entry) continue;
    entry.count += 1;
    entry.first = Math.min(entry.first, item.index);
  }

  const ranked = [...state.optionIds].sort((a, b) => {
    const left = counts.get(a);
    const right = counts.get(b);
    if ((right?.count ?? 0) !== (left?.count ?? 0)) return (right?.count ?? 0) - (left?.count ?? 0);
    // 같은 수면 더 일찍 낚인 쪽
    if ((left?.first ?? Infinity) !== (right?.first ?? Infinity)) {
      return (left?.first ?? Infinity) - (right?.first ?? Infinity);
    }
    return hashString(`${a}:${ctx.seed}`) - hashString(`${b}:${ctx.seed}`);
  });

  return { ...state, phase: 'reveal', phaseStartedAt: ctx.now, winnerId: ranked[0] ?? null };
}
