import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { isPosReportRangeReady } from '@/lib/posReports'
import {
  POS_AUDIT_KEY,
  POS_AUDIT_PAGE_SIZE,
  offsetFor,
  type AdminAuditEvent,
  type AuditQuery,
  type ManagerAuditEvent,
} from '@/lib/posAudit'

/**
 * The POS operational audit stream.
 *
 * Two readers, chosen by which screen is asking, each authorised independently
 * by the database:
 *
 *   manager  get_pos_manager_audit_events  -- manager at THAT branch, and only
 *                                             manager-visible event types. No
 *                                             parameter turns that filter off.
 *   admin    get_admin_pos_audit_events    -- is_admin(), branch or global
 *
 * The table itself is unreachable: no API role holds any privilege on
 * pos_audit_events, and it defines no RLS policy. There is no fallback path a
 * future edit could reach for.
 *
 * Query keys carry the surface, the branch scope, the range and every filter,
 * so switching between managed branches cannot briefly show another branch's
 * history -- a different key has no cached entry and the view renders its
 * loading state. Logout already calls queryClient.clear().
 */

const AUDIT_STALE_TIME = 30_000

function rangeKey(query: AuditQuery) {
  return [query.range?.dateFrom ?? 'pending', query.range?.dateTo ?? 'pending'] as const
}

function filterKey(query: AuditQuery) {
  return [
    query.eventType ?? 'any-event',
    query.actorId ?? 'any-actor',
    query.entityType ?? 'any-entity',
    query.page,
  ] as const
}

/** A manager's own branch. Enabled only once a branch and a resolved range
 * exist -- asking the database for events at "null" would be refused anyway,
 * and asking is worse than not asking. */
export function useManagerAuditEvents(query: AuditQuery, enabled = true) {
  return useQuery({
    queryKey: [
      ...POS_AUDIT_KEY,
      'manager',
      query.branchId ?? 'none',
      ...rangeKey(query),
      ...filterKey(query),
    ],
    enabled: enabled && !!query.branchId && isPosReportRangeReady(query.range),
    staleTime: AUDIT_STALE_TIME,
    queryFn: async (): Promise<ManagerAuditEvent[]> => {
      const { data, error } = await supabase.rpc('get_pos_manager_audit_events', {
        _branch_id: query.branchId!,
        _from_date: query.range!.dateFrom,
        _to_date: query.range!.dateTo,
        _event_type: query.eventType,
        _actor_id: query.actorId,
        _entity_type: query.entityType,
        _limit: POS_AUDIT_PAGE_SIZE,
        _offset: offsetFor(query.page),
      })
      if (error) throw error
      return (data ?? []) as unknown as ManagerAuditEvent[]
    },
  })
}

/** Every POS event. `scope` is 'all', 'global', or a branch id -- global
 * catalogue and access events carry no branch, so they get their own scope
 * rather than being filed under an arbitrary one. */
export function useAdminAuditEvents(query: AuditQuery, enabled = true) {
  const scope = query.scope ?? 'all'
  return useQuery({
    queryKey: [...POS_AUDIT_KEY, 'admin', scope, ...rangeKey(query), ...filterKey(query)],
    enabled: enabled && isPosReportRangeReady(query.range),
    staleTime: AUDIT_STALE_TIME,
    queryFn: async (): Promise<AdminAuditEvent[]> => {
      const { data, error } = await supabase.rpc('get_admin_pos_audit_events', {
        _branch_id: scope === 'all' || scope === 'global' ? undefined : scope,
        _global_only: scope === 'global',
        _from_date: query.range!.dateFrom,
        _to_date: query.range!.dateTo,
        _event_type: query.eventType,
        _actor_id: query.actorId,
        _entity_type: query.entityType,
        _limit: POS_AUDIT_PAGE_SIZE,
        _offset: offsetFor(query.page),
      })
      if (error) throw error
      return (data ?? []) as unknown as AdminAuditEvent[]
    },
  })
}
