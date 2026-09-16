import { Component, lazy, Suspense, useCallback, useMemo, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { TIMING } from '@/config/app';
import { Button } from '@/components/ui/Button';
import { Countdown } from '@/components/ui/Countdown';
import { RestaurantCard } from '@/components/RestaurantCard';
import { CATEGORY_EMOJI, type Restaurant } from '@/types/restaurant';
import type { GameViewProps } from '@/types/game';
import { findRestaurant, resolveAll } from '../shared';
import { SEGMENT_COLORS } from './wheelFace';
import type { RouletteState } from './logic';

/** three.js 는 룰렛을 실제로 볼 때만 받는다 — 다른 게임은 값을 치르지 않는다 */
const Wheel3D = lazy(() => import('./Wheel3D'));

/** 애니메이션을 줄이기로 한 사람에게 3D 를 들이밀지 않는다 */
function prefers3D(): boolean {
  if (typeof window === 'undefined') return false;
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function RouletteView({ state, ctx, isHost, dispatch }: GameViewProps<RouletteState>) {
  const [use3D, setUse3D] = useState(prefers3D);
  const fallbackTo2D = useCallback(() => setUse3D(false), []);

  const options = useMemo(
    () => resolveAll(ctx.candidates, state.optionIds),
    [ctx.candidates, state.optionIds],
  );
  const winner = findRestaurant(ctx.candidates, state.optionIds[state.winnerIndex] ?? null);

  const spinning = state.phase === 'spinning';
  const settled = state.phase === 'result' || state.phase === 'done';

  if (state.phase === 'countdown') {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Countdown startedAt={state.phaseStartedAt} durationMs={TIMING.countdownMs} />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8">
      <div className="relative h-[300px] w-[300px] max-w-full shrink-0">
        {use3D ? (
          // 3D 가 안 되는 기기·차단된 청크에서도 룰렛은 돌아가야 한다
          <WheelFallback onFail={fallbackTo2D}>
            <Suspense fallback={<WheelSkeleton />}>
              <Wheel3D
                options={options}
                winnerIndex={state.winnerIndex}
                startedAt={spinning || settled ? state.phaseStartedAt : null}
                durationMs={TIMING.rouletteSpinMs}
                settled={settled}
                onUnavailable={fallbackTo2D}
              />
            </Suspense>
          </WheelFallback>
        ) : (
          <Wheel2D
            options={options}
            winnerIndex={state.winnerIndex}
            phaseStartedAt={state.phaseStartedAt}
            spinning={spinning}
            settled={settled}
          />
        )}
      </div>

      {state.phase === 'ready' && (
        <div className="w-full space-y-4 text-center">
          <p className="text-body text-white/45">주변 {options.length}곳이 올라갔어요</p>
          {isHost ? (
            <Button surface="dark" variant="accent" block onClick={() => dispatch('spin')}>
              룰렛 돌리기
            </Button>
          ) : (
            <p className="text-body font-bold text-white/40">방장이 돌리기를 기다리는 중…</p>
          )}
        </div>
      )}

      {spinning && (
        <p className="animate-pulse text-h2 tracking-[0.2em] text-accent">두구두구두구</p>
      )}

      {settled && winner && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 280, damping: 22 }}
          className="w-full space-y-3 text-center"
        >
          <p className="text-h2 text-accent">여기로 정해졌어요</p>
          <RestaurantCard restaurant={winner} surface="dark" />
        </motion.div>
      )}
    </div>
  );
}

function WheelSkeleton() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="h-[260px] w-[260px] animate-pulse rounded-full bg-white/8" />
    </div>
  );
}

/**
 * 3D 가 실패해도 게임은 계속되어야 한다.
 *
 * WebGL 이 없는 기기, 청크를 못 받은 네트워크, three.js 내부 오류 — 어느 쪽이든
 * 룰렛이 안 돌면 방 전체가 멈춘다. 잡아서 2D 로 내려보낸다.
 */
class WheelFallback extends Component<{ onFail: () => void; children: ReactNode }> {
  componentDidCatch(error: unknown) {
    console.warn('[MEALGAME] 3D 룰렛을 쓸 수 없어 2D 로 대체합니다', error);
    this.props.onFail();
  }

  render() {
    return this.props.children;
  }
}

/** 예비용 2D 룰렛 — CSS 만으로 돈다 */
function Wheel2D({
  options,
  winnerIndex,
  phaseStartedAt,
  spinning,
  settled,
}: {
  options: Restaurant[];
  winnerIndex: number;
  phaseStartedAt: number;
  spinning: boolean;
  settled: boolean;
}) {
  const segmentAngle = 360 / Math.max(1, options.length);
  const targetRotation = 360 * 6 - (winnerIndex * segmentAngle + segmentAngle / 2);
  const elapsed = Date.now() - phaseStartedAt;
  const spinDuration = Math.max(0.4, (TIMING.rouletteSpinMs - elapsed) / 1000);

  return (
    <>
      <div className="absolute left-1/2 top-[-4px] z-20 -translate-x-1/2">
        <div className="h-0 w-0 border-x-[12px] border-t-[22px] border-x-transparent border-t-white drop-shadow" />
      </div>

      <motion.div
        className="absolute inset-0 rounded-full ring-[6px] ring-white/10"
        style={{ background: buildConicGradient(options.length) }}
        initial={{ rotate: 0 }}
        animate={{ rotate: spinning || settled ? targetRotation : 0 }}
        transition={
          spinning ? { duration: spinDuration, ease: [0.12, 0.72, 0.18, 1] } : { duration: 0 }
        }
      >
        {options.map((restaurant, index) => {
          // 회전이 끝난 뒤의 각도를 기준으로 뒤집어, 멈췄을 때 모두 바로 읽히게 한다
          const angle = index * segmentAngle + segmentAngle / 2 - 90;
          const resting = angle + (spinning || settled ? targetRotation : 0);
          const normalized = Math.round(((resting % 360) + 360) % 360);
          const flipped = normalized > 90 && normalized <= 270;

          return (
            <div
              key={restaurant.id}
              className="absolute left-1/2 top-1/2 -ml-[52px] -mt-3 flex h-6 w-[104px] items-center justify-center"
              style={{ transform: `rotate(${angle}deg) translateX(94px)` }}
            >
              <span
                className="block w-full truncate px-1 text-center text-[12px] font-extrabold text-white"
                style={{ transform: flipped ? 'rotate(180deg)' : undefined }}
              >
                {CATEGORY_EMOJI[restaurant.category]} {restaurant.name}
              </span>
            </div>
          );
        })}
      </motion.div>

      <div className="absolute left-1/2 top-1/2 z-10 flex h-[76px] w-[76px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-arena text-[28px] ring-4 ring-white/10">
        🎰
      </div>
    </>
  );
}

function buildConicGradient(count: number): string {
  const step = 100 / Math.max(1, count);
  return `conic-gradient(${Array.from({ length: count }, (_, i) => {
    const color = SEGMENT_COLORS[i % SEGMENT_COLORS.length];
    return `${color} ${i * step}% ${(i + 1) * step}%`;
  }).join(', ')})`;
}
