import { fetchApi } from '../api-client';
import { Topic } from '../types';
import { cachedAsync } from '../utils/cache';

/**
 * Topics are static reference data — fetch once per session and reuse.
 * Without this, every page navigation under (main) re-mounts the
 * TopicCarousel and refetches `/api/v1/topics`.
 */
const fetchTopics = (): Promise<Topic[]> =>
  fetchApi<Topic[]>('/api/v1/topics', {
    headers: { Accept: 'application/json' },
  });

const getAllCached = cachedAsync(fetchTopics);

export const topicService = {
  getAll: getAllCached,
};
