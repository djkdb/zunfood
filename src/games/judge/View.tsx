import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { PlayerAvatar } from '@/components/ui/PlayerAvatar';
import { TextField } from '@/components/ui/TextField';
import { RestaurantCard } from '@/components/RestaurantCard';
import type { GameViewProps } from '@/types/game';
import { findRestaurant } from '../shared';
import type { JudgeState } from './logic';

const QUICK_PICKS = ['삼겹살', '치킨', '마라탕', '국밥', '초밥', '파스타', '아무거나'];

export function JudgeView({ state, ctx, me, isHost, dispatch }: GameViewProps<JudgeState>) {
  const [text, setText] = useState('');
  const submitted = state.submittedPlayerIds.includes(me.id);

  const submit = (value: string) => {
    if (submitted) return;
    dispatch('wish', { text: value.trim() || '아무거나' });
  };

  if (state.phase === 'input') {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <motion.span
            className="block text-[56px]"
            animate={{ rotate: [-8, 8, -8] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          >
            ⚖️
          </motion.span>
          <h2 className="mt-3 text-[24px] font-black">뭐 먹고 싶어요?</h2>
          <p className="mt-2 text-[14px] font-semibold text-white/50">
            각자 하나씩 말하면 AI 판사가 정해줍니다.
            <br />
            다른 사람의 답은 전원이 제출한 뒤에 공개돼요.
          </p>
        </div>

        {submitted ? (
          <div className="rounded-2xl border border-mint/40 bg-mint/10 p-5 text-center">
            <p className="text-[16px] font-black text-mint">제출 완료!</p>
            <p className="mt-1 text-[14px] text-white/55">다른 친구들을 기다리는 중…</p>
          </div>
        ) : (
          <div className="space-y-3">
            <TextField
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="예: 삼겹살"
              maxLength={24}
              autoComplete="off"
              aria-label="먹고 싶은 음식"
            />
            <div className="flex flex-wrap gap-2">
              {QUICK_PICKS.map((pick) => (
                <button
                  key={pick}
                  type="button"
                  onClick={() => setText(pick)}
                  className="min-h-[40px] rounded-xl border border-white/12 bg-white/[0.05] px-3.5 text-[14px] font-bold text-white/70 active:bg-white/15"
                >
                  {pick}
                </button>
              ))}
            </div>
            <Button variant="pop" block onClick={() => submit(text)}>
              판사에게 제출하기
            </Button>
          </div>
        )}

        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3">
          <span className="min-w-0 flex-1 truncate text-[14px] font-bold text-white/60">
            {state.submittedPlayerIds.length} / {ctx.players.length}명 제출
          </span>
          <div className="flex shrink-0 -space-x-2">
            {ctx.players.map((player) => (
              <PlayerAvatar
                key={player.id}
                nickname={player.nickname}
                avatar={player.avatar}
                size="sm"
                dim={!state.submittedPlayerIds.includes(player.id)}
                className="ring-2 ring-navy-900"
              />
            ))}
          </div>
        </div>

        {isHost && state.submittedPlayerIds.length > 0 && (
          <Button variant="ghost" size="md" block onClick={() => dispatch('force')}>
            기다리지 않고 판결받기
          </Button>
        )}
      </div>
    );
  }

  if (state.phase === 'thinking') {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-16">
        <motion.span
          className="text-[72px]"
          animate={{ rotate: [0, -25, 0, 25, 0], y: [0, -6, 0, -6, 0] }}
          transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
        >
          🔨
        </motion.span>
        <div className="text-center">
          <p className="text-[22px] font-black">AI 판사가 심리 중…</p>
          <p className="mt-2 text-[14px] font-semibold text-white/50">
            {ctx.players.length}명의 의견과 주변 {ctx.candidates.length}곳을 비교하고 있어요
          </p>
        </div>
        <div className="flex w-full flex-wrap justify-center gap-2">
          {ctx.players.map((player, index) => (
            <motion.span
              key={player.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.12 }}
              className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-[13px] font-bold"
            >
              {player.nickname} → {state.wishes[player.id] ?? '아무거나'}
            </motion.span>
          ))}
        </div>
      </div>
    );
  }

  const verdictRestaurant = findRestaurant(ctx.candidates, state.verdict?.restaurantId ?? null);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 20 }}
        className="space-y-5"
      >
        <div className="text-center">
          <span className="text-[52px]">⚖️</span>
          <p className="mt-1 text-[13px] font-black tracking-[0.3em] text-brand-200">AI 판결</p>
          <h2 className="mt-3 text-[26px] font-black leading-tight text-pop-300 text-shadow-pop">
            “{state.verdict?.headline}”
          </h2>
        </div>

        {verdictRestaurant && <RestaurantCard restaurant={verdictRestaurant} />}

        <div className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.05] p-4">
          <p className="text-[12px] font-black tracking-widest text-white/40">판결 이유</p>
          {(state.verdict?.reasons ?? []).map((reason, index) => (
            <motion.p
              key={reason}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 + index * 0.12 }}
              className="text-[14px] font-semibold text-white/75"
            >
              · {reason}
            </motion.p>
          ))}
        </div>

        {state.error && (
          <p className="text-center text-[13px] font-bold text-coral">{state.error}</p>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
