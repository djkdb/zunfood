import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { APP } from '@/config/app';
import { Button } from '@/components/ui/Button';
import { Confetti } from '@/components/ui/Confetti';
import { Sheet } from '@/components/ui/Sheet';
import { formatDistance, formatRating, formatWon } from '@/lib/format';
import { walkingMinutes } from '@/lib/geo';
import { directionsUrl, mapUrl } from '@/lib/map';
import { inviteUrl, shareOrCopy } from '@/lib/share';
import { getGame } from '@/games/registry';
import { useRoomStore } from '@/store/roomStore';
import { CATEGORY_EMOJI, CATEGORY_LABEL } from '@/types/restaurant';
import type { Player, Room } from '@/types/room';

interface ResultScreenProps {
  room: Room;
  players: Player[];
  isHost: boolean;
}

const REVEAL_DELAY_MS = 1_500;

export function ResultScreen({ room, players, isHost }: ResultScreenProps) {
  const playAgain = useRoomStore((s) => s.playAgain);
  const [revealed, setRevealed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const winner = room.candidates.find((c) => c.id === room.winnerId) ?? null;
  const game = room.selectedGame ? getGame(room.selectedGame) : null;

  useEffect(() => {
    const timer = window.setTimeout(() => setRevealed(true), REVEAL_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [room.winnerId]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 1_800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  if (!winner) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <span className="text-[44px]">🤔</span>
        <p className="text-[16px] font-bold">결과를 불러오지 못했어요</p>
        <p className="text-[14px] text-white/50">방장이 다시 게임을 시작할 수 있어요.</p>
        {isHost && (
          <Button variant="ghost" size="md" onClick={playAgain}>
            다시 결정하기
          </Button>
        )}
      </div>
    );
  }

  const share = async () => {
    const result = await shareOrCopy({
      title: APP.shareTitle,
      text: `오늘의 ${mealLabel()}은 "${winner.name}"! ${APP.name}에서 정했어요 🎉`,
      url: inviteUrl(room.code),
    });
    if (result === 'copied') setToast('링크를 복사했어요!');
    if (result === 'failed') setToast('공유에 실패했어요.');
  };

  return (
    <div className="flex flex-1 flex-col pb-8">
      <AnimatePresence mode="wait">
        {!revealed ? (
          <motion.div
            key="teaser"
            exit={{ opacity: 0, scale: 1.15 }}
            transition={{ duration: 0.35 }}
            className="flex flex-1 flex-col items-center justify-center gap-6"
          >
            <p className="text-[26px] font-black text-white/70">오늘의 {mealLabel()}은…</p>
            <div className="flex gap-2">
              {[0, 1, 2].map((index) => (
                <motion.span
                  key={index}
                  className="h-3.5 w-3.5 rounded-full bg-pop-400"
                  animate={{ y: [0, -12, 0], opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 0.9, repeat: Infinity, delay: index * 0.15 }}
                />
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div key="result" className="flex flex-1 flex-col">
            <Confetti />

            {/* 릴스/스토리 촬영용 히어로 영역 */}
            <div className="relative mt-6 overflow-hidden rounded-[32px] border border-white/12 bg-gradient-to-b from-pop-400/25 via-brand-500/10 to-transparent px-5 py-8 text-center">
              <div className="pointer-events-none absolute -top-20 left-1/2 h-52 w-52 -translate-x-1/2 rounded-full bg-pop-400/25 blur-3xl" />

              <motion.p
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative text-[13px] font-black tracking-[0.36em] text-pop-300"
              >
                🏆 오늘의 {mealLabel()}
              </motion.p>

              <motion.div
                initial={{ scale: 0.3, opacity: 0, rotate: -12 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 220, damping: 14 }}
                className="relative mt-4 text-[76px] leading-none"
              >
                {CATEGORY_EMOJI[winner.category]}
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 22 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18, type: 'spring', stiffness: 200, damping: 18 }}
                className="relative mt-5 text-[34px] font-black leading-tight tracking-tight text-shadow-pop"
              >
                {winner.name}
              </motion.h1>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.36 }}
                className="relative mt-2 text-[14px] font-bold text-white/50"
              >
                {CATEGORY_LABEL[winner.category]} · {formatDistance(winner.distance)}
                {game && ` · ${game.emoji} ${game.title}`}
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.48 }}
                className="relative mt-6 grid grid-cols-3 gap-2"
              >
                <Stat
                  icon="⭐"
                  value={winner.rating > 0 ? formatRating(winner.rating) : '—'}
                  label="평점"
                />
                <Stat icon="🚶" value={`${walkingMinutes(winner.distance)}분`} label="도보" />
                <Stat
                  icon="💰"
                  value={
                    winner.priceRange > 0 ? winner.priceRange.toLocaleString('ko-KR') : '—'
                  }
                  label="1인 평균(원)"
                />
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="mt-4 space-y-3"
            >
              {winner.tags.length > 0 && (
                <div className="flex flex-wrap justify-center gap-1.5">
                  {winner.tags.slice(0, 4).map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-white/12 bg-white/[0.06] px-3 py-1 text-[12px] font-bold text-white/60"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
                <p className="text-[12px] font-black tracking-widest text-white/35">주소</p>
                <p className="mt-1 text-[14px] font-semibold text-white/80">{winner.address}</p>
                {winner.priceRange > 0 && (
                  <p className="mt-2 text-[14px] font-bold text-pop-300">
                    1인 약 {formatWon(winner.priceRange)}
                  </p>
                )}
              </div>

              <p className="text-center text-[13px] font-semibold text-white/35">
                {players.map((p) => p.nickname).join(' · ')} · 모두 같은 결과를 보고 있어요
              </p>
            </motion.div>

            <div className="flex-1" />

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="mt-6 space-y-2.5"
            >
              <Button
                variant="pop"
                block
                onClick={() => window.open(mapUrl(winner), '_blank', 'noopener,noreferrer')}
              >
                🗺️ 지도에서 보기
              </Button>
              <div className="grid grid-cols-2 gap-2.5">
                <Button variant="ghost" size="md" onClick={share}>
                  친구에게 공유
                </Button>
                <Button variant="ghost" size="md" onClick={() => setMenuOpen(true)}>
                  메뉴 보기
                </Button>
              </div>
              {isHost ? (
                <Button variant="outline" size="md" block onClick={playAgain}>
                  🔁 다른 게임으로 다시 결정
                </Button>
              ) : (
                <p className="pt-1 text-center text-[13px] font-bold text-white/35">
                  다시 하려면 방장에게 부탁하세요
                </p>
              )}
            </motion.div>

            {toast && (
              <p className="mt-3 animate-pop-in text-center text-[13px] font-bold text-mint">
                {toast}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title={winner.name}>
        {winner.menu.length > 0 ? (
          <ul className="space-y-2">
            {winner.menu.map((item) => (
              <li
                key={item.name}
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3"
              >
                <span className="text-[15px] font-bold">{item.name}</span>
                <span className="text-[15px] font-black text-pop-300">
                  {formatWon(item.price)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-6 text-center text-[14px] text-white/50">
            메뉴 정보가 아직 없어요. 지도에서 확인해 주세요.
          </p>
        )}
        <Button
          variant="ghost"
          size="md"
          block
          className="mt-4"
          onClick={() => window.open(directionsUrl(winner), '_blank', 'noopener,noreferrer')}
        >
          🚶 길찾기
        </Button>
      </Sheet>
    </div>
  );
}

function Stat({ icon, value, label }: { icon: string; value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-navy-950/40 px-2 py-3">
      <p className="text-[18px]">{icon}</p>
      <p className="mt-0.5 text-[17px] font-black">{value}</p>
      <p className="text-[11px] font-bold text-white/35">{label}</p>
    </div>
  );
}

function mealLabel(): string {
  const hour = new Date().getHours();
  if (hour < 11) return '아침';
  if (hour < 16) return '점심';
  if (hour < 21) return '저녁';
  return '야식';
}
