import { TIMING } from '@/config/app';
import { createRandom, seededShuffle } from '@/lib/random';
import type { GameAction, GameContext, GameMode } from '@/types/game';

const RESULT_HOLD_MS = 2_400;

export interface FateState {
  phase: 'ready' | 'countdown' | 'reeling' | 'result' | 'done';
  optionIds: string[];
  winnerIndex: number;
  /** 운명을 맡긴 참가자들 */
  committedPlayerIds: string[];
  phaseStartedAt: number;
}

const REEL_SIZE = 10;

export const fateGame: GameMode<FateState> = {
  id: 'fate',
  title: '운명 랜덤',
  tagline: '아무 생각 없이 뽑기',
  description: '다 같이 운명에 맡기고 한 곳을 뽑는다',
  emoji: '🎲',
  tint: 'bg-[#FFF3D9]',
  howTo: ['다 같이 운명 맡기기를 눌러요', '화면이 흔들리고 후보가 지나가요', '멈춘 곳으로 갑니다'],
  minPlayers: 1,
  maxPlayers: 8,
  candidateCount: REEL_SIZE,

  createInitialState(ctx: GameContext): FateState {
    const options = seededShuffle(ctx.candidates, ctx.seed ^ 0x51ed).slice(0, REEL_SIZE);
    const rand = createRandom(ctx.seed ^ 0xbeef);
    return {
      phase: 'ready',
      optionIds: options.map((r) => r.id),
      winnerIndex: Math.floor(rand() * Math.max(1, options.length)),
      committedPlayerIds: [],
      phaseStartedAt: ctx.now,
    };
  },

  handleAction(state, action: GameAction, ctx) {
    if (state.phase !== 'ready') return state;

    if (action.type === 'commit') {
      if (state.committedPlayerIds.includes(action.playerId)) return state;
      const committed = [...state.committedPlayerIds, action.playerId];
      const everyone = ctx.players.every((p) => committed.includes(p.id));
      return everyone
        ? { ...state, committedPlayerIds: committed, phase: 'countdown', phaseStartedAt: ctx.now }
        : { ...state, committedPlayerIds: committed };
    }

    // 방장이 기다리지 않고 바로 시작
    if (action.type === 'force' && action.playerId === ctx.hostId) {
      return { ...state, phase: 'countdown', phaseStartedAt: ctx.now };
    }

    return state;
  },

  tick(state, ctx) {
    const elapsed = ctx.now - state.phaseStartedAt;
    if (state.phase === 'countdown' && elapsed >= TIMING.countdownMs) {
      return { ...state, phase: 'reeling', phaseStartedAt: ctx.now };
    }
    if (state.phase === 'reeling' && elapsed >= TIMING.fateReelMs) {
      return { ...state, phase: 'result', phaseStartedAt: ctx.now };
    }
    if (state.phase === 'result' && elapsed >= RESULT_HOLD_MS) {
      return { ...state, phase: 'done', phaseStartedAt: ctx.now };
    }
    // 참가자가 나가서 이미 전원이 맡긴 상태가 된 경우
    if (
      state.phase === 'ready' &&
      ctx.players.length > 0 &&
      ctx.players.every((p) => state.committedPlayerIds.includes(p.id))
    ) {
      return { ...state, phase: 'countdown', phaseStartedAt: ctx.now };
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
    const order = { ready: 0.1, countdown: 0.4, reeling: 0.8, result: 1, done: 1 } as const;
    return order[state.phase];
  },
};
