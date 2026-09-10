import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button, IconButton } from '@/components/ui/Button';
import { AppBar, Screen } from '@/components/ui/Screen';
import { ConditionFields } from '@/components/ConditionFields';
import { LocationSheet } from '@/components/LocationSheet';
import { formatRadius } from '@/lib/format';
import { SOLO_METHODS } from '@/solo/methods';
import { useSoloStore } from '@/store/soloStore';

export function SoloSetupScreen() {
  const navigate = useNavigate();
  const [locationOpen, setLocationOpen] = useState(false);
  const [advanced, setAdvanced] = useState(false);

  const location = useSoloStore((s) => s.location);
  const radius = useSoloStore((s) => s.radius);
  const filters = useSoloStore((s) => s.filters);
  const method = useSoloStore((s) => s.method);
  const setLocation = useSoloStore((s) => s.setLocation);
  const setRadius = useSoloStore((s) => s.setRadius);
  const setFilters = useSoloStore((s) => s.setFilters);
  const setMethod = useSoloStore((s) => s.setMethod);

  return (
    <Screen>
      <AppBar
        title="혼자 결정하기"
        left={
          <IconButton label="뒤로" onClick={() => navigate('/')}>
            ‹
          </IconButton>
        }
      />

      <div className="pad-x flex-1 space-y-7 pb-[120px] pt-2">
        {/* 위치 — 가장 먼저, 가장 크게 */}
        <section>
          <h2 className="mb-2.5 text-h3 text-ink-900">어디서 먹어요?</h2>
          <button
            type="button"
            onClick={() => setLocationOpen(true)}
            className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-colors active:scale-[0.99] ${
              location
                ? 'border-line bg-surface'
                : 'border-dashed border-primary-200 bg-primary-50'
            }`}
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink-100 text-[18px]">
              📍
            </span>
            <span className="min-w-0 flex-1">
              {location ? (
                <>
                  <span className="block truncate text-h3 text-ink-900">{location.name}</span>
                  <span className="mt-0.5 block text-sm text-muted">
                    이 주변 {formatRadius(radius)}
                  </span>
                </>
              ) : (
                <>
                  <span className="block text-h3 text-primary-700">위치 정하기</span>
                  <span className="mt-0.5 block text-sm text-primary-700/70">
                    현재 위치 또는 장소 검색
                  </span>
                </>
              )}
            </span>
            <span className="shrink-0 text-[18px] text-ink-300" aria-hidden>
              ›
            </span>
          </button>
        </section>

        <ConditionFields
          radius={radius}
          filters={filters}
          onRadiusChange={setRadius}
          onFiltersChange={setFilters}
          showAdvanced={advanced}
        />

        {!advanced && (
          <button
            type="button"
            onClick={() => setAdvanced(true)}
            className="h-11 w-full rounded-lg border border-line bg-surface text-sm font-bold text-ink-600 active:bg-ink-50"
          >
            빼고 싶은 음식 고르기
          </button>
        )}

        {/* 결정 방식 */}
        <section>
          <h2 className="mb-2.5 text-h3 text-ink-900">어떻게 정할까요?</h2>
          <div className="bleed-x flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {SOLO_METHODS.map((item) => {
              const selected = item.id === method;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setMethod(item.id)}
                  className={`w-[132px] shrink-0 rounded-xl border p-3.5 text-left transition-all active:scale-[0.97] ${
                    selected
                      ? 'border-primary bg-primary-50'
                      : 'border-line bg-surface active:bg-ink-50'
                  }`}
                >
                  <span className="block text-[22px]" aria-hidden>
                    {item.emoji}
                  </span>
                  <span
                    className={`mt-2 block text-[15px] font-bold ${
                      selected ? 'text-primary-700' : 'text-ink-900'
                    }`}
                  >
                    {item.title}
                  </span>
                  <span className="mt-0.5 block text-xs leading-snug text-muted">
                    {item.blurb}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      <div className="action-bar bg-gradient-to-t from-paper via-paper to-transparent pt-6">
        <motion.div initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
          <Button
            variant="accent"
            block
            disabled={!location}
            onClick={() => navigate('/solo/result')}
          >
            {location ? '오늘 뭐 먹지?' : '위치를 먼저 정해주세요'}
          </Button>
        </motion.div>
      </div>

      <LocationSheet
        open={locationOpen}
        onClose={() => setLocationOpen(false)}
        onSelect={setLocation}
      />
    </Screen>
  );
}
