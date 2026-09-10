import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  tone?: 'brand' | 'pop' | 'danger';
}

const TONES = {
  brand: 'border-brand-400 bg-brand-500/25 text-brand-100',
  pop: 'border-pop-400 bg-pop-400/25 text-pop-300',
  danger: 'border-coral bg-coral/20 text-coral',
};

/** 조건 선택용 칩 (반경 / 예산 / 음식 종류) */
export function Chip({ selected, tone = 'brand', className, children, ...rest }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        'min-h-[44px] rounded-2xl border px-4 py-2.5 text-[15px] font-bold transition-all duration-150',
        'active:scale-[0.97]',
        selected
          ? TONES[tone]
          : 'border-white/10 bg-white/[0.05] text-white/65 active:bg-white/10',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
