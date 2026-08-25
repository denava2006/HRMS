import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { toast } from '@/components/ui/sonner'
import type { Json } from '@/lib/database.types'
import { parseFees, paymentQrPath, type Fee } from '@/lib/posFees'
import { describeSettingsError, emptySettings, type BranchPosSettings } from '@/lib/posSettings'

export { emptySettings, describeSettingsError }
export type { BranchPosSettings }

/**
 * A branch's POS configuration.
 *
 * Reads are open to an Administrator and to anyone actively assigned to that
 * branch's till; writes are Administrator-only. Both are enforced by RLS on
 * `branch_pos_settings`, not here -- these hooks only avoid offering an action
 * the database would refuse.
 *
 * A branch with no row is the normal starting state, not an error: it means no
 * fees and no payment QR. Every read path below returns that shape rather than
 * throwing, so the POS portal works on a branch nobody has configured yet.
 */

export const QR_BUCKET = 'pos-payment-qr'

/** How long a payment-QR signed URL stays valid. Long enough to render and
 * re-render the image, short enough that a leaked link dies quickly. The URL is
 * never persisted -- `branch_pos_settings.payment_qr_path` holds the object
 * path and a fresh signature is minted on each read. */
const SIGNED_URL_TTL_SECONDS = 300

const SETTINGS_KEY = ['branch-pos-settings']
const qrKey = (path: string | null) => ['branch-pos-qr', path ?? 'none']

/** Every settings row the caller may read. An Administrator sees all branches;
 * POS staff see only the branches they are assigned to. */
export function useAllBranchPosSettings() {
  return useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from('branch_pos_settings').select('*')
      if (error) throw error
      return (data ?? []).map((row) => ({
        branch_id: row.branch_id,
        fees: parseFees(row.fees),
        payment_qr_path: row.payment_qr_path,
        created_at: row.created_at,
        updated_at: row.updated_at,
      })) as BranchPosSettings[]
    },
  })
}

/** One branch's settings, or the empty shape when it has never been configured.
 *
 * Memoised because `emptySettings()` builds a new object on every call. Without
 * this, an unconfigured branch handed callers a fresh `data` -- and a fresh
 * `data.fees` array -- on every render, so any effect keyed on it re-ran
 * forever. */
export function useBranchPosSettings(branchId: string | undefined) {
  const all = useAllBranchPosSettings()
  const rows = all.data

  const found = React.useMemo(
    () => (branchId ? rows?.find((row) => row.branch_id === branchId) : undefined),
    [rows, branchId]
  )

  const data = React.useMemo(
    () => (branchId ? (found ?? emptySettings(branchId)) : undefined),
    [found, branchId]
  )

  return {
    ...all,
    data,
    /** False for a branch with no row -- the caller may want to say so. */
    isConfigured: !!found,
  }
}

/**
 * A short-lived signed URL for the branch's payment QR.
 *
 * The bucket is private, so this is the only way to render the image. The
 * signature is issued only if the caller passed the storage read policy, which
 * asks the same question the table does -- Administrator, or assigned to that
 * branch.
 */
export function usePaymentQrUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: qrKey(path ?? null),
    enabled: !!path,
    // Refetch before the signature expires rather than showing a broken image.
    staleTime: (SIGNED_URL_TTL_SECONDS - 30) * 1000,
    queryFn: async () => {
      if (!path) return null
      const { data, error } = await supabase.storage
        .from(QR_BUCKET)
        .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
      if (error) throw error
      return data.signedUrl
    },
  })
}

function useInvalidateSettings() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: SETTINGS_KEY })
}

/**
 * Saves the fee list.
 *
 * Upsert rather than insert-or-update branching: the first save for a branch
 * creates its row, and every later one replaces the list. `payment_qr_path` is
 * left out of the payload on purpose so saving fees never clears the QR.
 */
export function useSaveBranchFees() {
  const invalidate = useInvalidateSettings()
  return useMutation({
    mutationFn: async ({ branchId, fees }: { branchId: string; fees: Fee[] }) => {
      const { error } = await supabase
        .from('branch_pos_settings')
        .upsert({ branch_id: branchId, fees: fees as unknown as Json }, { onConflict: 'branch_id' })
      if (error) throw new Error(describeSettingsError(error))
    },
    onSuccess: () => {
      invalidate()
      toast.success('Fees saved')
    },
    onError: (error) => toast.error(error.message),
  })
}

export function useUploadPaymentQr() {
  const invalidate = useInvalidateSettings()
  return useMutation({
    mutationFn: async ({
      branchId,
      file,
      previousPath,
    }: {
      branchId: string
      file: File
      previousPath: string | null
    }) => {
      if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.')
      if (file.size > 5 * 1024 * 1024) throw new Error('The image must be under 5MB.')

      const path = paymentQrPath(branchId, file.name)
      const { error: uploadError } = await supabase.storage.from(QR_BUCKET).upload(path, file)
      if (uploadError) throw new Error(describeSettingsError(uploadError))

      const { error } = await supabase
        .from('branch_pos_settings')
        .upsert({ branch_id: branchId, payment_qr_path: path }, { onConflict: 'branch_id' })
      if (error) {
        // The row is the record of truth. If it could not be written, the
        // object that was just uploaded is unreferenced -- remove it rather
        // than leaving a file nothing points at.
        await supabase.storage.from(QR_BUCKET).remove([path])
        throw new Error(describeSettingsError(error))
      }

      // Only once the new path is committed. A failure here leaves an orphaned
      // file, which is untidy but harmless; failing the whole save because
      // cleanup did not work would be worse.
      if (previousPath && previousPath !== path) {
        await supabase.storage.from(QR_BUCKET).remove([previousPath])
      }
    },
    onSuccess: () => {
      invalidate()
      toast.success('Payment QR updated')
    },
    onError: (error) => toast.error(error.message),
  })
}

export function useRemovePaymentQr() {
  const invalidate = useInvalidateSettings()
  return useMutation({
    mutationFn: async ({ branchId, path }: { branchId: string; path: string }) => {
      const { error } = await supabase
        .from('branch_pos_settings')
        .update({ payment_qr_path: null })
        .eq('branch_id', branchId)
      if (error) throw new Error(describeSettingsError(error))
      await supabase.storage.from(QR_BUCKET).remove([path])
    },
    onSuccess: () => {
      invalidate()
      toast.success('Payment QR removed')
    },
    onError: (error) => toast.error(error.message),
  })
}
