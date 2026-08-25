import { describe, expect, it } from 'vitest'
import {
  ALL_EVENT_TYPES,
  MANAGER_VISIBLE_EVENT_TYPES,
  POS_AUDIT_EVENT_LABEL,
  describeAuditError,
  entityLabel,
  eventLabel,
  eventTypesFor,
  formatActorRole,
  formatChange,
  offsetFor,
  pageCount,
  totalFrom,
  type AdminAuditEvent,
  type ManagerAuditEvent,
} from '@/lib/posAudit'

function managerRow(overrides: Partial<ManagerAuditEvent> = {}): ManagerAuditEvent {
  return {
    event_id: 'e1',
    occurred_at: '2026-08-25T02:00:00Z',
    business_date: '2026-08-25',
    event_type: 'product_offered',
    entity_type: 'branch_product',
    entity_id: 'p1',
    actor_id: 'u1',
    actor_name: 'Jerome Castillo',
    branch_id: 'b1',
    branch_name: 'Cavite Branch',
    entity_name: 'Cola 1.5L',
    old_value: 'Stopped',
    new_value: 'Offered',
    total_count: 1,
    ...overrides,
  }
}

function adminRow(overrides: Partial<AdminAuditEvent> = {}): AdminAuditEvent {
  return {
    ...managerRow(),
    actor_enterprise_role: 'admin',
    actor_pos_role: null,
    manager_visible: false,
    description: 'Product created',
    ...overrides,
  }
}

describe('the manager and administrator contracts', () => {
  it('give a manager no administrator column', () => {
    // The manager RPC does not declare them. This pins the client type to the
    // same contract so a future edit cannot start reading one.
    const keys = Object.keys(managerRow())
    for (const forbidden of [
      'manager_visible',
      'description',
      'actor_enterprise_role',
      'actor_pos_role',
    ]) {
      expect(keys).not.toContain(forbidden)
    }
  })

  it('give a manager no cost, COGS, margin or profit field', () => {
    const keys = Object.keys(managerRow()).join(' ')
    expect(keys).not.toMatch(/cost/i)
    expect(keys).not.toMatch(/cogs/i)
    expect(keys).not.toMatch(/margin/i)
    expect(keys).not.toMatch(/profit/i)
  })

  it('give an administrator both role snapshots', () => {
    // POS role is branch-scoped and enterprise role is not. One conflated
    // column could not express an Administrator, who holds no POS assignment.
    const keys = Object.keys(adminRow())
    expect(keys).toContain('actor_enterprise_role')
    expect(keys).toContain('actor_pos_role')
  })
})

describe('the event taxonomy', () => {
  it('offers a manager only the event types they can ever see', () => {
    const managerTypes = eventTypesFor('manager')
    for (const adminOnly of [
      'assignment_granted',
      'assignment_revoked',
      'product_created',
      'category_deleted',
    ] as const) {
      expect(managerTypes).not.toContain(adminOnly)
    }
    expect(managerTypes).toEqual(MANAGER_VISIBLE_EVENT_TYPES)
  })

  it('offers an administrator every type', () => {
    expect(eventTypesFor('admin')).toEqual(ALL_EVENT_TYPES)
    expect(eventTypesFor('admin').length).toBeGreaterThan(eventTypesFor('manager').length)
  })

  it('labels every type, so no raw enum reaches a screen', () => {
    for (const type of ALL_EVENT_TYPES) {
      expect(POS_AUDIT_EVENT_LABEL[type]).toBeTruthy()
      expect(eventLabel(type)).not.toMatch(/_/)
    }
  })

  it('names no manager-visible label after cost or profit', () => {
    for (const type of MANAGER_VISIBLE_EVENT_TYPES) {
      const label = eventLabel(type)
      expect(label).not.toMatch(/cost/i)
      expect(label).not.toMatch(/cogs|margin|profit/i)
    }
  })

  it('keeps the one intentionally money-bearing manager event, as a selling price', () => {
    expect(MANAGER_VISIBLE_EVENT_TYPES).toContain('branch_selling_price_changed')
    expect(eventLabel('branch_selling_price_changed')).toBe('Branch selling price changed')
  })

  it('labels entities too', () => {
    expect(entityLabel('inventory_threshold')).toBe('Low-stock level')
    expect(entityLabel('branch_assignment')).toBe('POS access')
  })
})

describe('formatActorRole', () => {
  it('reads an Administrator from the enterprise role, with no POS role', () => {
    expect(formatActorRole('admin', null)).toBe('Administrator')
  })

  it('reads a POS Manager from the branch-scoped role, not the enterprise one', () => {
    // The manager is an ordinary employee enterprise-wide. Collapsing the two
    // would have called them "Employee" on their own branch's audit log.
    expect(formatActorRole('employee', 'manager')).toBe('POS Manager')
    expect(formatActorRole('employee', 'cashier')).toBe('Cashier')
  })

  it('falls back to the enterprise role where no POS role was held', () => {
    expect(formatActorRole('hr_manager', null)).toBe('HR Manager')
    expect(formatActorRole('employee', null)).toBe('Employee')
  })

  it('lets an Administrator stay an Administrator even at a branch', () => {
    expect(formatActorRole('admin', 'manager')).toBe('Administrator')
  })
})

describe('formatChange', () => {
  it('shows both sides of a transition', () => {
    expect(formatChange('Stopped', 'Offered')).toBe('Stopped → Offered')
  })

  it('shows one side when the other does not exist', () => {
    // A creation has no "before"; a removal has no "after".
    expect(formatChange(null, 'Carried')).toBe('Carried')
    expect(formatChange('Carried', null)).toBe('Carried')
  })

  it('never renders "null → null"', () => {
    expect(formatChange(null, null)).toBe('—')
  })
})

describe('pagination arithmetic', () => {
  it('counts pages at 25 per page', () => {
    expect(pageCount(0)).toBe(1)
    expect(pageCount(25)).toBe(1)
    expect(pageCount(26)).toBe(2)
  })

  it('offsets from a one-based page and never goes negative', () => {
    expect(offsetFor(1)).toBe(0)
    expect(offsetFor(3)).toBe(50)
    expect(offsetFor(0)).toBe(0)
    expect(offsetFor(-5)).toBe(0)
  })

  it('reads the window total off any row, and zero from an empty page', () => {
    expect(totalFrom([managerRow({ total_count: 91 })])).toBe(91)
    expect(totalFrom([])).toBe(0)
  })
})

describe('describeAuditError', () => {
  it('explains a branch the account does not manage', () => {
    expect(describeAuditError(new Error('permission denied'))).toBe(
      'You do not manage that branch.'
    )
  })

  it('explains an expired session', () => {
    expect(describeAuditError(new Error('Sign in again'))).toContain('session has expired')
  })

  it('never returns an empty string', () => {
    expect(describeAuditError(null)).toBe('The audit log could not be loaded.')
  })
})
