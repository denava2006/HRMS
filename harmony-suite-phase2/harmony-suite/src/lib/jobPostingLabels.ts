import type { Enums } from '@/lib/database.types'

export type EmploymentType = Enums<'employment_type'>

export const EMPLOYMENT_TYPE_LABEL: Record<EmploymentType, string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  contract: 'Contract',
  internship: 'Internship',
}
