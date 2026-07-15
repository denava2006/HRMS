import * as React from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, Mail, MapPin, Phone } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const NAV_LINKS = [
  { label: 'Home', to: '/' },
  { label: 'Careers', to: '/careers' },
]

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary font-display text-base font-bold text-primary-foreground">
        H
      </div>
      <span className="font-display text-lg font-semibold text-foreground">Harmony Suite</span>
    </Link>
  )
}

function SiteHeader() {
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = React.useState(false)

  React.useEffect(() => setMobileOpen(false), [location.pathname])

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/90 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />

        <nav className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={cn(
                'rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-muted',
                location.pathname === link.to ? 'text-secondary' : 'text-foreground'
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Button asChild variant="outline">
            <Link to="/login">HR Login</Link>
          </Button>
        </div>

        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-md text-foreground md:hidden"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden border-t border-border bg-card md:hidden"
          >
            <nav className="flex flex-col gap-1 px-4 py-3">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
                >
                  {link.label}
                </Link>
              ))}
              <Button asChild variant="outline" className="mt-1">
                <Link to="/login">HR Login</Link>
              </Button>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}

function SiteFooter() {
  return (
    <footer className="border-t border-border bg-primary text-primary-foreground">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-3">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 font-display text-base font-bold">
              H
            </div>
            <span className="font-display text-lg font-semibold">Harmony Suite</span>
          </div>
          <p className="mt-3 max-w-xs text-sm text-primary-foreground/70">
            A modern human resource management system built to support growing teams across the Philippines.
          </p>
        </div>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-primary-foreground/60">Quick links</h3>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            <li>
              <Link to="/" className="text-primary-foreground/80 hover:text-white">
                Home
              </Link>
            </li>
            <li>
              <Link to="/careers" className="text-primary-foreground/80 hover:text-white">
                Careers
              </Link>
            </li>
            <li>
              <Link to="/login" className="text-primary-foreground/80 hover:text-white">
                HR Login
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-primary-foreground/60">Contact</h3>
          <ul className="mt-3 flex flex-col gap-2.5 text-sm text-primary-foreground/80">
            <li className="flex items-center gap-2">
              <Mail className="h-4 w-4 shrink-0" />
              careers@harmonysuite.com
            </li>
            <li className="flex items-center gap-2">
              <Phone className="h-4 w-4 shrink-0" />
              +63 2 8888 0000
            </li>
            <li className="flex items-center gap-2">
              <MapPin className="h-4 w-4 shrink-0" />
              Manila, Philippines
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10 py-4">
        <p className="mx-auto max-w-6xl px-4 text-center text-xs text-primary-foreground/50 sm:px-6">
          © {new Date().getFullYear()} Harmony Suite HRMS. All rights reserved.
        </p>
      </div>
    </footer>
  )
}

export function PublicLayout() {
  const location = useLocation()

  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [location.pathname])

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <SiteHeader />
      <motion.main
        key={location.pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="flex-1"
      >
        <Outlet />
      </motion.main>
      <SiteFooter />
    </div>
  )
}
