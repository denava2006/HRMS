import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { useUpdateEmployee, type Employee } from '@/hooks/useEmployees'
import { CIVIL_STATUS_OPTIONS } from '@/lib/employeeLabels'

const nameRegex = /^[A-Za-z]+(?:[ '-][A-Za-z]+)*$/
const phoneRegex = /^09\d{9}$/

function sanitizePhoneInput(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 11)
}

export function EditPersonalInfoDialog({
  open,
  onOpenChange,
  employee,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  employee: Employee
}) {
  const updateEmployee = useUpdateEmployee()

  const [firstName, setFirstName] = React.useState('')
  const [middleName, setMiddleName] = React.useState('')
  const [lastName, setLastName] = React.useState('')
  const [gender, setGender] = React.useState('')
  const [birthDate, setBirthDate] = React.useState('')
  const [civilStatus, setCivilStatus] = React.useState('')
  const [nationality, setNationality] = React.useState('')
  const [phone, setPhone] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [address, setAddress] = React.useState('')
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  React.useEffect(() => {
    if (open) {
      setFirstName(employee.first_name)
      setMiddleName(employee.middle_name ?? '')
      setLastName(employee.last_name)
      setGender(employee.gender ?? '')
      setBirthDate(employee.birth_date ?? '')
      setCivilStatus(employee.civil_status ?? '')
      setNationality(employee.nationality ?? '')
      setPhone(employee.phone ?? '')
      setEmail(employee.email)
      setAddress(employee.address ?? '')
      setErrors({})
    }
  }, [open, employee])

  const onSubmit = () => {
    const nextErrors: Record<string, string> = {}
    if (!firstName.trim() || !nameRegex.test(firstName.trim())) nextErrors.firstName = 'Enter a valid first name.'
    if (middleName.trim() && !nameRegex.test(middleName.trim())) nextErrors.middleName = 'Letters, spaces, hyphens, and apostrophes only.'
    if (!lastName.trim() || !nameRegex.test(lastName.trim())) nextErrors.lastName = 'Enter a valid last name.'
    if (!phoneRegex.test(phone)) nextErrors.phone = 'Enter a valid mobile number (11 digits, starting with 09).'
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) nextErrors.email = 'Enter a valid email address.'
    if (!address.trim()) nextErrors.address = 'Address is required.'
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    updateEmployee.mutate(
      {
        id: employee.id,
        values: {
          first_name: firstName.trim(),
          middle_name: middleName.trim() || null,
          last_name: lastName.trim(),
          gender: gender || null,
          birth_date: birthDate || null,
          civil_status: civilStatus || null,
          nationality: nationality.trim() || null,
          phone,
          email: email.trim(),
          address: address.trim(),
        },
      },
      { onSuccess: () => onOpenChange(false) }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Personal Information</DialogTitle>
          <DialogDescription>Changes are reflected immediately on the employee profile.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit_first_name">First Name</Label>
              <Input id="edit_first_name" autoComplete="off" invalid={!!errors.firstName} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              {errors.firstName && <p className="text-xs text-destructive">{errors.firstName}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit_middle_name">Middle Name</Label>
              <Input id="edit_middle_name" autoComplete="off" invalid={!!errors.middleName} value={middleName} onChange={(e) => setMiddleName(e.target.value)} />
              {errors.middleName && <p className="text-xs text-destructive">{errors.middleName}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit_last_name">Last Name</Label>
              <Input id="edit_last_name" autoComplete="off" invalid={!!errors.lastName} value={lastName} onChange={(e) => setLastName(e.target.value)} />
              {errors.lastName && <p className="text-xs text-destructive">{errors.lastName}</p>}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Gender</Label>
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit_birth_date">Birth Date</Label>
              <Input id="edit_birth_date" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Civil Status</Label>
              <Select value={civilStatus} onValueChange={setCivilStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {CIVIL_STATUS_OPTIONS.map((v) => (
                    <SelectItem key={v} value={v}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit_nationality">Nationality</Label>
              <Input id="edit_nationality" autoComplete="off" value={nationality} onChange={(e) => setNationality(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit_phone">Contact Number</Label>
              <Input
                id="edit_phone"
                autoComplete="off"
                inputMode="numeric"
                invalid={!!errors.phone}
                value={phone}
                onChange={(e) => setPhone(sanitizePhoneInput(e.target.value))}
              />
              {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit_email">Email</Label>
              <Input id="edit_email" type="email" autoComplete="off" invalid={!!errors.email} value={email} onChange={(e) => setEmail(e.target.value)} />
              {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit_address">Complete Address</Label>
            <Textarea id="edit_address" invalid={!!errors.address} value={address} onChange={(e) => setAddress(e.target.value)} rows={2} />
            {errors.address && <p className="text-xs text-destructive">{errors.address}</p>}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" loading={updateEmployee.isPending} onClick={onSubmit}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
