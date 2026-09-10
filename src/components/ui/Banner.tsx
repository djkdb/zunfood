import { AnimatePresence, motion } from 'framer-motion';

interface BannerProps {
  message: string | null;
  onClose?: () => void;
  tone?: 'error' | 'info';
}

/** 화면 상단 안내/오류 배너 */
export function Banner({ message, onClose, tone = 'error' }: BannerProps) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          role="status"
          className={`mb-3 flex items-start gap-3 rounded-2xl border px-4 py-3 text-[14px] font-semibold ${
            tone === 'error'
              ? 'border-coral/40 bg-coral/15 text-coral'
              : 'border-brand-400/40 bg-brand-500/15 text-brand-100'
          }`}
        >
          <span className="mt-[1px]">{tone === 'error' ? '⚠️' : 'ℹ️'}</span>
          <span className="flex-1 leading-snug">{message}</span>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              className="-mr-1 -mt-1 h-7 w-7 shrink-0 rounded-full text-white/50 active:bg-white/10"
            >
              ✕
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
