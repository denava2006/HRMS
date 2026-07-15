import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowRight, Heart, TrendingUp, Users, ShieldCheck, Mail, Phone, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { JobPostingCard, JobPostingCardSkeleton, NoOpenPositions } from '@/components/public/JobPostingCard'
import { usePublicOpenJobPostings } from '@/hooks/usePublicCareers'

const WHY_JOIN = [
  {
    icon: Heart,
    title: 'People-first culture',
    description: 'We build tools for HR teams, so treating our own people well isn’t optional — it’s the whole point.',
  },
  {
    icon: TrendingUp,
    title: 'Room to grow',
    description: 'Clear career paths and continuous learning, whether you’re just starting out or leading a team.',
  },
  {
    icon: Users,
    title: 'Collaborative teams',
    description: 'Cross-functional squads that ship together — no silos, no politics, just good work.',
  },
  {
    icon: ShieldCheck,
    title: 'Stability you can trust',
    description: 'Competitive pay, transparent policies, and benefits that actually cover what matters.',
  },
]

function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-primary text-primary-foreground">
      <div
        className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-accent/20 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-secondary/20 blur-3xl"
        aria-hidden="true"
      />
      <div className="relative mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 py-24 text-center sm:px-6 sm:py-32">
        <motion.span
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="rounded-full border border-white/20 bg-white/10 px-4 py-1 text-xs font-medium uppercase tracking-wide"
        >
          We're hiring across the Philippines
        </motion.span>
        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.05 }}
          className="max-w-3xl font-display text-4xl font-bold leading-tight sm:text-5xl"
        >
          Build your career with Harmony Suite
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="max-w-xl text-base text-primary-foreground/80 sm:text-lg"
        >
          We're a growing HR technology company helping organizations manage their people better. Come help us
          build it.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="flex flex-col gap-3 sm:flex-row"
        >
          <Button asChild size="lg" variant="accent">
            <Link to="/careers">
              View Careers
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="border-white/30 bg-transparent text-white hover:bg-white/10"
          >
            <Link to="/login">HR Login</Link>
          </Button>
        </motion.div>
      </div>
    </section>
  )
}

function CompanyIntroSection() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="grid gap-10 md:grid-cols-2 md:items-center">
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.4 }}
        >
          <h2 className="font-display text-2xl font-bold text-foreground sm:text-3xl">Who we are</h2>
          <p className="mt-4 text-muted-foreground">
            Harmony Suite is a modern Human Resource Management System built for organizations that want to spend
            less time on paperwork and more time on people. From recruitment to payroll, our platform brings every
            HR workflow into one place.
          </p>
          <p className="mt-4 text-muted-foreground">
            Behind that product is a small, focused team that cares deeply about craft — clean design, dependable
            software, and a genuinely good place to work.
          </p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, x: 16 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="grid grid-cols-2 gap-4"
        >
          {[
            { label: 'HR modules', value: '8' },
            { label: 'Built for', value: 'PH teams' },
            { label: 'Core value', value: 'People first' },
            { label: 'Status', value: 'Growing' },
          ].map((stat) => (
            <Card key={stat.label}>
              <CardContent className="p-5">
                <p className="font-display text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

function WhyJoinSection() {
  return (
    <section className="bg-muted/40 py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.4 }}
          className="mx-auto max-w-2xl text-center"
        >
          <h2 className="font-display text-2xl font-bold text-foreground sm:text-3xl">Why join Harmony Suite</h2>
          <p className="mt-3 text-muted-foreground">A few reasons our team sticks around.</p>
        </motion.div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {WHY_JOIN.map((item, index) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.35, delay: index * 0.05 }}
            >
              <Card className="h-full">
                <CardContent className="flex flex-col gap-3 p-5">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent/10 text-accent">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-display text-base font-semibold text-foreground">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

function FeaturedCareersSection() {
  const { data, isLoading, isError } = usePublicOpenJobPostings()
  const featured = data?.slice(0, 3) ?? []

  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <h2 className="font-display text-2xl font-bold text-foreground sm:text-3xl">Featured careers</h2>
        <p className="max-w-xl text-muted-foreground">A few of our current open roles — see all openings on the Careers page.</p>
      </div>

      <div className="mt-10">
        {isLoading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <JobPostingCardSkeleton key={i} />
            ))}
          </div>
        ) : isError ? (
          <p className="text-center text-sm text-muted-foreground">Couldn't load featured careers right now.</p>
        ) : featured.length === 0 ? (
          <NoOpenPositions />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((posting, index) => (
              <JobPostingCard key={posting.id} posting={posting} index={index} />
            ))}
          </div>
        )}
      </div>

      <div className="mt-10 flex justify-center">
        <Button asChild variant="outline">
          <Link to="/careers">
            Browse all careers
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </section>
  )
}

function AboutSection() {
  return (
    <section id="about" className="bg-muted/40 py-20">
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.4 }}
        >
          <h2 className="font-display text-2xl font-bold text-foreground sm:text-3xl">About Harmony Suite</h2>
          <p className="mt-4 text-muted-foreground">
            We started Harmony Suite to fix a problem we kept running into: HR software that's either too
            complicated or too limited. Today we're building a full HR platform — recruitment, employees,
            attendance, leave, and payroll — with a design and engineering standard we're genuinely proud of. If
            that sounds like the kind of work you want to do, we'd love to hear from you.
          </p>
        </motion.div>
      </div>
    </section>
  )
}

function ContactSection() {
  const contactItems = [
    { icon: Mail, label: 'Email', value: 'careers@harmonysuite.com' },
    { icon: Phone, label: 'Phone', value: '+63 2 8888 0000' },
    { icon: MapPin, label: 'Location', value: 'Manila, Philippines' },
  ]

  return (
    <section id="contact" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.4 }}
        className="mx-auto max-w-2xl text-center"
      >
        <h2 className="font-display text-2xl font-bold text-foreground sm:text-3xl">Get in touch</h2>
        <p className="mt-3 text-muted-foreground">
          Have a question about a role or how we work? Reach out — we read every message.
        </p>
      </motion.div>

      <div className="mx-auto mt-10 grid max-w-3xl gap-5 sm:grid-cols-3">
        {contactItems.map((item, index) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.35, delay: index * 0.05 }}
          >
            <Card className="h-full text-center">
              <CardContent className="flex flex-col items-center gap-2 p-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary/10 text-secondary">
                  <item.icon className="h-5 w-5" />
                </div>
                <p className="text-sm font-medium text-foreground">{item.label}</p>
                <p className="text-sm text-muted-foreground">{item.value}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </section>
  )
}

export default function HomePage() {
  return (
    <div>
      <HeroSection />
      <CompanyIntroSection />
      <WhyJoinSection />
      <FeaturedCareersSection />
      <AboutSection />
      <ContactSection />
    </div>
  )
}
