import { Sheet } from '@/components/ui/Sheet';
import { RestaurantCard } from '@/components/RestaurantCard';
import { DemoDataNotice } from '@/components/DemoDataNotice';
import { mapUrl } from '@/lib/map';
import type { Restaurant } from '@/types/restaurant';

interface CandidateSheetProps {
  open: boolean;
  onClose: () => void;
  candidates: Restaurant[];
  /** 이번에 뽑힌 곳 — 따로 떼어 맨 위에 보여준다 */
  winnerId?: string;
}

/**
 * 이번 결정에 올랐던 후보 전체.
 *
 * "주변 10곳 중에서 뽑았어요" 로 끝내지 않고 그 10곳을 실제로 보여준다.
 * 결과가 마음에 안 들 때 다음 후보를 스스로 고를 수 있어야 납득이 된다.
 * 각 줄은 데이터 소스의 상세 페이지(카카오맵 등)로 연결된다.
 */
export function CandidateSheet({ open, onClose, candidates, winnerId }: CandidateSheetProps) {
  const winner = candidates.find((c) => c.id === winnerId) ?? null;
  const rest = candidates
    .filter((c) => c.id !== winnerId)
    .sort((a, b) => a.distance - b.distance);

  const openDetail = (restaurant: Restaurant) =>
    window.open(mapUrl(restaurant), '_blank', 'noopener,noreferrer');

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`후보 ${candidates.length}곳`}
      description="눌러서 지도와 상세 정보를 볼 수 있어요."
    >
      <DemoDataNotice surface="light" />

      <div className="mt-3 max-h-[54vh] space-y-4 overflow-y-auto overscroll-contain">
        {winner && (
          <Section label="오늘의 선택">
            <RestaurantCard
              restaurant={winner}
              onClick={() => openDetail(winner)}
              className="bg-primary/8 ring-2 ring-primary/35"
            />
          </Section>
        )}

        {rest.length > 0 && (
          <Section label={winner ? '다른 후보' : '후보'} hint="가까운 순">
            <ul className="space-y-1.5">
              {rest.map((restaurant) => (
                <li key={restaurant.id}>
                  <RestaurantCard
                    restaurant={restaurant}
                    onClick={() => openDetail(restaurant)}
                  />
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>
    </Sheet>
  );
}

function Section({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-1.5 flex items-baseline gap-1.5 px-1">
        <h3 className="text-sm font-extrabold text-ink-700">{label}</h3>
        {hint && <span className="text-xs text-muted">{hint}</span>}
      </div>
      {children}
    </section>
  );
}
