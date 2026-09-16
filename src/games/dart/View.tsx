import { Component, lazy, Suspense, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { TIMING } from '@/config/app';
import { Countdown } from '@/components/ui/Countdown';
import { PlayerAvatar } from '@/components/ui/PlayerAvatar';
import { RestaurantCard } from '@/components/RestaurantCard';
import { CATEGORY_EMOJI, type Restaurant } from '@/types/restaurant';
import type { GameViewProps } from '@/types/game';
import { findRestaurant, resolveAll } from '../shared';
import { SEGMENT_COLORS } from '../roulette/wheelFace';
import {
  ACCURATE_ENOUGH,
  accuracyFrom,
  aimedIndex,
  gaugeAt,
  ROTATION_MS,
  type DartState,
} from './logic';

const DartBoard3D = lazy(() => import('./DartBoard3D'));

function prefers3D(): boolean {
  if (typeof window === 'undefined') return false;
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function DartView({ state, ctx, me, dispatch }: GameViewProps<DartState>) {
  const [use3D, setUse3D] = useState(prefers3D);
  const fallbackTo2D = useCallback(() => setUse3D(false), []);

  const options = useMemo(
    () => resolveAll(ctx.candidates, state.optionIds),
    [ctx.candidates, state.optionIds],
  );
  const thrown = state.thrownPlayerIds.includes(me.id);
  const myThrow = state.throws.find((t) => t.playerId === me.id) ?? null;

  if (state.phase === 'countdown') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center">
        <Countdown
          startedAt={state.phaseStartedAt}
          durationMs={TIMING.countdownMs}
          label="판이 돌기 시작해요"
        />
      </div>
    );
  }

  const winner = findRestaurant(ctx.candidates, state.winnerId);
  const revealing = state.phase === 'reveal' || state.phase === 'done';

  const release = () => {
    if (thrown) return;
    const offsetMs = Date.now() - state.phaseStartedAt;
    dispatch('throw', { offsetMs, accuracy: accuracyFrom(gaugeAt(offsetMs)) });
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4">
      <div className="relative h-[290px] w-[290px] max-w-full shrink-0">
        {use3D ? (
          <BoardBoundary onFail={fallbackTo2D}>
            <Suspense fallback={<BoardSkeleton />}>
              <DartBoard3D
                options={options}
                startedAt={state.phaseStartedAt}
                throws={state.throws}
                winnerId={state.winnerId}
                onUnavailable={fallbackTo2D}
              />
            </Suspense>
          </BoardBoundary>
        ) : (
          <Board2D options={options} startedAt={state.phaseStartedAt} />
        )}
      </div>

      {revealing ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full space-y-3 text-center"
        >
          <p className="text-h2 text-accent">
            {state.throws.length > 0 ? '가장 많이 꽂힌 곳' : '아무도 못 맞혔어요'}
          </p>
          {winner && <RestaurantCard restaurant={winner} surface="dark" />}
          <Scoreboard state={state} ctx={ctx} />
        </motion.div>
      ) : (
        <>
          <Aim state={state} options={options} />
          <Gauge startedAt={state.phaseStartedAt} />

          {thrown ? (
            <div className="w-full rounded-2xl bg-success/12 py-4 text-center">
              <p className="text-h3 text-success">
                {myThrow && myThrow.drift === 0 ? '명중!' : '빗나갔어요'}
              </p>
              <p className="mt-1 text-sm text-white/45">다른 친구들을 기다리는 중…</p>
            </div>
          ) : (
            <button
              type="button"
              onClick={release}
              className="h-[68px] w-full rounded-2xl bg-danger text-h1 text-white transition-transform active:scale-[0.98]"
            >
              🎯 던지기
            </button>
          )}

          <div className="flex items-center gap-2">
            {ctx.players.map((player) => (
              <PlayerAvatar
                key={player.id}
                avatar={player.avatar}
                size="sm"
                surface="dark"
                dim={!state.thrownPlayerIds.includes(player.id)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** 지금 크로스헤어 아래 있는 칸 — 화면과 판정이 같은 공식을 쓴다 */
function Aim({ state, options }: { state: DartState; options: Restaurant[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setIndex(aimedIndex(Date.now() - state.phaseStartedAt, Math.max(1, options.length)));
    }, 60);
    return () => window.clearInterval(id);
  }, [state.phaseStartedAt, options.length]);

  const aimed = options[index];
  return (
    <p className="h-6 truncate text-center text-body font-bold text-white/60">
      {aimed ? `${CATEGORY_EMOJI[aimed.category]} ${aimed.name}` : ''}
    </p>
  );
}

/** 파워 게이지 — 가운데(초록)에서 떼야 겨눈 칸에 꽂힌다 */
function Gauge({ startedAt }: { startedAt: number }) {
  const [value, setValue] = useState(0.5);

  useEffect(() => {
    const id = window.setInterval(() => setValue(gaugeAt(Date.now() - startedAt)), 30);
    return () => window.clearInterval(id);
  }, [startedAt]);

  const good = accuracyFrom(value) >= ACCURATE_ENOUGH;

  return (
    <div className="relative h-7 w-full overflow-hidden rounded-full bg-white/10">
      {/* 명중 구간 */}
      <div
        className="absolute inset-y-0 bg-success/30"
        style={{ left: '38.5%', width: '23%' }}
      />
      <div
        className={`absolute inset-y-1 w-2 rounded-full ${good ? 'bg-success' : 'bg-white'}`}
        style={{ left: `calc(${value * 100}% - 4px)`, transition: 'left 30ms linear' }}
      />
    </div>
  );
}

function Scoreboard({ state, ctx }: { state: DartState; ctx: GameViewProps<DartState>['ctx'] }) {
  if (state.throws.length === 0) return null;
  return (
    <ul className="space-y-1.5 text-left">
      {state.throws.map((dart) => {
        const player = ctx.players.find((p) => p.id === dart.playerId);
        const restaurant = findRestaurant(ctx.candidates, dart.optionId);
        if (!restaurant) return null;
        return (
          <li
            key={dart.playerId}
            className="flex items-center gap-2 rounded-lg bg-white/6 px-3 py-2"
          >
            <PlayerAvatar avatar={player?.avatar ?? 0} size="sm" surface="dark" />
            <span className="min-w-0 flex-1 truncate text-sm font-bold text-white/75">
              {restaurant.name}
            </span>
            <span
              className={`shrink-0 text-xs font-extrabold ${
                dart.drift === 0 ? 'text-success' : 'text-white/35'
              }`}
            >
              {dart.drift === 0 ? '명중' : `${Math.abs(dart.drift)}칸 빗나감`}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function BoardSkeleton() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="h-[230px] w-[230px] animate-pulse rounded-full bg-white/8" />
    </div>
  );
}

/** 3D 가 안 되는 기기에서도 판은 돌아야 한다 */
class BoardBoundary extends Component<{ onFail: () => void; children: ReactNode }> {
  componentDidCatch(error: unknown) {
    console.warn('[MEALGAME] 3D 다트판을 쓸 수 없어 2D 로 대체합니다', error);
    this.props.onFail();
  }

  render() {
    return this.props.children;
  }
}

function Board2D({ options, startedAt }: { options: Restaurant[]; startedAt: number }) {
  const [angle, setAngle] = useState(0);

  useEffect(() => {
    const id = window.setInterval(
      () => setAngle((((Date.now() - startedAt) / ROTATION_MS) * 360) % 360),
      60,
    );
    return () => window.clearInterval(id);
  }, [startedAt]);

  const step = 100 / Math.max(1, options.length);
  const gradient = `conic-gradient(${options
    .map((_, i) => `${SEGMENT_COLORS[i % SEGMENT_COLORS.length]} ${i * step}% ${(i + 1) * step}%`)
    .join(', ')})`;

  return (
    <>
      <div className="absolute left-1/2 top-[-6px] z-20 -translate-x-1/2">
        <div className="h-0 w-0 border-x-[12px] border-t-[22px] border-x-transparent border-t-danger" />
      </div>
      <div
        className="absolute inset-0 rounded-full ring-[6px] ring-white/10"
        style={{ background: gradient, transform: `rotate(${-angle}deg)` }}
      />
    </>
  );
}
