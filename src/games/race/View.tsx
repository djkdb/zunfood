import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { TIMING } from '@/config/app';
import { Countdown } from '@/components/ui/Countdown';
import { faceFor } from '@/components/ui/PlayerAvatar';
import { RestaurantCard } from '@/components/RestaurantCard';
import { CATEGORY_EMOJI, type Restaurant } from '@/types/restaurant';
import type { GameViewProps } from '@/types/game';
import { findRestaurant, resolveAll } from '../shared';
import { laneTotals, leadingTotal, type RaceState } from './logic';

/** 누적 연타 수를 방에 알리는 주기 */
const SYNC_MS = 900;

export function RaceView({ state, ctx, me, dispatch }: GameViewProps<RaceState>) {
  const lanes = useMemo(
    () => resolveAll(ctx.candidates, state.optionIds),
    [ctx.candidates, state.optionIds],
  );

  const mine = state.runners[me.id] ?? null;
  const [lane, setLane] = useState<string | null>(null);
  /** 내 연타는 내 화면에서 센다 — 한 번씩 보내면 방이 못 버틴다 */
  const taps = useRef(0);
  const [localTaps, setLocalTaps] = useState(0);

  const chosen = lane ?? mine?.optionId ?? null;

  // 고른 레인이 있으면 주기적으로 누적 합계를 보낸다 (늦게·중복으로 와도 결과가 같다)
  useEffect(() => {
    if (!chosen || state.phase !== 'running') return;
    const send = () => dispatch('run', { optionId: chosen, taps: taps.current });
    send();
    const id = window.setInterval(send, SYNC_MS);
    return () => {
      window.clearInterval(id);
      send();
    };
  }, [chosen, state.phase, dispatch]);

  if (state.phase === 'countdown') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center">
        <Countdown
          startedAt={state.phaseStartedAt}
          durationMs={TIMING.countdownMs}
          label="밀 곳을 고르고 두드리세요"
        />
      </div>
    );
  }

  const winner = findRestaurant(ctx.candidates, state.winnerId);
  const revealing = state.phase === 'reveal' || state.phase === 'done';
  const totals = laneTotals(state);
  const lead = leadingTotal(state);

  if (revealing) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-1 flex-col justify-center gap-4 text-center"
      >
        <p className="text-h2 text-accent">결승선</p>
        {winner && <RestaurantCard restaurant={winner} surface="dark" />}
        <Track lanes={lanes} totals={totals} lead={lead} state={state} ctx={ctx} />
      </motion.div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <Timer startedAt={state.phaseStartedAt} />
      <div className="mt-3 flex-1">
        <Track
          lanes={lanes}
          totals={totals}
          lead={lead}
          state={state}
          ctx={ctx}
          onPick={chosen ? undefined : setLane}
        />
      </div>

      {chosen ? (
        <button
          type="button"
          onPointerDown={() => {
            taps.current += 1;
            setLocalTaps(taps.current);
          }}
          className="mt-3 h-[84px] w-full rounded-2xl bg-accent text-display text-white transition-transform active:scale-[0.97]"
        >
          {localTaps === 0 ? '두드려!' : localTaps}
        </button>
      ) : (
        <p className="mt-3 py-6 text-center text-body font-bold text-white/45">
          밀고 싶은 곳을 하나 누르세요
        </p>
      )}
    </div>
  );
}

function Timer({ startedAt }: { startedAt: number }) {
  const [ratio, setRatio] = useState(1);

  useEffect(() => {
    const id = window.setInterval(() => {
      setRatio(Math.max(0, 1 - (Date.now() - startedAt) / TIMING.raceMs));
    }, 80);
    return () => window.clearInterval(id);
  }, [startedAt]);

  return (
    <div className="h-2 overflow-hidden rounded-full bg-white/10">
      <div
        className="h-full rounded-full bg-accent"
        style={{ width: `${ratio * 100}%`, transition: 'width 80ms linear' }}
      />
    </div>
  );
}

function Track({
  lanes,
  totals,
  lead,
  state,
  ctx,
  onPick,
}: {
  lanes: Restaurant[];
  totals: Record<string, number>;
  lead: number;
  state: RaceState;
  ctx: GameViewProps<RaceState>['ctx'];
  onPick?: (optionId: string) => void;
}) {
  return (
    <ul className="space-y-2">
      {lanes.map((lane) => {
        const pushers = Object.values(state.runners).filter((r) => r.optionId === lane.id);
        const ratio = Math.min(1, (totals[lane.id] ?? 0) / lead);
        const isWinner = lane.id === state.winnerId;

        return (
          <li key={lane.id}>
            <button
              type="button"
              disabled={!onPick}
              onClick={() => onPick?.(lane.id)}
              className={`w-full rounded-xl px-3 py-2.5 text-left ${
                isWinner ? 'bg-accent/18' : 'bg-white/6'
              } ${onPick ? 'active:bg-white/14' : ''}`}
            >
              <div className="flex items-baseline gap-2">
                <span className="min-w-0 flex-1 truncate text-[15px] font-extrabold text-white">
                  {isWinner && <span aria-hidden>🏁 </span>}
                  {CATEGORY_EMOJI[lane.category]} {lane.name}
                </span>
                {pushers.length > 0 && (
                  <span className="shrink-0 text-xs" aria-label={`${pushers.length}명이 미는 중`}>
                    {pushers.map((p) => {
                      const player = ctx.players.find((x) => x.id === p.playerId);
                      return player ? faceFor(player.avatar) : '';
                    })}
                  </span>
                )}
                <span className="shrink-0 text-h3 tabular-nums text-white/55">
                  {totals[lane.id] ?? 0}
                </span>
              </div>

              <div className="relative mt-2 h-2.5 overflow-hidden rounded-full bg-white/8">
                <motion.div
                  className={`h-full rounded-full ${isWinner ? 'bg-accent' : 'bg-primary'}`}
                  animate={{ width: `${ratio * 100}%` }}
                  transition={{ type: 'tween', duration: 0.25 }}
                />
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
