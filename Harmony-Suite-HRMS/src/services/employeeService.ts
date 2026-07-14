import { supabase } from '@/lib/supabase'
import { generateEmployeeId } from '@/utils/attendanceCalculations'
import type { Employee, EmploymentStatus } from '@/types'

export async function getEmployees() {
  return supabase
    .from('employees')
    .select('*, department:departments(name), position:positions(title)')
    .order('created_at', { ascending: false })
}

export async function getEmployee(id: string) {
  return supabase
    .from('employees')
    .select('*, department:departments(*), position:positions(*)')
    .eq('id', id)
    .single()
}

export async function getDeployedApplicants() {
  return supabase
    .from('applicants')
    .select('*, job_posting:job_postings(department_id, position_id)')
    .eq('status', 'deployed')
    .order('updated_at', { ascending: false })
}

async function generateUniqueEmployeeId(): Promise<string> {
  let employeeId = generateEmployeeId()
  let attempts = 0
  while (attempts < 10) {
    const { data } = await supabase.from('employees').select('id').eq('employee_id', employeeId).maybeSingle()
    if (!data) return employeeId
    employeeId = generateEmployeeId()
    attempts++
  }
  return employeeId
}

export async function createEmployeeFromDeployment(applicantId: string, data: {
  department_id: string
  position_id: string
  employment_status: EmploymentStatus
  phone?: string
}) {
  const { data: applicant, error: appError } = await supabase
    .from('applicants')
    .select('*')
    .eq('id', applicantId)
    .single()

  if (appError || !applicant) return { data: null, error: appError ?? new Error('Applicant not found') }

  const employeeId = await generateUniqueEmployeeId()

  const result = await supabase.from('employees').insert({
    employee_id: employeeId,
    applicant_id: applicantId,
    full_name: applicant.full_name,
    email: applicant.email,
    phone: data.phone ?? applicant.phone,
    department_id: data.department_id,
    position_id: data.position_id,
    employment_status: data.employment_status,
    hire_date: new Date().toISOString().split('T')[0],
  }).select().single()

  if (!result.error) {
    await supabase.from('applicants').update({ status: 'employee_created', updated_at: new Date().toISOString() }).eq('id', applicantId)
    await supabase.from('leave_balances').insert({
      employee_id: result.data!.id,
      leave_type: 'vacation',
      total_credits: 15,
      used_credits: 0,
      remaining_credits: 15,
    })
  }

  return result
}

export async function updateEmployee(id: string, updates: Partial<Employee>) {
  return supabase
    .from('employees')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
}

export async function uploadEmployeeDocument(employeeId: string, file: File, documentType: string) {
  const ext = file.name.split('.').pop()
  const path = `${employeeId}/${documentType}.${ext}`
  const { error } = await supabase.storage.from('employee-documents').upload(path, file, { upsert: true })
  if (error) return { error, data: null }

  const { data: urlData } = supabase.storage.from('employee-documents').getPublicUrl(path)
  return supabase.from('employee_documents').insert({
    employee_id: employeeId,
    document_type: documentType,
    file_url: urlData.publicUrl,
  }).select().single()
}

export async function getEmployeeDocuments(employeeId: string) {
  return supabase.from('employee_documents').select('*').eq('employee_id', employeeId)
}

export async function setEmploymentStatus(employeeId: string, status: EmploymentStatus) {
  return updateEmployee(employeeId, { employment_status: status })
}

export async function saveEmployeeRecord(employee: Partial<Employee> & { id: string }) {
  return updateEmployee(employee.id, employee)
}

export async function getActiveEmployees() {
  return supabase
    .from('employees')
    .select('*, department:departments(name), position:positions(title)')
    .eq('employment_status', 'active')
    .order('full_name')
}
