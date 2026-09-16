import { TIMING } from '@/config/app';
import { createRandom, hashString, seededShuffle } from '@/lib/random';
import type { GameAction, GameContext, GameMode } from '@/types/game';

/** 판에 올리는 후보 수 */
const DECK_SIZE = 10;
/** 각자 쓸 수 있는 찜 횟수 */
export const INSTINCT_TICKETS = 3;
const RESULT_HOLD_MS = 4_600;

export interface Claim {
  optionId: string;
  /** 누른 시각 — 동점일 때 더 빨리 누른 쪽이 이긴다 */
  at: number;
}

export interface InstinctTally {
  optionId: string;
  count: number;
  /** 찜한 사람 이름 (공개 때만) */
  players: string[];
}

export interface InstinctState {
  phase: 'countdown' | 'showing' | 'result' | 'done';
  optionIds: string[];
  roundIndex: number;
  /** 🔒 비공개 — playerId -> 찜 목록. 공개 전까지 남이 뭘 찜했는지 모른다 */
  claims: Record<string, Claim[]>;
  /** 공개 — 누가 몇 장 썼는지만. "쟤 벌써 다 썼네" 가 이 게임의 눈치다 */
  ticketsUsed: Record<string, number>;
  results: InstinctTally[] | null;
  winnerId: string | null;
  phaseStartedAt: number;
  roundStartedAt: number;
}

/**
 * 눈치 게임.
 *
 * 후보가 한 장씩 몇 초만 지나간다. 찜은 세 번뿐이라 지금 쓸지 다음을 기다릴지
 * 매번 결정해야 한다. 다른 게임이 전부 "충분히 보고 고르는" 구조라면 이건
 * 반대다 — 판단할 시간을 일부러 뺏는다.
 *
 * 남이 뭘 찜했는지는 끝까지 모르지만, 티켓을 몇 장 썼는지는 보인다.
 * 그게 초조함을 만든다.
 */
export const instinctGame: GameMode<InstinctState> = {
  id: 'instinct',
  title: '눈치 게임',
  tagline: '3초 안에 결정',
  description: '한 장씩 지나가는 후보에 찜 3번',
  emoji: '⚡',
  tint: 'bg-[#FFF6DB]',
  howTo: [
    '후보가 한 장씩 몇 초만 지나가요',
    '찜은 딱 3번 — 아껴야 해요',
    '제일 많이 찜 받은 곳으로 갑니다',
  ],
  minPlayers: 2,
  maxPlayers: 8,
  candidateCount: DECK_SIZE,

  createInitialState(ctx: GameContext): InstinctState {
    const deck = seededShuffle(ctx.candidates, ctx.seed ^ 0x1e5c).slice(0, DECK_SIZE);
    const optionIds = deck.map((r) => r.id);

    if (optionIds.length < 2) {
      return {
        phase: 'done',
        optionIds,
        roundIndex: 0,
        claims: {},
        ticketsUsed: {},
        results: optionIds.map((id) => ({ optionId: id, count: 0, players: [] })),
        winnerId: optionIds[0] ?? null,
        phaseStartedAt: ctx.now,
        roundStartedAt: ctx.now,
      };
    }

    return {
      phase: 'countdown',
      optionIds,
      roundIndex: 0,
      claims: {},
      ticketsUsed: {},
      results: null,
      winnerId: null,
      phaseStartedAt: ctx.now,
      roundStartedAt: ctx.now,
    };
  },

  handleAction(state, action: GameAction, ctx) {
    if (action.type !== 'claim' || state.phase !== 'showing') return state;
    if (!ctx.players.some((p) => p.id === action.playerId)) return state;

    // 지금 화면에 떠 있는 곳만 찜할 수 있다 — 지나간 것을 되돌려 누를 수 없다
    const optionId = state.optionIds[state.roundIndex];
    if (!optionId || optionId !== String(action.payload?.optionId ?? '')) return state;

    const mine = state.claims[action.playerId] ?? [];
    if (mine.length >= INSTINCT_TICKETS) return state;
    if (mine.some((claim) => claim.optionId === optionId)) return state;

    const claims = { ...state.claims, [action.playerId]: [...mine, { optionId, at: ctx.now }] };
    const ticketsUsed = { ...state.ticketsUsed, [action.playerId]: mine.length + 1 };
    const next: InstinctState = { ...state, claims, ticketsUsed };

    // 전원이 티켓을 다 썼으면 남은 후보를 넘길 이유가 없다
    const spent = ctx.players.every(
      (p) => (claims[p.id]?.length ?? 0) >= INSTINCT_TICKETS,
    );
    return spent ? reveal(next, ctx) : next;
  },

  tick(state, ctx) {
    const elapsed = ctx.now - state.phaseStartedAt;

    if (state.phase === 'countdown' && elapsed >= TIMING.countdownMs) {
      return { ...state, phase: 'showing', phaseStartedAt: ctx.now, roundStartedAt: ctx.now };
    }

    if (state.phase === 'showing' && ctx.now - state.roundStartedAt >= TIMING.instinctRoundMs) {
      const nextIndex = state.roundIndex + 1;
      if (nextIndex >= state.optionIds.length) return reveal(state, ctx);
      return { ...state, roundIndex: nextIndex, roundStartedAt: ctx.now };
    }

    if (state.phase === 'result' && elapsed >= RESULT_HOLD_MS) {
      return { ...state, phase: 'done', phaseStartedAt: ctx.now };
    }

    return null;
  },

  toPublicState(state) {
    // 무엇을 찜했는지는 끝까지 숨긴다. 몇 장 썼는지(ticketsUsed)만 공개다.
    return { ...state, claims: {} };
  },

  getWinner(state) {
    return state.winnerId;
  },

  isFinished(state) {
    return state.phase === 'done';
  },

  getProgress(state) {
    if (state.phase === 'countdown') return 0.1;
    if (state.phase !== 'showing') return 1;
    return 0.1 + 0.8 * (state.roundIndex / Math.max(1, state.optionIds.length));
  },
};

/** 내가 남긴 찜 횟수 */
export function ticketsLeft(state: InstinctState, playerId: string): number {
  return INSTINCT_TICKETS - (state.ticketsUsed[playerId] ?? 0);
}

function reveal(state: InstinctState, ctx: GameContext): InstinctState {
  const counts = new Map<string, { count: number; first: number; players: string[] }>(
    state.optionIds.map((id) => [id, { count: 0, first: Infinity, players: [] }]),
  );

  for (const [playerId, claims] of Object.entries(state.claims)) {
    const nickname = ctx.players.find((p) => p.id === playerId)?.nickname;
    for (const claim of claims) {
      const entry = counts.get(claim.optionId);
      if (!entry) continue;
      entry.count += 1;
      entry.first = Math.min(entry.first, claim.at);
      // 이미 나간 사람의 찜도 표는 표다 — 이름만 빠진다
      if (nickname) entry.players.push(nickname);
    }
  }

  const results: InstinctTally[] = state.optionIds
    .map((optionId) => {
      const entry = counts.get(optionId);
      return { optionId, count: entry?.count ?? 0, players: entry?.players ?? [] };
    })
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      // 같은 표면 더 빨리 누른 쪽
      const first = (counts.get(a.optionId)?.first ?? Infinity)
        - (counts.get(b.optionId)?.first ?? Infinity);
      if (first !== 0) return first;
      // 아무도 안 누른 것들끼리는 시드로 가른다
      return hashString(`${a.optionId}:${ctx.seed}`) - hashString(`${b.optionId}:${ctx.seed}`);
    });

  // 아무도 찜하지 않았으면 시드로 한 곳
  const anyClaim = results.some((r) => r.count > 0);
  const fallback = state.optionIds[
    Math.floor(createRandom(ctx.seed ^ 0xf00d)() * state.optionIds.length)
  ];

  return {
    ...state,
    phase: 'result',
    phaseStartedAt: ctx.now,
    results,
    winnerId: anyClaim ? results[0]?.optionId ?? null : fallback ?? null,
  };
}
