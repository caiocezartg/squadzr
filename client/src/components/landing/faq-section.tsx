'use client'

import { Accordion } from '@base-ui-components/react/accordion'
import { Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Reveal } from '@/components/ui/reveal'
import { SectionEyebrow } from './section-eyebrow'

interface FaqItem {
  readonly id: string
  readonly question: string
  readonly answer: string
}

/**
 * The FAQ: the title on the left and the questions as an accordion on the right (stacked below
 * 1024px). An open item takes the card ground, its plus turns into a mint ×, and its answer opens
 * with its height and opacity, and closes faster than it opens. Under reduced motion the height and the
 * turn apply at once.
 */
export function FAQSection() {
  const t = useTranslations('landing.faq')
  const items = t.raw('items') as readonly FaqItem[]

  return (
    <section id="faq" className="bg-menu scroll-mt-20 px-4 py-24 sm:px-6 sm:py-28">
      <Reveal stagger className="mx-auto flex max-w-310 flex-col gap-12 lg:flex-row lg:gap-14">
        <div className="flex min-w-0 flex-col gap-4.5 lg:flex-[1_1_320px]">
          <SectionEyebrow>{t('label')}</SectionEyebrow>
          <h2 className="type-section-title text-balance">{t('title')}</h2>
          <p className="text-text-3 max-w-85 text-base/[1.6]">{t('subtitle')}</p>
        </div>

        <Accordion.Root className="flex min-w-0 flex-col gap-1 lg:flex-[2_1_560px]">
          {items.map((item, index) => (
            <Accordion.Item
              key={item.id}
              className="bg-panel data-open:bg-card transition-colors duration-250 ease-(--ease-out)"
            >
              <Accordion.Header>
                <Accordion.Trigger className="group focus-visible:outline-mint flex min-h-11 w-full cursor-pointer items-center gap-4 px-4 py-5 text-left focus-visible:-outline-offset-2 focus-visible:outline-2 sm:gap-4.5 sm:px-5.5">
                  <span className="font-mono text-muted w-7 shrink-0 text-xs font-bold">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="text-text flex-1 text-base font-bold sm:text-[17px]">
                    {item.question}
                  </span>
                  <span
                    aria-hidden="true"
                    className="bg-raised-2 text-text-2 group-data-panel-open:text-mint flex size-8 shrink-0 items-center justify-center transition-colors duration-250 ease-(--ease-out)"
                  >
                    {/* The plus turns into a × inside its square; the square itself stays put. */}
                    <Plus
                      className="size-3.5 transition-[rotate] duration-250 ease-(--ease-out) group-data-panel-open:rotate-45"
                      strokeWidth={2.8}
                    />
                  </span>
                </Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Panel className="h-(--accordion-panel-height) overflow-hidden transition-[height,opacity] duration-250 ease-(--ease-out) data-ending-style:h-0 data-ending-style:duration-150 data-ending-style:opacity-0 data-starting-style:h-0 data-starting-style:opacity-0">
                <p className="text-text-3 pr-4 pb-5.5 pl-15 text-[15px]/[1.65] sm:pr-18 sm:pl-17">
                  {item.answer}
                </p>
              </Accordion.Panel>
            </Accordion.Item>
          ))}
        </Accordion.Root>
      </Reveal>
    </section>
  )
}
