import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { PosAssignment } from '@/lib/portals'

const state: { assignments: PosAssignment[] } = { assignments: [] }

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    posAccess: {
      hasAccess: state.assignments.length > 0,
      branchIds: state.assignments.map((assignment) => assignment.branchId),
      assignments: state.assignments,
    },
  }),
}))

const { PosManagerRoute } = await import('@/components/pos/PosManagerRoute')

function show() {
  return render(
    <MemoryRouter initialEntries={['/pos/reports']}>
      <Routes>
        <Route path="/pos/till" element={<p>Cashier till</p>} />
        <Route
          path="/pos/reports"
          element={
            <PosManagerRoute>
              <p>Manager reports</p>
            </PosManagerRoute>
          }
        />
      </Routes>
    </MemoryRouter>
  )
}

afterEach(() => {
  cleanup()
  state.assignments = []
})

describe('PosManagerRoute', () => {
  it('admits an account that manages a branch', () => {
    state.assignments = [{ branchId: 'a', role: 'manager' }]
    show()
    expect(screen.getByText('Manager reports')).toBeTruthy()
  })

  it('admits a mixed account but only because it has a Manager assignment', () => {
    state.assignments = [
      { branchId: 'a', role: 'manager' },
      { branchId: 'b', role: 'cashier' },
    ]
    show()
    expect(screen.getByText('Manager reports')).toBeTruthy()
  })

  it('redirects a Cashier who types the Reports URL to the till', () => {
    state.assignments = [{ branchId: 'a', role: 'cashier' }]
    show()
    expect(screen.getByText('Cashier till')).toBeTruthy()
    expect(screen.queryByText('Manager reports')).toBeNull()
  })
})
