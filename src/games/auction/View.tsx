import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { TIMING } from '@/config/app';
import { Button } from '@/components/ui/Button';
import { Countdown } from '@/components/ui/Countdown';
import { PlayerAvatar } from '@/components/ui/PlayerAvatar';
import { formatDistance } from '@/lib/format';
import { CATEGORY_LABEL, type Restaurant } from '@/types/restaurant';
import type { GameViewProps } from '@/types/game';
import { findRestaurant } from '../shared';
import { AUCTION_BUDGET, AUCTION_STEP, type AuctionState } from './logic';

export function AuctionView({ state, ctx, me, isHost, dispatch }: GameViewProps<AuctionState>) {
  /** 내가 어디에 얼마를 걸었는지는 내 화면에만 있다 (서버 상태에서는 가려진다) */
  const [allocation, setAllocation] = useState<Record<string, number>>({});
  const submitted = state.submittedPlayerIds.includes(me.id);

  const lots = useMemo(
    () =>
      state.optionIds
        .map((id) => findRestaurant(ctx.candidates, id))
        .filter((r): r is Restaurant => Boolean(r)),
    [state.optionIds, ctx.candidates],
  );

  const spent = Object.values(allocation).reduce((sum, n) => sum + n, 0);
  const remaining = AUCTION_BUDGET - spent;

  const change = (optionId: string, delta: number) => {
    if (submitted) return;
    setAllocation((prev) => {
      const current = prev[optionId] ?? 0;
      const next = Math.max(0, Math.min(current + delta, current + remaining));
      if (next === current) return prev;
      return { ...prev, [optionId]: next };
    });
  };

  if (state.phase === 'countdown') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center">
        <Countdown
          startedAt={state.phaseStartedAt}
          durationMs={TIMING.countdownMs}
          label="100포인트를 드립니다"
        />
      </div>
    );
  }

  if (state.phase === 'reveal' || state.phase === 'done') {
    return <Reveal state={state} ctx={ctx} lots={lots} />;
  }

  return (
    <div className="flex flex-1 flex-col">
      <Header remaining={remaining} startedAt={state.phaseStartedAt} submitted={submitted} />

      {!submitted && (
        <p className="mt-3 text-center text-xs font-semibold text-white/30">
          가게 이름을 누르면 남은 포인트를 전부 걸어요
        </p>
      )}

      <div className="mt-2 flex-1 space-y-1.5">
        {lots.map((lot) => (
          <LotRow
            key={lot.id}
            restaurant={lot}
            points={allocation[lot.id] ?? 0}
            canAdd={!submitted && remaining > 0}
            canRemove={!submitted && (allocation[lot.id] ?? 0) > 0}
            onChange={(delta) => change(lot.id, delta)}
            onAllIn={() => change(lot.id, remaining)}
          />
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {submitted ? (
          <div className="rounded-2xl bg-success/12 py-5 text-center">
            <p className="text-h2 text-success">제출 완료</p>
            <p className="mt-1 text-body text-white/45">다른 친구들을 기다리는 중…</p>
          </div>
        ) : (
          <Button
            surface="dark"
            variant="accent"
            block
            disabled={remaining !== 0}
            onClick={() => dispatch('bid', { allocation })}
          >
            {remaining === 0 ? '이대로 걸기' : `${remaining}포인트 남았어요`}
          </Button>
        )}

        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2">
            {ctx.players.map((player) => (
              <PlayerAvatar
                key={player.id}
                avatar={player.avatar}
                size="sm"
                surface="dark"
                dim={!state.submittedPlayerIds.includes(player.id)}
              />
            ))}
          </div>
          <p className="text-sm font-bold text-white/35">
            {state.submittedPlayerIds.length} / {ctx.players.length}명 제출
          </p>
          {isHost && state.submittedPlayerIds.length > 0 && (
            <Button surface="dark" variant="ghost" size="sm" onClick={() => dispatch('force')}>
              기다리지 않고 공개하기
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Header({
  remaining,
  startedAt,
  submitted,
}: {
  remaining: number;
  startedAt: number;
  submitted: boolean;
}) {
  const seconds = useRemainingSeconds(startedAt, TIMING.auctionBidMs);

  return (
    <div className="flex items-end justify-between">
      <div>
        <p className="text-sm font-bold text-white/40">남은 포인트</p>
        <p className="text-display tabular-nums text-white">
          {submitted ? '—' : remaining}
        </p>
      </div>
      <div className="pb-1.5 text-right">
        <p className="text-sm font-bold text-white/40">공개까지</p>
        <p
          className={`text-h2 tabular-nums ${seconds <= 5 ? 'text-danger' : 'text-white/75'}`}
        >
          {seconds}초
        </p>
      </div>
    </div>
  );
}

function LotRow({
  restaurant,
  points,
  canAdd,
  canRemove,
  onChange,
  onAllIn,
}: {
  restaurant: Restaurant;
  points: number;
  canAdd: boolean;
  canRemove: boolean;
  onChange: (delta: number) => void;
  /** 남은 포인트를 이 한 곳에 전부 — 이 게임의 핵심 동작이라 한 번에 되어야 한다 */
  onAllIn: () => void;
}) {
  return (
    <div
      className={`rounded-xl px-3 py-2.5 transition-colors ${
        points > 0 ? 'bg-accent/14' : 'bg-white/6'
      }`}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!canAdd}
          onClick={onAllIn}
          aria-label={`${restaurant.name}에 남은 포인트 전부 걸기`}
          className="min-w-0 flex-1 py-1.5 text-left disabled:cursor-default"
        >
          <p className="truncate text-[15px] font-extrabold text-white">{restaurant.name}</p>
          <p className="mt-0.5 truncate text-xs font-semibold text-white/40">
            {CATEGORY_LABEL[restaurant.category]} · {formatDistance(restaurant.distance)}
          </p>
        </button>

        <StepButton label={`${restaurant.name} 포인트 빼기`} disabled={!canRemove} onClick={() => onChange(-AUCTION_STEP)}>
          −
        </StepButton>
        <span
          aria-label={`${restaurant.name} ${points}포인트`}
          className={`w-10 text-center text-h3 tabular-nums ${
            points > 0 ? 'text-accent-300' : 'text-white/25'
          }`}
        >
          {points}
        </span>
        <StepButton label={`${restaurant.name} 포인트 걸기`} disabled={!canAdd} onClick={() => onChange(AUCTION_STEP)}>
          +
        </StepButton>
      </div>

      {/* 내가 건 비중 */}
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/8">
        <motion.div
          className="h-full rounded-full bg-accent"
          animate={{ width: `${points}%` }}
          transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        />
      </div>
    </div>
  );
}

function StepButton({
  children,
  label,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white/10 text-h3 text-white transition-colors active:bg-white/20 disabled:opacity-25"
    >
      {children}
    </button>
  );
}

/** 공개 — 합산 포인트를 막대로 보여준다 */
function Reveal({
  state,
  ctx,
  lots,
}: {
  state: AuctionState;
  ctx: GameViewProps<AuctionState>['ctx'];
  lots: Restaurant[];
}) {
  const results = state.results ?? [];
  const max = Math.max(1, ...results.map((r) => r.total));

  return (
    <div className="flex flex-1 flex-col justify-center gap-5">
      <div className="text-center">
        <p className="text-sm font-extrabold tracking-[0.2em] text-accent">경매 결과</p>
        <h2 className="mt-2 text-h1 text-white">
          {ctx.players.length}명이 {AUCTION_BUDGET * state.submittedPlayerIds.length}포인트를 걸었어요
        </h2>
      </div>

      <ul className="space-y-2">
        <AnimatePresence initial={false}>
          {results.map((result, index) => {
            const restaurant = lots.find((l) => l.id === result.optionId);
            if (!restaurant) return null;
            const isWinner = result.optionId === state.winnerId;

            return (
              <motion.li
                key={result.optionId}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.12 }}
                className={`rounded-xl px-3 py-2.5 ${isWinner ? 'bg-accent/18' : 'bg-white/6'}`}
              >
                <div className="flex items-baseline gap-2">
                  <p className="min-w-0 flex-1 truncate text-[15px] font-extrabold text-white">
                    {isWinner && <span aria-hidden>👑 </span>}
                    {restaurant.name}
                  </p>
                  <p
                    className={`shrink-0 text-h3 tabular-nums ${
                      isWinner ? 'text-accent-300' : 'text-white/50'
                    }`}
                  >
                    {result.total}
                  </p>
                </div>

                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/8">
                  <motion.div
                    className={`h-full rounded-full ${isWinner ? 'bg-accent' : 'bg-white/30'}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${(result.total / max) * 100}%` }}
                    transition={{ delay: 0.2 + index * 0.12, duration: 0.7, ease: 'easeOut' }}
                  />
                </div>

                {result.backers.length > 0 && (
                  <p className="mt-1.5 truncate text-xs font-semibold text-white/35">
                    {result.backers.join(' · ')}
                  </p>
                )}
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </div>
  );
}

/** 남은 시간(초) — 호스트가 정한 시작 시각 기준이라 모두 같은 숫자를 본다 */
function useRemainingSeconds(startedAt: number, durationMs: number): number {
  const compute = () => Math.max(0, Math.ceil((startedAt + durationMs - Date.now()) / 1000));
  const [seconds, setSeconds] = useState(compute);

  useEffect(() => {
    const id = window.setInterval(() => setSeconds(compute()), 250);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startedAt, durationMs]);

  return seconds;
}
