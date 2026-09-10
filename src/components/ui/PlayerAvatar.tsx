import { cn } from '@/lib/cn';

const COLORS = [
  'from-brand-300 to-brand-600',
  'from-pop-300 to-pop-600',
  'from-mint to-brand-500',
  'from-coral to-pop-500',
  'from-grape to-brand-500',
  'from-pop-400 to-coral',
  'from-brand-200 to-mint',
  'from-grape to-coral',
];

interface PlayerAvatarProps {
  nickname: string;
  avatar: number;
  isHost?: boolean;
  size?: 'sm' | 'md' | 'lg';
  dim?: boolean;
  className?: string;
}

const SIZES = {
  sm: 'h-9 w-9 text-[14px]',
  md: 'h-12 w-12 text-[18px]',
  lg: 'h-16 w-16 text-[24px]',
};

export function PlayerAvatar({
  nickname,
  avatar,
  isHost,
  size = 'md',
  dim,
  className,
}: PlayerAvatarProps) {
  return (
    <div className={cn('relative shrink-0', className)}>
      <div
        className={cn(
          'flex items-center justify-center rounded-2xl bg-gradient-to-br font-black text-navy-950',
          SIZES[size],
          COLORS[avatar % COLORS.length],
          dim && 'opacity-35 grayscale',
        )}
      >
        {nickname.slice(0, 2)}
      </div>
      {isHost && (
        <span className="absolute -right-1.5 -top-2 text-[15px] drop-shadow" aria-label="방장">
          👑
        </span>
      )}
    </div>
  );
}
