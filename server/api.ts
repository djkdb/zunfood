import { readUsage } from './places.ts';
import type { Sql } from './sql';

/**
 * MEALGAME 방 API.
 *
 * 브라우저는 DB 에 직접 접근하지 않는다. 커넥션 문자열은 서버에만 있고,
 * 방장 전용 동작은 여기서 host_id 로 검증한다.
 *
 * 응답은 클라이언트 도메인 모델(camelCase, 시각은 epoch ms)과 같은 모양으로 내려서
 * 클라이언트 쪽에 별도 매핑 계층을 두지 않는다.
 */

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 헷갈리는 0/O/1/I 제외
const ROOM_TTL_HOURS = 3;

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message?: string) {
    super(message ?? code);
    this.status = status;
    this.code = code;
  }
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

export async function handleApi(request: Request, sql: Sql): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/?/, '').replace(/\/$/, '');
  const segments = path ? path.split('/') : [];
  const method = request.method.toUpperCase();

  try {
    // POST /api/rooms
    if (method === 'POST' && segments.length === 1 && segments[0] === 'rooms') {
      return json(await createRoom(sql, await body(request)));
    }
    // POST /api/rooms/join
    if (method === 'POST' && segments[0] === 'rooms' && segments[1] === 'join') {
      return json(await joinRoom(sql, await body(request)));
    }

    if (segments[0] === 'rooms' && segments[1]) {
      const roomId = segments[1];

      // GET /api/rooms/:id?rev=&crev=
      if (method === 'GET' && segments.length === 2) {
        return await getSnapshot(sql, roomId, url.searchParams);
      }
      // PATCH /api/rooms/:id
      if (method === 'PATCH' && segments.length === 2) {
        return json(await patchRoom(sql, roomId, await body(request)));
      }
      // PUT /api/rooms/:id/state
      if (method === 'PUT' && segments[2] === 'state') {
        return json(await setGameState(sql, roomId, await body(request)));
      }
      // GET|POST /api/rooms/:id/actions
      if (segments[2] === 'actions') {
        if (method === 'GET') return json(await pollActions(sql, roomId, url.searchParams));
        if (method === 'POST') return json(await sendAction(sql, roomId, await body(request)));
      }
      // POST /api/rooms/:id/heartbeat
      if (method === 'POST' && segments[2] === 'heartbeat') {
        return json(await heartbeat(sql, roomId, await body(request)));
      }
      // DELETE /api/rooms/:id/players/:playerId
      if (method === 'DELETE' && segments[2] === 'players' && segments[3]) {
        return json(await leaveRoom(sql, roomId, segments[3]));
      }
    }

    // GET /api/health — DB 연결 + 이번 달 외부 API 사용량
    if (method === 'GET' && segments[0] === 'health') {
      await sql`select 1`;
      let usage: Record<string, number> = {};
      try {
        usage = await readUsage(sql);
      } catch {
        // 사용량 테이블이 아직 없어도 health 는 성공으로 본다
      }
      return json({ ok: true, usage });
    }

    throw new ApiError(404, 'not_found');
  } catch (error) {
    if (error instanceof ApiError) {
      return json({ error: error.code, message: error.message }, error.status);
    }
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('ROOM_FULL')) return json({ error: 'room_full' }, 409);
    if (message.includes('duplicate key')) return json({ error: 'nickname_taken' }, 409);
    console.error('[api]', message);
    return json({ error: 'unknown' }, 500);
  }
}

// ── 핸들러 ────────────────────────────────────────────────────

async function createRoom(sql: Sql, input: Record<string, unknown>) {
  const nickname = requireNickname(input.nickname);
  const maxPlayers = clamp(Number(input.maxPlayers) || 4, 2, 8);
  const hostId = crypto.randomUUID();

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const code = generateCode();
    try {
      const [row] = await sql`
        insert into rooms (code, host_id, max_players, location, radius, filters, expires_at)
        values (${code}, ${hostId}, ${maxPlayers},
                ${JSON.stringify(input.location)}::jsonb, ${Number(input.radius) || 500},
                ${JSON.stringify(input.filters ?? {})}::jsonb,
                now() + ${`${ROOM_TTL_HOURS} hours`}::interval)
        returning *`;

      const [player] = await sql`
        insert into players (id, room_id, nickname, is_host, is_ready, avatar)
        values (${hostId}, ${row.id}, ${nickname}, true, true, 0)
        returning *`;

      return { room: toRoom(row), player: toPlayer(player) };
    } catch (error) {
      // 코드 충돌이면 다른 코드로 재시도, 그 외에는 그대로 던진다
      if (!String(error).includes('rooms_code_key')) throw error;
    }
  }
  throw new ApiError(503, 'unknown', '방 코드를 만들지 못했습니다.');
}

async function joinRoom(sql: Sql, input: Record<string, unknown>) {
  const code = String(input.code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const nickname = requireNickname(input.nickname);

  const [room] = await sql`select * from rooms where code = ${code}`;
  if (!room) throw new ApiError(404, 'room_not_found');
  if (new Date(room.expires_at as string).getTime() < Date.now()) {
    throw new ApiError(410, 'room_expired');
  }

  const players = await sql`select * from players where room_id = ${room.id} order by joined_at`;
  const existing = players.find((p) => p.nickname === nickname);

  if (existing) {
    // 오래 전에 끊긴 같은 닉네임이면 그 자리를 이어받는다 (새로고침 복구)
    const idle = Date.now() - new Date(existing.last_seen_at as string).getTime();
    if (idle > 35_000) {
      await sql`update players set last_seen_at = now() where id = ${existing.id}`;
      return { room: toRoom(room), player: toPlayer(existing) };
    }
    throw new ApiError(409, 'nickname_taken');
  }

  const [player] = await sql`
    insert into players (room_id, nickname, avatar)
    values (${room.id}, ${nickname}, ${players.length % 8})
    returning *`;

  return { room: toRoom(room), player: toPlayer(player) };
}

async function getSnapshot(sql: Sql, roomId: string, params: URLSearchParams): Promise<Response> {
  const knownRev = Number(params.get('rev') ?? -1);
  const knownCandidatesRev = Number(params.get('crev') ?? -1);

  const [room] = await sql`select * from rooms where id = ${roomId}`;
  if (!room) throw new ApiError(404, 'room_not_found');

  // 바뀐 게 없으면 본문 없이 끝낸다 — 폴링 비용을 낮추는 핵심
  if (Number(room.rev) === knownRev) {
    return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
  }

  const players = await sql`select * from players where room_id = ${roomId} order by joined_at`;
  const payload: Record<string, unknown> = {
    rev: Number(room.rev),
    candidatesRev: Number(room.candidates_rev),
    room: toRoom(room),
    players: players.map(toPlayer),
    gameState: room.game_state ?? null,
  };

  // 후보 목록은 바뀐 경우에만 실어 보낸다 (매 폴링마다 수 KB 를 다시 보내지 않도록)
  if (Number(room.candidates_rev) === knownCandidatesRev) {
    delete (payload.room as Record<string, unknown>).candidates;
  }

  return json(payload);
}

async function patchRoom(sql: Sql, roomId: string, input: Record<string, unknown>) {
  await assertHost(sql, roomId, input.playerId);
  const patch = (input.patch ?? {}) as Record<string, unknown>;

  // 화이트리스트 — 클라이언트가 임의 컬럼을 건드리지 못하게 한다
  if (patch.status !== undefined) {
    await sql`update rooms set status = ${String(patch.status)} where id = ${roomId}`;
  }
  if (patch.hostId !== undefined) {
    await sql`update rooms set host_id = ${String(patch.hostId)} where id = ${roomId}`;
    await sql`update players set is_host = (id = ${String(patch.hostId)}) where room_id = ${roomId}`;
  }
  if (patch.maxPlayers !== undefined) {
    await sql`update rooms set max_players = ${clamp(Number(patch.maxPlayers), 2, 8)} where id = ${roomId}`;
  }
  if (patch.location !== undefined) {
    await sql`update rooms set location = ${JSON.stringify(patch.location)}::jsonb where id = ${roomId}`;
  }
  if (patch.radius !== undefined) {
    await sql`update rooms set radius = ${Number(patch.radius)} where id = ${roomId}`;
  }
  if (patch.filters !== undefined) {
    await sql`update rooms set filters = ${JSON.stringify(patch.filters)}::jsonb where id = ${roomId}`;
  }
  if (patch.selectedGame !== undefined) {
    const game = patch.selectedGame === null ? null : String(patch.selectedGame);
    await sql`update rooms set selected_game = ${game} where id = ${roomId}`;
  }
  if (patch.candidates !== undefined) {
    await sql`update rooms set candidates = ${JSON.stringify(patch.candidates)}::jsonb where id = ${roomId}`;
  }
  if (patch.winnerId !== undefined) {
    const winner = patch.winnerId === null ? null : String(patch.winnerId);
    await sql`update rooms set winner_id = ${winner} where id = ${roomId}`;
  }
  return { ok: true };
}

async function setGameState(sql: Sql, roomId: string, input: Record<string, unknown>) {
  await assertHost(sql, roomId, input.playerId);
  const state = input.state === null || input.state === undefined ? null : JSON.stringify(input.state);
  await sql`update rooms set game_state = ${state}::jsonb where id = ${roomId}`;
  return { ok: true };
}

async function sendAction(sql: Sql, roomId: string, input: Record<string, unknown>) {
  const playerId = String(input.playerId ?? '');
  const [player] = await sql`select id from players where id = ${playerId} and room_id = ${roomId}`;
  if (!player) throw new ApiError(403, 'unknown', '방에 없는 참가자입니다.');

  await sql`
    insert into game_actions (room_id, player_id, type, payload)
    values (${roomId}, ${playerId}, ${String(input.type ?? '')},
            ${JSON.stringify(input.payload ?? {})}::jsonb)`;
  return { ok: true };
}

async function pollActions(sql: Sql, roomId: string, params: URLSearchParams) {
  await assertHost(sql, roomId, params.get('playerId'));
  const after = Number(params.get('after') ?? 0);

  const rows = await sql`
    select * from game_actions
    where room_id = ${roomId} and id > ${after}
    order by id limit 100`;

  return {
    actions: rows.map((row) => ({
      id: String(row.id),
      seq: Number(row.id),
      roomId,
      playerId: String(row.player_id),
      type: String(row.type),
      payload: (row.payload ?? {}) as Record<string, unknown>,
      createdAt: new Date(row.created_at as string).getTime(),
    })),
  };
}

async function heartbeat(sql: Sql, roomId: string, input: Record<string, unknown>) {
  await sql`
    update players set last_seen_at = now()
    where id = ${String(input.playerId ?? '')} and room_id = ${roomId}`;
  return { ok: true };
}

async function leaveRoom(sql: Sql, roomId: string, playerId: string) {
  await sql`delete from players where id = ${playerId} and room_id = ${roomId}`;

  const remaining = await sql`select * from players where room_id = ${roomId} order by joined_at`;
  if (remaining.length === 0) {
    await sql`delete from rooms where id = ${roomId}`;
    return { ok: true, roomClosed: true };
  }

  // 방장이 나갔으면 가장 먼저 들어온 사람에게 넘긴다
  const [room] = await sql`select host_id from rooms where id = ${roomId}`;
  if (room && String(room.host_id) === playerId) {
    const next = remaining[0];
    await sql`update rooms set host_id = ${next.id} where id = ${roomId}`;
    await sql`update players set is_host = (id = ${next.id}) where room_id = ${roomId}`;
  }
  return { ok: true };
}

// ── 도우미 ────────────────────────────────────────────────────

async function assertHost(sql: Sql, roomId: string, playerId: unknown): Promise<void> {
  const [room] = await sql`select host_id from rooms where id = ${roomId}`;
  if (!room) throw new ApiError(404, 'room_not_found');
  if (String(room.host_id) !== String(playerId ?? '')) {
    throw new ApiError(403, 'unknown', '방장만 할 수 있어요.');
  }
}

async function body(request: Request): Promise<Record<string, unknown>> {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function requireNickname(value: unknown): string {
  const nickname = String(value ?? '').trim().slice(0, 10);
  if (!nickname) throw new ApiError(400, 'unknown', '닉네임을 입력해 주세요.');
  return nickname;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function generateCode(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

function toRoom(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    code: String(row.code),
    hostId: String(row.host_id),
    status: String(row.status),
    maxPlayers: Number(row.max_players),
    location: row.location,
    radius: Number(row.radius),
    filters: row.filters,
    selectedGame: row.selected_game ?? null,
    candidates: row.candidates ?? [],
    winnerId: row.winner_id ?? null,
    createdAt: new Date(row.created_at as string).getTime(),
    updatedAt: new Date(row.updated_at as string).getTime(),
    expiresAt: new Date(row.expires_at as string).getTime(),
  };
}

function toPlayer(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    roomId: String(row.room_id),
    nickname: String(row.nickname),
    isHost: Boolean(row.is_host),
    isReady: Boolean(row.is_ready),
    avatar: Number(row.avatar),
    joinedAt: new Date(row.joined_at as string).getTime(),
    lastSeenAt: new Date(row.last_seen_at as string).getTime(),
  };
}
