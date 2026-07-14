import { supabase } from '@/lib/supabase'
import type {
  HrStaff,
  Department,
  Position,
  SalaryGrade,
  SystemSetting,
  AuditLog,
  DatabaseBackup,
} from '@/types'

async function logAudit(action: string, entityType: string, entityId?: string, details?: string) {
  const { data: { user } } = await supabase.auth.getUser()
  await supabase.from('audit_logs').insert({
    actor_id: user?.id ?? null,
    action,
    entity_type: entityType,
    entity_id: entityId ?? null,
    details: details ?? null,
  })
}

// HR Staff
export async function getHrStaff() {
  return supabase.from('hr_staff').select('*').order('created_at', { ascending: false })
}

export async function createHrStaff(staff: Omit<HrStaff, 'id' | 'created_at' | 'updated_at'>) {
  const result = await supabase.from('hr_staff').insert(staff).select().single()
  if (!result.error) await logAudit('create', 'hr_staff', result.data?.id, `Created HR staff: ${staff.full_name}`)
  return result
}

export async function updateHrStaff(id: string, updates: Partial<HrStaff>) {
  const result = await supabase.from('hr_staff').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single()
  if (!result.error) await logAudit('update', 'hr_staff', id)
  return result
}

export async function deactivateHrStaff(id: string) {
  const result = await supabase.from('hr_staff').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', id).select().single()
  if (!result.error) await logAudit('deactivate', 'hr_staff', id)
  return result
}

// Departments
export async function getDepartments() {
  return supabase.from('departments').select('*').order('name')
}

export async function createDepartment(dept: { name: string; description?: string }) {
  const result = await supabase.from('departments').insert(dept).select().single()
  if (!result.error) await logAudit('create', 'department', result.data?.id, dept.name)
  return result
}

export async function updateDepartment(id: string, updates: Partial<Department>) {
  const result = await supabase.from('departments').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single()
  if (!result.error) await logAudit('update', 'department', id)
  return result
}

export async function deleteDepartment(id: string) {
  const result = await supabase.from('departments').delete().eq('id', id)
  if (!result.error) await logAudit('delete', 'department', id)
  return result
}

// Positions
export async function getPositions() {
  return supabase.from('positions').select('*, department:departments(*), salary_grade:salary_grades(*)').order('title')
}

export async function createPosition(pos: { title: string; department_id: string; salary_grade_id?: string; description?: string }) {
  const result = await supabase.from('positions').insert(pos).select().single()
  if (!result.error) await logAudit('create', 'position', result.data?.id, pos.title)
  return result
}

export async function updatePosition(id: string, updates: Partial<Position>) {
  const result = await supabase.from('positions').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single()
  if (!result.error) await logAudit('update', 'position', id)
  return result
}

export async function deletePosition(id: string) {
  const result = await supabase.from('positions').delete().eq('id', id)
  if (!result.error) await logAudit('delete', 'position', id)
  return result
}

// Salary Grades
export async function getSalaryGrades() {
  return supabase.from('salary_grades').select('*').order('grade_level')
}

export async function createSalaryGrade(grade: { grade_level: string; base_salary: number; description?: string }) {
  const result = await supabase.from('salary_grades').insert(grade).select().single()
  if (!result.error) await logAudit('create', 'salary_grade', result.data?.id, grade.grade_level)
  return result
}

export async function updateSalaryGrade(id: string, updates: Partial<SalaryGrade>) {
  const result = await supabase.from('salary_grades').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single()
  if (!result.error) await logAudit('update', 'salary_grade', id)
  return result
}

export async function deleteSalaryGrade(id: string) {
  const result = await supabase.from('salary_grades').delete().eq('id', id)
  if (!result.error) await logAudit('delete', 'salary_grade', id)
  return result
}

export async function assignSalaryGrade(positionId: string, salaryGradeId: string) {
  const result = await supabase.from('positions').update({ salary_grade_id: salaryGradeId, updated_at: new Date().toISOString() }).eq('id', positionId).select().single()
  if (!result.error) await logAudit('assign_salary_grade', 'position', positionId)
  return result
}

// System Settings
export async function getSystemSettings() {
  return supabase.from('system_settings').select('*').order('key')
}

export async function updateSystemSetting(id: string, value: string) {
  const result = await supabase.from('system_settings').update({ value, updated_at: new Date().toISOString() }).eq('id', id).select().single()
  if (!result.error) await logAudit('update', 'system_setting', id)
  return result
}

// Audit Logs
export async function getAuditLogs() {
  return supabase.from('audit_logs').select('*, actor:profiles(full_name, email)').order('created_at', { ascending: false }).limit(100)
}

// Database Management
export async function createBackup() {
  const { data: { user } } = await supabase.auth.getUser()
  const result = await supabase.from('database_backups').insert({
    backup_type: 'backup',
    status: 'completed',
    created_by: user?.id ?? null,
    file_url: `backup-${new Date().toISOString()}.sql`,
  }).select().single()
  if (!result.error) await logAudit('backup_database', 'database', result.data?.id)
  return result
}

export async function createRestore(fileUrl: string) {
  const { data: { user } } = await supabase.auth.getUser()
  const result = await supabase.from('database_backups').insert({
    backup_type: 'restore',
    status: 'completed',
    created_by: user?.id ?? null,
    file_url: fileUrl,
  }).select().single()
  if (!result.error) await logAudit('restore_database', 'database', result.data?.id)
  return result
}

export async function getBackups() {
  return supabase.from('database_backups').select('*').order('created_at', { ascending: false })
}

// System Reports
export async function getSystemReportData() {
  const [profiles, auditLogs, departments] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact' }),
    supabase.from('audit_logs').select('id', { count: 'exact' }),
    supabase.from('departments').select('id', { count: 'exact' }),
  ])
  return {
    totalUsers: profiles.count ?? 0,
    totalAuditLogs: auditLogs.count ?? 0,
    totalDepartments: departments.count ?? 0,
  }
}
