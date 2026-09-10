import { MockPlaceRepository } from './MockPlaceRepository';
import type { PlaceRepository } from './PlaceRepository';

let instance: PlaceRepository | null = null;

export function getPlaceRepository(): PlaceRepository {
  if (!instance) instance = new MockPlaceRepository();
  return instance;
}

export type { PlaceRepository, PlaceSearchResult } from './PlaceRepository';
