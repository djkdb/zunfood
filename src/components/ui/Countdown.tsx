import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';

interface CountdownProps {
  /** 호스트가 정한 시작 시각(ms) — 늦게 접속해도 같은 숫자를 본다 */
  startedAt: number;
  durationMs: number;
  label?: string;
}

/** 3 · 2 · 1 카운트다운 */
export function Countdown({ startedAt, durationMs, label }: CountdownProps) {
  const [remaining, setRemaining] = useState(() => remainingSeconds(startedAt, durationMs));

  useEffect(() => {
    const id = window.setInterval(
      () => setRemaining(remainingSeconds(startedAt, durationMs)),
      80,
    );
    return () => window.clearInterval(id);
  }, [startedAt, durationMs]);

  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10">
      {label && <p className="text-[15px] font-bold text-white/45">{label}</p>}
      <div className="relative flex h-[168px] w-[168px] items-center justify-center">
        <AnimatePresence mode="popLayout">
          <motion.span
            key={remaining}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.7, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 340, damping: 20 }}
            className="text-count text-white"
          >
            {remaining > 0 ? remaining : 'GO'}
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  );
}

function remainingSeconds(startedAt: number, durationMs: number): number {
  return Math.max(0, Math.ceil((startedAt + durationMs - Date.now()) / 1000));
}
