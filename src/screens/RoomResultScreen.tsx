import { APP } from '@/config/app';
import { StatusView } from '@/components/ui/StatusView';
import { ResultView } from '@/components/ResultView';
import { getGame } from '@/games/registry';
import { inviteUrl, shareOrCopy } from '@/lib/share';
import { useRoomStore } from '@/store/roomStore';
import { toast } from '@/store/toastStore';
import type { Player, Room } from '@/types/room';

interface RoomResultScreenProps {
  room: Room;
  players: Player[];
  isHost: boolean;
}

export function RoomResultScreen({ room, players, isHost }: RoomResultScreenProps) {
  const playAgain = useRoomStore((s) => s.playAgain);
  const winner = room.candidates.find((c) => c.id === room.winnerId) ?? null;
  const game = room.selectedGame ? getGame(room.selectedGame) : null;

  if (!winner) {
    return (
      <div className="pad-x flex flex-1 flex-col">
        <StatusView
          surface="dark"
          emoji="🤔"
          title="결과를 불러오지 못했어요"
          description="방장이 다시 결정할 수 있어요."
          action={isHost ? { label: '다시 결정하기', onClick: () => void playAgain() } : undefined}
        />
      </div>
    );
  }

  /** 공유 카드 — 게임 · 우승 · 참가자 */
  const share = async () => {
    const lines = [
      '🍽️ 오늘 우리들의 선택',
      '',
      `게임: ${game?.title ?? '게임'}`,
      `WINNER: ${winner.name}`,
      `참가자: ${players.map((p) => p.nickname).join(' · ')}`,
    ].join('\n');

    const result = await shareOrCopy({
      title: APP.shareTitle,
      text: lines,
      url: inviteUrl(room.code),
    });
    if (result === 'copied') toast('결과를 복사했어요', { icon: '🔗' });
    if (result === 'failed') toast('공유하지 못했어요', { tone: 'error' });
  };

  return (
    <div className="pad-x flex flex-1 flex-col">
      <ResultView
        restaurant={winner}
        kicker="오늘의 선택"
        teaser="오늘 우리는…"
        footnote={
          <span className="flex flex-col items-center gap-1">
            {game && (
              <span>
                {game.emoji} {game.title}(으)로 결정
              </span>
            )}
            <span className="text-white/35">
              {players.map((p) => p.nickname).join(' · ')}
            </span>
          </span>
        }
        onShare={share}
        actions={
          isHost
            ? [
                { label: '다시 결정하기', onClick: () => void playAgain() },
                { label: '친구 더 부르기', onClick: share },
              ]
            : [{ label: '결과 공유', onClick: share }]
        }
      />
    </div>
  );
}
