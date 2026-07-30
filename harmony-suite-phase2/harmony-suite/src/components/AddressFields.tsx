import * as React from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { useProvinces, useCities, useBarangays } from '@/hooks/useLocations'

export interface AddressValue {
  province: string
  city: string
  barangay: string
  /** House/unit number and street. Genuinely free text — there is no list of
   * those, and pretending otherwise would just block people from applying. */
  street: string
}

export const EMPTY_ADDRESS: AddressValue = { province: '', city: '', barangay: '', street: '' }

/** Joins the parts the way an address is written, skipping any that are blank
 * so an incomplete address doesn't read as ", , ". */
export function formatAddress(value: Partial<AddressValue>): string {
  return [value.street, value.barangay, value.city, value.province].map((p) => p?.trim()).filter(Boolean).join(', ')
}

/** Province -> City/Municipality -> Barangay, plus the street line.
 *
 * Names are what get stored, not ids: an address is a record of where someone
 * lived when they wrote it down, and it shouldn't change because an
 * administrator later fixed a spelling in the list. The ids only live in this
 * component, to drive the cascade.
 */
export function AddressFields({
  value,
  onChange,
  errors,
  required = true,
  idPrefix = 'address',
}: {
  value: AddressValue
  onChange: (next: AddressValue) => void
  errors?: Partial<Record<keyof AddressValue, string>>
  required?: boolean
  idPrefix?: string
}) {
  const [provinceId, setProvinceId] = React.useState<string | null>(null)
  const [cityId, setCityId] = React.useState<string | null>(null)

  const { data: provinces } = useProvinces()
  const { data: cities } = useCities(provinceId)
  const { data: barangays } = useBarangays(cityId)

  // Editing an existing record arrives with names but no ids, so the cascade
  // has to find its own way back down the tree before the next level can load.
  React.useEffect(() => {
    if (!provinceId && value.province && provinces?.length) {
      setProvinceId(provinces.find((p) => p.name === value.province)?.id ?? null)
    }
  }, [provinceId, value.province, provinces])

  React.useEffect(() => {
    if (!cityId && value.city && cities?.length) {
      setCityId(cities.find((c) => c.name === value.city)?.id ?? null)
    }
  }, [cityId, value.city, cities])

  const star = required ? <span className="text-destructive">*</span> : null

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}_province`}>Province {star}</Label>
          <Select
            value={provinceId ?? ''}
            onValueChange={(id) => {
              const name = provinces?.find((p) => p.id === id)?.name ?? ''
              setProvinceId(id)
              // Anything below is now wrong — a city in the old province can't
              // stay selected under a new one.
              setCityId(null)
              onChange({ ...value, province: name, city: '', barangay: '' })
            }}
          >
            <SelectTrigger id={`${idPrefix}_province`} invalid={!!errors?.province}>
              <SelectValue placeholder="Select province" />
            </SelectTrigger>
            <SelectContent>
              {provinces?.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors?.province && <p className="text-xs text-destructive">{errors.province}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}_city`}>City / Municipality {star}</Label>
          <Select
            value={cityId ?? ''}
            disabled={!provinceId}
            onValueChange={(id) => {
              const name = cities?.find((c) => c.id === id)?.name ?? ''
              setCityId(id)
              onChange({ ...value, city: name, barangay: '' })
            }}
          >
            <SelectTrigger id={`${idPrefix}_city`} invalid={!!errors?.city}>
              <SelectValue placeholder={provinceId ? 'Select city or municipality' : 'Select a province first'} />
            </SelectTrigger>
            <SelectContent>
              {cities?.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors?.city && <p className="text-xs text-destructive">{errors.city}</p>}
          {provinceId && cities?.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No cities are listed for this province yet. Ask an administrator to add them.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}_barangay`}>Barangay {star}</Label>
          <Select
            value={value.barangay ? (barangays?.find((b) => b.name === value.barangay)?.id ?? '') : ''}
            disabled={!cityId}
            onValueChange={(id) => {
              const name = barangays?.find((b) => b.id === id)?.name ?? ''
              onChange({ ...value, barangay: name })
            }}
          >
            <SelectTrigger id={`${idPrefix}_barangay`} invalid={!!errors?.barangay}>
              <SelectValue placeholder={cityId ? 'Select barangay' : 'Select a city first'} />
            </SelectTrigger>
            <SelectContent>
              {barangays?.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors?.barangay && <p className="text-xs text-destructive">{errors.barangay}</p>}
          {cityId && barangays?.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No barangays are listed for this city yet. Ask an administrator to add them.
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}_street`}>Residential Address {star}</Label>
        <Input
          id={`${idPrefix}_street`}
          invalid={!!errors?.street}
          value={value.street}
          onChange={(e) => onChange({ ...value, street: e.target.value })}
          placeholder="Blk 123 Lot 5 Phase 2, Sampaguita Street"
        />
        {errors?.street ? (
          <p className="text-xs text-destructive">{errors.street}</p>
        ) : (
          <p className="text-xs text-muted-foreground">House or unit number and street only.</p>
        )}
      </div>
    </div>
  )
}
