import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface ScreenProps {
  children: ReactNode;
  /** 배경 연출 */
  tone?: 'default' | 'game' | 'result';
  className?: string;
}

const TONES = {
  default:
    'bg-[radial-gradient(120%_80%_at_50%_-10%,#1b3a6b_0%,#0f1c3a_45%,#0a1024_100%)]',
  game: 'bg-[radial-gradient(120%_70%_at_50%_0%,#26306b_0%,#131c3d_50%,#0a1024_100%)]',
  result:
    'bg-[radial-gradient(120%_80%_at_50%_-5%,#3a2a6b_0%,#17204a_45%,#0a1024_100%)]',
};

/** 모바일 우선 화면 프레임 (390x844 기준, 데스크톱에서는 가운데 정렬) */
export function Screen({ children, tone = 'default', className }: ScreenProps) {
  return (
    <div className={cn('flex min-h-full w-full flex-col', TONES[tone])}>
      <div className={cn('app-frame screen-pad', className)}>{children}</div>
    </div>
  );
}

interface TopBarProps {
  left?: ReactNode;
  center?: ReactNode;
  right?: ReactNode;
}

export function TopBar({ left, center, right }: TopBarProps) {
  return (
    <div
      className="sticky top-0 z-20 -mx-5 flex items-center justify-between gap-2 px-5 py-3 backdrop-blur-md"
      style={{ paddingTop: 'calc(12px + env(safe-area-inset-top))' }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">{left}</div>
      <div className="flex shrink-0 items-center">{center}</div>
      <div className="flex min-w-0 flex-1 items-center justify-end gap-2">{right}</div>
    </div>
  );
}

export function BackButton({ onClick, label = '뒤로' }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-xl text-white active:bg-white/20"
    >
      ‹
    </button>
  );
}
