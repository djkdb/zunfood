import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { TIMING } from '@/config/app';
import { Button } from '@/components/ui/Button';
import { Countdown } from '@/components/ui/Countdown';
import { PlayerAvatar } from '@/components/ui/PlayerAvatar';
import { RestaurantCard } from '@/components/RestaurantCard';
import { CATEGORY_EMOJI } from '@/types/restaurant';
import type { GameViewProps } from '@/types/game';
import { findRestaurant, resolveAll } from '../shared';
import type { FateState } from './logic';

export function FateView({ state, ctx, me, isHost, dispatch }: GameViewProps<FateState>) {
  const options = resolveAll(ctx.candidates, state.optionIds);
  const winner = findRestaurant(ctx.candidates, state.optionIds[state.winnerIndex] ?? null);
  const committed = state.committedPlayerIds.includes(me.id);

  if (state.phase === 'ready') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-8 text-center">
        <motion.span
          className="text-[76px]"
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          aria-hidden
        >
          🎲
        </motion.span>
        <h2 className="text-display text-white">
          오늘은
          <br />
          운명에 맡긴다
        </h2>

        <div className="w-full space-y-4">
          <Button
            surface="dark"
            variant="accent"
            block
            disabled={committed}
            onClick={() => dispatch('commit')}
          >
            {committed ? '기다리는 중…' : '운명 맡기기'}
          </Button>

          <div className="flex items-center justify-center gap-2">
            {ctx.players.map((player) => (
              <PlayerAvatar
                key={player.id}
                avatar={player.avatar}
                size="sm"
                surface="dark"
                dim={!state.committedPlayerIds.includes(player.id)}
              />
            ))}
          </div>
          <p className="text-sm font-bold text-white/35">
            {state.committedPlayerIds.length} / {ctx.players.length}명 준비
          </p>

          {isHost && (
            <Button surface="dark" variant="ghost" size="md" block onClick={() => dispatch('force')}>
              기다리지 않고 뽑기
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (state.phase === 'countdown') {
    return (
      <motion.div
        className="flex flex-1 items-center justify-center"
        animate={{ x: [0, -4, 4, -3, 3, 0] }}
        transition={{ duration: 0.5, repeat: Infinity }}
      >
        <Countdown startedAt={state.phaseStartedAt} durationMs={TIMING.countdownMs} />
      </motion.div>
    );
  }

  if (state.phase === 'reeling') {
    return (
      <FateReel
        state={state}
        names={options.map((r) => `${CATEGORY_EMOJI[r.category]} ${r.name}`)}
      />
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      className="flex flex-1 flex-col items-center justify-center gap-5 text-center"
    >
      <p className="text-h2 text-accent">운명의 선택</p>
      {winner && <RestaurantCard restaurant={winner} surface="dark" />}
    </motion.div>
  );
}

function FateReel({ state, names }: { state: FateState; names: string[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (names.length === 0) return;
    const totalSteps = names.length * 5 + state.winnerIndex;
    const update = () => {
      const p = Math.min(1, (Date.now() - state.phaseStartedAt) / TIMING.fateReelMs);
      const eased = 1 - (1 - p) ** 3;
      setIndex(Math.floor(eased * totalSteps) % names.length);
    };
    update();
    const id = window.setInterval(update, 45);
    return () => window.clearInterval(id);
  }, [state.phaseStartedAt, state.winnerIndex, names.length]);

  return (
    <motion.div
      animate={{ x: [0, -5, 5, -4, 4, 0] }}
      transition={{ duration: 0.45, repeat: Infinity }}
      className="flex flex-1 flex-col items-center justify-center gap-6"
    >
      <p className="text-sm font-bold tracking-[0.2em] text-white/35">운명을 고르는 중</p>
      <div className="flex h-28 w-full items-center justify-center overflow-hidden rounded-2xl bg-white/8 px-5">
        <motion.span
          key={index}
          initial={{ y: 20, opacity: 0.2 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.05 }}
          className="text-center text-h1 text-white"
        >
          {names[index] ?? '…'}
        </motion.span>
      </div>
    </motion.div>
  );
}
