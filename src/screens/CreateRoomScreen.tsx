import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ROOM, SEARCH } from '@/config/app';
import { Button, IconButton } from '@/components/ui/Button';
import { AppBar, Screen } from '@/components/ui/Screen';
import { Segmented } from '@/components/ui/Segmented';
import { Sheet } from '@/components/ui/Sheet';
import { TextField } from '@/components/ui/TextField';
import { ConditionFields } from '@/components/ConditionFields';
import { LocationSheet } from '@/components/LocationSheet';
import { formatRadius, formatWon } from '@/lib/format';
import { RoomError } from '@/realtime/types';
import { lastNickname } from '@/store/identity';
import { useRoomStore } from '@/store/roomStore';
import { toast } from '@/store/toastStore';
import { CATEGORY_LABEL, DEFAULT_FILTERS, type PlaceLocation, type RestaurantFilters } from '@/types/restaurant';

/**
 * 방 만들기.
 * 친구를 부르는 화면까지 최대한 빨리 도달하는 게 목표라, 여기서는 닉네임과 위치만 받고
 * 나머지 조건은 접어둔다(기본값으로도 바로 시작 가능).
 */
export function CreateRoomScreen() {
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const preset = (routerLocation.state as { location?: PlaceLocation } | null)?.location;

  const createRoom = useRoomStore((s) => s.createRoom);
  const [nickname, setNickname] = useState(lastNickname());
  const [location, setLocationValue] = useState<PlaceLocation | null>(preset ?? null);
  const [maxPlayers, setMaxPlayers] = useState<number>(ROOM.defaultMaxPlayers);
  const [radius, setRadius] = useState<number>(SEARCH.defaultRadius);
  const [filters, setFilters] = useState<RestaurantFilters>({
    ...DEFAULT_FILTERS,
    budget: SEARCH.defaultBudget,
  });

  const [locationOpen, setLocationOpen] = useState(false);
  const [conditionOpen, setConditionOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!nickname.trim()) {
      setError('닉네임을 입력해 주세요.');
      return;
    }
    if (!location) {
      setLocationOpen(true);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const code = await createRoom({
        nickname: nickname.trim().slice(0, 10),
        maxPlayers,
        location,
        radius,
        filters,
      });
      navigate(`/room/${code}`, { replace: true });
    } catch (err) {
      const message =
        err instanceof RoomError ? err.message : '방을 만들지 못했어요. 다시 시도해 주세요.';
      setError(message);
      toast(message, { tone: 'error' });
      setSubmitting(false);
    }
  };

  const conditionSummary = [
    formatRadius(radius),
    `${formatWon(filters.budget)} 안팎`,
    filters.categories.length === 0
      ? '음식 전체'
      : filters.categories.map((c) => CATEGORY_LABEL[c]).join('·'),
  ].join(' · ');

  return (
    <Screen>
      <AppBar
        title="친구들과 결정하기"
        left={
          <IconButton label="뒤로" onClick={() => navigate('/')}>
            ‹
          </IconButton>
        }
      />

      <div className="pad-x flex-1 space-y-7 pb-[120px] pt-3">
        <section>
          <h2 className="mb-2.5 text-h3 text-ink-900">친구들이 뭐라고 부르나요?</h2>
          <TextField
            value={nickname}
            onChange={(event) => {
              setNickname(event.target.value);
              setError(null);
            }}
            placeholder="닉네임"
            maxLength={10}
            autoComplete="off"
            error={error}
            trailing={`${nickname.length}/10`}
          />
        </section>

        <section>
          <h2 className="mb-2.5 text-h3 text-ink-900">어디서 만나요?</h2>
          <button
            type="button"
            onClick={() => setLocationOpen(true)}
            className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left active:scale-[0.99] ${
              location ? 'border-line bg-surface' : 'border-dashed border-primary-200 bg-primary-50'
            }`}
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink-100 text-[18px]">
              📍
            </span>
            <span className="min-w-0 flex-1">
              <span
                className={`block truncate text-h3 ${location ? 'text-ink-900' : 'text-primary-700'}`}
              >
                {location ? location.name : '위치 정하기'}
              </span>
              <span className="mt-0.5 block text-sm text-muted">
                {location ? `이 주변 ${formatRadius(radius)}` : '현재 위치 또는 장소 검색'}
              </span>
            </span>
            <span className="shrink-0 text-[18px] text-ink-300" aria-hidden>
              ›
            </span>
          </button>
        </section>

        <section>
          <h2 className="mb-2.5 text-h3 text-ink-900">몇 명이서?</h2>
          <Segmented
            label="최대 인원"
            value={maxPlayers}
            onChange={setMaxPlayers}
            options={[2, 3, 4, 5, 6, 7, 8].map((n) => ({ value: n, label: `${n}` }))}
          />
        </section>

        <button
          type="button"
          onClick={() => setConditionOpen(true)}
          className="flex w-full items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4 text-left active:bg-ink-50"
        >
          <span className="min-w-0">
            <span className="block text-sm font-bold text-ink-400">먹을 조건</span>
            <span className="mt-0.5 block truncate text-body font-semibold text-ink-900">
              {conditionSummary}
            </span>
          </span>
          <span className="shrink-0 text-sm font-bold text-primary">바꾸기</span>
        </button>
      </div>

      <div className="action-bar bg-gradient-to-t from-paper via-paper to-transparent pt-6">
        <Button block onClick={submit} loading={submitting}>
          방 만들고 친구 부르기
        </Button>
      </div>

      <LocationSheet
        open={locationOpen}
        onClose={() => setLocationOpen(false)}
        onSelect={setLocationValue}
        radius={radius}
        current={location}
      />

      <Sheet open={conditionOpen} onClose={() => setConditionOpen(false)} title="먹을 조건">
        <div className="max-h-[62vh] overflow-y-auto no-scrollbar pb-2">
          <ConditionFields
            radius={radius}
            filters={filters}
            onRadiusChange={setRadius}
            onFiltersChange={setFilters}
            showAdvanced
          />
        </div>
        <Button block className="mt-4" onClick={() => setConditionOpen(false)}>
          완료
        </Button>
      </Sheet>
    </Screen>
  );
}
