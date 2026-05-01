import { fetchApi } from '../api-client';
import { Topic } from '../types';

export const topicService = {
  getAll: (): Promise<Topic[]> => fetchApi<Topic[]>('/api/v1/topics'),
};
