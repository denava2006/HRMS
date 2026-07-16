import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { Tables, TablesUpdate, EmploymentStatus } from '@/lib/database.types'
import type { CurrencyCode } from '@/lib/currency'
import { toast } from '@/components/ui/sonner'

/** supabase.functions.invoke() throws a FunctionsHttpError whose `.message` is
 * always the generic "Edge Function returned a non-2xx status code" — the
 * actual `{ error: "..." }` body has to be read separately from `error.context`. */
async function describeFunctionError(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    const body = await error.context.json().catch(() => null)
    if (body?.error) return body.error
  }
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.'
}

function friendlyEmployeeError(error: Error): string {
  if (error.message.includes('employees_email_key')) return 'An employee with this email already exists.'
  return error.message
}

const EMPLOYEE_SELECT = `
  *,
  departments (id, name),
  positions (id, title),
  salary_grades (id, grade_name, min_salary, max_salary),
  profiles (id, email, role, status, invited_at, activated_at, last_login_at)
`

export type EmployeeAccount = Pick<
  Tables<'profiles'>,
  'id' | 'email' | 'role' | 'status' | 'invited_at' | 'activated_at' | 'last_login_at'
>

export type Employee = Tables<'employees'> & {
  departments: { id: string; name: string } | null
  positions: { id: string; title: string } | null
  salary_grades: { id: string; grade_name: string; min_salary: number; max_salary: number } | null
  // profiles.employee_id carries a UNIQUE constraint, so PostgREST embeds this
  // as a one-to-one relation (a single row or null), not an array.
  profiles: EmployeeAccount | null
}

const LIST_KEY = ['employees']
const STATS_KEY = ['employee-stats']

export function useEmployees() {
  return useQuery({
    queryKey: LIST_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from('employees').select(EMPLOYEE_SELECT).order('created_at', { ascending: false })
      if (error) throw error
      return data as unknown as Employee[]
    },
  })
}

export function useEmployeeDetail(employeeId: string | undefined) {
  return useQuery({
    queryKey: [...LIST_KEY, employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select(EMPLOYEE_SELECT)
        .eq('id', employeeId as string)
        .maybeSingle()
      if (error) throw error
      return data as unknown as Employee | null
    },
    enabled: !!employeeId,
  })
}

/** "Inactive" = no longer with the company (resigned/terminated/retired) —
 * distinct from On Leave/Contractual/Temporary, which are still-employed states. */
const INACTIVE_STATUSES: EmploymentStatus[] = ['resigned', 'terminated', 'retired']

export function useEmployeeStats() {
  return useQuery({
    queryKey: STATS_KEY,
    queryFn: async () => {
      const [total, active, probationary, regular, inactive] = await Promise.all([
        supabase.from('employees').select('*', { count: 'exact', head: true }),
        supabase.from('employees').select('*', { count: 'exact', head: true }).eq('employment_status', 'active'),
        supabase.from('employees').select('*', { count: 'exact', head: true }).eq('employment_status', 'probationary'),
        supabase.from('employees').select('*', { count: 'exact', head: true }).eq('employment_status', 'regular'),
        supabase.from('employees').select('*', { count: 'exact', head: true }).in('employment_status', INACTIVE_STATUSES),
      ])
      return {
        total: total.count ?? 0,
        active: active.count ?? 0,
        probationary: probationary.count ?? 0,
        regular: regular.count ?? 0,
        inactive: inactive.count ?? 0,
      }
    },
  })
}

function useInvalidateEmployees() {
  const queryClient = useQueryClient()
  return (employeeId?: string) => {
    queryClient.invalidateQueries({ queryKey: LIST_KEY })
    queryClient.invalidateQueries({ queryKey: STATS_KEY })
    if (employeeId) {
      queryClient.invalidateQueries({ queryKey: ['employee-history', employeeId] })
      queryClient.invalidateQueries({ queryKey: ['employee-audit-log', employeeId] })
    }
  }
}

export interface CreateEmployeeInput {
  firstName: string
  middleName?: string
  lastName: string
  gender: string
  birthDate: string
  civilStatus: string
  nationality: string
  phone: string
  email: string
  address: string
  departmentId: string
  positionId: string
  employmentType: 'full_time' | 'part_time'
  salaryGradeId?: string
  basicSalary: number
  currency: CurrencyCode
  hireDate: string
  probationPeriod?: string
  employmentStatus: EmploymentStatus
}

export function useCreateEmployee() {
  const { profile } = useAuth()
  const invalidate = useInvalidateEmployees()
  return useMutation({
    mutationFn: async (input: CreateEmployeeInput) => {
      const { data, error } = await supabase
        .from('employees')
        .insert({
          first_name: input.firstName,
          middle_name: input.middleName || null,
          last_name: input.lastName,
          gender: input.gender,
          birth_date: input.birthDate,
          civil_status: input.civilStatus,
          nationality: input.nationality,
          phone: input.phone,
          email: input.email,
          address: input.address,
          department_id: input.departmentId,
          position_id: input.positionId,
          employment_type: input.employmentType,
          salary_grade_id: input.salaryGradeId || null,
          basic_salary: input.basicSalary,
          currency: input.currency,
          hire_date: input.hireDate,
          probation_period: input.probationPeriod || null,
          employment_status: input.employmentStatus,
        })
        .select('id, employee_number')
        .single()
      if (error) throw error

      // Employee ID generation/uniqueness is fully automatic (DB sequence
      // default on employees.employee_number) — these two events just record
      // that it happened, matching the spec's flowchart steps 1-4.
      await supabase.from('employee_history').insert([
        { employee_id: data.id, event: 'record_created', actor_id: profile?.id },
        { employee_id: data.id, event: 'employee_id_generated', notes: data.employee_number, actor_id: profile?.id },
        { employee_id: data.id, event: 'department_assigned', actor_id: profile?.id },
        { employee_id: data.id, event: 'position_assigned', actor_id: profile?.id },
      ])
      await supabase.from('audit_logs').insert({
        actor_id: profile?.id,
        action: 'Employee Created',
        table_name: 'employees',
        record_id: data.id,
      })

      return data
    },
    onSuccess: () => {
      invalidate()
      toast.success('Employee record created successfully.')
    },
    onError: (error) => toast.error(friendlyEmployeeError(error)),
  })
}

export function useUpdateEmployee() {
  const { profile } = useAuth()
  const invalidate = useInvalidateEmployees()
  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: TablesUpdate<'employees'> }) => {
      const { error } = await supabase.from('employees').update(values).eq('id', id)
      if (error) throw error

      const historyEvents: { employee_id: string; event: string; actor_id?: string }[] = []
      const auditActions: string[] = []
      if ('department_id' in values) {
        historyEvents.push({ employee_id: id, event: 'department_assigned', actor_id: profile?.id })
        auditActions.push('Department Changed')
      }
      if ('position_id' in values) {
        historyEvents.push({ employee_id: id, event: 'position_assigned', actor_id: profile?.id })
        auditActions.push('Position Changed')
      }
      if ('employment_status' in values) {
        historyEvents.push({ employee_id: id, event: 'status_updated', actor_id: profile?.id })
        auditActions.push('Employment Status Updated')
      }
      const otherKeys = Object.keys(values).filter((k) => !['department_id', 'position_id', 'employment_status'].includes(k))
      if (otherKeys.length > 0 || historyEvents.length === 0) {
        historyEvents.push({ employee_id: id, event: 'information_updated', actor_id: profile?.id })
        auditActions.push('Employee Edited')
      }

      await supabase.from('employee_history').insert(historyEvents)
      await supabase
        .from('audit_logs')
        .insert(auditActions.map((action) => ({ actor_id: profile?.id, action, table_name: 'employees', record_id: id })))
    },
    onSuccess: (_data, { id }) => {
      invalidate(id)
      toast.success('Employee updated')
    },
    onError: (error) => toast.error(friendlyEmployeeError(error)),
  })
}

export function useEmployeeHistory(employeeId: string | undefined) {
  return useQuery({
    queryKey: ['employee-history', employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employee_history')
        .select('*, actor:profiles(full_name)')
        .eq('employee_id', employeeId as string)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data
    },
    enabled: !!employeeId,
  })
}

export function useEmployeeAuditLog(employeeId: string | undefined) {
  return useQuery({
    queryKey: ['employee-audit-log', employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*, actor:profiles(full_name)')
        .eq('table_name', 'employees')
        .eq('record_id', employeeId as string)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!employeeId,
  })
}

// ---- Employee account (invite/resend/enable/disable) ----

export function useCreateEmployeeAccount() {
  const invalidate = useInvalidateEmployees()
  return useMutation({
    mutationFn: async ({ employeeId, email, fullName }: { employeeId: string; email: string; fullName: string }) => {
      const siteUrl = import.meta.env.VITE_SITE_URL || window.location.origin
      const { data, error } = await supabase.functions.invoke('create-employee-account', {
        body: { employeeId, email, fullName, redirectTo: `${siteUrl}/auth/setup-password` },
      })
      if (error) throw new Error(await describeFunctionError(error))
      if (data?.error) throw new Error(data.error)
      return data as { id: string; email: string; resent: boolean }
    },
    onSuccess: (data, { employeeId }) => {
      invalidate(employeeId)
      toast.success(
        data.resent
          ? 'Invitation email resent.'
          : 'Employee account created successfully. An invitation email has been sent.'
      )
    },
    onError: (error) => toast.error(error.message),
  })
}

export function useSetEmployeeAccountStatus() {
  const { profile } = useAuth()
  const invalidate = useInvalidateEmployees()
  return useMutation({
    mutationFn: async ({ profileId, employeeId, status }: { profileId: string; employeeId: string; status: 'active' | 'inactive' }) => {
      const { error } = await supabase.from('profiles').update({ status }).eq('id', profileId)
      if (error) throw error

      await supabase.from('employee_history').insert({
        employee_id: employeeId,
        event: status === 'active' ? 'account_activated' : 'account_disabled',
        actor_id: profile?.id,
      })
      await supabase.from('audit_logs').insert({
        actor_id: profile?.id,
        action: status === 'active' ? 'Employee Account Activated' : 'Employee Account Disabled',
        table_name: 'employees',
        record_id: employeeId,
      })
    },
    onSuccess: (_data, { employeeId, status }) => {
      invalidate(employeeId)
      toast.success(status === 'active' ? 'Account activated' : 'Account disabled')
    },
    onError: (error) => toast.error(error.message),
  })
}

// ---- Employee documents ----

const ALLOWED_DOCUMENT_FILE_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
]
const MAX_DOCUMENT_FILE_BYTES = 10 * 1024 * 1024

export function validateEmployeeDocumentFile(file: File): string | null {
  if (!ALLOWED_DOCUMENT_FILE_TYPES.includes(file.type)) {
    return 'Only PDF, DOC, DOCX, JPG, or PNG files are accepted.'
  }
  if (file.size > MAX_DOCUMENT_FILE_BYTES) {
    return 'File is too large — the maximum size is 10 MB.'
  }
  return null
}

async function uploadEmployeeDocumentFile(employeeId: string, file: File): Promise<string> {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? 'pdf'
  const path = `${employeeId}/${crypto.randomUUID()}.${extension}`
  const { error } = await supabase.storage.from('employee-documents').upload(path, file, {
    contentType: file.type,
    upsert: false,
  })
  if (error) throw new Error('Could not upload the document. Please try again.')
  return path
}

export function useEmployeeDocuments(employeeId: string | undefined) {
  return useQuery({
    queryKey: ['employee-documents', employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employee_documents')
        .select('*, uploader:profiles(full_name)')
        .eq('employee_id', employeeId as string)
        .order('uploaded_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!employeeId,
  })
}

export function useEmployeeDocumentSignedUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: ['employee-document-signed-url', path],
    queryFn: async () => {
      const { data, error } = await supabase.storage.from('employee-documents').createSignedUrl(path as string, 300)
      if (error) throw error
      return data.signedUrl
    },
    enabled: !!path,
    staleTime: 4 * 60 * 1000,
  })
}

export function useUploadEmployeeDocument() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const invalidate = useInvalidateEmployees()
  return useMutation({
    mutationFn: async ({ employeeId, documentType, file }: { employeeId: string; documentType: string; file: File }) => {
      const path = await uploadEmployeeDocumentFile(employeeId, file)
      const { error } = await supabase.from('employee_documents').insert({
        employee_id: employeeId,
        document_type: documentType,
        file_url: path,
        uploaded_by: profile?.id,
      })
      if (error) throw error

      await supabase.from('employee_history').insert({ employee_id: employeeId, event: 'documents_uploaded', notes: documentType, actor_id: profile?.id })
      await supabase.from('audit_logs').insert({ actor_id: profile?.id, action: 'Document Uploaded', table_name: 'employees', record_id: employeeId })
    },
    onSuccess: (_data, { employeeId }) => {
      queryClient.invalidateQueries({ queryKey: ['employee-documents', employeeId] })
      invalidate(employeeId)
      toast.success('Document uploaded')
    },
    onError: (error) => toast.error(error.message),
  })
}

export function useReplaceEmployeeDocument() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const invalidate = useInvalidateEmployees()
  return useMutation({
    mutationFn: async ({
      documentId,
      employeeId,
      previousPath,
      documentType,
      file,
    }: {
      documentId: string
      employeeId: string
      previousPath: string
      documentType: string
      file: File
    }) => {
      const path = await uploadEmployeeDocumentFile(employeeId, file)
      const { error } = await supabase
        .from('employee_documents')
        .update({ file_url: path, document_type: documentType, uploaded_by: profile?.id, uploaded_at: new Date().toISOString() })
        .eq('id', documentId)
      if (error) throw error

      await supabase.storage.from('employee-documents').remove([previousPath])
      await supabase.from('employee_history').insert({ employee_id: employeeId, event: 'documents_uploaded', notes: `${documentType} (replaced)`, actor_id: profile?.id })
      await supabase.from('audit_logs').insert({ actor_id: profile?.id, action: 'Document Uploaded', table_name: 'employees', record_id: employeeId })
    },
    onSuccess: (_data, { employeeId }) => {
      queryClient.invalidateQueries({ queryKey: ['employee-documents', employeeId] })
      invalidate(employeeId)
      toast.success('Document replaced')
    },
    onError: (error) => toast.error(error.message),
  })
}

export function useDeleteEmployeeDocument() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const invalidate = useInvalidateEmployees()
  return useMutation({
    mutationFn: async ({ documentId, employeeId, path }: { documentId: string; employeeId: string; path: string }) => {
      const { error } = await supabase.from('employee_documents').delete().eq('id', documentId)
      if (error) throw error
      await supabase.storage.from('employee-documents').remove([path])

      await supabase.from('audit_logs').insert({ actor_id: profile?.id, action: 'Document Deleted', table_name: 'employees', record_id: employeeId })
    },
    onSuccess: (_data, { employeeId }) => {
      queryClient.invalidateQueries({ queryKey: ['employee-documents', employeeId] })
      invalidate(employeeId)
      toast.success('Document deleted')
    },
    onError: (error) => toast.error(error.message),
  })
}
