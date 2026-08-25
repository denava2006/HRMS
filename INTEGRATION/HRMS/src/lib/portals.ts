import type { PosRole, UserRole } from '@/lib/enums'

/** The three separate areas of the system. Each has its own layout, its own
 * sidebar, and its own landing route -- a cashier at a till and an HR Manager
 * approving payroll are doing unrelated jobs and should not share a menu. */
export type PortalKey = 'admin' | 'pos' | 'employee'

export interface Portal {
  key: PortalKey
  /** Shown in the portal switcher. */
  label: string
  /** Where this portal starts. */
  path: string
}

export const PORTALS: Record<PortalKey, Portal> = {
  admin: { key: 'admin', label: 'HR Workspace', path: '/dashboard' },
  // Straight to the selling screen. A cashier signing in wants the till, not a
  // landing page describing that a till exists.
  // '/pos', not a specific screen: the index route decides where POS staff
  // land, because a cashier wants the till and a manager wants their dashboard.
  // Keeping that test in one place means defaultPortalPath() needs to know
  // nothing about POS roles.
  pos: { key: 'pos', label: 'Point of Sale', path: '/pos' },
  // Employee self-service lives under /dashboard with its own navigation
  // (see Sidebar's employeeNav) rather than a separate route root. It is still
  // a distinct portal -- an employee never sees an HR module -- the separation
  // is just enforced by role-gated routes instead of a different path prefix.
  employee: { key: 'employee', label: 'My Workspace', path: '/dashboard' },
}

/** The order a landing portal is chosen in when someone holds more than one.
 * POS before employee so a cashier lands at the till rather than on their own
 * payslips. */
const PORTAL_PRIORITY: PortalKey[] = ['admin', 'pos', 'employee']

/** One POS assignment: a role AT a branch. The pair is the unit -- see
 * PosAccess for why it is never flattened. */
export interface PosAssignment {
  branchId: string
  role: PosRole
}

/** What the account can reach in the POS, resolved from the database. */
export interface PosAccess {
  /** True for an Administrator (every branch) or anyone holding an active
   * assignment. Mirrors public.has_pos_access(). */
  hasAccess: boolean
  /** Branches from pos_branch_assignments. Empty for an Administrator, whose
   * access is not branch-scoped -- never read this as "no branches" without
   * checking `hasAccess` first. */
  branchIds: string[]
  /**
   * The (branch, role) pairs, from public.my_pos_assignments().
   *
   * Kept as pairs on purpose. Somebody can be a Manager at one branch and a
   * Cashier at another, and collapsing that to a single "is a manager" flag
   * would offer them manager tools at the branch where they are a cashier.
   * Navigation may ask whether a manager role exists anywhere; anything
   * branch-sensitive must ask about the branch in hand.
   */
  assignments: PosAssignment[]
}

export const NO_POS_ACCESS: PosAccess = { hasAccess: false, branchIds: [], assignments: [] }

/* ------------------------------------------------------- reading the roles */

/** The role this account holds at one branch, or undefined. Administrators
 * hold no assignment rows, so this is undefined for them -- their reach comes
 * from profiles.role and is answered by is_admin()/has_pos_role(). */
export function roleForBranch(pos: PosAccess, branchId: string | undefined): PosRole | undefined {
  if (!branchId) return undefined
  return pos.assignments.find((a) => a.branchId === branchId)?.role
}

export function isPosManagerAt(pos: PosAccess, branchId: string | undefined): boolean {
  return roleForBranch(pos, branchId) === 'manager'
}

export function managerBranchIds(pos: PosAccess): string[] {
  return pos.assignments.filter((a) => a.role === 'manager').map((a) => a.branchId)
}

export function cashierBranchIds(pos: PosAccess): string[] {
  return pos.assignments.filter((a) => a.role === 'cashier').map((a) => a.branchId)
}

/** Whether manager-specific navigation is worth showing at all. Deliberately
 * NOT an authorization answer: what someone may do at a given branch is
 * `isPosManagerAt`, and what they may actually do is the database. */
export function hasAnyManagerAssignment(pos: PosAccess): boolean {
  return pos.assignments.some((a) => a.role === 'manager')
}

/* ------------------------------------------------------------- the portals */

/**
 * Which portals this account holds.
 *
 * An Administrator holds the back office and nothing else, stated explicitly
 * rather than left to the fact that admins usually have no assignment row. They
 * administer the parent system, and the POS modules they need are in their own
 * sidebar -- switching workspaces would hide HR from them, which is backwards
 * for the system that owns everything else. A stray historical assignment must
 * not bring the switcher back.
 *
 * For everyone else the POS comes from an actual assignment, which is the same
 * rule the database applies.
 */
export function portalsFor(role: UserRole | undefined, pos: PosAccess): PortalKey[] {
  if (role === 'admin') return ['admin']

  const held: PortalKey[] = []
  if (role === 'hr_manager' || role === 'hr_staff') held.push('admin')
  if (pos.assignments.length > 0) held.push('pos')
  if (role === 'employee') held.push('employee')
  return held
}

export function availablePortals(role: UserRole | undefined, pos: PosAccess): Portal[] {
  const held = portalsFor(role, pos)
  return PORTAL_PRIORITY.filter((key) => held.includes(key)).map((key) => PORTALS[key])
}

export function canAccessPortal(
  role: UserRole | undefined,
  pos: PosAccess,
  portal: PortalKey
): boolean {
  return portalsFor(role, pos).includes(portal)
}

/** Where to send someone immediately after sign-in.
 *
 * This is the whole reason /home exists. The login form cannot answer it: when
 * the password is accepted the profile and POS queries have not resolved yet,
 * so a cashier would be computed into the back office and then bounced out of
 * it. Under ProtectedRoute both are loaded before the decision is made. */
export function defaultPortalPath(role: UserRole | undefined, pos: PosAccess): string {
  const held = portalsFor(role, pos)
  const landing = PORTAL_PRIORITY.find((key) => held.includes(key))
  // No portal at all (an inactive or half-provisioned account) still needs
  // somewhere to go. /dashboard renders its own "nothing to show you" state,
  // which is more useful than a blank screen or a redirect loop.
  return landing ? PORTALS[landing].path : PORTALS.admin.path
}

/** Which portal a path belongs to, for marking the switcher. */
export function portalForPath(pathname: string): PortalKey {
  return pathname === '/pos' || pathname.startsWith('/pos/') ? 'pos' : 'admin'
}
