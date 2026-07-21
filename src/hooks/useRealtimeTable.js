import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

/**
 * Polls a Supabase table/query on a fixed interval via React Query.
 * `queryFn` receives the supabase client and must return { data, error }.
 */
export function useRealtimeTable({ key, queryFn, intervalMs = 15000, enabled = true }) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await queryFn(supabase)
      if (error) throw error
      return data ?? []
    },
    refetchInterval: enabled && intervalMs > 0 ? intervalMs : false,
    refetchIntervalInBackground: true,
    enabled,
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: key })

  return { ...query, refresh }
}
