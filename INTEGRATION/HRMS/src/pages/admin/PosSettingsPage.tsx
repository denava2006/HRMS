import * as React from 'react'
import { Info, Plus, QrCode, Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import { useBranches } from '@/hooks/useBranches'
import {
  useBranchPosSettings,
  usePaymentQrUrl,
  useRemovePaymentQr,
  useSaveBranchFees,
  useUploadPaymentQr,
} from '@/hooks/useBranchPosSettings'
import {
  FEE_TYPES,
  FEE_TYPE_LABEL,
  MAX_FEES,
  computeFees,
  newFeeId,
  parseFees,
  sumFees,
  validateFees,
  type Fee,
  type FeeType,
} from '@/lib/posFees'

/**
 * Per-branch POS configuration: the additional fees a till applies, and the
 * payment QR shown at checkout.
 *
 * A branch is the POS's location -- there is no separate "store". What lives
 * here is only the configuration a branch needs in order to trade; its name,
 * address and phone stay on the branch record itself, under Branches.
 *
 * Administrator-only. A POS Manager reads this configuration to run a sale but
 * does not set what the branch charges, which is how the standalone POS drew
 * the line too. RLS enforces it; this page never being reachable is the
 * courtesy, not the control.
 */

/** A representative basket, only for showing what the configured fees add. */
const PREVIEW_SUBTOTAL = 1000

const peso = (value: number) =>
  `₱${value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function FeeRow({
  fee,
  onChange,
  onRemove,
}: {
  fee: Fee
  onChange: (patch: Partial<Fee>) => void
  onRemove: () => void
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-3 sm:flex-row sm:items-end">
      <div className="flex flex-1 flex-col gap-1.5">
        <Label htmlFor={`fee-name-${fee.id}`}>Name</Label>
        <Input
          id={`fee-name-${fee.id}`}
          value={fee.name}
          maxLength={80}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Service charge"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Type</Label>
        <Select value={fee.type} onValueChange={(value) => onChange({ type: value as FeeType })}>
          <SelectTrigger className="w-40" aria-label={`Type for ${fee.name || 'fee'}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FEE_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {FEE_TYPE_LABEL[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex w-32 flex-col gap-1.5">
        <Label htmlFor={`fee-value-${fee.id}`}>{fee.type === 'percent' ? 'Percent' : 'Amount'}</Label>
        <Input
          id={`fee-value-${fee.id}`}
          type="number"
          min={0}
          max={fee.type === 'percent' ? 100 : undefined}
          step="0.01"
          value={Number.isFinite(fee.value) ? fee.value : ''}
          onChange={(e) => onChange({ value: e.target.value === '' ? Number.NaN : Number(e.target.value) })}
        />
      </div>

      <div className="flex items-center gap-3 pb-2">
        <div className="flex items-center gap-2">
          <Switch
            checked={fee.enabled}
            onCheckedChange={(enabled) => onChange({ enabled })}
            aria-label={`Enable ${fee.name || 'fee'}`}
          />
          <span className="text-sm text-muted-foreground">{fee.enabled ? 'On' : 'Off'}</span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label={`Remove ${fee.name || 'fee'}`}
          onClick={onRemove}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function PaymentQrSection({
  branchId,
  path,
  canEdit,
}: {
  branchId: string
  path: string | null
  canEdit: boolean
}) {
  const { data: signedUrl, isLoading } = usePaymentQrUrl(path)
  const upload = useUploadPaymentQr()
  const remove = useRemovePaymentQr()
  const fileRef = React.useRef<HTMLInputElement>(null)
  const [removing, setRemoving] = React.useState(false)

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 py-5">
        <div>
          <h3 className="font-medium text-foreground">Payment QR</h3>
          <p className="text-sm text-muted-foreground">
            A static QR shown to the customer at this branch's till.
          </p>
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            This is display configuration only. A scanned QR is never proof that a payment was received — the
            cashier still confirms it. Verified payment capture is a separate, later piece of work.
          </p>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex h-44 w-44 shrink-0 items-center justify-center rounded-lg border border-dashed border-border bg-muted/30">
            {isLoading && path ? (
              <Skeleton className="h-40 w-40" />
            ) : signedUrl ? (
              <img src={signedUrl} alt="Payment QR" className="h-40 w-40 object-contain" />
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <QrCode className="h-8 w-8" />
                <span className="text-xs">No QR uploaded</span>
              </div>
            )}
          </div>

          {canEdit && (
            <div className="flex flex-col gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                aria-label="Payment QR image"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) upload.mutate({ branchId, file, previousPath: path })
                  e.target.value = ''
                }}
              />
              <Button type="button" variant="outline" loading={upload.isPending} onClick={() => fileRef.current?.click()}>
                <Upload className="h-4 w-4" />
                {path ? 'Replace QR' : 'Upload QR'}
              </Button>
              {path && (
                <Button type="button" variant="ghost" onClick={() => setRemoving(true)}>
                  Remove
                </Button>
              )}
              <p className="max-w-xs text-xs text-muted-foreground">
                PNG, JPEG or WebP, under 5MB. Stored privately — the image is served through a short-lived signed
                link, never a public URL.
              </p>
            </div>
          )}
        </div>

        <AlertDialog open={removing} onOpenChange={setRemoving}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove this branch's payment QR?</AlertDialogTitle>
              <AlertDialogDescription>
                Cashiers at this branch will no longer see a QR at checkout. You can upload a new one at any time.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (path) remove.mutate({ branchId, path })
                  setRemoving(false)
                }}
              >
                Remove QR
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  )
}

export default function PosSettingsPage() {
  const { data: branches, isLoading: branchesLoading } = useBranches()
  const [branchId, setBranchId] = React.useState<string>('')

  const activeBranches = React.useMemo(() => (branches ?? []).filter((b) => b.is_active), [branches])

  React.useEffect(() => {
    if (!branchId && activeBranches.length > 0) setBranchId(activeBranches[0].id)
  }, [branchId, activeBranches])

  const { data: settings, isLoading: settingsLoading, isConfigured } = useBranchPosSettings(branchId || undefined)
  const saveFees = useSaveBranchFees()

  // Local working copy. Reset whenever the loaded row changes, so switching
  // branches never carries one branch's unsaved edits onto another.
  //
  // Keyed on the serialised fees rather than the array itself: an equal-but-new
  // array must not count as a change, or the reset re-runs on every render and
  // the page loops. The hook memoises too; this makes the component safe on its
  // own regardless of what it is handed.
  const [fees, setFees] = React.useState<Fee[]>([])
  const feesSignature = JSON.stringify(settings?.fees ?? [])
  React.useEffect(() => {
    setFees(parseFees(JSON.parse(feesSignature)))
  }, [feesSignature, branchId])

  const errors = validateFees(fees)
  const applied = computeFees(PREVIEW_SUBTOTAL, fees)
  const previewTotal = sumFees(applied)

  const updateFee = (id: string, patch: Partial<Fee>) =>
    setFees((current) => current.map((fee) => (fee.id === id ? { ...fee, ...patch } : fee)))

  const addFee = () =>
    setFees((current) => [
      ...current,
      { id: newFeeId(), name: '', type: 'percent', value: 0, enabled: true },
    ])

  if (branchesLoading) {
    return <Skeleton className="h-64 w-full" />
  }

  if (activeBranches.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="font-display text-xl font-semibold text-foreground">POS Settings</h2>
        </div>
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            There are no active branches yet. Add one under Branches before configuring a till.
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-foreground">POS Settings</h2>
        <p className="text-sm text-muted-foreground">
          What each branch's till charges and shows at checkout. A branch's name, address and phone live under
          Branches — this is the selling configuration only.
        </p>
      </div>

      <div className="flex flex-col gap-1.5 sm:max-w-xs">
        <Label>Branch</Label>
        <Select value={branchId} onValueChange={setBranchId}>
          <SelectTrigger aria-label="Branch">
            <SelectValue placeholder="Choose a branch" />
          </SelectTrigger>
          <SelectContent>
            {activeBranches.map((branch) => (
              <SelectItem key={branch.id} value={branch.id}>
                {branch.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!settingsLoading && !isConfigured && (
          <p className="text-xs text-muted-foreground">
            This branch has no POS configuration yet — no fees, no payment QR. Saving creates it.
          </p>
        )}
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-medium text-foreground">Additional fees</h3>
              <p className="text-sm text-muted-foreground">
                Applied on top of the basket at checkout, in the order listed.
              </p>
            </div>
            <Badge variant={fees.some((f) => f.enabled) ? 'success' : 'muted'}>
              {fees.filter((f) => f.enabled && f.value > 0).length} active
            </Badge>
          </div>

          {fees.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
              No additional fees. This branch charges the basket total only.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {fees.map((fee) => (
                <FeeRow
                  key={fee.id}
                  fee={fee}
                  onChange={(patch) => updateFee(fee.id, patch)}
                  onRemove={() => setFees((current) => current.filter((f) => f.id !== fee.id))}
                />
              ))}
            </div>
          )}

          <div>
            <Button type="button" variant="outline" onClick={addFee} disabled={fees.length >= MAX_FEES}>
              <Plus className="h-4 w-4" />
              Add fee
            </Button>
            {fees.length >= MAX_FEES && (
              <p className="mt-1.5 text-xs text-muted-foreground">
                A branch can have at most {MAX_FEES} fees.
              </p>
            )}
          </div>

          {errors.length > 0 && (
            <ul className="flex flex-col gap-1 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
              {errors.map((error) => (
                <li key={error} className="text-xs text-destructive">
                  {error}
                </li>
              ))}
            </ul>
          )}

          {applied.length > 0 && (
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-xs font-medium text-foreground">
                On a {peso(PREVIEW_SUBTOTAL)} basket
              </p>
              <ul className="mt-1.5 flex flex-col gap-0.5">
                {applied.map((fee) => (
                  <li key={fee.name} className="flex justify-between text-xs text-muted-foreground">
                    <span>
                      {fee.name} {fee.type === 'percent' ? `(${fee.value}%)` : ''}
                    </span>
                    <span>{peso(fee.amount)}</span>
                  </li>
                ))}
                <li className="mt-1 flex justify-between border-t border-border pt-1 text-xs font-medium text-foreground">
                  <span>Added to the basket</span>
                  <span>{peso(previewTotal)}</span>
                </li>
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">
                A preview only. What a customer is actually charged is calculated by the server at checkout.
              </p>
            </div>
          )}

          <div>
            <Button
              type="button"
              loading={saveFees.isPending}
              disabled={errors.length > 0 || !branchId}
              onClick={() => saveFees.mutate({ branchId, fees })}
            >
              Save fees
            </Button>
          </div>
        </CardContent>
      </Card>

      {branchId && (
        <PaymentQrSection branchId={branchId} path={settings?.payment_qr_path ?? null} canEdit />
      )}
    </div>
  )
}
