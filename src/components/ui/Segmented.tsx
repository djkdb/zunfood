import { cn } from '@/lib/cn';

interface SegmentedOption<T> {
  value: T;
  label: string;
}

interface SegmentedProps<T extends string | number> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  surface?: 'light' | 'dark';
  className?: string;
}

/**
 * 세그먼티드 컨트롤 — 반경/예산처럼 하나만 고르는 짧은 선택지에 쓴다.
 * 칩을 흩뿌리는 것보다 네이티브 앱에 가깝고 탭 영역도 크다.
 */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
  surface = 'light',
  className,
}: SegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        'grid gap-1 rounded-lg p-1',
        surface === 'light' ? 'bg-ink-100' : 'bg-white/10',
        className,
      )}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              'h-10 rounded text-[14px] font-bold transition-all duration-150 ease-out',
              selected
                ? surface === 'light'
                  ? 'bg-surface text-ink-900 shadow-sm'
                  : 'bg-white text-ink-900'
                : surface === 'light'
                  ? 'text-ink-500 active:bg-ink-200/60'
                  : 'text-white/60 active:bg-white/10',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

interface ChoiceChipProps {
  selected?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  tone?: 'default' | 'exclude';
  className?: string;
}

/** 다중 선택용 칩 (음식 종류 등) */
export function ChoiceChip({
  selected,
  onClick,
  children,
  tone = 'default',
  className,
}: ChoiceChipProps) {
  const activeStyle =
    tone === 'exclude'
      ? 'border-danger/35 bg-danger/8 text-danger'
      : 'border-primary bg-primary-50 text-primary-700';

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'inline-flex h-11 items-center gap-1.5 rounded-lg border px-3.5 text-[14px] font-bold',
        'transition-all duration-150 ease-out active:scale-[0.97]',
        selected ? activeStyle : 'border-line bg-surface text-ink-600 active:bg-ink-50',
        className,
      )}
    >
      {children}
    </button>
  );
}
