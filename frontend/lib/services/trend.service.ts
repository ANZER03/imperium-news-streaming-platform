import { fetchApi } from '../api-client';
import { TrendKeyword } from '../types';

export const trendService = {
  getExploreTrends: async (country?: string, topic?: string): Promise<TrendKeyword[]> => {
    const params = new URLSearchParams();
    if (country && country !== 'global') {
      params.set('country', country);
    }
    if (topic) {
      params.set('topic', topic);
    }
    
    // Convert to query string, if any params exist
    const queryString = params.toString();
    const url = queryString ? `/api/v1/trends/explore?${queryString}` : '/api/v1/trends/explore';
    
    return fetchApi<TrendKeyword[]>(url, {
      headers: { Accept: 'application/json' },
    });
  },
};
