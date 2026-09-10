import { cn } from '@/lib/cn';

/** 참가자마다 다른 동물 얼굴 — 닉네임 이니셜보다 친구끼리 알아보기 쉽다 */
const FACES = ['🐻', '🐱', '🐶', '🐰', '🐼', '🦊', '🐯', '🐨'];
const TINTS = [
  'bg-[#FFE9D6]',
  'bg-[#E2ECFF]',
  'bg-[#E4F7E9]',
  'bg-[#FFE5E9]',
  'bg-[#EFE7FF]',
  'bg-[#FFF3D1]',
  'bg-[#DFF4F6]',
  'bg-[#F0EFEA]',
];

export function faceFor(avatar: number): string {
  return FACES[avatar % FACES.length];
}

interface PlayerAvatarProps {
  avatar: number;
  isHost?: boolean;
  size?: 'sm' | 'md' | 'lg';
  /** 아직 준비/투표하지 않은 상태 */
  dim?: boolean;
  surface?: 'light' | 'dark';
  className?: string;
}

const SIZES = {
  sm: 'h-8 w-8 text-[16px] rounded-[10px]',
  md: 'h-11 w-11 text-[22px] rounded-md',
  lg: 'h-16 w-16 text-[32px] rounded-xl',
};

export function PlayerAvatar({
  avatar,
  isHost,
  size = 'md',
  dim,
  surface = 'light',
  className,
}: PlayerAvatarProps) {
  return (
    <span className={cn('relative inline-flex shrink-0', className)}>
      <span
        className={cn(
          'flex items-center justify-center',
          SIZES[size],
          surface === 'light' ? TINTS[avatar % TINTS.length] : 'bg-white/12',
          dim && 'opacity-35 saturate-50',
        )}
      >
        {faceFor(avatar)}
      </span>
      {isHost && (
        <span
          className="absolute -right-1 -top-1.5 text-[13px] leading-none drop-shadow-sm"
          aria-hidden
        >
          👑
        </span>
      )}
    </span>
  );
}
