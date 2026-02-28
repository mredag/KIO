import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';

export function useActivityFeed(limit = 50, offset = 0, eventTypes?: string[], entityTypes?: string[]) {
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  params.set('offset', String(offset));
  if (eventTypes?.length) params.set('event_types', eventTypes.join(','));
  if (entityTypes?.length) params.set('entity_types', entityTypes.join(','));

  return useQuery({
    queryKey: ['activity', 'feed', limit, offset, eventTypes, entityTypes],
    queryFn: async () => {
      const { data } = await api.get(`/mc/activity/feed?${params.toString()}`);
      return data;
    },
    refetchInterval: 15000,
  });
}

export function useActivityStats() {
  return useQuery({
    queryKey: ['activity', 'stats'],
    queryFn: async () => {
      const { data } = await api.get('/mc/activity/stats');
      return data;
    },
    refetchInterval: 10000,
  });
}
