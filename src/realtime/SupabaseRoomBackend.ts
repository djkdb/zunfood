import type { SupabaseClient } from '@supabase/supabase-js';
import { ROOM } from '@/config/app';
import { generateRoomCode, normalizeRoomCode } from '@/lib/id';
import type { GameAction } from '@/types/game';
import type { CreateRoomInput, Player, Room, RoomSnapshot, RoomStatus } from '@/types/room';
import type { PlaceLocation, Restaurant, RestaurantFilters } from '@/types/restaurant';
import type { GameId } from '@/types/game';
import {
  RoomError,
  ROOM_ERROR_MESSAGE,
  type RoomBackend,
  type RoomHandlers,
  type SubscribeOptions,
  type Unsubscribe,
} from './types';

interface RoomRow {
  id: string;
  code: string;
  host_id: string;
  status: RoomStatus;
  max_players: number;
  location: PlaceLocation;
  radius: number;
  filters: RestaurantFilters;
  selected_game: GameId | null;
  candidates: Restaurant[];
  winner_id: string | null;
  game_state: unknown | null;
  created_at: string;
  updated_at: string;
  expires_at: string;
}

interface PlayerRow {
  id: string;
  room_id: string;
  nickname: string;
  is_host: boolean;
  is_ready: boolean;
  avatar: number;
  joined_at: string;
  last_seen_at: string;
}

/** Supabase(Postgres + Realtime) 백엔드 — 서로 다른 기기 간 동기화를 담당한다. */
export class SupabaseRoomBackend implements RoomBackend {
  readonly kind = 'supabase' as const;
  private readonly db: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.db = client;
  }

  async createRoom(input: CreateRoomInput): Promise<{ room: Room; player: Player }> {
    const hostId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + ROOM.expiresInMinutes * 60_000).toISOString();

    let lastError: unknown = null;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = generateRoomCode(ROOM.codeLength);
      const { data, error } = await this.db
        .from('rooms')
        .insert({
          code,
          host_id: hostId,
          status: 'lobby',
          max_players: input.maxPlayers,
          location: input.location,
          radius: input.radius,
          filters: input.filters,
          candidates: [],
          expires_at: expiresAt,
        })
        .select()
        .single();

      if (!error && data) {
        const room = toRoom(data as RoomRow);
        const { data: playerRow, error: playerError } = await this.db
          .from('players')
          .insert({
            id: hostId,
            room_id: room.id,
            nickname: input.nickname.trim(),
            is_host: true,
            is_ready: true,
            avatar: 0,
          })
          .select()
          .single();

        if (playerError || !playerRow) {
          throw new RoomError('unknown', ROOM_ERROR_MESSAGE.unknown);
        }
        return { room, player: toPlayer(playerRow as PlayerRow) };
      }

      lastError = error;
      // 코드 충돌(23505)이면 새 코드로 재시도, 그 외에는 즉시 실패.
      if (error && error.code !== '23505') break;
    }

    throw new RoomError('network', describe(lastError));
  }

  async joinRoom(rawCode: string, nickname: string): Promise<{ room: Room; player: Player }> {
    const code = normalizeRoomCode(rawCode);
    const { data: roomRow, error } = await this.db
      .from('rooms')
      .select()
      .eq('code', code)
      .maybeSingle();

    if (error) throw new RoomError('network', describe(error));
    if (!roomRow) throw new RoomError('room_not_found', ROOM_ERROR_MESSAGE.room_not_found);

    const room = toRoom(roomRow as RoomRow);
    if (room.expiresAt < Date.now()) {
      throw new RoomError('room_expired', ROOM_ERROR_MESSAGE.room_expired);
    }

    const { data: playerRows } = await this.db.from('players').select().eq('room_id', room.id);
    const players = ((playerRows ?? []) as PlayerRow[]).map(toPlayer);
    const trimmed = nickname.trim();

    const existing = players.find((p) => p.nickname === trimmed);
    if (existing) {
      // 오래 전에 끊긴 동일 닉네임이면 자리 이어받기(새로고침 복구).
      if (Date.now() - existing.lastSeenAt > ROOM.offlineAfterMs) {
        await this.heartbeat(room.id, existing.id);
        return { room, player: existing };
      }
      throw new RoomError('nickname_taken', ROOM_ERROR_MESSAGE.nickname_taken);
    }

    if (players.length >= room.maxPlayers) {
      throw new RoomError('room_full', ROOM_ERROR_MESSAGE.room_full);
    }

    const { data: inserted, error: insertError } = await this.db
      .from('players')
      .insert({
        room_id: room.id,
        nickname: trimmed,
        is_host: false,
        is_ready: false,
        avatar: players.length % 8,
      })
      .select()
      .single();

    if (insertError?.code === '23505') {
      throw new RoomError('nickname_taken', ROOM_ERROR_MESSAGE.nickname_taken);
    }
    if (insertError || !inserted) throw new RoomError('network', describe(insertError));

    return { room, player: toPlayer(inserted as PlayerRow) };
  }

  async getSnapshot(roomId: string): Promise<RoomSnapshot | null> {
    const [{ data: roomRow }, { data: playerRows }] = await Promise.all([
      this.db.from('rooms').select().eq('id', roomId).maybeSingle(),
      this.db.from('players').select().eq('room_id', roomId).order('joined_at'),
    ]);

    if (!roomRow) return null;
    const row = roomRow as RoomRow;
    return {
      room: toRoom(row),
      players: ((playerRows ?? []) as PlayerRow[]).map(toPlayer),
      gameState: row.game_state ?? null,
    };
  }

  async subscribe(
    roomId: string,
    options: SubscribeOptions,
    handlers: RoomHandlers,
  ): Promise<Unsubscribe> {
    handlers.onStatus?.('connecting');

    let timer: number | null = null;
    let disposed = false;

    const refresh = () => {
      if (timer !== null) return;
      timer = window.setTimeout(async () => {
        timer = null;
        if (disposed) return;
        try {
          const snapshot = await this.getSnapshot(roomId);
          if (snapshot) handlers.onSnapshot(snapshot);
        } catch (error) {
          handlers.onError?.(new RoomError('network', describe(error)));
        }
      }, 80);
    };

    const channel = this.db
      .channel(`room:${roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        refresh,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${roomId}` },
        refresh,
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'game_actions',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          if (!options.isHost) return;
          const row = payload.new as {
            id: string;
            room_id: string;
            player_id: string;
            type: string;
            payload: Record<string, unknown>;
            created_at: string;
          };
          handlers.onAction?.({
            id: row.id,
            roomId: row.room_id,
            playerId: row.player_id,
            type: row.type,
            payload: row.payload ?? {},
            createdAt: new Date(row.created_at).getTime(),
          });
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          handlers.onStatus?.('online');
          refresh();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          handlers.onStatus?.('offline');
        }
      });

    // Realtime 이벤트를 놓쳤을 때를 대비한 안전망 폴링.
    const poll = window.setInterval(refresh, 5_000);
    refresh();

    return () => {
      disposed = true;
      if (timer !== null) window.clearTimeout(timer);
      window.clearInterval(poll);
      this.db.removeChannel(channel);
    };
  }

  async patchRoom(roomId: string, patch: Partial<Room>): Promise<void> {
    const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.status !== undefined) row.status = patch.status;
    if (patch.maxPlayers !== undefined) row.max_players = patch.maxPlayers;
    if (patch.location !== undefined) row.location = patch.location;
    if (patch.radius !== undefined) row.radius = patch.radius;
    if (patch.filters !== undefined) row.filters = patch.filters;
    if (patch.selectedGame !== undefined) row.selected_game = patch.selectedGame;
    if (patch.candidates !== undefined) row.candidates = patch.candidates;
    if (patch.winnerId !== undefined) row.winner_id = patch.winnerId;
    if (patch.hostId !== undefined) row.host_id = patch.hostId;

    const { error } = await this.db.from('rooms').update(row).eq('id', roomId);
    if (error) throw new RoomError('network', describe(error));
  }

  async setGameState(roomId: string, state: unknown | null): Promise<void> {
    const { error } = await this.db
      .from('rooms')
      .update({ game_state: state, updated_at: new Date().toISOString() })
      .eq('id', roomId);
    if (error) throw new RoomError('network', describe(error));
  }

  async sendAction(action: GameAction): Promise<void> {
    const { error } = await this.db.from('game_actions').insert({
      id: action.id,
      room_id: action.roomId,
      player_id: action.playerId,
      type: action.type,
      payload: action.payload,
    });
    if (error) throw new RoomError('network', describe(error));
  }

  async heartbeat(roomId: string, playerId: string): Promise<void> {
    await this.db
      .from('players')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', playerId)
      .eq('room_id', roomId);
  }

  async leaveRoom(roomId: string, playerId: string): Promise<void> {
    await this.db.from('players').delete().eq('id', playerId).eq('room_id', roomId);

    const { data: rest } = await this.db
      .from('players')
      .select()
      .eq('room_id', roomId)
      .order('joined_at');
    const remaining = ((rest ?? []) as PlayerRow[]).map(toPlayer);

    if (remaining.length === 0) {
      await this.db.from('rooms').delete().eq('id', roomId);
      return;
    }

    const { data: roomRow } = await this.db
      .from('rooms')
      .select('host_id')
      .eq('id', roomId)
      .maybeSingle();

    if (roomRow && (roomRow as { host_id: string }).host_id === playerId) {
      const next = remaining[0];
      await this.db.from('players').update({ is_host: true }).eq('id', next.id);
      await this.db.from('rooms').update({ host_id: next.id }).eq('id', roomId);
    }
  }
}

function toRoom(row: RoomRow): Room {
  return {
    id: row.id,
    code: row.code,
    hostId: row.host_id,
    status: row.status,
    maxPlayers: row.max_players,
    location: row.location,
    radius: row.radius,
    filters: row.filters,
    selectedGame: row.selected_game,
    candidates: row.candidates ?? [],
    winnerId: row.winner_id,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
    expiresAt: new Date(row.expires_at).getTime(),
  };
}

function toPlayer(row: PlayerRow): Player {
  return {
    id: row.id,
    roomId: row.room_id,
    nickname: row.nickname,
    isHost: row.is_host,
    isReady: row.is_ready,
    avatar: row.avatar,
    joinedAt: new Date(row.joined_at).getTime(),
    lastSeenAt: new Date(row.last_seen_at).getTime(),
  };
}

function describe(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message) || ROOM_ERROR_MESSAGE.network;
  }
  return ROOM_ERROR_MESSAGE.network;
}
