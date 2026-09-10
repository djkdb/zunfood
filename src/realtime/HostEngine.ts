import { uid } from '@/lib/id';
import { hashString } from '@/lib/random';
import type { GameAction, GameContext, GameId, GameMode } from '@/types/game';
import type { RoomBackend } from './types';

/** 방에 공유되는 게임 상태 봉투 — 시드를 함께 실어 모두가 같은 결과를 보게 한다. */
export interface GameEnvelope {
  gameId: GameId;
  seed: number;
  startedAt: number;
  /** 공개 상태 (비밀 정보 제거됨) */
  state: unknown;
}

export function isGameEnvelope(value: unknown): value is GameEnvelope {
  return (
    typeof value === 'object' &&
    value !== null &&
    'gameId' in value &&
    'seed' in value &&
    'state' in value
  );
}

const TICK_MS = 150;

/**
 * 호스트에서만 도는 게임 런타임.
 *
 * - 참가자 액션을 받아 순수 함수(GameMode)로 상태를 계산한다.
 * - 계산된 "공개 상태"만 방에 브로드캐스트한다 (투표 내용 등은 여기 남는다).
 * - 타이머 진행(tick)과 외부 호출(runEffect)도 호스트만 수행한다.
 */
export class HostEngine {
  private readonly backend: RoomBackend;
  private readonly roomId: string;
  private readonly getContext: () => GameContext | null;
  private readonly onFinish: (winnerId: string | null) => void;

  private game: GameMode<never> | null = null;
  private state: unknown = null;
  private seed = 0;
  private startedAt = 0;
  private timer: number | null = null;
  private lastEffectKey: string | null = null;
  private effectRunning = false;
  private finished = false;
  private publishing: Promise<void> = Promise.resolve();

  constructor(options: {
    backend: RoomBackend;
    roomId: string;
    getContext: () => GameContext | null;
    onFinish: (winnerId: string | null) => void;
  }) {
    this.backend = options.backend;
    this.roomId = options.roomId;
    this.getContext = options.getContext;
    this.onFinish = options.onFinish;
  }

  get activeGameId(): GameId | null {
    return this.game?.id ?? null;
  }

  /** 현재 진행 중인 플레이를 식별하는 키 (게임 + 시작 시각) */
  get key(): string | null {
    return this.game ? `${this.game.id}:${this.startedAt}` : null;
  }

  /** 새 게임 시작 */
  start(game: GameMode<never>, ctxBase: Omit<GameContext, 'seed'>): void {
    this.stopTimer();
    this.game = game;
    this.seed = hashString(`${this.roomId}:${game.id}:${Date.now()}`);
    this.startedAt = Date.now();
    this.lastEffectKey = null;
    this.finished = false;

    const ctx: GameContext = { ...ctxBase, seed: this.seed };
    this.state = game.createInitialState(ctx);
    this.publish(ctx);
    this.startTimer();
  }

  /**
   * 호스트가 새로고침한 경우, 방에 남아 있는 공개 상태로 런타임을 이어받는다.
   * (진행 중이던 투표 내용은 공개 상태에 없으므로 해당 라운드는 다시 받는다.)
   */
  resume(game: GameMode<never>, envelope: GameEnvelope): void {
    this.stopTimer();
    this.game = game;
    this.seed = envelope.seed;
    this.startedAt = envelope.startedAt;
    this.state = envelope.state;
    this.lastEffectKey = null;
    this.finished = game.isFinished(envelope.state as never);
    this.startTimer();
  }

  /** 참가자(또는 호스트 자신)의 액션 처리 */
  dispatch(action: GameAction): void {
    const game = this.game;
    if (!game || this.state === null) return;

    const ctx = this.context();
    if (!ctx) return;

    const next = game.handleAction(this.state as never, action, ctx);
    if (next !== this.state) {
      this.state = next;
      this.publish(ctx);
    }
  }

  stop(): void {
    this.stopTimer();
    this.game = null;
    this.state = null;
    this.lastEffectKey = null;
  }

  // ── 내부 ────────────────────────────────────────────────

  private context(): GameContext | null {
    const base = this.getContext();
    if (!base) return null;
    return { ...base, seed: this.seed, now: Date.now() };
  }

  private startTimer(): void {
    this.timer = window.setInterval(() => this.tick(), TICK_MS);
  }

  private stopTimer(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }

  private tick(): void {
    const game = this.game;
    if (!game || this.state === null) return;

    const ctx = this.context();
    if (!ctx) return;

    const next = game.tick(this.state as never, ctx);
    if (next !== null && next !== this.state) {
      this.state = next;
      this.publish(ctx);
    }

    this.maybeRunEffect(ctx);
  }

  private maybeRunEffect(ctx: GameContext): void {
    const game = this.game;
    if (!game?.getEffectKey || !game.runEffect || this.effectRunning) return;

    const key = game.getEffectKey(this.state as never);
    if (!key || key === this.lastEffectKey) return;

    this.lastEffectKey = key;
    this.effectRunning = true;

    game
      .runEffect(this.state as never, ctx)
      .then((draft) => {
        if (!draft || this.game !== game) return;
        this.dispatch({
          id: uid('a'),
          roomId: this.roomId,
          playerId: ctx.hostId,
          type: draft.type,
          payload: draft.payload ?? {},
          createdAt: Date.now(),
        });
      })
      .catch(() => {
        // 외부 호출 실패 — 다음 tick 에서 다시 시도할 수 있도록 키를 비운다.
        this.lastEffectKey = null;
      })
      .finally(() => {
        this.effectRunning = false;
      });
  }

  private publish(ctx: GameContext): void {
    const game = this.game;
    if (!game || this.state === null) return;

    const envelope: GameEnvelope = {
      gameId: game.id,
      seed: this.seed,
      startedAt: this.startedAt,
      state: game.toPublicState(this.state as never, ctx),
    };

    // 쓰기 순서를 보장한다 (앞선 저장이 끝난 뒤 다음 저장).
    this.publishing = this.publishing
      .then(() => this.backend.setGameState(this.roomId, envelope))
      .catch(() => undefined);

    if (!this.finished && game.isFinished(this.state as never)) {
      this.finished = true;
      this.onFinish(game.getWinner(this.state as never));
    }
  }
}
