import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'pop' | 'ghost' | 'outline' | 'danger';
type Size = 'lg' | 'md' | 'sm';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  loading?: boolean;
  leading?: ReactNode;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-gradient-to-b from-brand-400 to-brand-600 text-white shadow-pop active:shadow-pop-sm border-brand-700/40',
  pop: 'bg-gradient-to-b from-pop-300 to-pop-500 text-navy-950 shadow-pop active:shadow-pop-sm border-pop-700/40',
  ghost: 'bg-white/10 text-white border-white/10 active:bg-white/[0.14]',
  outline: 'bg-transparent text-white border-white/25 active:bg-white/10',
  danger: 'bg-coral/90 text-white border-coral shadow-pop-sm',
};

const SIZES: Record<Size, string> = {
  lg: 'h-14 px-6 text-[17px] rounded-2xl',
  md: 'h-12 px-5 text-[15px] rounded-xl',
  sm: 'h-10 px-4 text-[14px] rounded-xl',
};

/** 게임 UI용 두툼한 버튼. 모바일 터치 영역(최소 40px)을 항상 확보한다. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'lg', block, loading, leading, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex select-none items-center justify-center gap-2 border font-bold tracking-tight',
        'transition-[transform,box-shadow,background-color] duration-100',
        'active:translate-y-[3px] disabled:pointer-events-none disabled:opacity-45',
        VARIANTS[variant],
        SIZES[size],
        block && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? (
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
      ) : (
        leading
      )}
      {children}
    </button>
  );
});
