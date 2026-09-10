import type { GameAction } from '@/types/game';
import type { CreateRoomInput, Player, Room, RoomSnapshot } from '@/types/room';
import {
  RoomError,
  ROOM_ERROR_MESSAGE,
  type RoomBackend,
  type RoomErrorCode,
  type RoomHandlers,
  type SubscribeOptions,
  type Unsubscribe,
} from './types';

/**
 * 폴링 주기(ms).
 *
 * Neon 은 Supabase Realtime 같은 구독 기능이 없어서, 서버(/api)를 주기적으로 확인한다.
 * 서버는 rev 가 그대로면 204(본문 없음)를 돌려주므로 대부분의 폴링은 매우 가볍다.
 * 투표가 오가는 게임 중에만 촘촘히 보고, 나머지는 느슨하게 본다.
 */
const SNAPSHOT_INTERVAL: Record<Room['status'] | 'default', number> = {
  // 대기실에서는 친구가 2초쯤 뒤에 보여도 충분하다
  lobby: 2_500,
  selecting: 2_500,
  // 투표가 오가는 동안만 촘촘하게
  playing: 1_000,
  finished: 4_000,
  default: 2_500,
};

/** 방장이 참가자 액션을 가져오는 주기. 게임 중에만 돈다. */
const ACTION_INTERVAL_MS = 600;

interface SnapshotResponse {
  rev: number;
  candidatesRev: number;
  room: Omit<Room, 'candidates'> & { candidates?: Room['candidates'] };
  players: Player[];
  gameState: unknown | null;
}

/**
 * Neon(Postgres) 백엔드.
 *
 * 브라우저는 DB 에 직접 접근하지 않고 Cloudflare Pages Functions(/api)만 호출한다.
 * 커넥션 문자열은 서버에만 있으므로, 클라이언트에 DB 자격증명이 노출되지 않는다.
 */
export class NeonRoomBackend implements RoomBackend {
  readonly kind = 'neon' as const;
  private readonly base: string;

  constructor(apiBase: string) {
    this.base = apiBase.replace(/\/$/, '');
  }

  async createRoom(input: CreateRoomInput): Promise<{ room: Room; player: Player }> {
    return this.request('POST', '/rooms', input);
  }

  async joinRoom(code: string, nickname: string): Promise<{ room: Room; player: Player }> {
    return this.request('POST', '/rooms/join', { code, nickname });
  }

  async getSnapshot(roomId: string): Promise<RoomSnapshot | null> {
    try {
      const data = await this.request<SnapshotResponse>('GET', `/rooms/${roomId}`);
      return {
        room: { ...data.room, candidates: data.room.candidates ?? [] } as Room,
        players: data.players,
        gameState: data.gameState,
      };
    } catch (error) {
      if (error instanceof RoomError && error.code === 'room_not_found') return null;
      throw error;
    }
  }

  async subscribe(
    roomId: string,
    options: SubscribeOptions,
    handlers: RoomHandlers,
  ): Promise<Unsubscribe> {
    handlers.onStatus?.('connecting');
    // 방장 전용 요청에 실어 보낼 내 id — 서버가 이 값으로 방장 여부를 검증한다
    this.playerId = options.playerId;

    let disposed = false;
    let rev = -1;
    let candidatesRev = -1;
    let lastCandidates: Room['candidates'] = [];
    let lastActionSeq = 0;
    let isHost = false;
    let status: Room['status'] = 'lobby';
    let online = false;
    let snapshotTimer: number | null = null;
    let actionTimer: number | null = null;

    const markOnline = (value: boolean) => {
      if (online === value) return;
      online = value;
      handlers.onStatus?.(value ? 'online' : 'offline');
    };

    const pollSnapshot = async () => {
      if (disposed) return;
      try {
        const query = `?rev=${rev}&crev=${candidatesRev}`;
        const response = await fetch(`${this.base}/rooms/${roomId}${query}`, {
          headers: { accept: 'application/json' },
        });

        if (response.status === 204) {
          markOnline(true);
          return; // 바뀐 것 없음
        }
        if (response.status === 404) {
          handlers.onError?.(new RoomError('room_not_found', ROOM_ERROR_MESSAGE.room_not_found));
          return;
        }
        if (!response.ok) throw new Error(String(response.status));

        const data = (await response.json()) as SnapshotResponse;
        markOnline(true);

        rev = data.rev;
        // 후보는 바뀐 경우에만 내려온다 — 안 왔으면 직전 값을 유지한다
        if (data.room.candidates) {
          lastCandidates = data.room.candidates;
          candidatesRev = data.candidatesRev;
        }

        const room = { ...data.room, candidates: lastCandidates } as Room;
        status = room.status;
        isHost = room.hostId === options.playerId;

        handlers.onSnapshot({ room, players: data.players, gameState: data.gameState });
      } catch {
        markOnline(false);
      }
    };

    const pollActions = async () => {
      // 액션은 게임 중에만 발생한다 — 대기실/결과 화면에서는 아예 묻지 않는다
      if (disposed || !isHost || status !== 'playing') return;
      try {
        const response = await fetch(
          `${this.base}/rooms/${roomId}/actions?playerId=${options.playerId}&after=${lastActionSeq}`,
        );
        if (!response.ok) return;

        const data = (await response.json()) as {
          actions: (GameAction & { seq: number })[];
        };
        for (const action of data.actions) {
          lastActionSeq = Math.max(lastActionSeq, action.seq);
          handlers.onAction?.(action);
        }
      } catch {
        // 다음 주기에 다시 시도한다
      }
    };

    // 방 상태에 따라 주기를 바꿔가며 계속 돈다
    const loopSnapshot = async () => {
      await pollSnapshot();
      if (disposed) return;
      snapshotTimer = window.setTimeout(
        loopSnapshot,
        SNAPSHOT_INTERVAL[status] ?? SNAPSHOT_INTERVAL.default,
      );
    };

    const loopActions = async () => {
      await pollActions();
      if (disposed) return;
      actionTimer = window.setTimeout(
        loopActions,
        status === 'playing' ? ACTION_INTERVAL_MS : SNAPSHOT_INTERVAL.default,
      );
    };

    void loopSnapshot();
    void loopActions();

    // 탭으로 돌아오면 바로 최신 상태를 맞춘다
    const onVisible = () => {
      if (document.visibilityState === 'visible') void pollSnapshot();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      disposed = true;
      if (snapshotTimer !== null) window.clearTimeout(snapshotTimer);
      if (actionTimer !== null) window.clearTimeout(actionTimer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }

  async patchRoom(roomId: string, patch: Partial<Room>): Promise<void> {
    await this.request('PATCH', `/rooms/${roomId}`, {
      playerId: this.playerId,
      patch,
    });
  }

  async setGameState(roomId: string, state: unknown | null): Promise<void> {
    await this.request('PUT', `/rooms/${roomId}/state`, { playerId: this.playerId, state });
  }

  async sendAction(action: GameAction): Promise<void> {
    await this.request('POST', `/rooms/${action.roomId}/actions`, {
      playerId: action.playerId,
      type: action.type,
      payload: action.payload,
    });
  }

  async heartbeat(roomId: string, playerId: string): Promise<void> {
    await this.request('POST', `/rooms/${roomId}/heartbeat`, { playerId }).catch(() => undefined);
  }

  async leaveRoom(roomId: string, playerId: string): Promise<void> {
    await this.request('DELETE', `/rooms/${roomId}/players/${playerId}`).catch(() => undefined);
  }

  /** subscribe 시점에 채워지는 내 참가자 id */
  private playerId = '';

  // ── 내부 ────────────────────────────────────────────────

  private async request<T>(
    method: string,
    path: string,
    payload?: unknown,
  ): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${this.base}${path}`, {
        method,
        headers: payload ? { 'content-type': 'application/json' } : undefined,
        body: payload ? JSON.stringify(payload) : undefined,
      });
    } catch {
      throw new RoomError('network', ROOM_ERROR_MESSAGE.network);
    }

    if (!response.ok) {
      let code: RoomErrorCode = 'unknown';
      try {
        const body = (await response.json()) as { error?: string };
        if (body.error && body.error in ROOM_ERROR_MESSAGE) {
          code = body.error as RoomErrorCode;
        }
      } catch {
        // 본문이 없으면 상태 코드로 추정한다
      }
      if (code === 'unknown' && response.status === 404) code = 'room_not_found';
      throw new RoomError(code, ROOM_ERROR_MESSAGE[code]);
    }

    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }
}
