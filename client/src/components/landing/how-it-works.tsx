'use client'

import * as m from 'motion/react-m'
import { Check, Link as LinkIcon } from 'lucide-react'
import { DiscordIcon } from '@/components/ui/icons'
import { useTranslations } from 'next-intl'

/* ─── Illustration: Step 1 — Discord Sign In ─── */

function DiscordClickIllustration() {
  const t = useTranslations()

  return (
    <div className="relative h-32 sm:h-40 flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(88,101,242,0.06),transparent_70%)]" />

      {/* Discord button */}
      <m.div
        className="relative z-10 flex items-center gap-2 rounded-lg bg-discord px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-discord/20"
        whileInView={{ scale: [1, 1, 0.93, 1, 1] }}
        viewport={{ once: true }}
        transition={{ duration: 2.2, times: [0, 0.45, 0.5, 0.55, 1] }}
      >
        <DiscordIcon className="size-3.5" />
        {t('howItWorks.signInButton')}
      </m.div>

      {/* Animated cursor */}
      <m.svg
        className="absolute z-20 size-5 [filter:drop-shadow(0_4px_3px_rgb(0_0_0/0.07))_drop-shadow(0_2px_2px_rgb(0_0_0/0.06))]"
        viewBox="0 0 24 24"
        fill="#F0F0F0"
        style={{ top: '50%', left: '50%' }}
        initial={{ x: 50, y: -30, opacity: 0 }}
        whileInView={{
          x: [50, 12, 12, 12],
          y: [-30, 4, 4, 4],
          opacity: [0, 1, 1, 0],
        }}
        viewport={{ once: true }}
        transition={{ duration: 2.2, times: [0, 0.4, 0.65, 0.82] }}
      >
        <path d="M6 2L6 18L10.5 13.5L14 21L16 20L12.5 12.5L18 12.5L6 2Z" />
      </m.svg>

      {/* Click ripple */}
      <m.div
        className="absolute z-0 size-3 rounded-full bg-discord/30"
        initial={{ scale: 0.95, opacity: 0 }}
        whileInView={{ scale: [0.95, 8], opacity: [0.6, 0] }}
        viewport={{ once: true }}
        transition={{ delay: 1, duration: 0.6, ease: 'easeOut' }}
      />

      {/* Success checkmark */}
      <m.div
        className="absolute top-3 right-4 z-10 size-6 rounded-full bg-accent/15 flex items-center justify-center"
        initial={{ scale: 0.95, opacity: 0 }}
        whileInView={{ scale: 1, opacity: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 1.4, duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
      >
        <Check className="size-3 text-accent" strokeWidth={3} />
      </m.div>
    </div>
  )
}

/* ─── Illustration: Step 2 — Browse Squads ─── */

function SquadBrowseIllustration() {
  const squads = [
    { color: 'bg-red-500/50', name: 'Valorant 5v5', players: '3/5' },
    { color: 'bg-blue-500/50', name: 'LoL Ranked', players: '2/5' },
    { color: 'bg-amber-500/50', name: 'CS2 Comp', players: '4/5' },
  ]

  return (
    <div className="relative h-32 sm:h-40 flex flex-col items-center justify-center gap-1.5 overflow-hidden px-5 sm:px-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(0,255,162,0.04),transparent_70%)]" />

      {squads.map((squad, i) => (
        <m.div
          key={squad.name}
          className={`relative z-10 w-full flex items-center gap-2.5 rounded-lg border px-3 py-1.5 text-[10px] ${
            i === 2 ? 'border-accent/25 bg-accent/5' : 'border-border bg-surface/80'
          }`}
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 + i * 0.15, duration: 0.35 }}
        >
          <div className={`size-4 rounded-sm shrink-0 ${squad.color}`} />
          <span className="text-offwhite/80 font-medium truncate">{squad.name}</span>
          <span className="ml-auto text-muted shrink-0">{squad.players}</span>
        </m.div>
      ))}

      {/* Cursor near selected card */}
      <m.svg
        className="absolute z-20 size-4 [filter:drop-shadow(0_1px_2px_rgb(0_0_0/0.1))_drop-shadow(0_1px_1px_rgb(0_0_0/0.06))] right-5 sm:right-8 bottom-5 sm:bottom-7"
        viewBox="0 0 24 24"
        fill="rgba(240,240,240,0.7)"
        initial={{ opacity: 0, x: 16 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.9, duration: 0.4 }}
      >
        <path d="M6 2L6 18L10.5 13.5L14 21L16 20L12.5 12.5L18 12.5L6 2Z" />
      </m.svg>
    </div>
  )
}

/* ─── Illustration: Step 3 — Squad Fill ─── */

function SquadFillIllustration() {
  const t = useTranslations()
  const totalSlots = 5

  return (
    <div className="relative h-32 sm:h-40 flex flex-col items-center justify-center gap-3 sm:gap-4 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_80%,rgba(0,255,162,0.05),transparent_60%)]" />

      {/* Player slots */}
      <div className="relative z-10 flex items-center gap-1.5 sm:gap-2">
        {Array.from({ length: totalSlots }).map((_, i) => (
          <m.div
            key={i}
            className="size-7 sm:size-9 rounded-full border-2 flex items-center justify-center"
            initial={{
              borderColor: 'rgba(42, 42, 47, 1)',
              backgroundColor: 'rgba(0, 255, 162, 0)',
            }}
            whileInView={{
              borderColor: ['rgba(42, 42, 47, 1)', 'rgba(0, 255, 162, 0.4)'],
              backgroundColor: ['rgba(0, 255, 162, 0)', 'rgba(0, 255, 162, 0.1)'],
            }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 + i * 0.3, duration: 0.3 }}
          >
            <m.svg
              className="size-3 sm:size-3.5 text-accent"
              viewBox="0 0 24 24"
              fill="currentColor"
              initial={{ opacity: 0, scale: 0.5 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.5 + i * 0.3, duration: 0.2 }}
            >
              <circle cx="12" cy="8" r="4" />
              <path d="M20 21a8 8 0 0 0-16 0" />
            </m.svg>
          </m.div>
        ))}
      </div>

      {/* "Discord link ready" badge */}
      <m.div
        className="relative z-10 flex items-center gap-1.5 rounded-full bg-accent/10 border border-accent/20 px-3 py-1 text-[10px] font-semibold text-accent"
        initial={{ opacity: 0, y: 8 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 2.1, duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
      >
        <LinkIcon className="size-3" strokeWidth={2.5} />
        {t('howItWorks.discordLinkReady')}
      </m.div>
    </div>
  )
}

/* ─── Illustrations ─── */

const ILLUSTRATIONS = [
  DiscordClickIllustration,
  SquadBrowseIllustration,
  SquadFillIllustration,
] as const

/* ─── Main Component ─── */

export function HowItWorks() {
  const t = useTranslations()

  const stepData = t.raw('howItWorks.steps') as Array<{
    title: string
    description: string
  }>
  const steps = [...ILLUSTRATIONS].map((Illustration, i) => ({
    ...(stepData[i] ?? { title: '', description: '' }),
    number: i + 1,
    Illustration,
  }))

  return (
    <section className="relative py-24 border-t border-border/50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <m.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.5 }}
        >
          <span className="section-label">{t('howItWorks.label')}</span>
          <h2 className="font-heading text-3xl font-bold sm:text-4xl">{t('howItWorks.title')}</h2>
        </m.div>

        {/* Desktop: horizontal timeline + cards */}
        <div className="hidden md:block">
          <div className="relative">
            {/* Connector line */}
            <m.div
              className="absolute top-5 left-[calc(16.666%)] right-[calc(16.666%)] h-[2px] bg-border-light origin-left"
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
            />

            <div className="grid grid-cols-3 gap-8">
              {steps.map((step, i) => (
                <div key={step.number} className="flex flex-col items-center">
                  {/* Circle on the line */}
                  <m.div
                    className="relative z-10 size-10 rounded-full bg-accent text-background flex items-center justify-center font-heading text-sm font-extrabold shadow-[0_0_20px_rgba(0,255,162,0.25)]"
                    initial={{ opacity: 0, scale: 0.95 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true, margin: '-80px' }}
                    transition={{
                      duration: 0.4,
                      delay: 0.3 + i * 0.2,
                      ease: [0.23, 1, 0.32, 1],
                    }}
                  >
                    {step.number}
                  </m.div>

                  {/* Card */}
                  <m.div
                    className="mt-6 w-full rounded-2xl border border-border bg-surface overflow-hidden"
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-50px' }}
                    transition={{ duration: 0.5, delay: 0.5 + i * 0.2 }}
                  >
                    <div className="border-b border-border/50 bg-background/50">
                      <step.Illustration />
                    </div>
                    <div className="p-5">
                      <h3 className="font-heading text-base font-bold mb-1.5">{step.title}</h3>
                      <p className="text-sm text-muted leading-relaxed">{step.description}</p>
                    </div>
                  </m.div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Mobile: vertical timeline + cards */}
        <div className="md:hidden">
          <div className="relative">
            {/* Vertical line */}
            <m.div
              className="absolute left-[15px] top-0 bottom-0 w-[2px] bg-border-light origin-top"
              initial={{ scaleY: 0 }}
              whileInView={{ scaleY: 1 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
            />

            <div className="space-y-10">
              {steps.map((step, i) => (
                <div key={step.number} className="relative">
                  {/* Circle on the vertical line */}
                  <m.div
                    className="absolute -left-10 top-0 z-10 size-8 rounded-full bg-accent text-background flex items-center justify-center font-heading text-xs font-extrabold shadow-[0_0_16px_rgba(0,255,162,0.2)]"
                    initial={{ opacity: 0, scale: 0.95 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true, margin: '-50px' }}
                    transition={{
                      duration: 0.4,
                      delay: 0.3 + i * 0.15,
                      ease: [0.23, 1, 0.32, 1],
                    }}
                  >
                    {step.number}
                  </m.div>

                  {/* Card */}
                  <m.div
                    className="rounded-2xl border border-border bg-surface overflow-hidden"
                    initial={{ opacity: 0, x: 16 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, margin: '-50px' }}
                    transition={{ duration: 0.5, delay: 0.4 + i * 0.15 }}
                  >
                    <div className="border-b border-border/50 bg-background/50">
                      <step.Illustration />
                    </div>
                    <div className="p-4">
                      <h3 className="font-heading text-base font-bold mb-1">{step.title}</h3>
                      <p className="text-sm text-muted leading-relaxed">{step.description}</p>
                    </div>
                  </m.div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
