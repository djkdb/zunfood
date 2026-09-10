import { ROOM } from '@/config/app';
import { generateRoomCode, normalizeRoomCode, uid } from '@/lib/id';
import type { GameAction } from '@/types/game';
import type { CreateRoomInput, Player, Room, RoomSnapshot } from '@/types/room';
import {
  RoomError,
  ROOM_ERROR_MESSAGE,
  type RoomBackend,
  type RoomHandlers,
  type SubscribeOptions,
  type Unsubscribe,
} from './types';

const ROOM_KEY = (roomId: string) => `mealgame:room:${roomId}`;
const CODE_KEY = (code: string) => `mealgame:code:${code}`;
const CHANNEL = (roomId: string) => `mealgame:ch:${roomId}`;

interface StoredRoom {
  room: Room;
  players: Player[];
  gameState: unknown | null;
}

type ChannelMessage =
  | { type: 'snapshot'; roomId: string }
  | { type: 'action'; roomId: string; action: GameAction };

/**
 * Supabase 없이 동작하는 로컬 백엔드.
 *
 * - 상태는 localStorage 에 저장되고, BroadcastChannel 로 같은 기기의 다른 탭에 전파된다.
 * - 개발/데모용: 한 대의 기기에서 여러 탭을 띄워 4인 플레이를 그대로 재현할 수 있다.
 * - 다른 기기와 동기화하려면 .env 에 Supabase 값을 넣어 SupabaseRoomBackend 를 사용한다.
 */
export class LocalRoomBackend implements RoomBackend {
  readonly kind = 'local' as const;

  async createRoom(input: CreateRoomInput): Promise<{ room: Room; player: Player }> {
    const now = Date.now();
    const roomId = uid('room');
    const code = this.uniqueCode();
    const hostId = uid('p');

    const host: Player = {
      id: hostId,
      roomId,
      nickname: input.nickname,
      isHost: true,
      isReady: true,
      avatar: 0,
      joinedAt: now,
      lastSeenAt: now,
    };

    const room: Room = {
      id: roomId,
      code,
      hostId,
      status: 'lobby',
      maxPlayers: input.maxPlayers,
      location: input.location,
      radius: input.radius,
      filters: input.filters,
      selectedGame: null,
      candidates: [],
      winnerId: null,
      createdAt: now,
      updatedAt: now,
      expiresAt: now + ROOM.expiresInMinutes * 60_000,
    };

    this.write(roomId, { room, players: [host], gameState: null });
    localStorage.setItem(CODE_KEY(code), roomId);
    return { room, player: host };
  }

  async joinRoom(rawCode: string, nickname: string): Promise<{ room: Room; player: Player }> {
    const code = normalizeRoomCode(rawCode);
    const roomId = localStorage.getItem(CODE_KEY(code));
    if (!roomId) throw new RoomError('room_not_found', ROOM_ERROR_MESSAGE.room_not_found);

    const stored = this.read(roomId);
    if (!stored) throw new RoomError('room_not_found', ROOM_ERROR_MESSAGE.room_not_found);
    if (stored.room.expiresAt < Date.now()) {
      throw new RoomError('room_expired', ROOM_ERROR_MESSAGE.room_expired);
    }

    const trimmed = nickname.trim();
    const existing = stored.players.find((p) => p.nickname === trimmed);
    if (existing) {
      // 같은 닉네임이 이미 오프라인이면 그 자리를 이어받는다 (새로고침 복구).
      if (Date.now() - existing.lastSeenAt > ROOM.offlineAfterMs) {
        existing.lastSeenAt = Date.now();
        this.write(roomId, stored);
        return { room: stored.room, player: existing };
      }
      throw new RoomError('nickname_taken', ROOM_ERROR_MESSAGE.nickname_taken);
    }

    if (stored.players.length >= stored.room.maxPlayers) {
      throw new RoomError('room_full', ROOM_ERROR_MESSAGE.room_full);
    }

    const now = Date.now();
    const player: Player = {
      id: uid('p'),
      roomId,
      nickname: trimmed,
      isHost: false,
      isReady: false,
      avatar: stored.players.length % 8,
      joinedAt: now,
      lastSeenAt: now,
    };

    stored.players.push(player);
    stored.room.updatedAt = now;
    this.write(roomId, stored);
    return { room: stored.room, player };
  }

  async getSnapshot(roomId: string): Promise<RoomSnapshot | null> {
    const stored = this.read(roomId);
    return stored ? { ...stored } : null;
  }

  async subscribe(
    roomId: string,
    options: SubscribeOptions,
    handlers: RoomHandlers,
  ): Promise<Unsubscribe> {
    handlers.onStatus?.('online');

    const emit = () => {
      const stored = this.read(roomId);
      if (stored) handlers.onSnapshot({ ...stored });
    };

    const channel = supportsBroadcastChannel() ? new BroadcastChannel(CHANNEL(roomId)) : null;

    const onMessage = (event: MessageEvent<ChannelMessage>) => {
      const msg = event.data;
      if (!msg || msg.roomId !== roomId) return;
      if (msg.type === 'snapshot') emit();
      if (msg.type === 'action' && options.isHost) handlers.onAction?.(msg.action);
    };
    channel?.addEventListener('message', onMessage);

    // BroadcastChannel 이 없는 환경 대비 — storage 이벤트로도 감지한다.
    const onStorage = (event: StorageEvent) => {
      if (event.key === ROOM_KEY(roomId)) emit();
    };
    window.addEventListener('storage', onStorage);

    // 폴링 보정 (같은 탭 안에서의 변경 및 오프라인 판정)
    const poll = window.setInterval(emit, 1_500);

    emit();

    return () => {
      channel?.removeEventListener('message', onMessage);
      channel?.close();
      window.removeEventListener('storage', onStorage);
      window.clearInterval(poll);
    };
  }

  async patchRoom(roomId: string, patch: Partial<Room>): Promise<void> {
    const stored = this.read(roomId);
    if (!stored) return;
    stored.room = { ...stored.room, ...patch, updatedAt: Date.now() };
    this.write(roomId, stored);
  }

  async setGameState(roomId: string, state: unknown | null): Promise<void> {
    const stored = this.read(roomId);
    if (!stored) return;
    stored.gameState = state;
    stored.room.updatedAt = Date.now();
    this.write(roomId, stored);
  }

  async sendAction(action: GameAction): Promise<void> {
    this.post({ type: 'action', roomId: action.roomId, action });
    // 같은 탭에서 호스트가 직접 보낸 액션도 처리되도록, 호스트 런타임이
    // 구독하는 큐에 넣는다 (RoomEngine 이 로컬 dispatch 를 함께 처리).
  }

  async heartbeat(roomId: string, playerId: string): Promise<void> {
    const stored = this.read(roomId);
    if (!stored) return;
    const player = stored.players.find((p) => p.id === playerId);
    if (!player) return;
    player.lastSeenAt = Date.now();
    this.write(roomId, stored, false);
  }

  async leaveRoom(roomId: string, playerId: string): Promise<void> {
    const stored = this.read(roomId);
    if (!stored) return;
    stored.players = stored.players.filter((p) => p.id !== playerId);
    if (stored.players.length === 0) {
      localStorage.removeItem(ROOM_KEY(roomId));
      localStorage.removeItem(CODE_KEY(stored.room.code));
      this.post({ type: 'snapshot', roomId });
      return;
    }
    // 호스트가 나가면 가장 먼저 들어온 참가자에게 방장을 넘긴다.
    if (stored.room.hostId === playerId) {
      const next = [...stored.players].sort((a, b) => a.joinedAt - b.joinedAt)[0];
      next.isHost = true;
      stored.room.hostId = next.id;
    }
    this.write(roomId, stored);
  }

  // ── 내부 ────────────────────────────────────────────────

  private read(roomId: string): StoredRoom | null {
    try {
      const raw = localStorage.getItem(ROOM_KEY(roomId));
      return raw ? (JSON.parse(raw) as StoredRoom) : null;
    } catch {
      return null;
    }
  }

  private write(roomId: string, data: StoredRoom, notify = true): void {
    try {
      localStorage.setItem(ROOM_KEY(roomId), JSON.stringify(data));
    } catch {
      // 저장 공간 초과 등 — 실시간 전파는 계속 시도한다.
    }
    if (notify) this.post({ type: 'snapshot', roomId });
  }

  private post(message: ChannelMessage): void {
    if (!supportsBroadcastChannel()) return;
    const channel = new BroadcastChannel(CHANNEL(message.roomId));
    channel.postMessage(message);
    channel.close();
  }

  private uniqueCode(): string {
    for (let i = 0; i < 20; i += 1) {
      const code = generateRoomCode(ROOM.codeLength);
      if (!localStorage.getItem(CODE_KEY(code))) return code;
    }
    return generateRoomCode(ROOM.codeLength + 1);
  }
}

function supportsBroadcastChannel(): boolean {
  return typeof BroadcastChannel !== 'undefined';
}
