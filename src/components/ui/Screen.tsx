import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export { IconButton } from './Button';

export type ScreenVariant = 'app' | 'arena';

interface ScreenProps {
  children: ReactNode;
  /** 'app' = 밝은 앱 셸, 'arena' = 게임 몰입 화면 */
  variant?: ScreenVariant;
  className?: string;
}

const BACKGROUNDS: Record<ScreenVariant, string> = {
  app: 'bg-paper text-ink-900',
  arena: 'on-dark bg-arena text-white',
};

/** 모바일 우선 화면 프레임 */
export function Screen({ children, variant = 'app', className }: ScreenProps) {
  return (
    <div className={cn('flex min-h-full w-full flex-1 flex-col', BACKGROUNDS[variant])}>
      {variant === 'arena' && (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 opacity-70"
          style={{
            background:
              'radial-gradient(90% 55% at 50% -8%, rgba(47,107,255,0.28) 0%, rgba(12,19,34,0) 62%)',
          }}
        />
      )}
      <div className={cn('frame relative', className)}>{children}</div>
    </div>
  );
}

interface AppBarProps {
  title?: ReactNode;
  left?: ReactNode;
  right?: ReactNode;
  surface?: ScreenVariant;
  /** 스크롤해도 상단에 붙어 있게 */
  sticky?: boolean;
  className?: string;
}

/** 상단 바 — 제목은 가운데, 액션은 양옆 */
export function AppBar({
  title,
  left,
  right,
  surface = 'app',
  sticky = true,
  className,
}: AppBarProps) {
  return (
    <header
      className={cn(
        'safe-top pad-x z-sticky flex h-[56px] shrink-0 items-center justify-between gap-2 pt-[env(safe-area-inset-top)]',
        sticky && 'sticky top-0',
        surface === 'app' ? 'bg-paper/92 backdrop-blur' : 'bg-arena/85 backdrop-blur',
        className,
      )}
      style={{ height: 'calc(56px + env(safe-area-inset-top))' }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-1">{left}</div>
      {title && (
        <h1
          className={cn(
            'shrink-0 text-[15px] font-bold',
            surface === 'app' ? 'text-ink-900' : 'text-white',
          )}
        >
          {title}
        </h1>
      )}
      <div className="flex min-w-0 flex-1 items-center justify-end gap-1">{right}</div>
    </header>
  );
}
