import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { TIMING } from '@/config/app';
import { Countdown } from '@/components/ui/Countdown';
import { PlayerAvatar } from '@/components/ui/PlayerAvatar';
import { RestaurantCard } from '@/components/RestaurantCard';
import { RestaurantThumb } from '@/components/RestaurantThumb';
import { formatDistance } from '@/lib/format';
import { CATEGORY_LABEL } from '@/types/restaurant';
import type { GameViewProps } from '@/types/game';
import { findRestaurant } from '../shared';
import { NIBBLE_COUNT, nibbleFor, nibbleWindow, type FishingState } from './logic';

export function FishingView({ state, ctx, me, dispatch }: GameViewProps<FishingState>) {
  const [elapsed, setElapsed] = useState(0);
  const mine = state.catches.find((c) => c.playerId === me.id) ?? null;

  useEffect(() => {
    if (state.phase !== 'casting') return;
    const id = window.setInterval(() => setElapsed(Date.now() - state.phaseStartedAt), 60);
    return () => window.clearInterval(id);
  }, [state.phase, state.phaseStartedAt]);

  /** 지금 내 찌에 무엇이 물었는지 — 사람마다 다르다 */
  const now = useMemo(() => {
    const window_ = nibbleWindow(elapsed);
    if (window_.index >= NIBBLE_COUNT) return null;
    return {
      ...window_,
      ...nibbleFor(state.optionIds, ctx.seed, me.id, window_.index),
    };
  }, [elapsed, state.optionIds, ctx.seed, me.id]);

  if (state.phase === 'countdown') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center">
        <Countdown
          startedAt={state.phaseStartedAt}
          durationMs={TIMING.countdownMs}
          label="헛입질을 참으세요"
        />
      </div>
    );
  }

  const winner = findRestaurant(ctx.candidates, state.winnerId);
  const revealing = state.phase === 'reveal' || state.phase === 'done';

  if (revealing) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-1 flex-col justify-center gap-4 text-center"
      >
        <p className="text-h2 text-accent">
          {state.catches.some((c) => c.real) ? '가장 많이 낚인 곳' : '아무도 못 낚았어요'}
        </p>
        {winner && <RestaurantCard restaurant={winner} surface="dark" />}
        <ul className="space-y-1.5 text-left">
          {state.catches.map((item) => {
            const player = ctx.players.find((p) => p.id === item.playerId);
            const restaurant = findRestaurant(ctx.candidates, item.optionId);
            if (!restaurant) return null;
            return (
              <li
                key={item.playerId}
                className="flex items-center gap-2 rounded-lg bg-white/6 px-3 py-2"
              >
                <PlayerAvatar avatar={player?.avatar ?? 0} size="sm" surface="dark" />
                <span className="min-w-0 flex-1 truncate text-sm font-bold text-white/75">
                  {restaurant.name}
                </span>
                <span
                  className={`shrink-0 text-xs font-extrabold ${
                    item.real ? 'text-success' : 'text-white/35'
                  }`}
                >
                  {item.real ? '낚음' : '헛챔질'}
                </span>
              </li>
            );
          })}
        </ul>
      </motion.div>
    );
  }

  const biting = Boolean(now?.biting) && !mine;
  const fish = now ? findRestaurant(ctx.candidates, now.optionId) : null;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5">
      <p className="text-sm font-bold text-white/35">
        입질 {Math.min(NIBBLE_COUNT, (now?.index ?? 0) + 1)} / {NIBBLE_COUNT}
      </p>

      <div className="relative flex h-[220px] w-full items-center justify-center">
        <AnimatePresence mode="wait">
          {biting && fish ? (
            <motion.div
              key={`${now?.index}`}
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: [0, -6, 0], scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ y: { repeat: Infinity, duration: 0.42 }, duration: 0.18 }}
              className="flex flex-col items-center gap-3 text-center"
            >
              <RestaurantThumb
                category={fish.category}
                name={fish.name}
                className="h-[92px] w-[92px] rounded-3xl"
                emojiClassName="text-[46px]"
              />
              <div>
                <p className="text-h1 text-white">{fish.name}</p>
                <p className="mt-1 text-sm font-semibold text-white/45">
                  {CATEGORY_LABEL[fish.category]} · {formatDistance(fish.distance)}
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="wait"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center gap-3"
            >
              <motion.span
                className="text-[52px]"
                animate={{ y: [0, -4, 0] }}
                transition={{ repeat: Infinity, duration: 1.6 }}
                aria-hidden
              >
                🎣
              </motion.span>
              <p className="text-body font-bold text-white/35">
                {mine ? '낚싯대를 걷었어요' : '기다리는 중…'}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {mine ? (
        <div className="w-full rounded-2xl bg-white/8 py-4 text-center">
          <p className="text-h3 text-white">{mine.real ? '낚았다!' : '헛챔질…'}</p>
          <p className="mt-1 text-sm text-white/45">다른 친구들을 기다리는 중…</p>
        </div>
      ) : (
        <button
          type="button"
          // 입질이 없을 때 누르면 그냥 헛수고여야 한다 — 챔질로 세지 않는다
          disabled={!biting}
          onClick={() => now && dispatch('strike', { index: now.index })}
          className={`h-[68px] w-full rounded-2xl text-h1 transition-transform active:scale-[0.98] ${
            biting ? 'bg-success text-white' : 'bg-white/8 text-white/40'
          }`}
        >
          {biting ? '🎣 지금 챔질!' : '입질을 기다리세요'}
        </button>
      )}

      <div className="flex items-center gap-2">
        {ctx.players.map((player) => (
          <PlayerAvatar
            key={player.id}
            avatar={player.avatar}
            size="sm"
            surface="dark"
            dim={!state.strikedPlayerIds.includes(player.id)}
          />
        ))}
      </div>
    </div>
  );
}
