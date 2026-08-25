import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { UserRole } from '@/lib/enums'

const state: { role: UserRole } = { role: 'admin' }

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ profile: { role: state.role } }),
}))

const { Sidebar } = await import('@/components/layout/Sidebar')

function show() {
  return render(
    <MemoryRouter>
      <Sidebar />
    </MemoryRouter>
  )
}

afterEach(() => {
  cleanup()
  state.role = 'admin'
})

describe('back-office navigation', () => {
  it('keeps HR Reports and POS Reports as distinct Administrator links', () => {
    show()
    expect(screen.getByRole('link', { name: 'Reports' }).getAttribute('href')).toBe(
      '/dashboard/reports'
    )
    expect(screen.getByRole('link', { name: 'POS Reports' }).getAttribute('href')).toBe(
      '/dashboard/admin/pos-reports'
    )
  })

  it('does not expose Administrator POS Reports to HR staff', () => {
    state.role = 'hr_staff'
    show()
    expect(screen.queryByRole('link', { name: 'POS Reports' })).toBeNull()
  })
})
