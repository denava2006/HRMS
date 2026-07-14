export interface AttendanceSettings {
  workStartTime: string
  workEndTime: string
  standardHours: number
  lateThresholdMinutes: number
  overtimeMultiplier: number
}

export interface AttendanceCalculation {
  workingHours: number
  lateMinutes: number
  undertimeMinutes: number
  overtimeHours: number
}

function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

export function calculateAttendance(
  timeIn: string | null,
  timeOut: string | null,
  settings: AttendanceSettings
): AttendanceCalculation {
  if (!timeIn || !timeOut) {
    return { workingHours: 0, lateMinutes: 0, undertimeMinutes: 0, overtimeHours: 0 }
  }

  const timeInMinutes = parseTimeToMinutes(timeIn)
  const timeOutMinutes = parseTimeToMinutes(timeOut)
  const workStartMinutes = parseTimeToMinutes(settings.workStartTime)
  const workEndMinutes = parseTimeToMinutes(settings.workEndTime)

  const workingMinutes = Math.max(0, timeOutMinutes - timeInMinutes)
  const workingHours = Math.round((workingMinutes / 60) * 100) / 100

  const lateMinutes = Math.max(0, timeInMinutes - workStartMinutes - settings.lateThresholdMinutes)

  const expectedMinutes = settings.standardHours * 60
  const undertimeMinutes = Math.max(0, expectedMinutes - workingMinutes)

  const overtimeMinutes = Math.max(0, timeOutMinutes - workEndMinutes)
  const overtimeHours = Math.round((overtimeMinutes / 60) * 100) / 100

  return { workingHours, lateMinutes, undertimeMinutes, overtimeHours }
}

export function generateEmployeeId(): string {
  const year = new Date().getFullYear()
  const random = Math.floor(1000 + Math.random() * 9000)
  return `EMP-${year}-${random}`
}

export function calculateLeaveDays(startDate: string, endDate: string): number {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const diff = end.getTime() - start.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1
}
