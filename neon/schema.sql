-- ─────────────────────────────────────────────────────────────
-- MEALGAME · Neon(Postgres) 스키마
--
-- Neon SQL Editor 또는 psql "$DATABASE_URL" -f neon/schema.sql 로 실행하세요.
--
-- Supabase 와 달리 브라우저가 DB 에 직접 접근하지 않습니다.
-- 모든 접근은 Cloudflare Pages Functions(/api)를 거치므로 RLS 대신
-- 서버에서 권한을 확인합니다. (방장 전용 동작은 host_id 로 검증)
-- ─────────────────────────────────────────────────────────────

create extension if not exists "pgcrypto";

-- 방 ------------------------------------------------------------------
create table if not exists rooms (
  id             uuid primary key default gen_random_uuid(),
  code           text        not null unique,
  host_id        uuid        not null,
  status         text        not null default 'lobby'
                   check (status in ('lobby', 'selecting', 'playing', 'finished')),
  max_players    int         not null default 4 check (max_players between 2 and 8),
  location       jsonb       not null,
  radius         int         not null default 500,
  filters        jsonb       not null default '{}'::jsonb,
  selected_game  text,
  candidates     jsonb       not null default '[]'::jsonb,
  winner_id      text,
  -- 참가자에게 공개되는 게임 상태 (투표 내용 등 비밀 정보는 제거된 형태)
  game_state     jsonb,
  -- 변경 감지용. 클라이언트는 이 값이 그대로면 폴링 응답을 받지 않는다(204).
  rev            int         not null default 1,
  -- 후보 목록은 거의 안 바뀌므로 따로 추적해서, 바뀔 때만 내려보낸다.
  candidates_rev int         not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  expires_at     timestamptz not null default (now() + interval '3 hours')
);

create index if not exists rooms_code_idx on rooms (code);
create index if not exists rooms_expires_idx on rooms (expires_at);

-- 참가자 --------------------------------------------------------------
create table if not exists players (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid        not null references rooms (id) on delete cascade,
  nickname     text        not null,
  is_host      boolean     not null default false,
  is_ready     boolean     not null default false,
  avatar       int         not null default 0,
  joined_at    timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (room_id, nickname)
);

create index if not exists players_room_idx on players (room_id, joined_at);

-- 게임 액션 (참가자 → 방장) --------------------------------------------
create table if not exists game_actions (
  id         bigserial primary key,
  room_id    uuid        not null references rooms (id) on delete cascade,
  player_id  uuid        not null,
  type       text        not null,
  payload    jsonb       not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists game_actions_room_idx on game_actions (room_id, id);

-- rev 관리 -------------------------------------------------------------
-- 방이 바뀌면 rev 를 올리고, 후보가 바뀐 경우에만 candidates_rev 도 올린다.
create or replace function rooms_bump_rev() returns trigger
language plpgsql as $$
begin
  new.rev := old.rev + 1;
  new.updated_at := now();
  if new.candidates is distinct from old.candidates then
    new.candidates_rev := new.rev;
  end if;
  return new;
end $$;

drop trigger if exists rooms_bump_rev_trg on rooms;
create trigger rooms_bump_rev_trg
  before update on rooms
  for each row execute function rooms_bump_rev();

-- 참가자 입장/이탈/하트비트도 방의 rev 를 올려서 모두가 알아채게 한다.
create or replace function players_bump_room_rev() returns trigger
language plpgsql as $$
begin
  update rooms set rev = rev + 1, updated_at = now()
  where id = coalesce(new.room_id, old.room_id);
  return coalesce(new, old);
end $$;

drop trigger if exists players_bump_room_rev_trg on players;
create trigger players_bump_room_rev_trg
  after insert or update or delete on players
  for each row execute function players_bump_room_rev();

-- 정원 초과를 DB 에서 막는다 (동시 입장 경쟁 상태 방지) ------------------
create or replace function players_check_capacity() returns trigger
language plpgsql as $$
declare
  seated int;
  capacity int;
begin
  select max_players into capacity from rooms where id = new.room_id for update;
  select count(*) into seated from players where room_id = new.room_id;
  if seated >= capacity then
    raise exception 'ROOM_FULL';
  end if;
  return new;
end $$;

drop trigger if exists players_check_capacity_trg on players;
create trigger players_check_capacity_trg
  before insert on players
  for each row execute function players_check_capacity();

-- 만료된 방 정리 (Neon 스케줄러 또는 Cron Trigger 에서 호출) -------------
create or replace function cleanup_expired_rooms() returns void
language sql as $$
  delete from rooms where expires_at < now();
$$;

-- 외부 API 사용량 ------------------------------------------------------
-- 구글 Places 처럼 유료 전환되는 API 의 월 사용량을 세어, 무료 한도를 넘기 전에
-- 무료 제공자(카카오)로 자동 전환하기 위한 카운터.
create table if not exists api_usage (
  provider text not null,
  period   text not null,          -- 'YYYY-MM'
  count    int  not null default 0,
  primary key (provider, period)
);
