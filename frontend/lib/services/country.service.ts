import { fetchApi } from '../api-client';
import { Country } from '../types';

export const countryService = {
  getAll: (): Promise<Country[]> => fetchApi<Country[]>('/api/v1/countries'),
};
