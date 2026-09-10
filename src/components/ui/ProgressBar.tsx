import { motion } from 'framer-motion';
import { cn } from '@/lib/cn';

interface ProgressBarProps {
  /** 0~1 */
  value: number;
  surface?: 'light' | 'dark';
  className?: string;
}

export function ProgressBar({ value, surface = 'light', className }: ProgressBarProps) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn(
        'h-1.5 w-full overflow-hidden rounded-full',
        surface === 'light' ? 'bg-ink-200' : 'bg-white/15',
        className,
      )}
    >
      <motion.div
        className={cn('h-full rounded-full', surface === 'light' ? 'bg-primary' : 'bg-accent')}
        initial={false}
        animate={{ width: `${pct}%` }}
        transition={{ type: 'spring', stiffness: 140, damping: 22 }}
      />
    </div>
  );
}

/** 로딩 점 세 개 */
export function LoadingDots({ surface = 'light' }: { surface?: 'light' | 'dark' }) {
  return (
    <span className="inline-flex items-center gap-1.5" aria-hidden>
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className={cn(
            'h-1.5 w-1.5 animate-dot-bounce rounded-full',
            surface === 'light' ? 'bg-ink-400' : 'bg-white',
          )}
          style={{ animationDelay: `${index * 0.14}s` }}
        />
      ))}
    </span>
  );
}
