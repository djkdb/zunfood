import { SEARCH } from '@/config/app';
import { ChoiceChip, Segmented } from '@/components/ui/Segmented';
import { formatRadius } from '@/lib/format';
import { FOOD_CATEGORIES, type FoodCategory, type RestaurantFilters } from '@/types/restaurant';

interface ConditionFieldsProps {
  radius: number;
  filters: RestaurantFilters;
  onRadiusChange: (radius: number) => void;
  onFiltersChange: (filters: RestaurantFilters) => void;
  /** 제외 음식·추가 조건까지 노출할지 */
  showAdvanced?: boolean;
}

const BUDGET_LABEL: Record<number, string> = {
  10000: '1만',
  15000: '1.5만',
  20000: '2만',
  30000: '3만+',
};

/** 반경 · 예산 · 음식 종류 — 솔로/멀티가 함께 쓰는 조건 편집기 */
export function ConditionFields({
  radius,
  filters,
  onRadiusChange,
  onFiltersChange,
  showAdvanced = false,
}: ConditionFieldsProps) {
  const toggleCategory = (id: FoodCategory) => {
    const has = filters.categories.includes(id);
    onFiltersChange({
      ...filters,
      categories: has
        ? filters.categories.filter((c) => c !== id)
        : [...filters.categories, id],
      excludedCategories: filters.excludedCategories.filter((c) => c !== id),
    });
  };

  const toggleExcluded = (id: FoodCategory) => {
    const has = filters.excludedCategories.includes(id);
    onFiltersChange({
      ...filters,
      excludedCategories: has
        ? filters.excludedCategories.filter((c) => c !== id)
        : [...filters.excludedCategories, id],
      categories: filters.categories.filter((c) => c !== id),
    });
  };

  return (
    <div className="space-y-7">
      <Field label="얼마나 멀리?">
        <Segmented
          label="검색 반경"
          value={radius}
          onChange={onRadiusChange}
          options={SEARCH.radiusOptions.map((r) => ({ value: r, label: formatRadius(r) }))}
        />
      </Field>

      <Field label="1인 예산">
        <Segmented
          label="1인 예산"
          value={filters.budget}
          onChange={(budget) => onFiltersChange({ ...filters, budget })}
          options={SEARCH.budgetOptions.map((b) => ({ value: b, label: BUDGET_LABEL[b] }))}
        />
      </Field>

      <Field label="음식" hint={filters.categories.length === 0 ? '고르지 않으면 전체' : undefined}>
        <div className="flex flex-wrap gap-2">
          {FOOD_CATEGORIES.map((category) => (
            <ChoiceChip
              key={category.id}
              selected={filters.categories.includes(category.id)}
              onClick={() => toggleCategory(category.id)}
            >
              <span aria-hidden>{category.emoji}</span>
              {category.label}
            </ChoiceChip>
          ))}
        </div>
      </Field>

      {showAdvanced && (
        <>
          <Field label="오늘은 빼주세요">
            <div className="flex flex-wrap gap-2">
              {FOOD_CATEGORIES.map((category) => (
                <ChoiceChip
                  key={category.id}
                  tone="exclude"
                  selected={filters.excludedCategories.includes(category.id)}
                  onClick={() => toggleExcluded(category.id)}
                >
                  {category.label}
                </ChoiceChip>
              ))}
            </div>
          </Field>

          <div className="group-list">
            <ToggleRow
              label="지금 영업 중인 곳만"
              checked={filters.openNowOnly}
              onChange={(openNowOnly) => onFiltersChange({ ...filters, openNowOnly })}
            />
            <ToggleRow
              label="평점 4.0 이상만"
              checked={filters.minRating >= 4}
              onChange={(on) => onFiltersChange({ ...filters, minRating: on ? 4 : 0 })}
            />
          </div>
        </>
      )}
    </div>
  );
}

function Field({
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
      <div className="mb-2.5 flex items-baseline gap-2">
        <h2 className="text-h3 text-ink-900">{label}</h2>
        {hint && <span className="text-sm text-muted">{hint}</span>}
      </div>
      {children}
    </section>
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
      className="flex h-[54px] w-full items-center justify-between px-4 active:bg-ink-50"
    >
      <span className="text-body font-semibold text-ink-900">{label}</span>
      <span
        className={`relative h-[26px] w-[44px] shrink-0 rounded-full transition-colors duration-200 ${
          checked ? 'bg-primary' : 'bg-ink-200'
        }`}
      >
        <span
          className={`absolute top-[3px] h-5 w-5 rounded-full bg-white shadow-sm transition-all duration-200 ease-out ${
            checked ? 'left-[21px]' : 'left-[3px]'
          }`}
        />
      </span>
    </button>
  );
}
