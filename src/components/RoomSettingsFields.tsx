import { SEARCH } from '@/config/app';
import { Chip } from '@/components/ui/Chip';
import { SectionTitle } from '@/components/ui/Card';
import { LocationPicker } from '@/components/LocationPicker';
import { formatRadius, formatWon } from '@/lib/format';
import { FOOD_CATEGORIES, type FoodCategory, type PlaceLocation, type RestaurantFilters } from '@/types/restaurant';

export interface RoomSettingsValue {
  location: PlaceLocation | null;
  radius: number;
  filters: RestaurantFilters;
}

interface Props {
  value: RoomSettingsValue;
  onChange: (next: RoomSettingsValue) => void;
}

/** 위치 · 반경 · 음식 조건 설정 (방 만들기 / 방장 설정 변경에서 공유) */
export function RoomSettingsFields({ value, onChange }: Props) {
  const patch = (next: Partial<RoomSettingsValue>) => onChange({ ...value, ...next });
  const patchFilters = (next: Partial<RestaurantFilters>) =>
    patch({ filters: { ...value.filters, ...next } });

  const toggleCategory = (id: FoodCategory) => {
    const has = value.filters.categories.includes(id);
    patchFilters({
      categories: has
        ? value.filters.categories.filter((c) => c !== id)
        : [...value.filters.categories, id],
      excludedCategories: value.filters.excludedCategories.filter((c) => c !== id),
    });
  };

  const toggleExcluded = (id: FoodCategory) => {
    const has = value.filters.excludedCategories.includes(id);
    patchFilters({
      excludedCategories: has
        ? value.filters.excludedCategories.filter((c) => c !== id)
        : [...value.filters.excludedCategories, id],
      categories: value.filters.categories.filter((c) => c !== id),
    });
  };

  return (
    <div className="space-y-7">
      <section>
        <SectionTitle>어디서 먹을까요?</SectionTitle>
        <LocationPicker value={value.location} onChange={(location) => patch({ location })} />
      </section>

      <section>
        <SectionTitle>검색 반경</SectionTitle>
        <div className="grid grid-cols-4 gap-2">
          {SEARCH.radiusOptions.map((radius) => (
            <Chip
              key={radius}
              selected={value.radius === radius}
              onClick={() => patch({ radius })}
              className="!px-2"
            >
              {formatRadius(radius)}
            </Chip>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle>1인 예산</SectionTitle>
        <div className="grid grid-cols-4 gap-2">
          {SEARCH.budgetOptions.map((budget) => (
            <Chip
              key={budget}
              tone="pop"
              selected={value.filters.budget === budget}
              onClick={() => patchFilters({ budget })}
              className="!px-1 text-[13px]"
            >
              {budget >= 30_000 ? '3만+' : `${budget / 10_000}만`}
            </Chip>
          ))}
        </div>
        <p className="mt-2 text-[12px] text-white/35">
          선택: {formatWon(value.filters.budget)} 안팎
        </p>
      </section>

      <section>
        <SectionTitle>먹고 싶은 음식 (선택 안 하면 전체)</SectionTitle>
        <div className="flex flex-wrap gap-2">
          {FOOD_CATEGORIES.map((category) => (
            <Chip
              key={category.id}
              selected={value.filters.categories.includes(category.id)}
              onClick={() => toggleCategory(category.id)}
              className="!px-3.5"
            >
              {category.emoji} {category.label}
            </Chip>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle>오늘은 이건 빼주세요</SectionTitle>
        <div className="flex flex-wrap gap-2">
          {FOOD_CATEGORIES.map((category) => (
            <Chip
              key={category.id}
              tone="danger"
              selected={value.filters.excludedCategories.includes(category.id)}
              onClick={() => toggleExcluded(category.id)}
              className="!px-3.5"
            >
              {category.label}
            </Chip>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle>추가 조건</SectionTitle>
        <div className="space-y-2">
          <ToggleRow
            label="지금 영업 중인 곳만"
            checked={value.filters.openNowOnly}
            onChange={(openNowOnly) => patchFilters({ openNowOnly })}
          />
          <ToggleRow
            label="평점 4.0 이상만"
            checked={value.filters.minRating >= 4}
            onChange={(on) => patchFilters({ minRating: on ? 4 : 0 })}
          />
        </div>
      </section>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex h-14 w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.05] px-4 active:bg-white/10"
    >
      <span className="text-[15px] font-bold">{label}</span>
      <span
        className={`relative h-7 w-12 rounded-full transition-colors ${
          checked ? 'bg-brand-500' : 'bg-white/15'
        }`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${
            checked ? 'left-6' : 'left-1'
          }`}
        />
      </span>
    </button>
  );
}
