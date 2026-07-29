import * as React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CheckCircle2, Home, Briefcase, Copy, Check, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { RESPONSE_WINDOW_DAYS } from '@/lib/applicationSla'

export default function ApplicationSuccessPage() {
  const location = useLocation()
  const state = location.state as { jobTitle?: string; referenceCode?: string; email?: string } | null
  const jobTitle = state?.jobTitle
  const referenceCode = state?.referenceCode
  const [copied, setCopied] = React.useState(false)

  // No auto-redirect here any more: the reference number is the only copy the
  // applicant will ever get, so the page has to wait for them rather than
  // bouncing to the homepage on a timer.
  const copyReference = async () => {
    if (!referenceCode) return
    try {
      await navigator.clipboard.writeText(referenceCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard permission denied — the code is on screen to copy manually.
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-4 py-16 text-center sm:px-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="flex h-20 w-20 items-center justify-center rounded-full bg-success/10 text-success"
      >
        <CheckCircle2 className="h-10 w-10" />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <h1 className="mt-6 font-display text-2xl font-bold text-foreground sm:text-3xl">
          Application Submitted Successfully
        </h1>
        <p className="mt-3 text-muted-foreground">
          {jobTitle ? (
            <>
              Thank you for applying for <span className="font-medium text-foreground">{jobTitle}</span>.
            </>
          ) : (
            'Thank you for applying.'
          )}{' '}
          Our HR team reviews every application within{' '}
          <span className="font-medium text-foreground">{RESPONSE_WINDOW_DAYS} days</span> and will reach out if you're
          a match for the role.
        </p>

        {referenceCode && (
          <div className="mt-8 rounded-xl border border-secondary/30 bg-secondary/5 p-5 text-left">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Your reference number
            </p>
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="font-mono text-xl font-bold text-foreground">{referenceCode}</p>
              <Button type="button" variant="outline" size="sm" onClick={copyReference}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Save this. Together with the email you applied with, it lets you track your application, see your
              interview schedule, and respond to a job offer.
            </p>
            <Button asChild className="mt-4 w-full sm:w-auto">
              <Link to={`/track?ref=${encodeURIComponent(referenceCode)}`}>
                <Search className="h-4 w-4" />
                Track My Application
              </Link>
            </Button>
          </div>
        )}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild size="lg" variant="outline">
            <Link to="/careers">
              <Briefcase className="h-4 w-4" />
              Browse More Jobs
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/">
              <Home className="h-4 w-4" />
              Return Home
            </Link>
          </Button>
        </div>
      </motion.div>
    </div>
  )
}
