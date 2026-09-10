import type { JudgeProvider, JudgeRequest, JudgeVerdict } from './JudgeProvider';
import { computeVerdict } from './MockJudgeProvider';

/**
 * 서버(또는 서버리스 함수)에 판결을 위임하는 구현체.
 *
 * LLM API 키는 **반드시 서버에 보관**한다. 이 클래스는 키를 알지 못한다.
 * 서버는 아래 형태로 응답해야 한다:
 *   { restaurantId: string, headline: string, reasons: string[] }
 *
 * 서버가 후보 목록에 없는 식당을 반환하면(=지어냈다면) 응답을 버리고
 * 결정론적 로컬 판결로 대체한다.
 */
export class HttpJudgeProvider implements JudgeProvider {
  readonly source = 'http';
  private readonly endpoint: string;

  constructor(endpoint: string) {
    this.endpoint = endpoint;
  }

  async judge(request: JudgeRequest): Promise<JudgeVerdict> {
    const fallback = computeVerdict(request);
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wishes: request.wishes.map((w) => ({ nickname: w.nickname, text: w.text })),
          budget: request.budget,
          radius: request.radius,
          location: request.location,
          // 후보는 판결에 필요한 정보만 전달한다.
          candidates: request.candidates.map((c) => ({
            id: c.id,
            name: c.name,
            category: c.category,
            rating: c.rating,
            priceRange: c.priceRange,
            distance: c.distance,
            isOpen: c.isOpen,
            menu: c.menu,
            tags: c.tags,
          })),
        }),
      });

      if (!response.ok) return fallback;

      const body = (await response.json()) as Partial<JudgeVerdict>;
      const isValid =
        typeof body.restaurantId === 'string' &&
        request.candidates.some((c) => c.id === body.restaurantId);

      if (!isValid) return fallback;

      return {
        restaurantId: body.restaurantId as string,
        headline: body.headline?.slice(0, 60) || fallback.headline,
        reasons:
          Array.isArray(body.reasons) && body.reasons.length > 0
            ? body.reasons.slice(0, 5).map((r) => String(r).slice(0, 80))
            : fallback.reasons,
        scores: fallback.scores,
      };
    } catch {
      return fallback;
    }
  }
}
