import { TIMING } from '@/config/app';
import { createRandom, seededShuffle } from '@/lib/random';
import type { GameAction, GameContext, GameMode } from '@/types/game';

/** 결과를 화면에서 보여주는 시간(ms) — 이 시간이 지나면 최종 결과 화면으로 넘어간다. */
const RESULT_HOLD_MS = 2_400;

export interface RouletteState {
  phase: 'ready' | 'countdown' | 'spinning' | 'result' | 'done';
  /** 룰렛 칸 순서 (식당 id) */
  optionIds: string[];
  /** 당첨 칸 인덱스 — 시작 시점에 시드로 확정되어 모두가 같은 결과를 본다. */
  winnerIndex: number;
  phaseStartedAt: number;
  /** 회전을 시작한 사람 */
  spunBy: string | null;
}

const SEGMENTS = 8;

export const rouletteGame: GameMode<RouletteState> = {
  id: 'roulette',
  title: '음식 룰렛',
  tagline: '운명에게 맡기기',
  description: '주변 식당을 룰렛에 올리고 한 방에 결정',
  emoji: '🎰',
  tint: 'bg-[#EEF1FF]',
  howTo: ['주변 식당 8곳이 룰렛에 올라가요', '방장이 룰렛을 돌려요', '멈춘 칸이 오늘의 식당'],
  minPlayers: 1,
  maxPlayers: 8,
  candidateCount: SEGMENTS,

  createInitialState(ctx: GameContext): RouletteState {
    const options = seededShuffle(ctx.candidates, ctx.seed).slice(0, SEGMENTS);
    const rand = createRandom(ctx.seed ^ 0x9e37);
    return {
      phase: 'ready',
      optionIds: options.map((r) => r.id),
      winnerIndex: Math.floor(rand() * Math.max(1, options.length)),
      phaseStartedAt: ctx.now,
      spunBy: null,
    };
  },

  handleAction(state, action: GameAction, ctx) {
    if (action.type === 'spin' && state.phase === 'ready') {
      return {
        ...state,
        phase: 'countdown',
        phaseStartedAt: ctx.now,
        spunBy: action.playerId,
      };
    }
    return state;
  },

  tick(state, ctx) {
    const elapsed = ctx.now - state.phaseStartedAt;
    if (state.phase === 'countdown' && elapsed >= TIMING.countdownMs) {
      return { ...state, phase: 'spinning', phaseStartedAt: ctx.now };
    }
    if (state.phase === 'spinning' && elapsed >= TIMING.rouletteSpinMs) {
      return { ...state, phase: 'result', phaseStartedAt: ctx.now };
    }
    if (state.phase === 'result' && elapsed >= RESULT_HOLD_MS) {
      return { ...state, phase: 'done', phaseStartedAt: ctx.now };
    }
    return null;
  },

  toPublicState(state) {
    return state;
  },

  getWinner(state) {
    if (state.phase !== 'result' && state.phase !== 'done') return null;
    return state.optionIds[state.winnerIndex] ?? null;
  },

  isFinished(state) {
    return state.phase === 'done';
  },

  getProgress(state) {
    const order = { ready: 0, countdown: 0.25, spinning: 0.7, result: 1, done: 1 } as const;
    return order[state.phase];
  },
};
