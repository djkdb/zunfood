import { motion } from 'framer-motion';

/** 게임 진행률 (0~1) */
export function ProgressBar({ value, label }: { value: number; label?: string }) {
  return (
    <div className="w-full">
      {label && (
        <p className="mb-1.5 text-center text-[12px] font-bold tracking-widest text-white/45">
          {label}
        </p>
      )}
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-brand-300 to-pop-400"
          initial={false}
          animate={{ width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        />
      </div>
    </div>
  );
}
