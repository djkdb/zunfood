import { create } from 'zustand';
import { ROOM } from '@/config/app';
import { getRestaurantRepository, RestaurantSearchError } from '@/data/restaurants';
import { getGame, MAX_CANDIDATES } from '@/games/registry';
import { uid } from '@/lib/id';
import { getRoomBackend } from '@/realtime';
import { HostEngine, isGameEnvelope, type GameEnvelope } from '@/realtime/HostEngine';
import {
  RoomError,
  ROOM_ERROR_MESSAGE,
  type ConnectionStatus,
  type RoomBackend,
} from '@/realtime/types';
import type { GameAction, GameContext, GameId } from '@/types/game';
import type { CreateRoomInput, Player, Room, RoomSnapshot } from '@/types/room';
import { clearIdentity, loadIdentity, saveIdentity } from './identity';

export interface RoomStoreState {
  snapshot: RoomSnapshot | null;
  meId: string | null;
  status: ConnectionStatus;
  /** 화면 상단에 띄우는 오류/안내 메시지 */
  error: string | null;
  /** 후보 식당을 불러오는 중 */
  preparing: boolean;
  backendKind: RoomBackend['kind'];

  createRoom: (input: CreateRoomInput) => Promise<string>;
  joinRoom: (code: string, nickname: string) => Promise<string>;
  attach: (code: string) => Promise<boolean>;
  detach: () => void;
  leave: () => Promise<void>;
  setError: (message: string | null) => void;

  // 방장 전용
  updateSettings: (patch: Partial<Room>) => Promise<void>;
  openGameSelect: () => Promise<void>;
  backToLobby: () => Promise<void>;
  startGame: (gameId: GameId) => Promise<void>;
  playAgain: () => Promise<void>;

  dispatch: (type: string, payload?: Record<string, unknown>) => void;
}

let unsubscribe: (() => void) | null = null;
let heartbeat: number | null = null;
let engine: HostEngine | null = null;
/** 접속 세대 — 비동기 구독이 늦게 도착해 덮어쓰는 것을 막는다. */
let sessionEpoch = 0;

export const useRoomStore = create<RoomStoreState>((set, get) => {
  const backend = getRoomBackend();

  /** 최근 하트비트 기준으로 실제 접속 중인 참가자만 추린다. */
  const activePlayers = (snapshot: RoomSnapshot): Player[] => {
    const now = Date.now();
    const online = snapshot.players.filter(
      (p) => now - p.lastSeenAt < ROOM.offlineAfterMs || p.id === get().meId,
    );
    return online.length > 0 ? online : snapshot.players;
  };

  const buildContext = (): Omit<GameContext, 'seed'> | null => {
    const snapshot = get().snapshot;
    if (!snapshot) return null;
    return {
      roomId: snapshot.room.id,
      hostId: snapshot.room.hostId,
      players: activePlayers(snapshot),
      candidates: snapshot.room.candidates,
      location: snapshot.room.location,
      radius: snapshot.room.radius,
      filters: snapshot.room.filters,
      now: Date.now(),
    };
  };

  const stopEngine = () => {
    engine?.stop();
    engine = null;
  };

  const ensureEngine = (): HostEngine => {
    if (engine) return engine;
    const roomId = get().snapshot?.room.id;
    if (!roomId) throw new RoomError('unknown', ROOM_ERROR_MESSAGE.unknown);

    engine = new HostEngine({
      backend,
      roomId,
      getContext: () => {
        const base = buildContext();
        return base ? { ...base, seed: 0 } : null;
      },
      onFinish: (winnerId) => {
        void backend.patchRoom(roomId, { status: 'finished', winnerId });
      },
    });
    return engine;
  };

  /** 스냅샷이 올 때마다 호스트 런타임 상태를 맞춘다. */
  const syncEngine = (snapshot: RoomSnapshot) => {
    const meId = get().meId;
    const isHost = Boolean(meId && snapshot.room.hostId === meId);

    if (!isHost) {
      stopEngine();
      return;
    }

    if (snapshot.room.status !== 'playing') {
      stopEngine();
      return;
    }

    const game = snapshot.room.selectedGame ? getGame(snapshot.room.selectedGame) : null;
    if (!game) return;

    const envelope = isGameEnvelope(snapshot.gameState) ? snapshot.gameState : null;

    if (!envelope) {
      // 게임 상태가 없는데 진행 중 — 호스트가 새로고침한 직후일 수 있다.
      if (!engine) {
        const base = buildContext();
        if (base) ensureEngine().start(game, base);
      }
      return;
    }

    const key = `${envelope.gameId}:${envelope.startedAt}`;
    if (!engine || engine.key !== key) {
      ensureEngine().resume(game, envelope);
    }
  };

  /**
   * 방장이 말없이 나갔을 때(탭 종료 등) 방이 멈추지 않도록 방장을 승계한다.
   * 남아 있는 접속자 중 가장 먼저 들어온 사람이 스스로 방장을 가져간다 —
   * 조건이 모두에게 동일하므로 한 명만 시도한다.
   */
  const maybeClaimHost = (snapshot: RoomSnapshot) => {
    const meId = get().meId;
    if (!meId || snapshot.room.hostId === meId) return;

    const now = Date.now();
    const isOnline = (p: Player) => now - p.lastSeenAt < ROOM.offlineAfterMs;
    const host = snapshot.players.find((p) => p.id === snapshot.room.hostId);
    if (host && isOnline(host)) return;

    const successor = snapshot.players
      .filter(isOnline)
      .sort((a, b) => a.joinedAt - b.joinedAt)[0];
    if (!successor || successor.id !== meId) return;

    void backend.patchRoom(snapshot.room.id, { hostId: meId }).catch(() => undefined);
  };

  const handleSnapshot = (snapshot: RoomSnapshot) => {
    set({ snapshot });
    maybeClaimHost(snapshot);
    syncEngine(snapshot);
  };

  const startSession = async (roomId: string, playerId: string, code: string, nickname: string) => {
    const epoch = ++sessionEpoch;
    unsubscribe?.();
    unsubscribe = null;
    if (heartbeat !== null) window.clearInterval(heartbeat);

    set({ meId: playerId, status: 'connecting', error: null });
    saveIdentity({ roomId, playerId, code, nickname });

    // 액션 수신은 항상 켜둔다 — 호스트 여부는 첫 스냅샷을 받아야 알 수 있고,
    // 엔진이 없는 참가자 쪽에서는 그냥 무시된다.
    const dispose = await backend.subscribe(
      roomId,
      { playerId, isHost: true },
      {
        onSnapshot: handleSnapshot,
        onStatus: (status) => set({ status }),
        onError: (error) => set({ error: error.message }),
        onAction: (action) => engine?.dispatch(action),
      },
    );

    // 구독이 완료되기 전에 화면을 벗어났다면 즉시 정리한다.
    if (epoch !== sessionEpoch) {
      dispose();
      return;
    }
    unsubscribe = dispose;

    void backend.heartbeat(roomId, playerId);
    heartbeat = window.setInterval(() => {
      void backend.heartbeat(roomId, playerId);
    }, ROOM.heartbeatMs);
  };

  return {
    snapshot: null,
    meId: null,
    status: 'connecting',
    error: null,
    preparing: false,
    backendKind: backend.kind,

    setError: (message) => set({ error: message }),

    async createRoom(input) {
      const { room, player } = await backend.createRoom(input);
      await startSession(room.id, player.id, room.code, player.nickname);
      return room.code;
    },

    async joinRoom(code, nickname) {
      const { room, player } = await backend.joinRoom(code, nickname);
      await startSession(room.id, player.id, room.code, player.nickname);
      return room.code;
    },

    /** 저장된 신원으로 방에 다시 접속한다. 실패하면 false. */
    async attach(code) {
      const identity = loadIdentity(code);
      if (!identity) return false;

      const snapshot = await backend.getSnapshot(identity.roomId);
      if (!snapshot) {
        clearIdentity(code);
        return false;
      }
      if (!snapshot.players.some((p) => p.id === identity.playerId)) {
        clearIdentity(code);
        return false;
      }

      await startSession(identity.roomId, identity.playerId, code, identity.nickname);
      handleSnapshot(snapshot);
      return true;
    },

    detach() {
      sessionEpoch += 1;
      unsubscribe?.();
      unsubscribe = null;
      if (heartbeat !== null) window.clearInterval(heartbeat);
      heartbeat = null;
      stopEngine();
      set({ snapshot: null, meId: null, status: 'connecting', error: null });
    },

    async leave() {
      const { snapshot, meId } = get();
      if (snapshot && meId) {
        clearIdentity(snapshot.room.code);
        try {
          await backend.leaveRoom(snapshot.room.id, meId);
        } catch {
          // 나가기 실패해도 화면은 정리한다.
        }
      }
      get().detach();
    },

    async updateSettings(patch) {
      const snapshot = get().snapshot;
      if (!snapshot) return;
      try {
        await backend.patchRoom(snapshot.room.id, patch);
      } catch (error) {
        set({ error: error instanceof RoomError ? error.message : ROOM_ERROR_MESSAGE.network });
      }
    },

    /** 대기실 → 게임 선택. 이 시점에 후보 식당을 확정한다. */
    async openGameSelect() {
      const snapshot = get().snapshot;
      if (!snapshot) return;

      set({ preparing: true, error: null });
      try {
        const repository = getRestaurantRepository();
        const candidates = await repository.search({
          location: snapshot.room.location,
          radius: snapshot.room.radius,
          filters: snapshot.room.filters,
          limit: MAX_CANDIDATES,
        });

        if (candidates.length < 2) {
          set({
            error:
              '조건에 맞는 식당이 너무 적어요. 반경을 넓히거나 음식 조건을 줄여보세요.',
            preparing: false,
          });
          return;
        }

        await backend.patchRoom(snapshot.room.id, { candidates, status: 'selecting' });
      } catch (error) {
        const message =
          error instanceof RestaurantSearchError
            ? error.message
            : '식당 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.';
        set({ error: message });
      } finally {
        set({ preparing: false });
      }
    },

    async backToLobby() {
      const snapshot = get().snapshot;
      if (!snapshot) return;
      stopEngine();
      await backend.setGameState(snapshot.room.id, null);
      await backend.patchRoom(snapshot.room.id, {
        status: 'lobby',
        selectedGame: null,
        winnerId: null,
      });
    },

    async startGame(gameId) {
      const snapshot = get().snapshot;
      const game = getGame(gameId);
      if (!snapshot || !game) return;

      const base = buildContext();
      if (!base) return;

      if (base.candidates.length < 2) {
        set({ error: '후보 식당이 부족해요. 조건을 다시 설정해 주세요.' });
        return;
      }

      stopEngine();
      await backend.setGameState(snapshot.room.id, null);
      await backend.patchRoom(snapshot.room.id, {
        status: 'playing',
        selectedGame: gameId,
        winnerId: null,
      });
      ensureEngine().start(game, base);
    },

    async playAgain() {
      const snapshot = get().snapshot;
      if (!snapshot) return;
      stopEngine();
      await backend.setGameState(snapshot.room.id, null);
      await backend.patchRoom(snapshot.room.id, {
        status: 'selecting',
        selectedGame: null,
        winnerId: null,
      });
    },

    dispatch(type, payload = {}) {
      const { snapshot, meId } = get();
      if (!snapshot || !meId) return;

      const action: GameAction = {
        id: uid('a'),
        roomId: snapshot.room.id,
        playerId: meId,
        type,
        payload,
        createdAt: Date.now(),
      };

      if (snapshot.room.hostId === meId) {
        engine?.dispatch(action);
        return;
      }

      void backend.sendAction(action).catch(() => {
        set({ error: '연결이 불안정해요. 잠시 후 다시 시도해 주세요.' });
      });
    },
  };
});

// ── 셀렉터 ──────────────────────────────────────────────────

export const selectRoom = (s: RoomStoreState): Room | null => s.snapshot?.room ?? null;
export const selectPlayers = (s: RoomStoreState): Player[] => s.snapshot?.players ?? [];
export const selectMe = (s: RoomStoreState): Player | null =>
  s.snapshot?.players.find((p) => p.id === s.meId) ?? null;
export const selectIsHost = (s: RoomStoreState): boolean =>
  Boolean(s.meId && s.snapshot?.room.hostId === s.meId);
export const selectEnvelope = (s: RoomStoreState): GameEnvelope | null =>
  isGameEnvelope(s.snapshot?.gameState) ? (s.snapshot?.gameState as GameEnvelope) : null;
