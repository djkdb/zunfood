import { TIMING } from '@/config/app';
import { hashString, seededShuffle } from '@/lib/random';
import type { GameAction, GameContext, GameMode } from '@/types/game';

/** 달릴 수 있는 레인 수 */
const LANE_COUNT = 5;
/**
 * 한 사람이 낼 수 있는 최대 연타 수.
 * 사람 손으로 초당 15번을 넘기기 어렵다 — 그 위는 받지 않는다.
 */
const MAX_TAPS_PER_SECOND = 15;
const RESULT_HOLD_MS = 4_200;

export interface Runner {
  playerId: string;
  /** 이 사람이 밀고 있는 레인 */
  optionId: string;
  taps: number;
}

export interface RaceState {
  phase: 'countdown' | 'running' | 'reveal' | 'done';
  optionIds: string[];
  /** playerId -> 레인과 연타 수 */
  runners: Record<string, Runner>;
  winnerId: string | null;
  phaseStartedAt: number;
}

/**
 * 음식 달리기.
 *
 * 먼저 밀 곳을 하나 고르고, 그다음 미친 듯이 두드린다. 가장 많이 밀린 곳으로 간다.
 * 고르기만 하는 게임과 다른 점은, 고른 다음에 그걸 **지켜야** 한다는 것이다.
 * 혼자 밀어도 두 명이 미는 곳을 이길 수 있다.
 *
 * 연타를 한 번씩 보내면 방이 감당하지 못한다. 그래서 각자 자기 화면에서 세고
 * 누적 합계만 이따금 보낸다 — 늦게 오거나 중복으로 와도 결과가 같다.
 */
export const raceGame: GameMode<RaceState> = {
  id: 'race',
  title: '음식 달리기',
  tagline: '고른 곳을 두드려서 밀기',
  description: '밀 곳을 정하고 연타로 결승선까지',
  emoji: '🏃',
  tint: 'bg-[#E6F6FF]',
  howTo: ['밀고 싶은 곳을 하나 고르세요', '제한 시간 동안 미친 듯이 두드려요', '가장 많이 밀린 곳으로 갑니다'],
  minPlayers: 1,
  maxPlayers: 8,
  candidateCount: LANE_COUNT,

  createInitialState(ctx: GameContext): RaceState {
    const lanes = seededShuffle(ctx.candidates, ctx.seed ^ 0x2ace).slice(0, LANE_COUNT);
    const optionIds = lanes.map((r) => r.id);

    if (optionIds.length < 2) {
      return {
        phase: 'done',
        optionIds,
        runners: {},
        winnerId: optionIds[0] ?? null,
        phaseStartedAt: ctx.now,
      };
    }

    return {
      phase: 'countdown',
      optionIds,
      runners: {},
      winnerId: null,
      phaseStartedAt: ctx.now,
    };
  },

  handleAction(state, action: GameAction, ctx) {
    if (action.type !== 'run' || state.phase !== 'running') return state;
    if (!ctx.players.some((p) => p.id === action.playerId)) return state;

    const optionId = String(action.payload?.optionId ?? '');
    if (!state.optionIds.includes(optionId)) return state;

    const previous = state.runners[action.playerId];
    // 레인은 한 번 고르면 못 바꾼다 — 유리한 쪽으로 갈아타면 게임이 아니다
    if (previous && previous.optionId !== optionId) return state;

    const taps = Number(action.payload?.taps);
    if (!Number.isFinite(taps)) return state;

    return {
      ...state,
      runners: {
        ...state.runners,
        [action.playerId]: {
          playerId: action.playerId,
          optionId,
          // 누적 합계를 받으므로 되돌아가지 않는다. 사람 한계 위로는 자르고.
          taps: Math.max(previous?.taps ?? 0, clampTaps(taps, ctx.now - state.phaseStartedAt)),
        },
      },
    };
  },

  tick(state, ctx) {
    const elapsed = ctx.now - state.phaseStartedAt;

    if (state.phase === 'countdown' && elapsed >= TIMING.countdownMs) {
      return { ...state, phase: 'running', phaseStartedAt: ctx.now };
    }

    if (state.phase === 'running' && elapsed >= TIMING.raceMs) {
      return reveal(state, ctx);
    }

    if (state.phase === 'reveal' && elapsed >= RESULT_HOLD_MS) {
      return { ...state, phase: 'done', phaseStartedAt: ctx.now };
    }

    return null;
  },

  toPublicState(state) {
    // 누가 어디를 얼마나 밀고 있는지는 실시간으로 보여야 재미있다
    return state;
  },

  getWinner(state) {
    return state.winnerId;
  },

  isFinished(state) {
    return state.phase === 'done';
  },

  getProgress(state) {
    const order = { countdown: 0.1, running: 0.55, reveal: 1, done: 1 } as const;
    return order[state.phase];
  },
};

/** 레인별 누적 연타 수 */
export function laneTotals(state: RaceState): Record<string, number> {
  const totals: Record<string, number> = Object.fromEntries(
    state.optionIds.map((id) => [id, 0]),
  );
  for (const runner of Object.values(state.runners)) {
    if (totals[runner.optionId] === undefined) continue;
    totals[runner.optionId] += runner.taps;
  }
  return totals;
}

/** 결승선으로 삼을 값 — 가장 앞선 레인 기준으로 막대를 그린다 */
export function leadingTotal(state: RaceState): number {
  return Math.max(1, ...Object.values(laneTotals(state)));
}

function clampTaps(taps: number, elapsedMs: number): number {
  const seconds = Math.max(1, elapsedMs / 1000);
  const ceiling = Math.ceil(seconds * MAX_TAPS_PER_SECOND);
  return Math.min(ceiling, Math.max(0, Math.floor(taps)));
}

function reveal(state: RaceState, ctx: GameContext): RaceState {
  const totals = laneTotals(state);
  const ranked = [...state.optionIds].sort((a, b) => {
    if (totals[b] !== totals[a]) return totals[b] - totals[a];
    return hashString(`${a}:${ctx.seed}`) - hashString(`${b}:${ctx.seed}`);
  });

  return {
    ...state,
    phase: 'reveal',
    phaseStartedAt: ctx.now,
    winnerId: ranked[0] ?? null,
  };
}
