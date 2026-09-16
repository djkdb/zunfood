import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button, IconButton } from '@/components/ui/Button';
import { AppBar, Screen } from '@/components/ui/Screen';
import { ConditionFields } from '@/components/ConditionFields';
import { LocationSheet } from '@/components/LocationSheet';
import { formatRadius } from '@/lib/format';
import { SOLO_METHODS, type SoloMethod, type SoloMethodMeta } from '@/solo/methods';
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

        {/* 결정 방식 — 직접 고르는 쪽과 맡기는 쪽을 나눠 보여준다.
            섞어두면 "어차피 다 랜덤" 으로 보인다. */}
        <section className="space-y-5">
          <MethodGroup
            title="직접 골라서 정하기"
            hint="내가 고른 결과"
            methods={SOLO_METHODS.filter((m) => m.kind === 'play')}
            selected={method}
            onSelect={setMethod}
          />
          <MethodGroup
            title="맡기고 바로 받기"
            hint="누르면 끝"
            methods={SOLO_METHODS.filter((m) => m.kind === 'instant')}
            selected={method}
            onSelect={setMethod}
          />
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

function MethodGroup({
  title,
  hint,
  methods,
  selected,
  onSelect,
}: {
  title: string;
  hint: string;
  methods: SoloMethodMeta[];
  selected: SoloMethod;
  onSelect: (id: SoloMethod) => void;
}) {
  return (
    <div>
      <div className="mb-2.5 flex items-baseline gap-2">
        <h2 className="text-h3 text-ink-900">{title}</h2>
        <span className="text-sm text-muted">{hint}</span>
      </div>
      <div className="bleed-x flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {methods.map((item) => {
          const active = item.id === selected;
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(item.id)}
              className={`w-[132px] shrink-0 rounded-xl border p-3.5 text-left transition-all active:scale-[0.97] ${
                active ? 'border-primary bg-primary-50' : 'border-line bg-surface active:bg-ink-50'
              }`}
            >
              <span className="block text-[22px]" aria-hidden>
                {item.emoji}
              </span>
              <span
                className={`mt-2 block text-[15px] font-bold ${
                  active ? 'text-primary-700' : 'text-ink-900'
                }`}
              >
                {item.title}
              </span>
              <span className="mt-0.5 block text-xs leading-snug text-muted">{item.blurb}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
