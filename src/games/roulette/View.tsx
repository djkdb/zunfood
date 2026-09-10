import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { TIMING } from '@/config/app';
import { Button } from '@/components/ui/Button';
import { Countdown } from '@/components/ui/Countdown';
import { RestaurantCard } from '@/components/RestaurantCard';
import { CATEGORY_EMOJI } from '@/types/restaurant';
import type { GameViewProps } from '@/types/game';
import { findRestaurant, resolveAll } from '../shared';
import type { RouletteState } from './logic';

const SEGMENT_COLORS = [
  '#2196f3', '#ffc21e', '#28d9a3', '#ff5d6c',
  '#8b5cf6', '#4bb3ff', '#f58200', '#0d5eb0',
];

export function RouletteView({ state, ctx, isHost, dispatch }: GameViewProps<RouletteState>) {
  const options = useMemo(
    () => resolveAll(ctx.candidates, state.optionIds),
    [ctx.candidates, state.optionIds],
  );
  const winner = findRestaurant(ctx.candidates, state.optionIds[state.winnerIndex] ?? null);
  const segmentAngle = 360 / Math.max(1, options.length);

  // 당첨 칸이 위쪽 포인터에 오도록 최종 각도를 계산한다.
  const targetRotation =
    360 * 6 - (state.winnerIndex * segmentAngle + segmentAngle / 2);

  const spinning = state.phase === 'spinning';
  const settled = state.phase === 'result' || state.phase === 'done';
  const elapsed = Date.now() - state.phaseStartedAt;
  const spinDuration = Math.max(0.4, (TIMING.rouletteSpinMs - elapsed) / 1000);

  if (state.phase === 'countdown') {
    return <Countdown startedAt={state.phaseStartedAt} durationMs={TIMING.countdownMs} label="룰렛 돌아갑니다" />;
  }

  return (
    <div className="flex flex-col items-center gap-6 py-2">
      <div className="relative h-[300px] w-[300px] max-w-full">
        {/* 포인터 */}
        <div className="absolute left-1/2 top-[-6px] z-20 -translate-x-1/2">
          <div className="h-0 w-0 border-x-[14px] border-t-[26px] border-x-transparent border-t-pop-400 drop-shadow-lg" />
        </div>

        <motion.div
          className="absolute inset-0 rounded-full border-[6px] border-white/15 shadow-glow"
          style={{ background: buildConicGradient(options.length) }}
          initial={{ rotate: spinning || settled ? 0 : 0 }}
          animate={{ rotate: spinning || settled ? targetRotation : 0 }}
          transition={
            spinning
              ? { duration: spinDuration, ease: [0.12, 0.72, 0.18, 1] }
              : { duration: 0 }
          }
        >
          {options.map((restaurant, index) => {
            // 라벨이 뒤집혀 보이지 않도록 왼쪽 절반(90°~270°)은 180° 돌려서 그린다.
            // 판단 기준은 "회전이 끝난 뒤의 각도" — 그래야 멈춘 상태에서 모두 바로 읽힌다.
            const angle = index * segmentAngle + segmentAngle / 2 - 90;
            const resting = angle + (spinning || settled ? targetRotation : 0);
            const normalized = Math.round(((resting % 360) + 360) % 360);
            // 정확히 90°/270° 인 라벨은 세로가 되는데, 둘 다 "위→아래"로 읽히게 맞춘다.
            const flipped = normalized > 90 && normalized <= 270;

            return (
              <div
                key={restaurant.id}
                className="absolute left-1/2 top-1/2 -ml-[52px] -mt-3 flex h-6 w-[104px] items-center justify-center"
                style={{ transform: `rotate(${angle}deg) translateX(94px)` }}
              >
                <span
                  className="block w-full truncate px-1 text-center text-[12px] font-black leading-tight text-navy-950"
                  style={{ transform: flipped ? 'rotate(180deg)' : undefined }}
                >
                  {CATEGORY_EMOJI[restaurant.category]} {restaurant.name}
                </span>
              </div>
            );
          })}
        </motion.div>

        {/* 중앙 허브 */}
        <div className="absolute left-1/2 top-1/2 z-10 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-white/20 bg-navy-950 text-[26px]">
          🎰
        </div>
      </div>

      {state.phase === 'ready' && (
        <div className="w-full space-y-3 text-center">
          <p className="text-[15px] font-bold text-white/60">
            후보 {options.length}곳이 룰렛에 올랐어요
          </p>
          {isHost ? (
            <Button variant="pop" block onClick={() => dispatch('spin')}>
              룰렛 돌리기
            </Button>
          ) : (
            <p className="text-[14px] font-bold text-white/45">방장이 룰렛을 돌리는 중…</p>
          )}
        </div>
      )}

      {spinning && (
        <p className="animate-pulse text-[18px] font-black tracking-widest text-pop-300">
          두구두구두구…
        </p>
      )}

      {settled && winner && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 18 }}
          className="w-full space-y-3 text-center"
        >
          <p className="text-[20px] font-black text-pop-300">🏆 오늘은 여기!</p>
          <RestaurantCard restaurant={winner} />
        </motion.div>
      )}
    </div>
  );
}

function buildConicGradient(count: number): string {
  const step = 100 / Math.max(1, count);
  const stops = Array.from({ length: count }, (_, index) => {
    const color = SEGMENT_COLORS[index % SEGMENT_COLORS.length];
    return `${color} ${index * step}% ${(index + 1) * step}%`;
  });
  return `conic-gradient(${stops.join(', ')})`;
}
