import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ROOM } from '@/config/app';
import { Button } from '@/components/ui/Button';
import { PlayerAvatar } from '@/components/ui/PlayerAvatar';
import { Sheet } from '@/components/ui/Sheet';
import { ConditionFields } from '@/components/ConditionFields';
import { InviteSheet } from '@/components/InviteSheet';
import { LocationSheet } from '@/components/LocationSheet';
import { formatRadius, formatWon } from '@/lib/format';
import { useRoomStore } from '@/store/roomStore';
import { toast } from '@/store/toastStore';
import { CATEGORY_LABEL, type PlaceLocation, type RestaurantFilters } from '@/types/restaurant';
import type { Player, Room } from '@/types/room';

interface LobbyScreenProps {
  room: Room;
  players: Player[];
  isHost: boolean;
}

export function LobbyScreen({ room, players, isHost }: LobbyScreenProps) {
  const openGameSelect = useRoomStore((s) => s.openGameSelect);
  const updateSettings = useRoomStore((s) => s.updateSettings);
  const preparing = useRoomStore((s) => s.preparing);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [conditionOpen, setConditionOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [draft, setDraft] = useState<{ radius: number; filters: RestaurantFilters } | null>(null);

  // 친구가 들어오는 순간을 놓치지 않게 알린다
  const knownIds = useRef<string[] | null>(null);
  useEffect(() => {
    const ids = players.map((p) => p.id);
    if (knownIds.current === null) {
      knownIds.current = ids;
      return;
    }
    for (const player of players) {
      if (!knownIds.current.includes(player.id)) {
        toast(`${player.nickname}님이 들어왔어요`, { icon: '👋' });
      }
    }
    knownIds.current = ids;
  }, [players]);

  const alone = players.length < 2;
  const openSlots = Math.max(0, room.maxPlayers - players.length);

  const saveConditions = async () => {
    if (draft) await updateSettings({ radius: draft.radius, filters: draft.filters });
    setConditionOpen(false);
  };

  const saveLocation = async (location: PlaceLocation) => {
    await updateSettings({ location });
    toast('위치를 바꿨어요', { icon: '📍' });
  };

  return (
    <div className="pad-x flex flex-1 flex-col pb-[168px]">
      <div className="pt-3">
        <p className="text-sm font-bold text-primary">오늘 뭐 먹을지 정하는 중</p>
        <h1 className="mt-2 text-h1 text-ink-900">
          {alone ? '친구를 불러주세요' : `${players.length}명이 모였어요`}
        </h1>
        <p className="mt-1.5 text-body text-muted">
          {alone ? '링크만 보내면 바로 들어와요' : '다 모이면 게임을 골라요'}
        </p>
      </div>

      <ul className="group-list mt-6">
        <AnimatePresence initial={false}>
          {players.map((player) => {
            const isRoomHost = player.id === room.hostId;
            const offline = Date.now() - player.lastSeenAt > ROOM.offlineAfterMs;
            return (
              <motion.li
                key={player.id}
                layout
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                className="flex items-center gap-3 bg-surface px-4 py-3"
              >
                <PlayerAvatar avatar={player.avatar} isHost={isRoomHost} dim={offline} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-h3 text-ink-900">{player.nickname}</span>
                  <span className="text-sm text-muted">
                    {isRoomHost ? '방장' : '참가자'}
                    {offline && ' · 연결 끊김'}
                  </span>
                </span>
              </motion.li>
            );
          })}
        </AnimatePresence>

        {openSlots > 0 && (
          <li className="flex items-center gap-3 bg-surface px-4 py-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-dashed border-ink-200 text-ink-300">
              +
            </span>
            <span className="text-body text-muted">{openSlots}자리 남았어요</span>
          </li>
        )}
      </ul>

      {/* 조건 요약 — 카드로 감싸지 않고 구분선 목록으로 */}
      <div className="mt-7">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-h3 text-ink-900">먹을 조건</h2>
          {isHost && (
            <button
              type="button"
              onClick={() => {
                setDraft({ radius: room.radius, filters: room.filters });
                setConditionOpen(true);
              }}
              className="h-8 rounded px-2 text-sm font-bold text-primary active:bg-primary-50"
            >
              바꾸기
            </button>
          )}
        </div>
        <div className="group-list">
          <button
            type="button"
            disabled={!isHost}
            onClick={() => setLocationOpen(true)}
            className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left disabled:opacity-100"
          >
            <span className="text-body text-muted">위치</span>
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="truncate text-body font-semibold text-ink-900">
                {room.location.name}
              </span>
              {isHost && <span className="text-ink-300">›</span>}
            </span>
          </button>
          <Row label="반경" value={formatRadius(room.radius)} />
          <Row label="1인 예산" value={`${formatWon(room.filters.budget)} 안팎`} />
          <Row
            label="음식"
            value={
              room.filters.categories.length === 0
                ? '전체'
                : room.filters.categories.map((c) => CATEGORY_LABEL[c]).join(', ')
            }
          />
        </div>
      </div>

      <div className="action-bar bg-gradient-to-t from-paper via-paper to-transparent pt-6">
        {isHost ? (
          <div className="space-y-2">
            <Button
              variant={alone ? 'primary' : 'accent'}
              block
              onClick={alone ? () => setInviteOpen(true) : openGameSelect}
              loading={preparing}
            >
              {preparing ? '주변 식당 찾는 중…' : alone ? '친구 초대하기' : '게임 고르기'}
            </Button>
            {!alone && (
              <Button variant="secondary" size="md" block onClick={() => setInviteOpen(true)}>
                친구 더 부르기
              </Button>
            )}
          </div>
        ) : (
          <div className="flex h-[54px] items-center justify-center gap-2 rounded-lg bg-ink-100 text-body font-bold text-ink-500">
            <span className="h-1.5 w-1.5 animate-ping rounded-full bg-primary" />
            방장이 게임을 고르는 중…
          </div>
        )}
      </div>

      <InviteSheet open={inviteOpen} onClose={() => setInviteOpen(false)} code={room.code} />

      <LocationSheet
        open={locationOpen}
        onClose={() => setLocationOpen(false)}
        onSelect={saveLocation}
        radius={room.radius}
        current={room.location}
      />

      <Sheet open={conditionOpen} onClose={() => setConditionOpen(false)} title="먹을 조건">
        <div className="max-h-[62vh] overflow-y-auto no-scrollbar pb-2">
          {draft && (
            <ConditionFields
              radius={draft.radius}
              filters={draft.filters}
              onRadiusChange={(radius) => setDraft({ ...draft, radius })}
              onFiltersChange={(filters) => setDraft({ ...draft, filters })}
              showAdvanced
            />
          )}
        </div>
        <Button block className="mt-4" onClick={saveConditions}>
          저장
        </Button>
      </Sheet>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3.5">
      <span className="text-body text-muted">{label}</span>
      <span className="truncate text-body font-semibold text-ink-900">{value}</span>
    </div>
  );
}
