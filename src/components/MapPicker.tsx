import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { formatRadius } from '@/lib/format';
import {
  coordToAddress,
  KakaoMapError,
  KAKAO_MAP_ERROR,
  loadKakaoMaps,
  shortPlaceName,
  type KakaoCircle,
  type KakaoMap,
  type KakaoMaps,
} from '@/lib/kakaoMap';
import { useGeolocation } from '@/hooks/useGeolocation';
import type { PlaceLocation } from '@/types/restaurant';

interface MapPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (location: PlaceLocation) => void;
  /** 처음 보여줄 중심 */
  initial?: { latitude: number; longitude: number } | null;
  /** 지도에 그려줄 검색 반경 */
  radius: number;
}

/** 서울시청 — 아무 정보도 없을 때의 시작점 */
const FALLBACK = { latitude: 37.5665, longitude: 126.978 };

/** 반경에 맞춘 지도 확대 수준 (작을수록 확대) */
function levelFor(radius: number): number {
  if (radius <= 300) return 4;
  if (radius <= 500) return 5;
  if (radius <= 1000) return 6;
  return 7;
}

/**
 * 지도에서 위치 고르기.
 *
 * 핀을 화면 가운데 고정하고 지도를 움직이게 한다. 모바일에서 작은 핀을 정확히
 * 짚는 것보다 훨씬 쉽고, 손가락에 가려지지도 않는다.
 * 검색 반경을 원으로 같이 그려서 "얼마나 넓게 볼지" 가 눈에 보이게 한다.
 */
export function MapPicker({ open, onClose, onSelect, initial, radius }: MapPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<KakaoMap | null>(null);
  const circleRef = useRef<KakaoCircle | null>(null);
  const mapsRef = useRef<KakaoMaps | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [address, setAddress] = useState('');
  const [busy, setBusy] = useState(true);
  const geo = useGeolocation();

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    setBusy(true);
    setError(null);

    void loadKakaoMaps()
      .then((maps) => {
        if (cancelled || !containerRef.current) return;
        mapsRef.current = maps;

        const start = initial ?? FALLBACK;
        const center = new maps.LatLng(start.latitude, start.longitude);
        const map = new maps.Map(containerRef.current, {
          center,
          level: levelFor(radius),
        });
        mapRef.current = map;

        const circle = new maps.Circle({
          center,
          radius,
          strokeWeight: 2,
          strokeColor: '#2F6BFF',
          strokeOpacity: 0.7,
          fillColor: '#2F6BFF',
          fillOpacity: 0.08,
        });
        circle.setMap(map);
        circleRef.current = circle;

        const sync = () => {
          const point = map.getCenter();
          circle.setPosition(point);
          void coordToAddress(maps, point.getLat(), point.getLng()).then((found) => {
            if (!cancelled) setAddress(found);
          });
        };

        maps.event.addListener(map, 'idle', sync);
        sync();
        setBusy(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setBusy(false);
        setError(
          err instanceof KakaoMapError ? err.message : KAKAO_MAP_ERROR.blocked,
        );
      });

    return () => {
      cancelled = true;
      circleRef.current?.setMap(null);
      circleRef.current = null;
      mapRef.current = null;
    };
    // 반경이 바뀌면 지도를 다시 그린다
  }, [open, radius, initial]);

  const recenter = async () => {
    const here = await geo.request();
    const maps = mapsRef.current;
    if (!here || !maps || !mapRef.current) return;
    mapRef.current.setCenter(new maps.LatLng(here.latitude, here.longitude));
  };

  const confirm = () => {
    const map = mapRef.current;
    if (!map) return;
    const point = map.getCenter();
    onSelect({
      latitude: point.getLat(),
      longitude: point.getLng(),
      name: address ? shortPlaceName(address) : '지도에서 고른 위치',
      address: address || undefined,
      source: 'map',
    });
    onClose();
  };

  if (!open) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-sheet flex flex-col bg-paper"
      role="dialog"
      aria-modal="true"
      aria-label="지도에서 위치 고르기"
    >
      <div className="safe-top flex items-center gap-2 px-3 pb-2 pt-3">
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="flex h-10 w-10 items-center justify-center rounded-full text-h3 text-ink-500 active:bg-ink-100"
        >
          ✕
        </button>
        <h2 className="text-h3 text-ink-900">지도에서 위치 고르기</h2>
      </div>

      <div className="relative flex-1 bg-ink-100">
        <div ref={containerRef} className="h-full w-full" />

        {/* 핀은 화면 가운데 고정 — 지도를 움직여서 맞춘다 */}
        {!error && (
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full text-[34px] drop-shadow-md"
          >
            📍
          </div>
        )}

        {busy && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-paper/70">
            <p className="text-body font-bold text-muted">지도를 불러오는 중…</p>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
            <span className="text-[40px]" aria-hidden>
              🗺️
            </span>
            <p className="text-body font-semibold text-ink-700">{error}</p>
            <Button variant="secondary" size="md" onClick={onClose}>
              검색으로 정하기
            </Button>
          </div>
        )}

        {!error && (
          <button
            type="button"
            onClick={recenter}
            disabled={geo.loading}
            aria-label="현재 위치로 이동"
            className="absolute bottom-4 right-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface text-[19px] shadow-lg active:bg-ink-100 disabled:opacity-60"
          >
            {geo.loading ? '…' : '📍'}
          </button>
        )}
      </div>

      {!error && (
        <div className="pad-x pad-bottom border-t border-line bg-surface pt-4">
          <p className="truncate text-h3 text-ink-900">
            {address || '지도를 움직여 위치를 맞춰주세요'}
          </p>
          <p className="mt-1 text-sm text-muted">
            이 지점에서 반경 {formatRadius(radius)} 안을 찾아요
          </p>
          <Button block className="mt-4" onClick={confirm} disabled={busy}>
            이 위치로 정하기
          </Button>
        </div>
      )}
    </motion.div>
  );
}
