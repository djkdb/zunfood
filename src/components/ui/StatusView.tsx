import type { ReactNode } from 'react';
import { Button } from './Button';
import { cn } from '@/lib/cn';

interface StatusViewProps {
  emoji: string;
  title: string;
  description?: string;
  /** 사용자가 바로 취할 수 있는 다음 행동 */
  action?: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
  surface?: 'light' | 'dark';
  children?: ReactNode;
}

/**
 * 빈 상태 · 오류 상태 공통 화면.
 * 무엇이 잘못됐는지 말하고, 반드시 다음 행동을 준다.
 */
export function StatusView({
  emoji,
  title,
  description,
  action,
  secondaryAction,
  surface = 'light',
  children,
}: StatusViewProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 px-2 py-16 text-center">
      <span className="text-[48px]" aria-hidden>
        {emoji}
      </span>
      <div>
        <h2 className={cn('text-h2', surface === 'dark' && 'text-white')}>{title}</h2>
        {description && (
          <p
            className={cn(
              'mt-2 text-body',
              surface === 'light' ? 'text-muted' : 'text-white/55',
            )}
          >
            {description}
          </p>
        )}
      </div>
      {children}
      {(action || secondaryAction) && (
        <div className="w-full max-w-[280px] space-y-2">
          {action && (
            <Button block surface={surface} onClick={action.onClick}>
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              block
              variant="ghost"
              size="md"
              surface={surface}
              onClick={secondaryAction.onClick}
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
