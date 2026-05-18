import { fetchApi } from '../api-client';
import { Country } from '../types';
import { cachedAsync } from '../utils/cache';

/**
 * Countries are static reference data — fetch once per session and reuse.
 */
const fetchCountries = (): Promise<Country[]> =>
  fetchApi<Country[]>('/api/v1/countries', {
    headers: { Accept: 'application/json' },
  });

const getAllCached = cachedAsync(fetchCountries);

export const countryService = {
  getAll: getAllCached,
};
