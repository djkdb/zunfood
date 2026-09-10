import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string | null;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, hint, error, className, id, ...rest },
  ref,
) {
  const inputId = id ?? rest.name ?? label;
  return (
    <label htmlFor={inputId} className="block">
      {label && (
        <span className="mb-2 block text-[13px] font-bold text-white/55">{label}</span>
      )}
      <input
        ref={ref}
        id={inputId}
        className={cn(
          'h-14 w-full rounded-2xl border bg-white/[0.06] px-4 text-[17px] font-semibold text-white',
          'placeholder:font-medium placeholder:text-white/30',
          'outline-none transition-colors focus:border-brand-400 focus:bg-white/[0.09]',
          error ? 'border-coral' : 'border-white/12',
          className,
        )}
        {...rest}
      />
      {error ? (
        <span className="mt-2 block text-[13px] font-semibold text-coral">{error}</span>
      ) : hint ? (
        <span className="mt-2 block text-[13px] text-white/40">{hint}</span>
      ) : null}
    </label>
  );
});
