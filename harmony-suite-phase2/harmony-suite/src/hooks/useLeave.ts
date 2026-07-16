import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { Tables, TablesUpdate, LeaveRequestStatus } from '@/lib/database.types'
import { toast } from '@/components/ui/sonner'
import { calculateLeaveDays, dateRangesOverlap, todayISODate } from '@/lib/leaveCalculations'

export type LeaveType = Tables<'leave_types'>

export function useLeaveTypes() {
  return useQuery({
    queryKey: ['leave_types'],
    queryFn: async () => {
      const { data, error } = await supabase.from('leave_types').select('*').order('name')
      if (error) throw error
      return data
    },
  })
}

const LEAVE_SELECT = `
  *,
  employees (
    id, employee_number, first_name, last_name, email, department_id, position_id, employment_status,
    departments (id, name),
    positions (id, title)
  ),
  leave_types (id, name, is_paid),
  reviewer:profiles!leave_requests_reviewed_by_fkey (full_name)
`

export type LeaveEmployee = Pick<
  Tables<'employees'>,
  'id' | 'employee_number' | 'first_name' | 'last_name' | 'email' | 'department_id' | 'position_id' | 'employment_status'
> & {
  departments: { id: string; name: string } | null
  positions: { id: string; title: string } | null
}

export type LeaveRequest = Tables<'leave_requests'> & {
  employees: LeaveEmployee
  leave_types: Pick<Tables<'leave_types'>, 'id' | 'name' | 'is_paid'>
  reviewer: { full_name: string } | null
}

const LIST_KEY = ['leave-requests']

export function useLeaveRequests(dateFrom: string, dateTo: string) {
  return useQuery({
    queryKey: [...LIST_KEY, dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leave_requests')
        .select(LEAVE_SELECT)
        .lte('start_date', dateTo)
        .gte('end_date', dateFrom)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as unknown as LeaveRequest[]
    },
  })
}

export function useLeaveRequest(id: string | undefined) {
  return useQuery({
    queryKey: [...LIST_KEY, 'detail', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('leave_requests').select(LEAVE_SELECT).eq('id', id as string).maybeSingle()
      if (error) throw error
      return data as unknown as LeaveRequest | null
    },
    enabled: !!id,
  })
}

function startOfMonthISODate(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export function useLeaveStats() {
  return useQuery({
    queryKey: ['leave-stats'],
    queryFn: async () => {
      const today = todayISODate()
      const monthStart = startOfMonthISODate()
      const [pendingRes, approvedRes, rejectedRes, onLeaveTodayRes, thisMonthRes, balancesRes] = await Promise.all([
        supabase.from('leave_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('leave_requests').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
        supabase.from('leave_requests').select('*', { count: 'exact', head: true }).eq('status', 'rejected'),
        supabase.from('leave_requests').select('employee_id').eq('status', 'approved').lte('start_date', today).gte('end_date', today),
        supabase.from('leave_requests').select('*', { count: 'exact', head: true }).gte('created_at', monthStart),
        supabase.from('leave_balances').select('used_credits').eq('year', new Date().getFullYear()),
      ])
      if (pendingRes.error) throw pendingRes.error
      if (approvedRes.error) throw approvedRes.error
      if (rejectedRes.error) throw rejectedRes.error
      if (onLeaveTodayRes.error) throw onLeaveTodayRes.error
      if (thisMonthRes.error) throw thisMonthRes.error
      if (balancesRes.error) throw balancesRes.error

      const currentlyOnLeaveCount = new Set(onLeaveTodayRes.data.map((r) => r.employee_id)).size
      const totalCreditsUsed = balancesRes.data.reduce((sum, b) => sum + Number(b.used_credits), 0)

      return {
        pendingCount: pendingRes.count ?? 0,
        approvedCount: approvedRes.count ?? 0,
        rejectedCount: rejectedRes.count ?? 0,
        currentlyOnLeaveCount,
        thisMonthCount: thisMonthRes.count ?? 0,
        totalCreditsUsed,
      }
    },
  })
}

function useInvalidateLeave() {
  const queryClient = useQueryClient()
  return (employeeId?: string) => {
    queryClient.invalidateQueries({ queryKey: LIST_KEY })
    queryClient.invalidateQueries({ queryKey: ['leave-stats'] })
    if (employeeId) {
      queryClient.invalidateQueries({ queryKey: ['employee-leave-balances', employeeId] })
      queryClient.invalidateQueries({ queryKey: ['employee-leave-summary', employeeId] })
    }
  }
}

// ---- Supporting document upload ----

const ALLOWED_DOCUMENT_FILE_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
]
const MAX_DOCUMENT_FILE_BYTES = 10 * 1024 * 1024

export function validateLeaveDocumentFile(file: File): string | null {
  if (!ALLOWED_DOCUMENT_FILE_TYPES.includes(file.type)) {
    return 'Only PDF, DOC, DOCX, JPG, or PNG files are accepted.'
  }
  if (file.size > MAX_DOCUMENT_FILE_BYTES) {
    return 'File is too large — the maximum size is 10 MB.'
  }
  return null
}

async function uploadLeaveDocumentFile(employeeId: string, file: File): Promise<string> {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? 'pdf'
  const path = `${employeeId}/${crypto.randomUUID()}.${extension}`
  const { error } = await supabase.storage.from('leave-documents').upload(path, file, { contentType: file.type, upsert: false })
  if (error) throw new Error('Could not upload the supporting document. Please try again.')
  return path
}

export function useLeaveDocumentSignedUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: ['leave-document-signed-url', path],
    queryFn: async () => {
      const { data, error } = await supabase.storage.from('leave-documents').createSignedUrl(path as string, 300)
      if (error) throw error
      return data.signedUrl
    },
    enabled: !!path,
    staleTime: 4 * 60 * 1000,
  })
}

// ---- Submit ----

export interface CreateLeaveRequestInput {
  employeeId: string
  leaveTypeId: string
  startDate: string
  endDate: string
  reason: string
  supportingDocument?: File
}

export function useCreateLeaveRequest() {
  const { profile } = useAuth()
  const invalidate = useInvalidateLeave()
  return useMutation({
    mutationFn: async (input: CreateLeaveRequestInput) => {
      if (input.startDate > input.endDate) throw new Error('Start Date cannot be after End Date.')

      const { data: leaveType, error: leaveTypeError } = await supabase
        .from('leave_types')
        .select('name')
        .eq('id', input.leaveTypeId)
        .single()
      if (leaveTypeError) throw leaveTypeError

      if (leaveType.name !== 'Emergency Leave' && input.startDate < todayISODate()) {
        throw new Error('Leave requests must be submitted before the leave start date (except Emergency Leave).')
      }

      const { data: existing, error: existingError } = await supabase
        .from('leave_requests')
        .select('start_date, end_date, status')
        .eq('employee_id', input.employeeId)
        .in('status', ['pending', 'approved'])
      if (existingError) throw existingError

      const hasOverlap = existing.some((r) => dateRangesOverlap(input.startDate, input.endDate, r.start_date, r.end_date))
      if (hasOverlap) {
        throw new Error('This employee already has a pending or approved leave request that overlaps these dates.')
      }

      const daysRequested = calculateLeaveDays(input.startDate, input.endDate)

      const supportingDocumentUrl = input.supportingDocument ? await uploadLeaveDocumentFile(input.employeeId, input.supportingDocument) : null

      const { error } = await supabase.from('leave_requests').insert({
        employee_id: input.employeeId,
        leave_type_id: input.leaveTypeId,
        start_date: input.startDate,
        end_date: input.endDate,
        days_requested: daysRequested,
        reason: input.reason.trim() || null,
        supporting_document_url: supportingDocumentUrl,
        status: 'pending',
      })
      if (error) throw error

      await supabase.from('audit_logs').insert({
        actor_id: profile?.id,
        action: 'Leave Request Submitted',
        table_name: 'leave_requests',
        record_id: input.employeeId,
      })
    },
    onSuccess: (_data, { employeeId }) => {
      invalidate(employeeId)
      toast.success('Leave request submitted successfully.')
    },
    onError: (error) => toast.error(error.message),
  })
}

// ---- Approve ----

export function useApproveLeaveRequest() {
  const { profile } = useAuth()
  const invalidate = useInvalidateLeave()
  return useMutation({
    mutationFn: async ({ requestId }: { requestId: string }) => {
      const { data: request, error: requestError } = await supabase
        .from('leave_requests')
        .select('employee_id, leave_type_id, start_date, end_date, days_requested, status')
        .eq('id', requestId)
        .single()
      if (requestError) throw requestError
      if (request.status !== 'pending') throw new Error('Only pending requests can be approved.')

      const year = new Date(`${request.start_date}T00:00:00`).getFullYear()
      const { data: balance, error: balanceError } = await supabase
        .from('leave_balances')
        .select('id, total_credits, used_credits, remaining_credits')
        .eq('employee_id', request.employee_id)
        .eq('leave_type_id', request.leave_type_id)
        .eq('year', year)
        .maybeSingle()
      if (balanceError) throw balanceError
      if (!balance) throw new Error('No leave balance found for this employee and leave type.')

      const remaining = Number(balance.remaining_credits)
      const daysRequested = Number(request.days_requested)
      if (remaining < daysRequested) {
        throw new Error(`Insufficient leave credits. ${remaining} remaining, ${daysRequested} requested.`)
      }

      const { error: balanceUpdateError } = await supabase
        .from('leave_balances')
        .update({ used_credits: Number(balance.used_credits) + daysRequested })
        .eq('id', balance.id)
      if (balanceUpdateError) throw balanceUpdateError

      const { error: requestUpdateError } = await supabase
        .from('leave_requests')
        .update({ status: 'approved', reviewed_by: profile?.id, reviewed_at: new Date().toISOString() })
        .eq('id', requestId)
      if (requestUpdateError) throw requestUpdateError

      // Approved leave must automatically update Attendance Status -> On Leave
      // for every date in the range (mirrors useAttendance's upsert pattern).
      const dates: string[] = []
      const cursor = new Date(`${request.start_date}T00:00:00`)
      const end = new Date(`${request.end_date}T00:00:00`)
      while (cursor.getTime() <= end.getTime()) {
        dates.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`)
        cursor.setDate(cursor.getDate() + 1)
      }
      await supabase
        .from('attendance_records')
        .upsert(
          dates.map((date) => ({ employee_id: request.employee_id, attendance_date: date, status: 'on_leave' as const })),
          { onConflict: 'employee_id,attendance_date' }
        )

      await supabase.from('audit_logs').insert({
        actor_id: profile?.id,
        action: 'Leave Approved',
        table_name: 'leave_requests',
        record_id: requestId,
        old_data: { status: 'pending' },
        new_data: { status: 'approved', days_deducted: daysRequested, remaining_after: remaining - daysRequested },
      })
    },
    onSuccess: () => {
      invalidate()
      toast.success('Leave record saved successfully.')
    },
    onError: (error) => toast.error(error.message),
  })
}

// ---- Reject ----

export function useRejectLeaveRequest() {
  const { profile } = useAuth()
  const invalidate = useInvalidateLeave()
  return useMutation({
    mutationFn: async ({ requestId, reason }: { requestId: string; reason: string }) => {
      const { error } = await supabase
        .from('leave_requests')
        .update({ status: 'rejected', rejection_reason: reason, reviewed_by: profile?.id, reviewed_at: new Date().toISOString() })
        .eq('id', requestId)
      if (error) throw error

      await supabase.from('audit_logs').insert({
        actor_id: profile?.id,
        action: 'Leave Rejected',
        table_name: 'leave_requests',
        record_id: requestId,
        new_data: { status: 'rejected', reason },
      })
    },
    onSuccess: () => {
      invalidate()
      toast.success('Leave request rejected.')
    },
    onError: (error) => toast.error(error.message),
  })
}

// ---- Balances ----

export function useEmployeeLeaveBalances(employeeId: string | undefined, year: number = new Date().getFullYear()) {
  return useQuery({
    queryKey: ['employee-leave-balances', employeeId, year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leave_balances')
        .select('*, leave_types(id, name, is_paid)')
        .eq('employee_id', employeeId as string)
        .eq('year', year)
        .order('leave_types(name)')
      if (error) throw error
      return data as unknown as (Tables<'leave_balances'> & { leave_types: LeaveType })[]
    },
    enabled: !!employeeId,
  })
}

export function useAdjustLeaveBalance() {
  const { profile } = useAuth()
  const invalidate = useInvalidateLeave()
  return useMutation({
    mutationFn: async ({
      balanceId,
      newTotalCredits,
      reason,
    }: {
      balanceId: string
      employeeId: string
      newTotalCredits: number
      reason: string
    }) => {
      const { data: previous, error: previousError } = await supabase
        .from('leave_balances')
        .select('total_credits, used_credits')
        .eq('id', balanceId)
        .single()
      if (previousError) throw previousError

      const values: TablesUpdate<'leave_balances'> = { total_credits: newTotalCredits }
      const { error } = await supabase.from('leave_balances').update(values).eq('id', balanceId)
      if (error) throw error

      await supabase.from('audit_logs').insert({
        actor_id: profile?.id,
        action: 'Leave Balance Adjusted',
        table_name: 'leave_balances',
        record_id: balanceId,
        old_data: { total_credits: previous.total_credits },
        new_data: { total_credits: newTotalCredits, reason },
      })
    },
    onSuccess: (_data, { employeeId }) => {
      invalidate(employeeId)
      toast.success('Leave balance updated')
    },
    onError: (error) => {
      if (error.message.includes('leave_balances_credits_check')) {
        toast.error('Total credits cannot be less than credits already used.')
        return
      }
      toast.error(error.message)
    },
  })
}

export function useLeaveAuditLog(requestId: string | undefined) {
  return useQuery({
    queryKey: ['leave-audit-log', requestId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*, actor:profiles(full_name)')
        .eq('table_name', 'leave_requests')
        .eq('record_id', requestId as string)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!requestId,
  })
}

// ---- Employee Leave Summary (Employee Details page) ----

export interface EmployeeLeaveSummary {
  pending: number
  approved: number
  rejected: number
  balances: (Tables<'leave_balances'> & { leave_types: LeaveType })[]
}

export function useEmployeeLeaveSummary(employeeId: string | undefined) {
  return useQuery({
    queryKey: ['employee-leave-summary', employeeId],
    queryFn: async (): Promise<EmployeeLeaveSummary> => {
      const [requestsRes, balancesRes] = await Promise.all([
        supabase.from('leave_requests').select('status').eq('employee_id', employeeId as string),
        supabase
          .from('leave_balances')
          .select('*, leave_types(id, name, is_paid)')
          .eq('employee_id', employeeId as string)
          .eq('year', new Date().getFullYear())
          .order('leave_types(name)'),
      ])
      if (requestsRes.error) throw requestsRes.error
      if (balancesRes.error) throw balancesRes.error

      return {
        pending: requestsRes.data.filter((r) => r.status === 'pending').length,
        approved: requestsRes.data.filter((r) => r.status === 'approved').length,
        rejected: requestsRes.data.filter((r) => r.status === 'rejected').length,
        balances: balancesRes.data as unknown as (Tables<'leave_balances'> & { leave_types: LeaveType })[],
      }
    },
    enabled: !!employeeId,
  })
}

export function useLeaveRealtimeAlerts() {
  const queryClient = useQueryClient()
  React.useEffect(() => {
    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: LIST_KEY })
      queryClient.invalidateQueries({ queryKey: ['leave-stats'] })
    }
    const channel = supabase
      .channel('leave-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_requests' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_balances' }, refresh)
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient])
}

export type { LeaveRequestStatus }
