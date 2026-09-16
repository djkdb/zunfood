import { TIMING } from '@/config/app';
import { hashString, seededShuffle } from '@/lib/random';
import type { GameAction, GameContext, GameMode } from '@/types/game';

/** 기계에 들어가는 캡슐 수 */
const CAPSULE_COUNT = 8;
/** 집게가 좌우로 한 번 왕복하는 시간(ms) */
export const SLIDE_MS = 2_400;
/** 악력 게이지가 한 번 왕복하는 시간(ms) */
export const GRIP_MS = 1_000;
/** 이 위로는 무조건 잡는다 */
export const FIRM_GRIP = 0.75;
/** 이 아래로는 무조건 놓친다 */
export const WEAK_GRIP = 0.45;
const RESULT_HOLD_MS = 4_200;

export interface Grab {
  playerId: string;
  /** 집으려 한 캡슐 */
  optionId: string;
  /** 0~1. 악력 게이지를 얼마나 잘 맞췄는지 */
  grip: number;
  /** 실제로 집었는지 */
  caught: boolean;
}

export interface ClawState {
  phase: 'countdown' | 'playing' | 'reveal' | 'done';
  optionIds: string[];
  grabs: Grab[];
  grabbedPlayerIds: string[];
  winnerId: string | null;
  phaseStartedAt: number;
}

/**
 * 뽑기 기계.
 *
 * 다트가 한 번 누르는 게임이라면 이건 두 번이다. 먼저 좌우로 움직이는 집게를
 * 세워 캡슐을 고르고, 그다음 악력 게이지를 맞춰 실제로 집는다. 위치를 잘
 * 맞춰도 힘이 약하면 미끄러진다 — 진짜 뽑기 기계처럼.
 *
 * 집게 움직임은 각자 화면에서만 돈다(남의 집게를 볼 이유가 없다). 공유되는 건
 * 결과뿐이라, 폴링으로 도는 방에서도 가볍다.
 */
export const clawGame: GameMode<ClawState> = {
  id: 'claw',
  title: '뽑기 기계',
  tagline: '집게로 집어 올리기',
  description: '위치 맞추고, 악력 맞추고',
  emoji: '🕹️',
  tint: 'bg-[#F3EDFF]',
  howTo: [
    '집게가 좌우로 움직여요 — 눌러서 세우세요',
    '악력 게이지를 한 번 더 눌러 맞춰요',
    '가장 많이 집힌 캡슐로 갑니다',
  ],
  minPlayers: 1,
  maxPlayers: 8,
  candidateCount: CAPSULE_COUNT,

  createInitialState(ctx: GameContext): ClawState {
    const capsules = seededShuffle(ctx.candidates, ctx.seed ^ 0xc1a7).slice(0, CAPSULE_COUNT);
    const optionIds = capsules.map((r) => r.id);

    if (optionIds.length < 2) {
      return {
        phase: 'done',
        optionIds,
        grabs: [],
        grabbedPlayerIds: [],
        winnerId: optionIds[0] ?? null,
        phaseStartedAt: ctx.now,
      };
    }

    return {
      phase: 'countdown',
      optionIds,
      grabs: [],
      grabbedPlayerIds: [],
      winnerId: null,
      phaseStartedAt: ctx.now,
    };
  },

  handleAction(state, action: GameAction, ctx) {
    if (action.type !== 'grab' || state.phase !== 'playing') return state;
    if (!ctx.players.some((p) => p.id === action.playerId)) return state;
    if (state.grabbedPlayerIds.includes(action.playerId)) return state;

    const x = Number(action.payload?.x);
    const grip = Number(action.payload?.grip);
    if (!Number.isFinite(x) || !Number.isFinite(grip)) return state;

    const grab = resolveGrab({
      optionIds: state.optionIds,
      x,
      grip,
      seed: ctx.seed,
      playerId: action.playerId,
    });

    const grabs = [...state.grabs, { playerId: action.playerId, ...grab }];
    const grabbedPlayerIds = [...new Set([...state.grabbedPlayerIds, action.playerId])];
    const next: ClawState = { ...state, grabs, grabbedPlayerIds };

    const everyone =
      ctx.players.length > 0 && ctx.players.every((p) => grabbedPlayerIds.includes(p.id));
    return everyone ? reveal(next, ctx) : next;
  },

  tick(state, ctx) {
    const elapsed = ctx.now - state.phaseStartedAt;

    if (state.phase === 'countdown' && elapsed >= TIMING.countdownMs) {
      return { ...state, phase: 'playing', phaseStartedAt: ctx.now };
    }

    if (state.phase === 'playing') {
      const everyone =
        ctx.players.length > 0 &&
        ctx.players.every((p) => state.grabbedPlayerIds.includes(p.id));
      if (everyone || elapsed >= TIMING.clawWindowMs) return reveal(state, ctx);
    }

    if (state.phase === 'reveal' && elapsed >= RESULT_HOLD_MS) {
      return { ...state, phase: 'done', phaseStartedAt: ctx.now };
    }

    return null;
  },

  toPublicState(state) {
    // 숨길 게 없다. 누가 뭘 집었고 누가 놓쳤는지가 이 게임의 이야기다.
    return state;
  },

  getWinner(state) {
    return state.winnerId;
  },

  isFinished(state) {
    return state.phase === 'done';
  },

  getProgress(state) {
    const order = { countdown: 0.1, playing: 0.55, reveal: 1, done: 1 } as const;
    return order[state.phase];
  },
};

/** 집게 위치(0~1) → 그 아래 있는 캡슐 번호 */
export function capsuleAt(x: number, count: number): number {
  const clamped = Math.min(0.999, Math.max(0, x));
  return Math.floor(clamped * count);
}

/** 집게가 좌우로 움직이는 위치 (0~1 왕복) */
export function slideAt(offsetMs: number): number {
  const phase = ((offsetMs % SLIDE_MS) + SLIDE_MS) % SLIDE_MS;
  const half = SLIDE_MS / 2;
  return phase < half ? phase / half : 2 - phase / half;
}

/** 악력 게이지 위치 (0~1 왕복) */
export function gripAt(offsetMs: number): number {
  const phase = ((offsetMs % GRIP_MS) + GRIP_MS) % GRIP_MS;
  const half = GRIP_MS / 2;
  return phase < half ? phase / half : 2 - phase / half;
}

/** 게이지 위치 → 악력. 한가운데가 가장 세다 */
export function gripStrength(gauge: number): number {
  return Math.max(0, 1 - Math.abs(gauge - 0.5) * 2);
}

function resolveGrab(input: {
  optionIds: string[];
  x: number;
  grip: number;
  seed: number;
  playerId: string;
}): { optionId: string; grip: number; caught: boolean } {
  const { optionIds, seed, playerId } = input;
  // 클라이언트가 보내는 값이라 그대로 믿지 않는다
  const grip = Math.min(1, Math.max(0, input.grip));
  const optionId = optionIds[capsuleAt(input.x, optionIds.length)];

  if (grip >= FIRM_GRIP) return { optionId, grip, caught: true };
  if (grip < WEAK_GRIP) return { optionId, grip, caught: false };

  // 애매한 악력은 미끄러질 수도 있다 — 진짜 뽑기 기계처럼.
  // 다만 시드로 정해서, 같은 입력이면 항상 같은 결과가 나온다.
  const roll = hashString(`${playerId}:${Math.round(grip * 1000)}:${seed}`) % 100;
  return { optionId, grip, caught: roll < 50 };
}

function reveal(state: ClawState, ctx: GameContext): ClawState {
  const caught = state.grabs.filter((grab) => grab.caught);

  const score = new Map<string, { count: number; grip: number }>(
    state.optionIds.map((id) => [id, { count: 0, grip: 0 }]),
  );
  for (const grab of caught) {
    const entry = score.get(grab.optionId);
    if (!entry) continue;
    entry.count += 1;
    entry.grip += grab.grip;
  }

  const ranked = [...state.optionIds].sort((a, b) => {
    const left = score.get(a);
    const right = score.get(b);
    if ((right?.count ?? 0) !== (left?.count ?? 0)) return (right?.count ?? 0) - (left?.count ?? 0);
    if ((right?.grip ?? 0) !== (left?.grip ?? 0)) return (right?.grip ?? 0) - (left?.grip ?? 0);
    return hashString(`${a}:${ctx.seed}`) - hashString(`${b}:${ctx.seed}`);
  });

  return {
    ...state,
    phase: 'reveal',
    phaseStartedAt: ctx.now,
    winnerId: ranked[0] ?? null,
  };
}
