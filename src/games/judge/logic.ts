import { TIMING } from '@/config/app';
import { getJudgeProvider } from '@/data/ai';
import type { GameAction, GameContext, GameMode } from '@/types/game';

export interface JudgeVerdictState {
  restaurantId: string;
  headline: string;
  reasons: string[];
}

/** 판결문을 읽을 시간 */
const VERDICT_HOLD_MS = 4_200;

export interface JudgeState {
  phase: 'input' | 'thinking' | 'verdict' | 'done';
  /** playerId -> 먹고 싶은 음식. 전원 제출 전까지는 공개하지 않는다. */
  wishes: Record<string, string>;
  submittedPlayerIds: string[];
  verdict: JudgeVerdictState | null;
  phaseStartedAt: number;
  /** 판결 실패 시 사용자에게 보여줄 메시지 */
  error: string | null;
}

export const judgeGame: GameMode<JudgeState> = {
  id: 'judge',
  title: 'AI 판사',
  tagline: 'AI에게 판결받기',
  description: '각자 먹고 싶은 걸 말하면 판사가 정해준다',
  emoji: '⚖️',
  tint: 'bg-[#E7F4FF]',
  howTo: ['각자 먹고 싶은 걸 적어요', 'AI 판사가 조건을 따져봐요', '판결로 한 곳이 정해져요'],
  minPlayers: 1,
  maxPlayers: 8,
  candidateCount: 10,

  createInitialState(ctx: GameContext): JudgeState {
    return {
      phase: 'input',
      wishes: {},
      submittedPlayerIds: [],
      verdict: null,
      phaseStartedAt: ctx.now,
      error: null,
    };
  },

  handleAction(state, action: GameAction, ctx) {
    if (action.type === 'wish' && state.phase === 'input') {
      const text = String(action.payload?.text ?? '').trim().slice(0, 24);
      if (!ctx.players.some((p) => p.id === action.playerId)) return state;

      const wishes = { ...state.wishes, [action.playerId]: text || '아무거나' };
      const submittedPlayerIds = [...new Set([...state.submittedPlayerIds, action.playerId])];
      const everyone = ctx.players.every((p) => wishes[p.id] !== undefined);

      return {
        ...state,
        wishes,
        submittedPlayerIds,
        phase: everyone ? 'thinking' : 'input',
        phaseStartedAt: everyone ? ctx.now : state.phaseStartedAt,
      };
    }

    // 호스트가 기다리지 않고 판결로 넘어감 (미제출자는 "아무거나" 처리)
    if (action.type === 'force' && action.playerId === ctx.hostId && state.phase === 'input') {
      const wishes = { ...state.wishes };
      for (const player of ctx.players) {
        if (wishes[player.id] === undefined) wishes[player.id] = '아무거나';
      }
      return { ...state, wishes, phase: 'thinking', phaseStartedAt: ctx.now };
    }

    // runEffect 결과가 되돌아오는 액션
    if (action.type === 'verdict' && state.phase === 'thinking') {
      const restaurantId = String(action.payload?.restaurantId ?? '');
      // AI 가 후보 밖의 식당을 고르는 것을 원천 차단한다.
      if (!ctx.candidates.some((c) => c.id === restaurantId)) {
        return { ...state, error: '판결을 받아오지 못했어요. 다시 시도해 주세요.' };
      }
      return {
        ...state,
        phase: 'verdict',
        phaseStartedAt: ctx.now,
        error: null,
        verdict: {
          restaurantId,
          headline: String(action.payload?.headline ?? ''),
          reasons: (action.payload?.reasons as string[] | undefined) ?? [],
        },
      };
    }

    return state;
  },

  tick(state, ctx) {
    if (state.phase === 'verdict' && ctx.now - state.phaseStartedAt >= VERDICT_HOLD_MS) {
      return { ...state, phase: 'done' };
    }

    // 모두 제출했는지 다시 확인 (참가자 이탈 대응)
    if (
      state.phase === 'input' &&
      ctx.players.length > 0 &&
      ctx.players.every((p) => state.wishes[p.id] !== undefined)
    ) {
      return { ...state, phase: 'thinking', phaseStartedAt: ctx.now };
    }
    return null;
  },

  toPublicState(state) {
    // 입력 단계에서는 다른 사람의 선택이 보이지 않아야 한다.
    if (state.phase === 'input') {
      return { ...state, wishes: {} };
    }
    return state;
  },

  getWinner(state) {
    return state.verdict?.restaurantId ?? null;
  },

  isFinished(state) {
    return state.phase === 'done';
  },

  getProgress(state) {
    const order = { input: 0.2, thinking: 0.7, verdict: 1, done: 1 } as const;
    return order[state.phase];
  },

  getEffectKey(state) {
    return state.phase === 'thinking' && !state.verdict ? 'judge:verdict' : null;
  },

  async runEffect(state, ctx) {
    // 연출을 위해 최소 "고민하는 시간"을 확보한다.
    const provider = getJudgeProvider();
    const [verdict] = await Promise.all([
      provider.judge({
        wishes: ctx.players.map((p) => ({
          playerId: p.id,
          nickname: p.nickname,
          text: state.wishes[p.id] ?? '아무거나',
        })),
        candidates: ctx.candidates,
        location: ctx.location,
        budget: ctx.filters.budget,
        radius: ctx.radius,
      }),
      new Promise((resolve) => setTimeout(resolve, TIMING.judgeThinkingMs)),
    ]);

    return {
      type: 'verdict',
      payload: {
        restaurantId: verdict.restaurantId,
        headline: verdict.headline,
        reasons: verdict.reasons,
      },
    };
  },
};
