'use client'

import * as m from 'motion/react-m'
import { Accordion } from '@base-ui-components/react/accordion'
import { Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'

export function FAQSection() {
  const t = useTranslations()
  const faqItems = t.raw('faq.items') as Array<{
    id: string
    question: string
    answer: string
  }>

  return (
    <section className="relative py-24 border-t border-border/50">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <m.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.5 }}
        >
          <span className="section-label">{t('faq.label')}</span>
          <h2 className="mt-3 font-heading text-3xl font-bold sm:text-4xl">{t('faq.title')}</h2>
          <p className="mt-3 text-muted">{t('faq.subtitle')}</p>
        </m.div>

        <Accordion.Root className="space-y-2">
          {faqItems.map((item, i) => (
            <m.div
              key={item.id}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.35, delay: i * 0.05 }}
            >
              <Accordion.Item className="group/item rounded-xl border border-border bg-surface/50 transition-colors duration-200 data-panel-open:border-accent/20 data-panel-open:bg-surface hover:border-border-light">
                <Accordion.Header>
                  <Accordion.Trigger className="group flex w-full items-center justify-between gap-4 px-5 py-4 text-left">
                    <span className="text-sm font-semibold text-offwhite sm:text-base">
                      {item.question}
                    </span>
                    <Plus className="size-5 shrink-0 text-muted transition-all duration-200 group-data-panel-open:rotate-45 group-data-panel-open:text-accent" />
                  </Accordion.Trigger>
                </Accordion.Header>
                <Accordion.Panel className="h-(--accordion-panel-height) overflow-hidden transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0">
                  <p className="px-5 pb-4 text-sm leading-relaxed text-muted">{item.answer}</p>
                </Accordion.Panel>
              </Accordion.Item>
            </m.div>
          ))}
        </Accordion.Root>
      </div>
    </section>
  )
}
