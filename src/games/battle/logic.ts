import { TIMING } from '@/config/app';
import { createRandom, hashString, seededShuffle } from '@/lib/random';
import type { GameAction, GameContext, GameMode } from '@/types/game';

export interface BattleMatch {
  a: string;
  b: string;
  winnerId: string | null;
  tally: { a: number; b: number } | null;
}

export interface BattleState {
  phase: 'countdown' | 'voting' | 'reveal' | 'finished';
  /** rounds[0] = 8강, rounds[1] = 4강 ... */
  rounds: BattleMatch[][];
  roundIndex: number;
  matchIndex: number;
  /** 🔒 비공개 — toPublicState 에서 제거된다 */
  votes: Record<string, string>;
  /** 공개 — 누가 투표를 마쳤는지만 알린다 */
  votedPlayerIds: string[];
  phaseStartedAt: number;
  championId: string | null;
}

const BRACKET_SIZE = 8;

export const battleGame: GameMode<BattleState> = {
  id: 'battle',
  title: '음식 배틀',
  tagline: '친구들과 토너먼트',
  description: '8강부터 결승까지, 투표로 살아남는 한 곳',
  emoji: '⚔️',
  accent: 'from-coral to-pop-500',
  minPlayers: 2,
  maxPlayers: 8,
  candidateCount: BRACKET_SIZE,

  createInitialState(ctx: GameContext): BattleState {
    const shuffled = seededShuffle(ctx.candidates, ctx.seed);
    const size = largestPowerOfTwo(Math.min(shuffled.length, BRACKET_SIZE));
    const entrants = shuffled.slice(0, size).map((r) => r.id);

    if (entrants.length < 2) {
      return {
        phase: 'finished',
        rounds: [],
        roundIndex: 0,
        matchIndex: 0,
        votes: {},
        votedPlayerIds: [],
        phaseStartedAt: ctx.now,
        championId: entrants[0] ?? null,
      };
    }

    return {
      phase: 'countdown',
      rounds: [buildRound(entrants)],
      roundIndex: 0,
      matchIndex: 0,
      votes: {},
      votedPlayerIds: [],
      phaseStartedAt: ctx.now,
      championId: null,
    };
  },

  handleAction(state, action: GameAction, ctx) {
    if (action.type !== 'vote' || state.phase !== 'voting') return state;

    const match = currentMatch(state);
    if (!match) return state;

    const optionId = String(action.payload?.optionId ?? '');
    if (optionId !== match.a && optionId !== match.b) return state;
    if (!ctx.players.some((p) => p.id === action.playerId)) return state;
    if (state.votes[action.playerId] === optionId) return state;

    const votes = { ...state.votes, [action.playerId]: optionId };
    const votedPlayerIds = [...new Set([...state.votedPlayerIds, action.playerId])];
    const next: BattleState = { ...state, votes, votedPlayerIds };

    const everyoneVoted =
      ctx.players.length > 0 && ctx.players.every((p) => votes[p.id] !== undefined);

    return everyoneVoted ? revealCurrentMatch(next, ctx) : next;
  },

  tick(state, ctx) {
    const elapsed = ctx.now - state.phaseStartedAt;

    if (state.phase === 'countdown' && elapsed >= TIMING.countdownMs) {
      return { ...state, phase: 'voting', phaseStartedAt: ctx.now, votes: {}, votedPlayerIds: [] };
    }

    if (state.phase === 'voting') {
      // 참가자가 나가서 남은 사람이 모두 투표를 마친 경우도 즉시 공개한다.
      const everyoneVoted =
        ctx.players.length > 0 && ctx.players.every((p) => state.votes[p.id] !== undefined);
      if (everyoneVoted || elapsed >= TIMING.battleVoteMs) {
        return revealCurrentMatch(state, ctx);
      }
    }

    if (state.phase === 'reveal' && elapsed >= TIMING.battleRevealMs) {
      return advance(state, ctx);
    }

    return null;
  },

  toPublicState(state) {
    // 투표 내용은 절대 공개하지 않는다. 공개 시점(reveal)에는 집계(tally)만 노출된다.
    return { ...state, votes: {} };
  },

  getWinner(state) {
    return state.phase === 'finished' ? state.championId : null;
  },

  isFinished(state) {
    return state.phase === 'finished';
  },

  getProgress(state) {
    const total = state.rounds[0] ? state.rounds[0].length * 2 - 1 : 1;
    const done = state.rounds
      .flat()
      .filter((m) => m.winnerId !== null).length;
    return Math.min(1, done / total);
  },
};

// ── 헬퍼 ──────────────────────────────────────────────────────

export function currentMatch(state: BattleState): BattleMatch | null {
  return state.rounds[state.roundIndex]?.[state.matchIndex] ?? null;
}

/** 라운드 이름: 8강 / 4강 / 결승 */
export function roundLabel(state: BattleState): string {
  const remaining = state.rounds[state.roundIndex]?.length ?? 0;
  if (remaining === 1) return '결승';
  return `${remaining * 2}강`;
}

function buildRound(ids: string[]): BattleMatch[] {
  const matches: BattleMatch[] = [];
  for (let i = 0; i < ids.length; i += 2) {
    matches.push({ a: ids[i], b: ids[i + 1], winnerId: null, tally: null });
  }
  return matches;
}

function largestPowerOfTwo(n: number): number {
  let size = 1;
  while (size * 2 <= n) size *= 2;
  return size;
}

function revealCurrentMatch(state: BattleState, ctx: GameContext): BattleState {
  const match = currentMatch(state);
  if (!match) return state;

  let a = 0;
  let b = 0;
  for (const player of ctx.players) {
    const vote = state.votes[player.id];
    if (vote === match.a) a += 1;
    else if (vote === match.b) b += 1;
  }

  let winnerId: string;
  if (a > b) winnerId = match.a;
  else if (b > a) winnerId = match.b;
  else {
    // 동점/무투표 — 시드로 결정해 모두가 같은 결과를 본다.
    const rand = createRandom(ctx.seed ^ hashString(`${state.roundIndex}:${state.matchIndex}`));
    winnerId = rand() < 0.5 ? match.a : match.b;
  }

  const rounds = state.rounds.map((round, ri) =>
    ri !== state.roundIndex
      ? round
      : round.map((m, mi) => (mi === state.matchIndex ? { ...m, winnerId, tally: { a, b } } : m)),
  );

  return { ...state, rounds, phase: 'reveal', phaseStartedAt: ctx.now };
}

function advance(state: BattleState, ctx: GameContext): BattleState {
  const round = state.rounds[state.roundIndex];
  const isLastMatch = state.matchIndex >= round.length - 1;

  if (!isLastMatch) {
    return {
      ...state,
      matchIndex: state.matchIndex + 1,
      phase: 'countdown',
      phaseStartedAt: ctx.now,
      votes: {},
      votedPlayerIds: [],
    };
  }

  const winners = round.map((m) => m.winnerId).filter((id): id is string => Boolean(id));
  if (winners.length <= 1) {
    return {
      ...state,
      phase: 'finished',
      championId: winners[0] ?? null,
      phaseStartedAt: ctx.now,
    };
  }

  return {
    ...state,
    rounds: [...state.rounds, buildRound(winners)],
    roundIndex: state.roundIndex + 1,
    matchIndex: 0,
    phase: 'countdown',
    phaseStartedAt: ctx.now,
    votes: {},
    votedPlayerIds: [],
  };
}
