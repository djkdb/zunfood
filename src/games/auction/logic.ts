import { TIMING } from '@/config/app';
import { hashString, seededShuffle } from '@/lib/random';
import type { GameAction, GameContext, GameMode } from '@/types/game';

/** 각자에게 주어지는 포인트 */
export const AUCTION_BUDGET = 100;
/** 경매에 오르는 후보 수 */
const LOT_COUNT = 5;
/** 포인트를 올리고 내리는 단위 */
export const AUCTION_STEP = 10;

export interface AuctionTally {
  optionId: string;
  total: number;
  /** 이 후보에 포인트를 건 사람들 (많이 건 순) */
  backers: string[];
}

export interface AuctionState {
  phase: 'countdown' | 'bidding' | 'reveal' | 'done';
  optionIds: string[];
  /**
   * 🔒 비공개 — playerId -> (식당 id -> 포인트).
   * toPublicState 에서 제거된다. 남이 어디에 걸었는지 모르는 게 이 게임의 전부다.
   */
  bids: Record<string, Record<string, number>>;
  /** 공개 — 제출을 마친 사람만 알린다 */
  submittedPlayerIds: string[];
  /** 공개 시점에만 채워진다 (많이 받은 순) */
  results: AuctionTally[] | null;
  winnerId: string | null;
  phaseStartedAt: number;
}

/**
 * 음식 경매.
 *
 * 각자 100포인트를 후보들에 몰래 나눠 건다. 전원이 제출하면 한 번에 공개하고,
 * 가장 많은 포인트를 받은 곳으로 간다.
 *
 * 다른 게임과 다른 점: 운도 아니고 단순 다수결도 아니다. "나는 여기가 꼭 좋다"를
 * 몰빵으로 표현할 수 있어서, 한 명이 강하게 원하면 여러 명의 미지근한 선호를
 * 이길 수 있다. 소수의 간절함이 반영되는 유일한 게임이다.
 */
export const auctionGame: GameMode<AuctionState> = {
  id: 'auction',
  title: '음식 경매',
  tagline: '포인트로 밀어붙이기',
  description: '100포인트를 몰래 나눠 걸고 한 번에 공개',
  emoji: '💰',
  tint: 'bg-[#FFF0F4]',
  howTo: [
    '각자 100포인트를 받아요',
    '가고 싶은 곳에 몰래 나눠 걸어요',
    '한 번에 공개 — 제일 많이 받은 곳으로',
  ],
  minPlayers: 2,
  maxPlayers: 8,
  candidateCount: LOT_COUNT,

  createInitialState(ctx: GameContext): AuctionState {
    const lots = seededShuffle(ctx.candidates, ctx.seed ^ 0xa0c7).slice(0, LOT_COUNT);
    const optionIds = lots.map((r) => r.id);

    // 후보가 하나뿐이면 경매할 것이 없다
    if (optionIds.length < 2) {
      return {
        phase: 'done',
        optionIds,
        bids: {},
        submittedPlayerIds: [],
        results: optionIds.map((id) => ({ optionId: id, total: 0, backers: [] })),
        winnerId: optionIds[0] ?? null,
        phaseStartedAt: ctx.now,
      };
    }

    return {
      phase: 'countdown',
      optionIds,
      bids: {},
      submittedPlayerIds: [],
      results: null,
      winnerId: null,
      phaseStartedAt: ctx.now,
    };
  },

  handleAction(state, action: GameAction, ctx) {
    if (action.type === 'bid' && state.phase === 'bidding') {
      if (!ctx.players.some((p) => p.id === action.playerId)) return state;
      // 한 번 제출하면 바꿀 수 없다 — 그래서 공개가 긴장된다
      if (state.submittedPlayerIds.includes(action.playerId)) return state;

      const allocation = sanitizeAllocation(action.payload?.allocation, state.optionIds);
      if (!allocation) return state;

      const bids = { ...state.bids, [action.playerId]: allocation };
      const submittedPlayerIds = [...new Set([...state.submittedPlayerIds, action.playerId])];
      const next: AuctionState = { ...state, bids, submittedPlayerIds };

      const everyone =
        ctx.players.length > 0 && ctx.players.every((p) => bids[p.id] !== undefined);
      return everyone ? reveal(next, ctx) : next;
    }

    // 방장이 기다리지 않고 공개 (미제출자는 기권)
    if (action.type === 'force' && action.playerId === ctx.hostId && state.phase === 'bidding') {
      return reveal(state, ctx);
    }

    return state;
  },

  tick(state, ctx) {
    const elapsed = ctx.now - state.phaseStartedAt;

    if (state.phase === 'countdown' && elapsed >= TIMING.countdownMs) {
      return { ...state, phase: 'bidding', phaseStartedAt: ctx.now };
    }

    if (state.phase === 'bidding') {
      // 참가자가 나가서 남은 사람이 모두 제출을 마친 경우도 바로 공개한다
      const everyone =
        ctx.players.length > 0 && ctx.players.every((p) => state.bids[p.id] !== undefined);
      if (everyone || elapsed >= TIMING.auctionBidMs) return reveal(state, ctx);
    }

    if (state.phase === 'reveal' && elapsed >= TIMING.auctionRevealMs) {
      return { ...state, phase: 'done', phaseStartedAt: ctx.now };
    }

    return null;
  },

  toPublicState(state) {
    // 누가 어디에 걸었는지는 공개하지 않는다. 집계(results)만 나간다.
    return { ...state, bids: {} };
  },

  getWinner(state) {
    return state.winnerId;
  },

  isFinished(state) {
    return state.phase === 'done';
  },

  getProgress(state) {
    const order = { countdown: 0.15, bidding: 0.55, reveal: 0.9, done: 1 } as const;
    return order[state.phase];
  },
};

/**
 * 들어온 배분이 규칙에 맞는지 확인한다.
 *
 * 호스트에서만 실행되지만, 참가자가 보내는 값이므로 그대로 믿지 않는다.
 * 후보 밖의 식당, 음수, 소수점, 예산 초과를 모두 막는다.
 */
function sanitizeAllocation(
  raw: unknown,
  optionIds: string[],
): Record<string, number> | null {
  if (!raw || typeof raw !== 'object') return null;

  const allocation: Record<string, number> = {};
  let spent = 0;

  for (const [optionId, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!optionIds.includes(optionId)) return null;
    const points = Number(value);
    if (!Number.isInteger(points) || points < 0) return null;
    if (points === 0) continue;
    allocation[optionId] = points;
    spent += points;
  }

  if (spent > AUCTION_BUDGET) return null;
  return allocation;
}

/** 제출된 포인트를 합산하고 우승을 확정한다 */
function reveal(state: AuctionState, ctx: GameContext): AuctionState {
  const totals = new Map<string, number>(state.optionIds.map((id) => [id, 0]));
  const perOption = new Map<string, { nickname: string; points: number }[]>(
    state.optionIds.map((id) => [id, []]),
  );

  for (const [playerId, allocation] of Object.entries(state.bids)) {
    const nickname = ctx.players.find((p) => p.id === playerId)?.nickname;
    for (const [optionId, points] of Object.entries(allocation)) {
      if (!totals.has(optionId) || points <= 0) continue;
      totals.set(optionId, (totals.get(optionId) ?? 0) + points);
      // 이탈한 참가자의 포인트도 합계에는 남긴다 (이미 낸 표다)
      if (nickname) perOption.get(optionId)?.push({ nickname, points });
    }
  }

  const results: AuctionTally[] = state.optionIds
    .map((optionId) => ({
      optionId,
      total: totals.get(optionId) ?? 0,
      backers: (perOption.get(optionId) ?? [])
        .sort((a, b) => b.points - a.points)
        .map((b) => b.nickname),
    }))
    .sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      // 동점은 시드로 가른다 — 모든 참가자가 같은 결과를 봐야 한다
      return tieBreak(a.optionId, ctx.seed) - tieBreak(b.optionId, ctx.seed);
    });

  return {
    ...state,
    phase: 'reveal',
    phaseStartedAt: ctx.now,
    results,
    winnerId: results[0]?.optionId ?? null,
  };
}

function tieBreak(optionId: string, seed: number): number {
  return hashString(`${optionId}:${seed}`);
}
