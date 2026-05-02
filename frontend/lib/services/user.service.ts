import { fetchApi } from '../api-client';

export const userService = {
  onboard: (countryId: number, topics: string[]): Promise<{ userId: string }> => 
    fetchApi<{ userId: string }>('/api/v1/users/onboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ countryId, topics }),
    }),
};
