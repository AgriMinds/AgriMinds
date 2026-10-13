import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { getLocale } from 'next-intl/server'
import { DATA_SOURCES, MODELS, STEPS } from '@/features/public/content'
import { LinkButton } from '@/features/public/LinkButton'
import { Reveal, Section, SectionHead } from '@/features/public/Section'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('howItWorks')
  return { title: t('title'), description: t('lead') }
}

/**
 * The method, stated plainly enough to be argued with.
 *
 * A research platform that will not say what its model is skilful at is asking to be trusted
 * rather than checked. The limitations section is not a disclaimer at the bottom — it is a section
 * with the same weight as the claims, because the people reading this page make planting and
 * procurement decisions on it.
 */
export default async function HowItWorksPage() {
  const t = await getTranslations('howItWorks')
  const locale = await getLocale()

  return (
    <>
      <section className="bg-contour border-b border-border">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-3 px-4 pt-14 pb-12 sm:px-6 lg:px-8 lg:pt-20">
          <span className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
            {t('eyebrow')}
          </span>
          <h1 className="font-display text-display max-w-3xl font-bold tracking-tight text-balance">
            {t('title')}
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-fg-muted">{t('lead')}</p>
        </div>
      </section>

      <Section>
        <SectionHead eyebrow={t('dataEyebrow')} title={t('dataTitle')} lead={t('dataLead')} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th scope="col" className="py-2.5 pr-4 font-semibold">{t('col.source')}</th>
                <th scope="col" className="py-2.5 pr-4 font-semibold">{t('col.provider')}</th>
                <th scope="col" className="py-2.5 font-semibold">{t('col.feeds')}</th>
              </tr>
            </thead>
            <tbody>
              {DATA_SOURCES.map((source) => (
                <tr key={source.key} className="border-b border-border/60">
                  <td className="py-3 pr-4 font-medium">{t(`source.${source.key}`)}</td>
                  <td className="py-3 pr-4 font-mono text-xs text-fg-muted">{source.provider}</td>
                  <td className="py-3 text-fg-muted">{t(`feeds.${source.feeds}`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm leading-relaxed text-fg-muted">{t('dataNote')}</p>
      </Section>

      <Section tone="sunken">
        <SectionHead eyebrow={t('pipelineEyebrow')} title={t('pipelineTitle')} />
        <ol className="flex flex-col gap-3">
          {STEPS.map((step, i) => (
            <Reveal
              key={step}
              as="li"
              delay={i * 70}
              className="flex gap-4 rounded-2xl border border-border bg-surface p-5"
            >
              <span className="font-display shrink-0 text-2xl font-bold text-primary/40 tabular-nums">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className="flex min-w-0 flex-col gap-1">
                <h3 className="font-display text-base font-semibold">{t(`pipeline.${step}.title`)}</h3>
                <p className="text-sm leading-relaxed text-fg-muted">{t(`pipeline.${step}.body`)}</p>
              </div>
            </Reveal>
          ))}
        </ol>
      </Section>

      <Section>
        <SectionHead eyebrow={t('modelsEyebrow')} title={t('modelsTitle')} lead={t('modelsLead')} />
        <div className="grid gap-4 lg:grid-cols-3">
          {MODELS.map((model) => (
            <div key={model.key} className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-raised p-5">
              <h3 className="font-display text-base font-semibold">{t(`model.${model.key}.title`)}</h3>
              <p className="font-mono text-[11px] text-fg-subtle">{model.arch}</p>
              <p className="text-sm leading-relaxed text-fg-muted">{t(`model.${model.key}.body`)}</p>
              <dl className="mt-auto flex flex-wrap gap-x-5 gap-y-1.5 border-t border-border pt-3">
                {model.metrics.map((m) => (
                  <div key={m.label}>
                    <dt className="text-[11px] tracking-wide text-fg-subtle uppercase">{m.label}</dt>
                    <dd className="font-semibold tabular-nums">{m.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </Section>

      {/* Given the same weight as the claims, on purpose. */}
      <Section tone="sunken">
        <SectionHead eyebrow={t('limitsEyebrow')} title={t('limitsTitle')} lead={t('limitsLead')} />
        <ul className="grid gap-3 md:grid-cols-2">
          {(['lead', 'persistence', 'yield', 'sms'] as const).map((key) => (
            <li key={key} className="flex flex-col gap-1 rounded-xl border border-border bg-surface p-4">
              <h3 className="text-sm font-semibold">{t(`limit.${key}.title`)}</h3>
              <p className="text-sm leading-relaxed text-fg-muted">{t(`limit.${key}.body`)}</p>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-3">
          <LinkButton href="/request-access">{t('ctaAccess')}</LinkButton>
          <LinkButton href="/about" variant="outline">{t('ctaAbout')}</LinkButton>
        </div>
        <p className="text-xs text-fg-subtle" lang={locale}>
          {t('rulesVersionNote')}
        </p>
      </Section>
    </>
  )
}
