import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { TextField } from '@/components/ui/TextField';
import { getPlaceRepository, type PlaceSearchResult } from '@/data/places';
import { useGeolocation } from '@/hooks/useGeolocation';
import type { PlaceLocation } from '@/types/restaurant';

type Mode = 'current' | 'campus' | 'search';

interface LocationPickerProps {
  value: PlaceLocation | null;
  onChange: (location: PlaceLocation) => void;
}

const MODE_LABEL: Record<Mode, string> = {
  current: '📍 현재 위치',
  campus: '🏫 학교 선택',
  search: '🔎 장소 검색',
};

/**
 * 위치 설정 — 현재 위치 / 학교 선택 / 직접 검색 세 가지 방식.
 * 좌표는 항상 데이터 계층(Geolocation API, PlaceRepository)에서만 가져온다.
 */
export function LocationPicker({ value, onChange }: LocationPickerProps) {
  const [mode, setMode] = useState<Mode>(value?.source === 'current' ? 'current' : 'campus');
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<PlaceSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const geo = useGeolocation();
  const repository = useMemo(() => getPlaceRepository(), []);

  useEffect(() => {
    if (mode === 'current') return;
    let cancelled = false;
    setSearching(true);

    const timer = window.setTimeout(async () => {
      const found =
        mode === 'campus'
          ? await repository.searchCampuses(keyword)
          : await repository.searchPlaces(keyword);
      if (!cancelled) {
        setResults(found);
        setSearching(false);
      }
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [mode, keyword, repository]);

  const useCurrent = async () => {
    const location = await geo.request();
    if (location) onChange(location);
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {(Object.keys(MODE_LABEL) as Mode[]).map((m) => (
          <Chip
            key={m}
            selected={mode === m}
            onClick={() => {
              setMode(m);
              setKeyword('');
            }}
            className="!px-2 text-[13px]"
          >
            {MODE_LABEL[m]}
          </Chip>
        ))}
      </div>

      {mode === 'current' ? (
        <div className="space-y-2">
          <Button variant="ghost" size="md" block onClick={useCurrent} loading={geo.loading}>
            현재 위치 사용하기
          </Button>
          {geo.error && (
            <p className="text-[13px] font-semibold leading-snug text-coral">{geo.error}</p>
          )}
        </div>
      ) : (
        <>
          <TextField
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder={mode === 'campus' ? '학교 이름 (예: 충북대)' : '장소 (예: 충북대 중문)'}
            aria-label={mode === 'campus' ? '학교 검색' : '장소 검색'}
          />
          <div className="max-h-56 space-y-1.5 overflow-y-auto no-scrollbar">
            {searching && <p className="px-1 py-2 text-[13px] text-white/40">찾는 중…</p>}
            {!searching && results.length === 0 && (
              <p className="px-1 py-2 text-[13px] leading-snug text-white/40">
                {mode === 'campus'
                  ? '검색 결과가 없어요. 다른 이름으로 찾아보세요.'
                  : '학교 이름으로 먼저 검색해 보세요. (예: 충북대 중문)'}
              </p>
            )}
            {results.map((place) => {
              const selected =
                value?.name === place.name &&
                value?.latitude === place.latitude &&
                value?.longitude === place.longitude;
              return (
                <button
                  key={place.id}
                  type="button"
                  onClick={() => onChange(place)}
                  className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition-colors ${
                    selected
                      ? 'border-brand-400 bg-brand-500/20'
                      : 'border-white/10 bg-white/[0.04] active:bg-white/10'
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-bold">{place.name}</span>
                    {place.subtitle && (
                      <span className="block truncate text-[12px] text-white/45">
                        {place.subtitle}
                      </span>
                    )}
                  </span>
                  {selected && <span className="shrink-0 text-brand-200">✓</span>}
                </button>
              );
            })}
          </div>
        </>
      )}

      {value && (
        <div className="rounded-2xl border border-brand-400/30 bg-brand-500/10 px-4 py-3">
          <p className="text-[12px] font-bold text-brand-200">선택된 위치</p>
          <p className="mt-0.5 text-[15px] font-bold">{value.name}</p>
        </div>
      )}
    </div>
  );
}
