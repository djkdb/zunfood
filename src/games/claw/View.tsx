import { Component, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { TIMING } from '@/config/app';
import { Countdown } from '@/components/ui/Countdown';
import { PlayerAvatar } from '@/components/ui/PlayerAvatar';
import { RestaurantCard } from '@/components/RestaurantCard';
import { CATEGORY_EMOJI, type Restaurant } from '@/types/restaurant';
import type { GameViewProps } from '@/types/game';
import { findRestaurant, resolveAll } from '../shared';
import { SEGMENT_COLORS } from '../roulette/wheelFace';
import type { ClawStage } from './ClawMachine3D';
import {
  capsuleAt,
  FIRM_GRIP,
  gripAt,
  gripStrength,
  slideAt,
  WEAK_GRIP,
  type ClawState,
} from './logic';

const ClawMachine3D = lazy(() => import('./ClawMachine3D'));

/** 집게가 내려갔다 올라오는 연출 시간 */
const DROP_MS = 2_200;

function prefers3D(): boolean {
  if (typeof window === 'undefined') return false;
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function ClawView({ state, ctx, me, dispatch }: GameViewProps<ClawState>) {
  const [use3D, setUse3D] = useState(prefers3D);
  const fallbackTo2D = useCallback(() => setUse3D(false), []);

  const capsules = useMemo(
    () => resolveAll(ctx.candidates, state.optionIds),
    [ctx.candidates, state.optionIds],
  );

  /** 내 조작은 내 화면에만 있다 — 방을 통해 주고받지 않는다 */
  const [stage, setStage] = useState<ClawStage>('sliding');
  const [lockedX, setLockedX] = useState(0.5);
  const startedAt = useRef(Date.now());
  const myGrab = state.grabs.find((g) => g.playerId === me.id) ?? null;
  const dropStartedAt = useRef(0);

  const tap = () => {
    if (stage === 'sliding') {
      setLockedX(slideAt(Date.now() - startedAt.current));
      setStage('gripping');
      return;
    }
    if (stage === 'gripping') {
      const grip = gripStrength(gripAt(Date.now() - startedAt.current));
      dropStartedAt.current = Date.now();
      setStage('dropping');
      dispatch('grab', { x: lockedX, grip });
    }
  };

  if (state.phase === 'countdown') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center">
        <Countdown
          startedAt={state.phaseStartedAt}
          durationMs={TIMING.countdownMs}
          label="집게를 세우고, 힘을 주세요"
        />
      </div>
    );
  }

  const winner = findRestaurant(ctx.candidates, state.winnerId);
  const revealing = state.phase === 'reveal' || state.phase === 'done';
  const aimedIndex = capsuleAt(stage === 'sliding' ? 0.5 : lockedX, capsules.length);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3">
      <div className="relative h-[280px] w-full shrink-0">
        {use3D ? (
          <MachineBoundary onFail={fallbackTo2D}>
            <Suspense fallback={<MachineSkeleton />}>
              <ClawMachine3D
                capsules={capsules}
                stage={stage}
                lockedX={lockedX}
                caught={myGrab?.caught ?? false}
                dropMs={DROP_MS}
                dropStartedAt={dropStartedAt.current}
                onUnavailable={fallbackTo2D}
              />
            </Suspense>
          </MachineBoundary>
        ) : (
          <Machine2D capsules={capsules} stage={stage} lockedX={lockedX} startedAt={startedAt.current} />
        )}
      </div>

      {revealing ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full space-y-3 text-center"
        >
          <p className="text-h2 text-accent">
            {state.grabs.some((g) => g.caught) ? '가장 많이 집힌 캡슐' : '아무도 못 집었어요'}
          </p>
          {winner && <RestaurantCard restaurant={winner} surface="dark" />}
          <Scoreboard state={state} ctx={ctx} />
        </motion.div>
      ) : (
        <>
          <Target capsule={capsules[aimedIndex]} stage={stage} />

          {stage === 'gripping' && <GripGauge startedAt={startedAt.current} />}

          {stage === 'dropping' || myGrab ? (
            <div className="w-full rounded-2xl bg-white/8 py-4 text-center">
              <p className="text-h3 text-white">
                {myGrab ? (myGrab.caught ? '집었다!' : '미끄러졌어요') : '내려가는 중…'}
              </p>
              <p className="mt-1 text-sm text-white/45">다른 친구들을 기다리는 중…</p>
            </div>
          ) : (
            <button
              type="button"
              onClick={tap}
              className="h-[64px] w-full rounded-2xl bg-primary text-h1 text-white transition-transform active:scale-[0.98]"
            >
              {stage === 'sliding' ? '🕹️ 여기서 멈춰!' : '💪 지금 집어!'}
            </button>
          )}

          <div className="flex items-center gap-2">
            {ctx.players.map((player) => (
              <PlayerAvatar
                key={player.id}
                avatar={player.avatar}
                size="sm"
                surface="dark"
                dim={!state.grabbedPlayerIds.includes(player.id)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** 지금 집게 아래 있는 캡슐 */
function Target({ capsule, stage }: { capsule: Restaurant | undefined; stage: ClawStage }) {
  if (stage === 'sliding') {
    return <p className="h-6 text-center text-body font-bold text-white/40">집게가 움직이는 중…</p>;
  }
  return (
    <p className="h-6 truncate text-center text-body font-bold text-white/70">
      {capsule ? `${CATEGORY_EMOJI[capsule.category]} ${capsule.name}` : ''}
    </p>
  );
}

/** 악력 게이지 — 가운데일수록 세게 집는다 */
function GripGauge({ startedAt }: { startedAt: number }) {
  const [value, setValue] = useState(0.5);

  useEffect(() => {
    const id = window.setInterval(() => setValue(gripAt(Date.now() - startedAt)), 30);
    return () => window.clearInterval(id);
  }, [startedAt]);

  const strength = gripStrength(value);

  return (
    <div className="relative h-7 w-full overflow-hidden rounded-full bg-white/10">
      {/* 확실히 집는 구간 / 미끄러질 수도 있는 구간 */}
      <div className="absolute inset-y-0 bg-warning/25" style={{ left: '27.5%', width: '45%' }} />
      <div className="absolute inset-y-0 bg-success/30" style={{ left: '37.5%', width: '25%' }} />
      <div
        className={`absolute inset-y-1 w-2 rounded-full ${
          strength >= FIRM_GRIP ? 'bg-success' : strength >= WEAK_GRIP ? 'bg-warning' : 'bg-white'
        }`}
        style={{ left: `calc(${value * 100}% - 4px)`, transition: 'left 30ms linear' }}
      />
    </div>
  );
}

function Scoreboard({ state, ctx }: { state: ClawState; ctx: GameViewProps<ClawState>['ctx'] }) {
  if (state.grabs.length === 0) return null;
  return (
    <ul className="space-y-1.5 text-left">
      {state.grabs.map((grab) => {
        const player = ctx.players.find((p) => p.id === grab.playerId);
        const restaurant = findRestaurant(ctx.candidates, grab.optionId);
        if (!restaurant) return null;
        return (
          <li key={grab.playerId} className="flex items-center gap-2 rounded-lg bg-white/6 px-3 py-2">
            <PlayerAvatar avatar={player?.avatar ?? 0} size="sm" surface="dark" />
            <span className="min-w-0 flex-1 truncate text-sm font-bold text-white/75">
              {restaurant.name}
            </span>
            <span
              className={`shrink-0 text-xs font-extrabold ${
                grab.caught ? 'text-success' : 'text-white/35'
              }`}
            >
              {grab.caught ? '집음' : '놓침'}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function MachineSkeleton() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="h-[220px] w-[260px] animate-pulse rounded-2xl bg-white/8" />
    </div>
  );
}

class MachineBoundary extends Component<{ onFail: () => void; children: ReactNode }> {
  componentDidCatch(error: unknown) {
    console.warn('[MEALGAME] 3D 뽑기 기계를 쓸 수 없어 2D 로 대체합니다', error);
    this.props.onFail();
  }

  render() {
    return this.props.children;
  }
}

/** 3D 가 안 되는 기기용 — 집게 위치만 보여준다 */
function Machine2D({
  capsules,
  stage,
  lockedX,
  startedAt,
}: {
  capsules: Restaurant[];
  stage: ClawStage;
  lockedX: number;
  startedAt: number;
}) {
  const [x, setX] = useState(0.5);

  useEffect(() => {
    if (stage !== 'sliding') return;
    const id = window.setInterval(() => setX(slideAt(Date.now() - startedAt)), 40);
    return () => window.clearInterval(id);
  }, [stage, startedAt]);

  const position = stage === 'sliding' ? x : lockedX;

  return (
    <div className="relative h-full w-full rounded-2xl border border-white/15 bg-white/4">
      <div
        className="absolute top-3 text-[26px]"
        style={{ left: `calc(${position * 100}% - 14px)`, transition: 'left 40ms linear' }}
      >
        🕹️
      </div>
      <div className="absolute inset-x-3 bottom-4 flex items-end justify-between">
        {capsules.map((capsule, index) => (
          <span
            key={capsule.id}
            className="h-7 w-7 rounded-full"
            style={{ background: SEGMENT_COLORS[index % SEGMENT_COLORS.length] }}
          />
        ))}
      </div>
    </div>
  );
}
