import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ROOM, SEARCH } from '@/config/app';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { SectionTitle } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { BackButton, Screen, TopBar } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { RoomSettingsFields, type RoomSettingsValue } from '@/components/RoomSettingsFields';
import { lastNickname } from '@/store/identity';
import { useRoomStore } from '@/store/roomStore';
import { RoomError } from '@/realtime/types';
import { DEFAULT_FILTERS, type PlaceLocation } from '@/types/restaurant';

export function CreateRoomScreen() {
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const presetLocation = (routerLocation.state as { location?: PlaceLocation } | null)?.location;

  const createRoom = useRoomStore((s) => s.createRoom);
  const [nickname, setNickname] = useState(lastNickname());
  const [maxPlayers, setMaxPlayers] = useState<number>(ROOM.defaultMaxPlayers);
  const [settings, setSettings] = useState<RoomSettingsValue>({
    location: presetLocation ?? null,
    radius: SEARCH.defaultRadius,
    filters: { ...DEFAULT_FILTERS, budget: SEARCH.defaultBudget },
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = nickname.trim().length > 0 && settings.location !== null && !submitting;

  const submit = async () => {
    if (!settings.location) {
      setError('먼저 위치를 정해주세요.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const code = await createRoom({
        nickname: nickname.trim().slice(0, 10),
        maxPlayers,
        location: settings.location,
        radius: settings.radius,
        filters: settings.filters,
      });
      navigate(`/room/${code}`, { replace: true });
    } catch (err) {
      setError(
        err instanceof RoomError
          ? err.message
          : '방을 만들지 못했어요. 잠시 후 다시 시도해 주세요.',
      );
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <TopBar
        left={<BackButton onClick={() => navigate('/')} />}
        center={<span className="text-[16px] font-black">방 만들기</span>}
        right={<span className="w-11" />}
      />

      <div className="space-y-7 pb-28 pt-2">
        <Banner message={error} onClose={() => setError(null)} />

        <section>
          <SectionTitle>내 닉네임</SectionTitle>
          <TextField
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            placeholder="예: 성준"
            maxLength={10}
            autoComplete="off"
            hint="회원가입 없이 바로 시작합니다."
          />
        </section>

        <section>
          <SectionTitle>최대 인원</SectionTitle>
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: ROOM.maxPlayers - ROOM.minPlayers + 1 }, (_, i) => i + ROOM.minPlayers).map(
              (count) => (
                <Chip
                  key={count}
                  selected={maxPlayers === count}
                  onClick={() => setMaxPlayers(count)}
                  className="!px-2"
                >
                  {count}명
                </Chip>
              ),
            )}
          </div>
        </section>

        <RoomSettingsFields value={settings} onChange={setSettings} />
      </div>

      {/* 하단 고정 CTA */}
      <div
        className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-[430px] border-t border-white/10 bg-navy-950/90 px-5 pt-3 backdrop-blur-xl"
        style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}
      >
        <Button variant="pop" block onClick={submit} disabled={!canSubmit} loading={submitting}>
          방 만들고 친구 부르기
        </Button>
      </div>
    </Screen>
  );
}
