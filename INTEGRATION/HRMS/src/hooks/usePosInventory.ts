import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { toast } from '@/components/ui/sonner'
import { describeInventoryError, type AdjustmentReason, type InventoryRow, type MovementType } from '@/lib/posInventory'

/**
 * Branch inventory.
 *
 * Every read is an RPC and every write is an RPC: `pos_branch_inventory` and
 * `pos_inventory_movements` grant nobody INSERT, UPDATE or DELETE, and their
 * RLS admits only an Administrator to SELECT. That is deliberate -- the balance
 * carries `average_unit_cost`, which POS staff must never see, and RLS filters
 * rows rather than columns.
 *
 * The two cost-free read RPCs are what POS staff use; the cost-bearing one is a
 * separate function so there is no code path that could return cost to the
 * wrong caller.
 */

const INVENTORY_KEY = ['pos-branch-inventory']
const MOVEMENTS_KEY = ['pos-inventory-movements']
const CATALOGUE_KEY = ['pos-catalogue']

export interface Movement {
  id: string
  product_id: string
  product_name: string
  movement_type: MovementType
  quantity_change: number
  stock_before: number
  stock_after: number
  source_type: string
  notes: string | null
  actor_name: string | null
  created_at: string
}

export interface MovementWithCost extends Movement {
  unit_cost: number | null
  source_id: string | null
}

/** The branch's stock, without any cost. Administrators and the branch's POS
 * Manager; a cashier receives nothing (they see quantity on the catalogue). */
export function useBranchInventory(branchId: string | undefined) {
  return useQuery({
    queryKey: [...INVENTORY_KEY, branchId ?? 'none'],
    enabled: !!branchId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_branch_inventory', { _branch_id: branchId! })
      if (error) throw error
      return (data ?? []) as unknown as InventoryRow[]
    },
  })
}

/** Movement history without cost, for a POS Manager. */
export function useBranchMovements(branchId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: [...MOVEMENTS_KEY, branchId ?? 'none'],
    enabled: !!branchId && enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_branch_movements', {
        _branch_id: branchId!,
        _limit: 200,
      })
      if (error) throw error
      return (data ?? []) as unknown as Movement[]
    },
  })
}

/** The same history with valuation. Administrator-only in the database. */
export function useBranchMovementsWithCost(branchId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: [...MOVEMENTS_KEY, 'cost', branchId ?? 'none'],
    enabled: !!branchId && enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_branch_movements_with_cost', {
        _branch_id: branchId!,
        _limit: 200,
      })
      if (error) throw error
      return (data ?? []) as unknown as MovementWithCost[]
    },
  })
}

/**
 * The Administrator-visible balance, including `average_unit_cost`.
 *
 * Read straight from the table because RLS already restricts it to
 * Administrators -- there is no cost-free variant to protect here.
 */
export function useBranchInventoryValuation(branchId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: [...INVENTORY_KEY, 'valuation', branchId ?? 'none'],
    enabled: !!branchId && enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pos_branch_inventory')
        .select('product_id, quantity_on_hand, average_unit_cost, low_stock_threshold')
        .eq('branch_id', branchId!)
      if (error) throw error
      return data as unknown as {
        product_id: string
        quantity_on_hand: number
        average_unit_cost: number
        low_stock_threshold: number
      }[]
    },
  })
}

function useInvalidateInventory() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: INVENTORY_KEY })
    queryClient.invalidateQueries({ queryKey: MOVEMENTS_KEY })
    queryClient.invalidateQueries({ queryKey: CATALOGUE_KEY })
  }
}

/**
 * Receiving a delivery. Administrator-only.
 *
 * A POS Manager deliberately has no path to this: the intended flow is that
 * they request stock, an Administrator or FMS approves it, and receiving
 * follows. Giving them a button now would build a bypass around a workflow that
 * does not exist yet.
 */
export function useReceiveStock() {
  const invalidate = useInvalidateInventory()
  return useMutation({
    mutationFn: async ({
      branchId,
      productId,
      quantity,
      unitCost,
      notes,
    }: {
      branchId: string
      productId: string
      quantity: number
      unitCost: number
      notes?: string
    }) => {
      const { error } = await supabase.rpc('receive_pos_stock', {
        _branch_id: branchId,
        _product_id: productId,
        _quantity: quantity,
        _unit_cost: unitCost,
        _notes: notes?.trim() || undefined,
      })
      if (error) throw new Error(describeInventoryError(error))
    },
    onSuccess: () => {
      invalidate()
      toast.success('Stock received')
    },
    onError: (error) => toast.error(error.message),
  })
}

export function useAdjustStock() {
  const invalidate = useInvalidateInventory()
  return useMutation({
    mutationFn: async ({
      branchId,
      productId,
      quantityChange,
      reason,
      notes,
    }: {
      branchId: string
      productId: string
      quantityChange: number
      reason: AdjustmentReason
      notes?: string
    }) => {
      const { error } = await supabase.rpc('adjust_pos_stock', {
        _branch_id: branchId,
        _product_id: productId,
        _quantity_change: quantityChange,
        _reason: reason,
        _notes: notes?.trim() || undefined,
      })
      if (error) throw new Error(describeInventoryError(error))
    },
    onSuccess: () => {
      invalidate()
      toast.success('Stock adjusted')
    },
    onError: (error) => toast.error(error.message),
  })
}

/** The one inventory write a POS Manager holds. Moves no quantity: the guard
 * trigger would refuse it if it tried. */
export function useSetLowStockThreshold() {
  const invalidate = useInvalidateInventory()
  return useMutation({
    mutationFn: async ({
      branchId,
      productId,
      threshold,
    }: {
      branchId: string
      productId: string
      threshold: number
    }) => {
      const { error } = await supabase.rpc('set_low_stock_threshold', {
        _branch_id: branchId,
        _product_id: productId,
        _threshold: threshold,
      })
      if (error) throw new Error(describeInventoryError(error))
    },
    onSuccess: () => {
      invalidate()
      toast.success('Low-stock level updated')
    },
    onError: (error) => toast.error(error.message),
  })
}
