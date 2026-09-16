import { TIMING } from '@/config/app';
import { createRandom, seededShuffle } from '@/lib/random';
import type { GameAction, GameContext, GameMode } from '@/types/game';

/** 판에 올라가는 후보 수 */
const BOARD_SIZE = 8;
const RESULT_HOLD_MS = 2_600;

export interface Strike {
  optionId: string;
  /** 지운 사람 */
  playerId: string;
}

export interface EliminationState {
  phase: 'countdown' | 'playing' | 'result' | 'done';
  optionIds: string[];
  /** 지워진 순서대로 */
  removed: Strike[];
  /** 차례 순서 (playerId) */
  order: string[];
  /** order 안에서의 현재 위치 */
  turn: number;
  phaseStartedAt: number;
  turnStartedAt: number;
  winnerId: string | null;
}

/**
 * 지우기.
 *
 * 룰렛·운명 랜덤은 눌러놓고 구경만 한다. 이 게임은 정반대다 — 한 곳이 남을
 * 때까지 돌아가며 "여긴 아니야" 를 한 번씩 행사한다.
 *
 * 재미는 거부권에서 나온다. 내가 가고 싶은 곳을 지키려면 남들이 노릴 만한
 * 곳을 먼저 쳐야 하고, 친구가 내 최애를 지우는 순간이 이 게임의 장면이다.
 */
export const eliminationGame: GameMode<EliminationState> = {
  id: 'elimination',
  title: '지우기',
  tagline: '싫은 곳부터 하나씩',
  description: '돌아가며 한 곳씩 지우고 마지막에 남은 곳으로',
  emoji: '🙅',
  tint: 'bg-[#EDEAFF]',
  howTo: [
    '후보 8곳이 판에 올라가요',
    '차례가 오면 싫은 곳을 하나 지워요',
    '마지막에 남은 한 곳으로 갑니다',
  ],
  minPlayers: 2,
  maxPlayers: 8,
  candidateCount: BOARD_SIZE,

  createInitialState(ctx: GameContext): EliminationState {
    const board = seededShuffle(ctx.candidates, ctx.seed ^ 0x3110).slice(0, BOARD_SIZE);
    const optionIds = board.map((r) => r.id);
    // 차례도 시드로 섞는다 — 방장이 늘 먼저가 아니게
    const order = seededShuffle(ctx.players.map((p) => p.id), ctx.seed ^ 0x7a1c);

    if (optionIds.length < 2) {
      return {
        phase: 'done',
        optionIds,
        removed: [],
        order,
        turn: 0,
        phaseStartedAt: ctx.now,
        turnStartedAt: ctx.now,
        winnerId: optionIds[0] ?? null,
      };
    }

    return {
      phase: 'countdown',
      optionIds,
      removed: [],
      order,
      turn: 0,
      phaseStartedAt: ctx.now,
      turnStartedAt: ctx.now,
      winnerId: null,
    };
  },

  handleAction(state, action: GameAction, ctx) {
    if (action.type !== 'strike' || state.phase !== 'playing') return state;

    // 자기 차례인 사람만 지울 수 있다
    if (currentPlayerId(state, ctx) !== action.playerId) return state;

    const optionId = String(action.payload?.optionId ?? '');
    if (!remaining(state).includes(optionId)) return state;

    return applyStrike(state, optionId, action.playerId, ctx);
  },

  tick(state, ctx) {
    const elapsed = ctx.now - state.phaseStartedAt;

    if (state.phase === 'countdown' && elapsed >= TIMING.countdownMs) {
      return { ...state, phase: 'playing', phaseStartedAt: ctx.now, turnStartedAt: ctx.now };
    }

    if (state.phase === 'playing') {
      const turnPlayer = currentPlayerId(state, ctx);
      // 아무도 안 남았으면 진행할 것이 없다 (방이 비면 상위에서 정리된다)
      if (!turnPlayer) return null;

      // 시간 안에 안 고르면 대신 지워준다 (게임이 멈추면 안 된다)
      if (ctx.now - state.turnStartedAt >= TIMING.eliminationTurnMs) {
        const alive = remaining(state);
        const rand = createRandom(ctx.seed ^ state.removed.length);
        return applyStrike(state, alive[Math.floor(rand() * alive.length)], turnPlayer, ctx);
      }
    }

    if (state.phase === 'result' && elapsed >= RESULT_HOLD_MS) {
      return { ...state, phase: 'done', phaseStartedAt: ctx.now };
    }

    return null;
  },

  toPublicState(state) {
    // 숨길 것이 없다. 누가 무엇을 지웠는지가 이 게임의 재미다.
    return state;
  },

  getWinner(state) {
    return state.winnerId;
  },

  isFinished(state) {
    return state.phase === 'done';
  },

  getProgress(state) {
    if (state.phase === 'countdown') return 0.1;
    if (state.phase !== 'playing') return 1;
    const total = Math.max(1, state.optionIds.length - 1);
    return 0.1 + 0.85 * (state.removed.length / total);
  },
};

/** 아직 살아 있는 후보 */
export function remaining(state: EliminationState): string[] {
  const struck = new Set(state.removed.map((r) => r.optionId));
  return state.optionIds.filter((id) => !struck.has(id));
}

/**
 * 지금 차례인 사람.
 *
 * 나간 사람은 건너뛴다. 아무도 안 남았으면 null — 호출부가 알아서 처리한다.
 */
export function currentPlayerId(state: EliminationState, ctx: GameContext): string | null {
  const present = state.order.filter((id) => ctx.players.some((p) => p.id === id));
  if (present.length === 0) return null;
  return present[state.turn % present.length];
}

function applyStrike(
  state: EliminationState,
  optionId: string,
  playerId: string,
  ctx: GameContext,
): EliminationState {
  const removed = [...state.removed, { optionId, playerId }];
  const left = state.optionIds.filter(
    (id) => !removed.some((strike) => strike.optionId === id),
  );

  if (left.length <= 1) {
    return {
      ...state,
      removed,
      phase: 'result',
      phaseStartedAt: ctx.now,
      turnStartedAt: ctx.now,
      winnerId: left[0] ?? null,
    };
  }

  return { ...state, removed, turn: state.turn + 1, turnStartedAt: ctx.now };
}
