import { TIMING } from '@/config/app';
import { hashString, seededShuffle } from '@/lib/random';
import type { GameAction, GameContext, GameMode } from '@/types/game';

/** 판에 올라가는 칸 수 */
const BOARD_SIZE = 8;
/** 판이 한 바퀴 도는 데 걸리는 시간(ms). 화면과 서버가 같은 값을 쓴다 */
export const ROTATION_MS = 3_600;
/** 파워 게이지가 한 번 왕복하는 시간(ms) */
export const GAUGE_MS = 1_100;
/** 이 아래로 떨어지면 빗나간다 */
export const ACCURATE_ENOUGH = 0.55;
const RESULT_HOLD_MS = 4_200;

export interface DartThrow {
  playerId: string;
  /** 맞힌 칸 */
  optionId: string;
  /** 0~1. 파워 게이지를 얼마나 잘 맞췄는지 */
  accuracy: number;
  /** 겨눈 칸에서 몇 칸 빗나갔는지 (0 이면 명중) */
  drift: number;
}

export interface DartState {
  phase: 'countdown' | 'throwing' | 'reveal' | 'done';
  optionIds: string[];
  /** 던진 결과. 던지는 중에는 누가 던졌는지만 공개된다 */
  throws: DartThrow[];
  thrownPlayerIds: string[];
  winnerId: string | null;
  phaseStartedAt: number;
}

/**
 * 음식 다트.
 *
 * 지금까지의 게임은 전부 "고르기" 였다 — 투표하거나 탭하거나 지우거나.
 * 이건 손으로 하는 게임이다. 판이 계속 돌고, 파워 게이지가 왕복한다.
 * 던지는 순간의 판 각도가 겨눈 칸을 정하고, 게이지를 얼마나 잘 맞췄는지가
 * 그 칸에 실제로 꽂히는지를 정한다. 잘하면 원하는 데를 맞힌다.
 *
 * 판의 각도는 시작 시각에서 계산한다 — 모두가 같은 판을 본다.
 * 빗나감도 시드로 정해서, 같은 입력이면 항상 같은 결과가 나온다.
 */
export const dartGame: GameMode<DartState> = {
  id: 'dart',
  title: '음식 다트',
  tagline: '돌아가는 판에 던지기',
  description: '타이밍을 맞춰 원하는 칸에 꽂는다',
  emoji: '🎯',
  tint: 'bg-[#FFECEC]',
  howTo: [
    '판이 계속 돌아가요',
    '누르고 있다가 게이지가 가운데일 때 떼세요',
    '가장 많이 꽂힌 칸으로 갑니다',
  ],
  minPlayers: 1,
  maxPlayers: 8,
  candidateCount: BOARD_SIZE,

  createInitialState(ctx: GameContext): DartState {
    const board = seededShuffle(ctx.candidates, ctx.seed ^ 0xda47).slice(0, BOARD_SIZE);
    const optionIds = board.map((r) => r.id);

    if (optionIds.length < 2) {
      return {
        phase: 'done',
        optionIds,
        throws: [],
        thrownPlayerIds: [],
        winnerId: optionIds[0] ?? null,
        phaseStartedAt: ctx.now,
      };
    }

    return {
      phase: 'countdown',
      optionIds,
      throws: [],
      thrownPlayerIds: [],
      winnerId: null,
      phaseStartedAt: ctx.now,
    };
  },

  handleAction(state, action: GameAction, ctx) {
    if (action.type !== 'throw' || state.phase !== 'throwing') return state;
    if (!ctx.players.some((p) => p.id === action.playerId)) return state;
    // 한 사람당 한 번
    if (state.thrownPlayerIds.includes(action.playerId)) return state;

    const offsetMs = Number(action.payload?.offsetMs);
    const accuracy = Number(action.payload?.accuracy);
    if (!Number.isFinite(offsetMs) || !Number.isFinite(accuracy)) return state;

    const landed = land({
      optionIds: state.optionIds,
      offsetMs,
      accuracy,
      seed: ctx.seed,
      playerId: action.playerId,
    });

    const throws = [...state.throws, { playerId: action.playerId, ...landed }];
    const thrownPlayerIds = [...new Set([...state.thrownPlayerIds, action.playerId])];
    const next: DartState = { ...state, throws, thrownPlayerIds };

    const everyone =
      ctx.players.length > 0 && ctx.players.every((p) => thrownPlayerIds.includes(p.id));
    return everyone ? reveal(next, ctx) : next;
  },

  tick(state, ctx) {
    const elapsed = ctx.now - state.phaseStartedAt;

    if (state.phase === 'countdown' && elapsed >= TIMING.countdownMs) {
      return { ...state, phase: 'throwing', phaseStartedAt: ctx.now };
    }

    if (state.phase === 'throwing') {
      const everyone =
        ctx.players.length > 0 &&
        ctx.players.every((p) => state.thrownPlayerIds.includes(p.id));
      if (everyone || elapsed >= TIMING.dartWindowMs) return reveal(state, ctx);
    }

    if (state.phase === 'reveal' && elapsed >= RESULT_HOLD_MS) {
      return { ...state, phase: 'done', phaseStartedAt: ctx.now };
    }

    return null;
  },

  toPublicState(state) {
    // 숨길 게 없다. 어디에 꽂혔는지는 바로 보여야 손맛이 난다.
    return state;
  },

  getWinner(state) {
    return state.winnerId;
  },

  isFinished(state) {
    return state.phase === 'done';
  },

  getProgress(state) {
    const order = { countdown: 0.1, throwing: 0.55, reveal: 1, done: 1 } as const;
    return order[state.phase];
  },
};

/**
 * 던지는 순간 크로스헤어(12시) 아래에 있는 칸.
 *
 * 화면도 같은 식으로 그려서, 눈에 보이는 칸과 실제로 겨눈 칸이 어긋나지 않게 한다.
 */
export function aimedIndex(offsetMs: number, count: number): number {
  const turns = offsetMs / ROTATION_MS;
  const fraction = ((turns % 1) + 1) % 1;
  return Math.floor(fraction * count) % count;
}

/** 파워 게이지의 현재 위치 (0~1 왕복) */
export function gaugeAt(offsetMs: number): number {
  const phase = ((offsetMs % GAUGE_MS) + GAUGE_MS) % GAUGE_MS;
  const half = GAUGE_MS / 2;
  return phase < half ? phase / half : 2 - phase / half;
}

/** 게이지 위치 → 정확도. 한가운데(0.5)가 가장 좋다 */
export function accuracyFrom(gauge: number): number {
  return Math.max(0, 1 - Math.abs(gauge - 0.5) * 2);
}

function land(input: {
  optionIds: string[];
  offsetMs: number;
  accuracy: number;
  seed: number;
  playerId: string;
}): { optionId: string; accuracy: number; drift: number } {
  const { optionIds, offsetMs, seed, playerId } = input;
  const count = optionIds.length;
  // 클라이언트가 보내는 값이라 그대로 믿지 않는다
  const accuracy = Math.min(1, Math.max(0, input.accuracy));
  const aimed = aimedIndex(offsetMs, count);

  // 잘 맞췄으면 겨눈 칸에 그대로 꽂힌다
  if (accuracy >= ACCURATE_ENOUGH) {
    return { optionId: optionIds[aimed], accuracy, drift: 0 };
  }

  // 못 맞출수록 더 많이 빗나간다. 방향과 크기는 시드로 정한다.
  const miss = accuracy < 0.25 ? 2 : 1;
  const roll = hashString(`${playerId}:${Math.round(offsetMs)}:${seed}`);
  const drift = roll % 2 === 0 ? miss : -miss;
  const index = ((aimed + drift) % count + count) % count;
  return { optionId: optionIds[index], accuracy, drift };
}

function reveal(state: DartState, ctx: GameContext): DartState {
  const scores = new Map<string, { darts: number; accuracy: number }>(
    state.optionIds.map((id) => [id, { darts: 0, accuracy: 0 }]),
  );

  for (const dart of state.throws) {
    const entry = scores.get(dart.optionId);
    if (!entry) continue;
    entry.darts += 1;
    entry.accuracy += dart.accuracy;
  }

  const ranked = [...state.optionIds].sort((a, b) => {
    const left = scores.get(a);
    const right = scores.get(b);
    if ((right?.darts ?? 0) !== (left?.darts ?? 0)) return (right?.darts ?? 0) - (left?.darts ?? 0);
    // 같은 개수면 더 정확하게 꽂은 쪽
    if ((right?.accuracy ?? 0) !== (left?.accuracy ?? 0)) {
      return (right?.accuracy ?? 0) - (left?.accuracy ?? 0);
    }
    return hashString(`${a}:${ctx.seed}`) - hashString(`${b}:${ctx.seed}`);
  });

  return {
    ...state,
    phase: 'reveal',
    phaseStartedAt: ctx.now,
    winnerId: ranked[0] ?? null,
  };
}
