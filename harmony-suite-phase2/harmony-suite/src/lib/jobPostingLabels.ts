import type { Enums } from '@/lib/database.types'

export type EmploymentType = Enums<'employment_type'>

export const EMPLOYMENT_TYPE_LABEL: Record<EmploymentType, string> = {
  regular: 'Regular',
  part_time: 'Part-time (4-hour shift)',
}
