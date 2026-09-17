import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { MapPicker } from '@/components/MapPicker';
import { isMapAvailable } from '@/lib/kakaoMap';
import { detectEntry, escapeHint, SOURCE_LABEL } from '@/lib/entry';
import { Sheet } from '@/components/ui/Sheet';
import { TextField } from '@/components/ui/TextField';
import { getPlaceRepository, type PlaceSearchResult } from '@/data/places';
import { useGeolocation } from '@/hooks/useGeolocation';
import type { PlaceLocation } from '@/types/restaurant';

interface LocationSheetProps {
  open: boolean;
  onClose: () => void;
  onSelect: (location: PlaceLocation) => void;
  /** 지도에 함께 그려줄 검색 반경 */
  radius: number;
  /** 지도를 열었을 때 처음 보여줄 위치 */
  current?: PlaceLocation | null;
}

/**
 * 위치 선택 시트.
 * 브라우저 권한 팝업을 갑자기 띄우지 않고, 왜 필요한지 먼저 알려준 뒤 요청한다.
 */
export function LocationSheet({
  open,
  onClose,
  onSelect,
  radius,
  current,
}: LocationSheetProps) {
  const [keyword, setKeyword] = useState('');
  const [mapOpen, setMapOpen] = useState(false);
  const [results, setResults] = useState<PlaceSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const geo = useGeolocation();
  const entry = useMemo(() => detectEntry(), []);
  const repository = useMemo(() => getPlaceRepository(), []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setSearching(true);

    const timer = window.setTimeout(async () => {
      const [campuses, places] = await Promise.all([
        repository.searchCampuses(keyword),
        keyword.trim() ? repository.searchPlaces(keyword) : Promise.resolve([]),
      ]);
      if (cancelled) return;

      const merged = [...places, ...campuses];
      const seen = new Set<string>();
      setResults(
        merged
          .filter((place) => {
            const key = `${place.name}:${place.latitude}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          })
          .slice(0, 10),
      );
      setSearching(false);
    }, 160);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, keyword, repository]);

  const pick = (location: PlaceLocation) => {
    onSelect(location);
    onClose();
  };

  const useCurrent = async () => {
    const location = await geo.request();
    if (location) pick(location);
  };

  return (
    <Sheet open={open} onClose={onClose} title="어디서 먹을까요?">
      {/* 권한을 요청하기 전에 이유를 먼저 말한다 */}
      <button
        type="button"
        onClick={useCurrent}
        disabled={geo.loading}
        className="flex w-full items-center gap-3 rounded-xl border border-primary-100 bg-primary-50 p-4 text-left active:bg-primary-100 disabled:opacity-60"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-[19px]">
          📍
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-h3 text-primary-700">
            {geo.loading ? '위치 확인 중…' : '현재 위치 사용'}
          </span>
          <span className="mt-0.5 block text-sm text-primary-700/70">
            지금 있는 곳 주변에서 찾아요
          </span>
        </span>
      </button>

      {/* 지도 키가 없으면 이 줄은 나타나지 않는다 — 눌러도 안 되는 버튼을 두지 않는다 */}
      {isMapAvailable() && (
        <button
          type="button"
          onClick={() => setMapOpen(true)}
          className="mt-2 flex w-full items-center gap-3 rounded-xl border border-line bg-surface p-4 text-left active:bg-ink-50"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink-100 text-[19px]">
            🗺️
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-h3 text-ink-900">지도에서 고르기</span>
            <span className="mt-0.5 block text-sm text-muted">
              핀을 옮겨 원하는 지점으로
            </span>
          </span>
          <span aria-hidden className="shrink-0 text-ink-300">
            ›
          </span>
        </button>
      )}

      {geo.error && (
        <div className="mt-3 rounded-lg bg-danger/8 p-3.5">
          <p className="text-sm font-semibold text-danger">{geo.error}</p>
          {/*
            앱 안 브라우저(인스타·카톡)에서는 권한을 눌러도 위치가 조용히 막히는 일이 잦다.
            여기서 "설정을 확인하세요"라고만 하면 확인할 설정이 없어 막다른 길이 된다.
            원인과 빠져나가는 방법을 같이 말해준다.
          */}
          {entry.inApp ? (
            <p className="mt-1 text-sm leading-relaxed text-ink-700">
              {SOURCE_LABEL[entry.source] || '이 앱'} 안에서는 위치를 못 가져올 때가 많아요.
              <br />
              {escapeHint(entry)}
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted">아래에서 장소를 검색해 주세요.</p>
          )}
        </div>
      )}

      <div className="mt-4">
        <TextField
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="학교나 장소 검색 (예: 충북대 중문)"
          aria-label="장소 검색"
          autoComplete="off"
        />
      </div>

      <div className="mt-2 max-h-[38vh] overflow-y-auto no-scrollbar">
        {searching && results.length === 0 && (
          <p className="px-1 py-4 text-body text-muted">찾는 중…</p>
        )}
        {!searching && results.length === 0 && (
          <p className="px-1 py-4 text-body text-muted">
            검색 결과가 없어요. 다른 이름으로 찾아보세요.
          </p>
        )}
        {results.map((place) => (
          <button
            key={place.id}
            type="button"
            onClick={() => pick(place)}
            className="flex w-full items-center gap-3 rounded-lg px-1 py-3.5 text-left active:bg-ink-50"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink-100 text-[15px]">
              {place.source === 'campus' ? '🏫' : '📌'}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-body font-bold text-ink-900">
                {place.name}
              </span>
              {place.subtitle && (
                <span className="block truncate text-sm text-muted">{place.subtitle}</span>
              )}
            </span>
          </button>
        ))}
      </div>

      <Button variant="ghost" size="md" block className="mt-2" onClick={onClose}>
        닫기
      </Button>

      <MapPicker
        open={mapOpen}
        onClose={() => setMapOpen(false)}
        onSelect={pick}
        initial={current}
        radius={radius}
      />
    </Sheet>
  );
}
