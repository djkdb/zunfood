import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/** 기본 카드 — 어두운 배경 위 유리 느낌 */
export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('glass rounded-3xl p-5 shadow-card', className)} {...rest} />;
}

export function SectionTitle({ className, ...rest }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn('mb-3 text-[13px] font-bold uppercase tracking-widest text-white/45', className)}
      {...rest}
    />
  );
}
