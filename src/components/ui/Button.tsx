import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'lg' | 'md' | 'sm';
export type ButtonSurface = 'light' | 'dark';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** 어두운 게임 화면 위에 놓일 때 'dark' */
  surface?: ButtonSurface;
  block?: boolean;
  loading?: boolean;
  leading?: ReactNode;
}

const STYLES: Record<ButtonSurface, Record<ButtonVariant, string>> = {
  light: {
    primary: 'bg-primary text-white shadow-sm hover:bg-primary-600',
    accent: 'bg-accent text-white shadow-sm hover:bg-accent-600',
    secondary: 'bg-ink-100 text-ink-900 hover:bg-ink-200',
    ghost: 'bg-transparent text-ink-600 hover:bg-ink-100',
    danger: 'bg-danger text-white shadow-sm',
  },
  dark: {
    primary: 'bg-primary text-white hover:bg-primary-400',
    accent: 'bg-accent text-white hover:bg-accent-400',
    secondary: 'bg-white/14 text-white ring-1 ring-inset ring-white/12 hover:bg-white/20',
    ghost: 'bg-transparent text-white/70 hover:bg-white/10',
    danger: 'bg-danger text-white',
  },
};

const SIZES: Record<ButtonSize, string> = {
  lg: 'h-[54px] px-6 text-[16px] rounded-lg gap-2',
  md: 'h-11 px-4 text-[15px] rounded-md gap-1.5',
  sm: 'h-10 px-3.5 text-[13.5px] rounded gap-1',
};

/**
 * 기본 버튼.
 * 과장된 입체 그림자 대신, 눌렸을 때 살짝 줄어드는 실제 앱 감각을 쓴다.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'lg',
    surface = 'light',
    block,
    loading,
    leading,
    className,
    children,
    disabled,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex select-none items-center justify-center font-bold tracking-[-0.01em]',
        'transition-[transform,background-color,opacity] duration-150 ease-out',
        'active:scale-[0.975] disabled:pointer-events-none disabled:opacity-40',
        STYLES[surface][variant],
        SIZES[size],
        block && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? (
        <span
          className={cn(
            'h-[18px] w-[18px] animate-spin rounded-full border-2 border-current border-t-transparent opacity-70',
          )}
        />
      ) : (
        leading
      )}
      {children}
    </button>
  );
});

/** 아이콘 전용 원형 버튼 (앱바 등) */
export const IconButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { surface?: ButtonSurface; label: string }
>(function IconButton({ surface = 'light', label, className, children, ...rest }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      className={cn(
        'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[19px]',
        'transition-colors active:scale-95',
        surface === 'dark'
          ? 'text-white/80 hover:bg-white/10'
          : 'text-ink-700 hover:bg-ink-100',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});
