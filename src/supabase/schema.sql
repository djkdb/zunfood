-- ─────────────────────────────────────────────────────────────
-- MEALGAME · Supabase 스키마
-- Supabase 프로젝트의 SQL Editor 에 그대로 붙여넣어 실행하세요.
-- ─────────────────────────────────────────────────────────────

create extension if not exists "pgcrypto";

-- 방 ------------------------------------------------------------------
create table if not exists public.rooms (
  id            uuid primary key default gen_random_uuid(),
  code          text        not null unique,
  host_id       uuid        not null,
  status        text        not null default 'lobby'
                check (status in ('lobby', 'selecting', 'playing', 'finished')),
  max_players   int         not null default 4 check (max_players between 2 and 8),
  location      jsonb       not null,
  radius        int         not null default 500,
  filters       jsonb       not null default '{}'::jsonb,
  selected_game text,
  candidates    jsonb       not null default '[]'::jsonb,
  winner_id     text,
  -- 참가자에게 공개되는 게임 상태 (투표 내용 등 비밀 정보는 제거된 형태)
  game_state    jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  expires_at    timestamptz not null default (now() + interval '3 hours')
);

create index if not exists rooms_code_idx on public.rooms (code);

-- 참가자 --------------------------------------------------------------
create table if not exists public.players (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid        not null references public.rooms (id) on delete cascade,
  nickname     text        not null,
  is_host      boolean     not null default false,
  is_ready     boolean     not null default false,
  avatar       int         not null default 0,
  joined_at    timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (room_id, nickname)
);

create index if not exists players_room_idx on public.players (room_id);

-- 게임 액션 (참가자 → 호스트) ------------------------------------------
create table if not exists public.game_actions (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid        not null references public.rooms (id) on delete cascade,
  player_id  uuid        not null,
  type       text        not null,
  payload    jsonb       not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists game_actions_room_idx on public.game_actions (room_id, created_at);

-- Realtime 발행 -------------------------------------------------------
alter table public.rooms        replica identity full;
alter table public.players      replica identity full;
alter table public.game_actions replica identity full;

do $$
begin
  begin
    alter publication supabase_realtime add table public.rooms;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.players;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.game_actions;
  exception when duplicate_object then null;
  end;
end $$;

-- RLS ------------------------------------------------------------------
-- MVP 는 로그인이 없으므로 anon 키로 접근한다.
-- ⚠️ 운영에서는 방 코드를 아는 사람만 접근하도록 조건을 좁히거나,
--    Edge Function 을 통해서만 쓰도록 바꾸는 것을 권장한다.
alter table public.rooms        enable row level security;
alter table public.players      enable row level security;
alter table public.game_actions enable row level security;

drop policy if exists "rooms anon access" on public.rooms;
create policy "rooms anon access" on public.rooms
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "players anon access" on public.players;
create policy "players anon access" on public.players
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "game_actions anon access" on public.game_actions;
create policy "game_actions anon access" on public.game_actions
  for all to anon, authenticated using (true) with check (true);

-- 만료된 방 정리 (예: pg_cron 으로 주기 실행) ---------------------------
create or replace function public.cleanup_expired_rooms()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.rooms where expires_at < now();
$$;
