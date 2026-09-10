import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ROOM } from '@/config/app';
import { Button } from '@/components/ui/Button';
import { SectionTitle } from '@/components/ui/Card';
import { PlayerAvatar } from '@/components/ui/PlayerAvatar';
import { Sheet } from '@/components/ui/Sheet';
import { InvitePanel } from '@/components/InvitePanel';
import { RoomSettingsFields, type RoomSettingsValue } from '@/components/RoomSettingsFields';
import { formatRadius, formatWon } from '@/lib/format';
import { useRoomStore } from '@/store/roomStore';
import { CATEGORY_LABEL, type FoodCategory } from '@/types/restaurant';
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draft, setDraft] = useState<RoomSettingsValue | null>(null);

  const emptySlots = Math.max(0, room.maxPlayers - players.length);

  const openSettings = () => {
    setDraft({ location: room.location, radius: room.radius, filters: room.filters });
    setSettingsOpen(true);
  };

  const saveSettings = async () => {
    if (draft?.location) {
      await updateSettings({
        location: draft.location,
        radius: draft.radius,
        filters: draft.filters,
      });
    }
    setSettingsOpen(false);
  };

  return (
    <div className="space-y-6 pb-32">
      <InvitePanel code={room.code} />

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <SectionTitle className="mb-0">참가자</SectionTitle>
          <span className="text-[14px] font-black text-brand-200">
            {players.length} / {room.maxPlayers}명 참가
          </span>
        </div>

        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {players.map((player) => {
              const isRoomHost = player.id === room.hostId;
              return (
              <motion.div
                key={player.id}
                layout
                initial={{ opacity: 0, x: -18, scale: 0.96 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 320, damping: 26 }}
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.05] p-3"
              >
                <PlayerAvatar
                  nickname={player.nickname}
                  avatar={player.avatar}
                  isHost={isRoomHost}
                  dim={Date.now() - player.lastSeenAt > ROOM.offlineAfterMs}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[16px] font-bold">{player.nickname}</p>
                  <p className="text-[12px] text-white/40">
                    {isRoomHost ? '방장' : '참가자'}
                    {Date.now() - player.lastSeenAt > ROOM.offlineAfterMs && ' · 연결 끊김'}
                  </p>
                </div>
                {isRoomHost && (
                  <span className="rounded-full bg-pop-400/20 px-2.5 py-1 text-[12px] font-black text-pop-300">
                    방장
                  </span>
                )}
              </motion.div>
              );
            })}
          </AnimatePresence>

          {Array.from({ length: emptySlots }).map((_, index) => (
            <div
              key={`slot-${index}`}
              className="flex items-center gap-3 rounded-2xl border border-dashed border-white/12 p-3"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/5 text-[18px] text-white/25">
                ?
              </div>
              <p className="text-[15px] font-semibold text-white/25">친구를 기다리는 중…</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <SectionTitle className="mb-0">오늘의 조건</SectionTitle>
          {isHost && (
            <button
              type="button"
              onClick={openSettings}
              className="rounded-lg px-2 py-1 text-[13px] font-bold text-brand-200 active:bg-white/10"
            >
              수정
            </button>
          )}
        </div>
        <div className="space-y-1.5 rounded-2xl border border-white/10 bg-white/[0.05] p-4 text-[14px]">
          <Row label="위치" value={room.location.name} />
          <Row label="반경" value={formatRadius(room.radius)} />
          <Row label="1인 예산" value={`${formatWon(room.filters.budget)} 안팎`} />
          <Row
            label="음식"
            value={
              room.filters.categories.length === 0
                ? '전체'
                : room.filters.categories.map((c: FoodCategory) => CATEGORY_LABEL[c]).join(', ')
            }
          />
          {room.filters.excludedCategories.length > 0 && (
            <Row
              label="제외"
              value={room.filters.excludedCategories
                .map((c: FoodCategory) => CATEGORY_LABEL[c])
                .join(', ')}
            />
          )}
        </div>
      </section>

      <div
        className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-[430px] border-t border-white/10 bg-navy-950/90 px-5 pt-3 backdrop-blur-xl"
        style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}
      >
        {isHost ? (
          <Button variant="pop" block onClick={openGameSelect} loading={preparing}>
            {preparing ? '주변 식당 찾는 중…' : '게임 시작하기'}
          </Button>
        ) : (
          <div className="flex h-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-[15px] font-bold text-white/55">
            <span className="mr-2 h-2 w-2 animate-ping rounded-full bg-pop-400" />
            방장이 시작하기를 기다리는 중…
          </div>
        )}
      </div>

      <Sheet open={settingsOpen} onClose={() => setSettingsOpen(false)} title="조건 변경">
        <div className="max-h-[62vh] overflow-y-auto no-scrollbar pb-2">
          {draft && <RoomSettingsFields value={draft} onChange={setDraft} />}
        </div>
        <Button variant="pop" block className="mt-4" onClick={saveSettings}>
          저장하기
        </Button>
      </Sheet>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <span className="w-16 shrink-0 font-bold text-white/40">{label}</span>
      <span className="min-w-0 flex-1 font-semibold text-white/90">{value}</span>
    </div>
  );
}
