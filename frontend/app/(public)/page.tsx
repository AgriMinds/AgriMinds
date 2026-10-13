import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import {
  ArrowRight,
  CloudRain,
  Database,
  LineChart,
  MessageSquare,
  Satellite,
  Sprout,
} from 'lucide-react'
import { LinkButton } from '@/features/public/LinkButton'
import { MODELS, REACH, SEGMENTS, STEPS } from '@/features/public/content'
import { Reveal, Section, SectionHead } from '@/features/public/Section'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('home')
  return { title: t('metaTitle'), description: t('heroLead') }
}

const STEP_ICONS = [Satellite, Database, LineChart, MessageSquare] as const

/**
 * What the platform is, for somebody who has never seen it.
 *
 * Every figure on this page is read from the trained artefacts rather than written into the copy,
 * and the honest limits are stated next to the claims — the drought model is skilful one month
 * ahead, so the page says one month rather than the three the interface can display. A landing
 * page that oversells a forecast costs a farmer a planting season, which is a more expensive kind
 * of marketing than it looks.
 */
export default async function HomePage() {
  const t = await getTranslations('home')

  return (
    <>
      {/* ---------------------------------------------------------------- hero */}
      <section className="bg-contour relative overflow-hidden border-b border-border">
        <div className="mx-auto grid max-w-[1280px] gap-10 px-4 pt-16 pb-14 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:gap-14 lg:px-8 lg:pt-24 lg:pb-20">
          <Reveal className="flex flex-col items-start gap-5">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/5 px-3 py-1 text-xs font-semibold tracking-wide text-primary">
              <Sprout className="size-3.5" aria-hidden />
              {t('eyebrow')}
            </span>
            <h1 className="font-display text-[clamp(2.25rem,1.6rem+2.8vw,3.75rem)] leading-[1.02] font-bold tracking-tight text-balance">
              {t('heroTitle')}
              <span className="block text-primary">{t('heroTitleAccent')}</span>
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-fg-muted sm:text-lg">
              {t('heroLead')}
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <LinkButton href="/request-access" size="lg" className="h-12">
                  {t('ctaPrimary')} <ArrowRight className="size-4" />
                </LinkButton>
              <LinkButton href="/how-it-works" size="lg" variant="outline" className="h-12">{t('ctaSecondary')}</LinkButton>
            </div>
            <p className="text-xs text-fg-subtle">{t('ctaNote')}</p>
          </Reveal>

          {/* The numbers that justify the claim, each traceable to a trained artefact. */}
          <Reveal delay={120} className="grid grid-cols-2 gap-3">
            {(['catchment', 'cells', 'record', 'crops'] as const).map((key) => (
              <div
                key={key}
                className="flex flex-col gap-1 rounded-2xl border border-border bg-surface-raised/80 p-4 shadow-sm backdrop-blur-sm"
              >
                <span className="font-display text-2xl font-bold tracking-tight text-primary">
                  {t(`stat.${key}.value`)}
                </span>
                <span className="text-sm font-medium">{t(`stat.${key}.label`)}</span>
                <span className="text-xs leading-snug text-fg-subtle">{t(`stat.${key}.note`)}</span>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------------- outcomes */}
      <Section>
        <SectionHead eyebrow={t('whyEyebrow')} title={t('whyTitle')} lead={t('whyLead')} />
        <div className="grid gap-4 md:grid-cols-3">
          {(['warning', 'decision', 'reach'] as const).map((key, i) => (
            <Reveal
              key={key}
              delay={i * 90}
              className="flex flex-col gap-2 rounded-2xl border border-border bg-surface-raised p-5 transition-shadow hover:shadow-md"
            >
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                {[<CloudRain key="a" className="size-5" />, <LineChart key="b" className="size-5" />, <MessageSquare key="c" className="size-5" />][i]}
              </span>
              <h3 className="font-display text-base font-semibold">{t(`why.${key}.title`)}</h3>
              <p className="text-sm leading-relaxed text-fg-muted">{t(`why.${key}.body`)}</p>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* ----------------------------------------------------------- how it works */}
      <Section tone="sunken">
        <SectionHead eyebrow={t('howEyebrow')} title={t('howTitle')} lead={t('howLead')} />
        <ol className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => {
            const Icon = STEP_ICONS[i % STEP_ICONS.length]!
            return (
              <Reveal
                key={step}
                as="li"
                delay={i * 80}
                className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-5"
              >
                <span className="flex items-center gap-2 text-xs font-semibold tracking-wider text-fg-subtle uppercase">
                  <Icon className="size-4 text-primary" aria-hidden />
                  {t('stepLabel', { n: i + 1 })}
                </span>
                <h3 className="font-display text-base font-semibold">{t(`step.${step}.title`)}</h3>
                <p className="text-sm leading-relaxed text-fg-muted">{t(`step.${step}.body`)}</p>
              </Reveal>
            )
          })}
        </ol>
        <div className="flex justify-center">
          <LinkButton href="/how-it-works" variant="outline">
              {t('howMore')} <ArrowRight className="size-4" />
            </LinkButton>
        </div>
      </Section>

      {/* ------------------------------------------------------------- the models */}
      <Section>
        <SectionHead eyebrow={t('modelsEyebrow')} title={t('modelsTitle')} lead={t('modelsLead')} />
        <div className="grid gap-4 lg:grid-cols-3">
          {MODELS.map((model, i) => (
            <Reveal
              key={model.key}
              delay={i * 90}
              className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-raised p-5"
            >
              <div className="flex flex-col gap-1">
                <h3 className="font-display text-base font-semibold">{t(`model.${model.key}.title`)}</h3>
                <p className="font-mono text-[11px] text-fg-subtle">{model.arch}</p>
              </div>
              <p className="text-sm leading-relaxed text-fg-muted">{t(`model.${model.key}.body`)}</p>
              <dl className="mt-auto flex flex-wrap gap-x-5 gap-y-1.5 border-t border-border pt-3">
                {model.metrics.map((m) => (
                  <div key={m.label} className="flex flex-col">
                    <dt className="text-[11px] tracking-wide text-fg-subtle uppercase">{m.label}</dt>
                    <dd className="font-semibold tabular-nums">{m.value}</dd>
                  </div>
                ))}
              </dl>
            </Reveal>
          ))}
        </div>
        {/* Said on the page itself, not in a footnote nobody opens. */}
        <p className="mx-auto max-w-2xl rounded-xl border border-dashed border-border px-4 py-3 text-center text-sm leading-relaxed text-fg-muted">
          {t('modelsCaveat')}
        </p>
      </Section>

      {/* -------------------------------------------------------------- who it serves */}
      <Section tone="sunken">
        <SectionHead eyebrow={t('whoEyebrow')} title={t('whoTitle')} lead={t('whoLead')} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SEGMENTS.map((segment, i) => (
            <Reveal
              key={segment}
              delay={i * 60}
              className="flex flex-col gap-1.5 rounded-xl border border-border bg-surface p-4"
            >
              <h3 className="text-sm font-semibold">{t(`segment.${segment}.title`)}</h3>
              <p className="text-sm leading-relaxed text-fg-muted">{t(`segment.${segment}.body`)}</p>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* ------------------------------------------------------------------- reach */}
      <Section>
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <Reveal className="flex flex-col gap-3">
            <span className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
              {t('reachEyebrow')}
            </span>
            <h2 className="font-display text-display-sm font-bold tracking-tight">{t('reachTitle')}</h2>
            <p className="text-sm leading-relaxed text-fg-muted sm:text-base">{t('reachLead')}</p>
          </Reveal>
          <Reveal delay={100} className="flex flex-col gap-2.5">
            {REACH.map((channel) => (
              <div
                key={channel.key}
                className="flex items-start gap-3 rounded-xl border border-border bg-surface-raised p-4"
              >
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-display text-xs font-bold text-primary">
                  {channel.badge}
                </span>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <h3 className="text-sm font-semibold">{t(`reach.${channel.key}.title`)}</h3>
                  <p className="text-sm leading-relaxed text-fg-muted">{t(`reach.${channel.key}.body`)}</p>
                </div>
              </div>
            ))}
          </Reveal>
        </div>
      </Section>

      {/* --------------------------------------------------------------------- cta */}
      <section className="border-t border-border bg-primary/[0.06]">
        <div className="mx-auto flex max-w-[1280px] flex-col items-center gap-5 px-4 py-16 text-center sm:px-6 lg:px-8 lg:py-20">
          <h2 className="font-display text-display font-bold tracking-tight text-balance">
            {t('ctaTitle')}
          </h2>
          <p className="max-w-xl text-sm leading-relaxed text-fg-muted sm:text-base">{t('ctaLead')}</p>
          <div className="flex flex-wrap justify-center gap-3">
            <LinkButton href="/request-access" size="lg" className="h-12">
                {t('ctaPrimary')} <ArrowRight className="size-4" />
              </LinkButton>
            <LinkButton href="/about" size="lg" variant="outline" className="h-12">{t('ctaAbout')}</LinkButton>
          </div>
        </div>
      </section>
    </>
  )
}
