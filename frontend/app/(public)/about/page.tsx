import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Building2 } from 'lucide-react'
import { TEAM } from '@/features/public/content'
import { LinkButton } from '@/features/public/LinkButton'
import { Reveal, Section, SectionHead } from '@/features/public/Section'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('about')
  return { title: t('title'), description: t('lead') }
}

/**
 * Who built this and where it comes from.
 *
 * The investigators are listed with their role and institution and **not** with their personal
 * mobile numbers or private email addresses. Those were supplied for the project record, and a
 * public page is a different thing from a project record: an address published here is scraped
 * within days, and the people on this list did not choose that. Enquiries go through the access
 * request instead, which reaches the same team and leaves a trail.
 */
export default async function AboutPage() {
  const t = await getTranslations('about')

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
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="flex flex-col gap-4">
            <SectionHead eyebrow={t('storyEyebrow')} title={t('storyTitle')} />
            <div className="flex flex-col gap-3 text-sm leading-relaxed text-fg-muted sm:text-base">
              <p>{t('story1')}</p>
              <p>{t('story2')}</p>
            </div>
          </div>
          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-sunken p-5">
            <h3 className="flex items-center gap-2 font-display text-base font-semibold">
              <Building2 className="size-4 text-primary" aria-hidden />
              {t('hostTitle')}
            </h3>
            <p className="text-sm leading-relaxed text-fg-muted">{t('hostBody')}</p>
            <dl className="flex flex-col gap-2 border-t border-border pt-3 text-sm">
              {(['area', 'woredas', 'region'] as const).map((key) => (
                <div key={key} className="flex items-baseline justify-between gap-3">
                  <dt className="text-fg-muted">{t(`fact.${key}.label`)}</dt>
                  <dd className="font-semibold">{t(`fact.${key}.value`)}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </Section>

      <Section tone="sunken">
        <SectionHead eyebrow={t('teamEyebrow')} title={t('teamTitle')} lead={t('teamLead')} />
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TEAM.map((person, i) => (
            <Reveal
              key={person.name}
              as="li"
              delay={i * 60}
              className="flex flex-col gap-1.5 rounded-2xl border border-border bg-surface p-5"
            >
              <h3 className="font-display text-base font-semibold">{person.name}</h3>
              <p className="text-sm font-medium text-primary">{t(`role.${person.role}`)}</p>
              {'detail' in person && person.detail && (
                <p className="text-xs text-fg-muted">{person.detail}</p>
              )}
              <p className="mt-auto pt-2 text-xs text-fg-subtle">{person.institution}</p>
            </Reveal>
          ))}
        </ul>
        <p className="max-w-2xl text-xs leading-relaxed text-fg-subtle">{t('contactNote')}</p>
      </Section>

      <Section>
        <div className="flex flex-col items-start gap-4">
          <SectionHead eyebrow={t('talkEyebrow')} title={t('talkTitle')} lead={t('talkLead')} />
          <div className="flex flex-wrap gap-3">
            <LinkButton href="/request-access">{t('ctaAccess')}</LinkButton>
            <LinkButton href="/signup" variant="outline">{t('ctaSignup')}</LinkButton>
          </div>
        </div>
      </Section>
    </>
  )
}
