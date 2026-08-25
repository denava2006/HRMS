import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface PhLocation {
  id: string
  name: string
}

/** One level of the Province -> City/Municipality -> Barangay tree.
 *
 * `parentId` is undefined for provinces and the parent's id below that.
 * Passing null means "a parent hasn't been chosen yet", which disables the
 * query rather than fetching every city in the country. */
function useLocationLevel(level: 'province' | 'city' | 'barangay', parentId: string | null | undefined) {
  const isRoot = level === 'province'
  return useQuery({
    queryKey: ['ph-locations', level, parentId ?? null],
    queryFn: async () => {
      let query = supabase.from('ph_locations').select('id, name').eq('level', level).order('name')
      query = isRoot ? query.is('parent_id', null) : query.eq('parent_id', parentId as string)
      const { data, error } = await query
      if (error) throw error
      return data as PhLocation[]
    },
    enabled: isRoot || !!parentId,
    // Geography doesn't move. Refetching it on every dialog open is pure noise.
    staleTime: 60 * 60 * 1000,
  })
}

export function useProvinces() {
  return useLocationLevel('province', undefined)
}

export function useCities(provinceId: string | null) {
  return useLocationLevel('city', provinceId)
}

export function useBarangays(cityId: string | null) {
  return useLocationLevel('barangay', cityId)
}
