import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';

interface CountdownProps {
  /** 카운트다운이 시작된 시각(ms) */
  startedAt: number;
  /** 전체 길이(ms) */
  durationMs: number;
  label?: string;
  onFinish?: () => void;
}

/**
 * 3 · 2 · 1 카운트다운.
 * 서버(호스트)가 정한 시작 시각을 기준으로 그리기 때문에, 늦게 들어온 참가자도
 * 같은 숫자를 보게 된다.
 */
export function Countdown({ startedAt, durationMs, label, onFinish }: CountdownProps) {
  const [remaining, setRemaining] = useState(() => remainingSeconds(startedAt, durationMs));

  useEffect(() => {
    const id = window.setInterval(() => {
      const next = remainingSeconds(startedAt, durationMs);
      setRemaining((prev) => {
        if (prev !== next && next === 0) onFinish?.();
        return next;
      });
    }, 80);
    return () => window.clearInterval(id);
  }, [startedAt, durationMs, onFinish]);

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-6">
      {label && <p className="text-[15px] font-bold text-white/60">{label}</p>}
      <div className="relative flex h-40 w-40 items-center justify-center">
        <span className="absolute inset-0 animate-pulse-ring rounded-full border-4 border-pop-400/50" />
        <AnimatePresence mode="popLayout">
          <motion.span
            key={remaining}
            initial={{ scale: 0.4, opacity: 0, rotate: -12 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            exit={{ scale: 1.9, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 18 }}
            className="text-[96px] font-black leading-none text-white text-shadow-pop"
          >
            {remaining > 0 ? remaining : 'GO!'}
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  );
}

function remainingSeconds(startedAt: number, durationMs: number): number {
  const left = startedAt + durationMs - Date.now();
  return Math.max(0, Math.ceil(left / 1000));
}
