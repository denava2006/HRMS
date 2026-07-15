import * as React from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CheckCircle2, Home, Briefcase } from 'lucide-react'
import { Button } from '@/components/ui/button'

const REDIRECT_SECONDS = 8

export default function ApplicationSuccessPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const jobTitle = (location.state as { jobTitle?: string } | null)?.jobTitle
  const [secondsLeft, setSecondsLeft] = React.useState(REDIRECT_SECONDS)

  React.useEffect(() => {
    if (secondsLeft <= 0) {
      navigate('/', { replace: true })
      return
    }
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [secondsLeft, navigate])

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
          Our HR team will review your application and reach out if you're a match for the role.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild size="lg">
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

        <p className="mt-6 text-xs text-muted-foreground">
          Redirecting to the homepage in {secondsLeft} second{secondsLeft === 1 ? '' : 's'}…
        </p>
      </motion.div>
    </div>
  )
}
