import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string | null;
  surface?: 'light' | 'dark';
  /** 오른쪽에 붙는 보조 요소 (글자수 등) */
  trailing?: React.ReactNode;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, error, surface = 'light', trailing, className, id, ...rest },
  ref,
) {
  const inputId = id ?? rest.name ?? label;
  return (
    <div>
      {label && (
        <label
          htmlFor={inputId}
          className={cn(
            'mb-2 block text-sm font-bold',
            surface === 'light' ? 'text-ink-600' : 'text-white/60',
          )}
        >
          {label}
        </label>
      )}
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          className={cn(
            'h-[54px] w-full rounded-lg border px-4 text-[16px] font-semibold outline-none',
            'transition-colors duration-150',
            surface === 'light'
              ? 'border-line bg-surface text-ink-900 placeholder:font-medium placeholder:text-ink-300 focus:border-primary'
              : 'border-white/15 bg-white/8 text-white placeholder:text-white/30 focus:border-primary-300',
            error && 'border-danger focus:border-danger',
            trailing && 'pr-14',
            className,
          )}
          {...rest}
        />
        {trailing && (
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-ink-300">
            {trailing}
          </span>
        )}
      </div>
      {error && <p className="mt-2 text-sm font-semibold text-danger">{error}</p>}
    </div>
  );
});
