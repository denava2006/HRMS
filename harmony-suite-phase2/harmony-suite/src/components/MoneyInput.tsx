import * as React from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { CURRENCY_SYMBOL, formatGroupedAmount, sanitizeMoneyInput, type CurrencyCode } from '@/lib/currency'

export interface MoneyInputProps {
  id?: string
  /** Raw numeric string only — no commas or currency symbol, e.g. "25000" or "25000.5". */
  value: string
  onValueChange: (raw: string) => void
  onBlur?: () => void
  currency: CurrencyCode
  invalid?: boolean
  placeholder?: string
  disabled?: boolean
  className?: string
}

/** A currency-aware amount field that thousands-groups its value live as the user
 * types (cursor pinned to the end after each keystroke — a common, deliberate
 * simplification for hand-rolled money inputs) and normalizes to 2 decimal
 * places on blur. The currency symbol is a fixed visual prefix, never part of
 * the editable text, so it can't be accidentally duplicated or deleted. */
export function MoneyInput({
  id,
  value,
  onValueChange,
  onBlur,
  currency,
  invalid,
  placeholder,
  disabled,
  className,
}: MoneyInputProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [displayValue, setDisplayValue] = React.useState(() => (value ? formatGroupedAmount(value) : ''))

  React.useEffect(() => {
    setDisplayValue(value ? formatGroupedAmount(value) : '')
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = sanitizeMoneyInput(e.target.value)
    const formatted = raw ? formatGroupedAmount(raw) : ''
    onValueChange(raw)
    setDisplayValue(formatted)
    requestAnimationFrame(() => {
      inputRef.current?.setSelectionRange(formatted.length, formatted.length)
    })
  }

  const handleBlur = () => {
    if (value) {
      const normalized = Number(value).toFixed(2)
      onValueChange(normalized)
      setDisplayValue(formatGroupedAmount(normalized))
    }
    onBlur?.()
  }

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
        {CURRENCY_SYMBOL[currency]}
      </span>
      <Input
        ref={inputRef}
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder={placeholder}
        disabled={disabled}
        invalid={invalid}
        className={cn('pl-7 font-mono', className)}
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
      />
    </div>
  )
}
