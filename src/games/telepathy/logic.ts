import { TIMING } from '@/config/app';
import { hashString, seededShuffle } from '@/lib/random';
import type { GameAction, GameContext, GameMode } from '@/types/game';

/** 시작 후보 수 */
const BOARD_SIZE = 6;
const RESULT_HOLD_MS = 3_600;

export interface TelepathyTally {
  optionId: string;
  /** 이 곳을 고른 사람 이름 */
  players: string[];
}

export interface TelepathyState {
  phase: 'countdown' | 'picking' | 'reveal' | 'result' | 'done';
  /** 아직 살아 있는 후보 */
  optionIds: string[];
  round: number;
  /** 🔒 비공개 — playerId -> 고른 곳 */
  picks: Record<string, string>;
  /** 공개 — 누가 골랐는지만 */
  pickedPlayerIds: string[];
  /** 공개 직후에만 채워진다 */
  lastTally: TelepathyTally[] | null;
  /** 이번에 탈락한 곳 */
  eliminated: string[];
  /** 전원이 같은 곳을 골라서 끝났는지 */
  matched: boolean;
  winnerId: string | null;
  phaseStartedAt: number;
}

/**
 * 이심전심.
 *
 * 다른 게임은 전부 겨루는 구조다 — 투표로 이기고, 포인트로 밀어붙이고,
 * 남의 선택을 지운다. 이 게임만 반대다. **전원이 같은 곳을 고르면 그 순간 끝난다.**
 *
 * 못 맞추면 제일 적게 뽑힌 곳이 사라지고 다시 고른다. 선택지가 줄수록
 * 맞출 확률은 올라가지만, 내가 원하던 곳이 먼저 사라질 수도 있다.
 * "몇 번 만에 통했나" 가 이 게임의 기록이다.
 */
export const telepathyGame: GameMode<TelepathyState> = {
  id: 'telepathy',
  title: '이심전심',
  tagline: '말 없이 마음 맞추기',
  description: '전원이 같은 곳을 고르면 그 자리에서 끝',
  emoji: '🔮',
  tint: 'bg-[#E9F7F1]',
  howTo: [
    '말하지 않고 각자 한 곳을 골라요',
    '전원이 같으면 그 자리에서 끝',
    '갈리면 제일 적게 뽑힌 곳이 사라져요',
  ],
  minPlayers: 2,
  maxPlayers: 8,
  candidateCount: BOARD_SIZE,

  createInitialState(ctx: GameContext): TelepathyState {
    const board = seededShuffle(ctx.candidates, ctx.seed ^ 0x7e1e).slice(0, BOARD_SIZE);
    const optionIds = board.map((r) => r.id);

    const base: TelepathyState = {
      phase: 'countdown',
      optionIds,
      round: 1,
      picks: {},
      pickedPlayerIds: [],
      lastTally: null,
      eliminated: [],
      matched: false,
      winnerId: null,
      phaseStartedAt: ctx.now,
    };

    if (optionIds.length < 2) {
      return { ...base, phase: 'done', winnerId: optionIds[0] ?? null };
    }
    return base;
  },

  handleAction(state, action: GameAction, ctx) {
    if (action.type !== 'pick' || state.phase !== 'picking') return state;
    if (!ctx.players.some((p) => p.id === action.playerId)) return state;

    const optionId = String(action.payload?.optionId ?? '');
    if (!state.optionIds.includes(optionId)) return state;
    // 한 번 고르면 못 바꾼다 — 바꿀 수 있으면 눈치 싸움이 되어버린다
    if (state.picks[action.playerId] !== undefined) return state;

    const picks = { ...state.picks, [action.playerId]: optionId };
    const pickedPlayerIds = [...new Set([...state.pickedPlayerIds, action.playerId])];
    const next: TelepathyState = { ...state, picks, pickedPlayerIds };

    const everyone = ctx.players.length > 0 && ctx.players.every((p) => picks[p.id] !== undefined);
    return everyone ? resolve(next, ctx) : next;
  },

  tick(state, ctx) {
    const elapsed = ctx.now - state.phaseStartedAt;

    if (state.phase === 'countdown' && elapsed >= TIMING.countdownMs) {
      return { ...state, phase: 'picking', phaseStartedAt: ctx.now };
    }

    if (state.phase === 'picking') {
      const everyone =
        ctx.players.length > 0 && ctx.players.every((p) => state.picks[p.id] !== undefined);
      if (everyone || elapsed >= TIMING.telepathyPickMs) return resolve(state, ctx);
    }

    if (state.phase === 'reveal' && elapsed >= TIMING.telepathyRevealMs) {
      // 다음 라운드 — 탈락한 곳을 빼고 다시 고른다
      return {
        ...state,
        phase: 'picking',
        optionIds: state.optionIds.filter((id) => !state.eliminated.includes(id)),
        round: state.round + 1,
        picks: {},
        pickedPlayerIds: [],
        lastTally: null,
        eliminated: [],
        phaseStartedAt: ctx.now,
      };
    }

    if (state.phase === 'result' && elapsed >= RESULT_HOLD_MS) {
      return { ...state, phase: 'done', phaseStartedAt: ctx.now };
    }

    return null;
  },

  toPublicState(state) {
    // 고르는 중에는 남이 무엇을 골랐는지 몰라야 한다. 공개 후에는 lastTally 로 드러난다.
    return { ...state, picks: {} };
  },

  getWinner(state) {
    return state.winnerId;
  },

  isFinished(state) {
    return state.phase === 'done';
  },

  getProgress(state) {
    if (state.phase === 'countdown') return 0.1;
    if (state.phase === 'result' || state.phase === 'done') return 1;
    // 후보가 줄어든 만큼 진행된 것으로 본다
    const gone = BOARD_SIZE - state.optionIds.length;
    return 0.1 + 0.8 * (gone / Math.max(1, BOARD_SIZE - 1));
  },
};

function resolve(state: TelepathyState, ctx: GameContext): TelepathyState {
  const byOption = new Map<string, string[]>(state.optionIds.map((id) => [id, []]));
  for (const [playerId, optionId] of Object.entries(state.picks)) {
    const nickname = ctx.players.find((p) => p.id === playerId)?.nickname;
    byOption.get(optionId)?.push(nickname ?? '나간 사람');
  }

  const tally: TelepathyTally[] = state.optionIds.map((optionId) => ({
    optionId,
    players: byOption.get(optionId) ?? [],
  }));

  const votes = Object.values(state.picks);
  const unanimous = votes.length > 0 && new Set(votes).size === 1;

  // 전원 일치 — 이 게임이 노리는 순간
  if (unanimous && votes.length === ctx.players.length) {
    return {
      ...state,
      phase: 'result',
      phaseStartedAt: ctx.now,
      lastTally: tally,
      matched: true,
      winnerId: votes[0],
    };
  }

  const ranked = [...tally].sort((a, b) => {
    if (b.players.length !== a.players.length) return b.players.length - a.players.length;
    // 동수는 시드로 가른다 — 모두가 같은 결과를 봐야 한다
    return hashString(`${a.optionId}:${ctx.seed}`) - hashString(`${b.optionId}:${ctx.seed}`);
  });

  // 두 곳까지 좁혀졌는데도 갈렸으면 더 줄일 수 없다. 많이 받은 쪽으로 끝낸다.
  if (state.optionIds.length <= 2) {
    return {
      ...state,
      phase: 'result',
      phaseStartedAt: ctx.now,
      lastTally: tally,
      matched: false,
      winnerId: ranked[0]?.optionId ?? null,
    };
  }

  // 제일 적게 뽑힌 곳부터 탈락. 단, 최소 두 곳은 남긴다.
  const fewest = ranked[ranked.length - 1].players.length;
  const losers = ranked.filter((entry) => entry.players.length === fewest);
  const maxDrop = state.optionIds.length - 2;
  const eliminated = losers.slice(-maxDrop).map((entry) => entry.optionId);

  return {
    ...state,
    phase: 'reveal',
    phaseStartedAt: ctx.now,
    lastTally: tally,
    eliminated,
    matched: false,
  };
}
