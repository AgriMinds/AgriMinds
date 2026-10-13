'use client'

import { useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Loader2, Mic, Send, Square, Volume2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { useFarmerDashboard } from './useFarmer'
import { useAskAgent } from './useAgent'
import { useSpeech } from './useSpeech'

type Turn = { from: 'farmer' | 'agent'; text: string; intent?: string }

/** The questions the agent can answer, offered as taps so nobody has to guess the wording. */
const CHIPS = ['risk', 'planting', 'water', 'crop', 'plots', 'season'] as const

/** What each chip sends. Digits, because the hotline menu uses the same ones. */
const CHIP_TEXT: Record<(typeof CHIPS)[number], string> = {
  risk: '1',
  planting: '2',
  water: '3',
  crop: '4',
  plots: '5',
  season: '6',
}

/**
 * The farmer's agent: ask in words or by tapping, read the answer or hear it.
 *
 * Every answer comes from this farmer's own plots and the forecast for them — the agent chooses
 * which of the advisory engine's findings answers the question and says it in their language. It
 * does not compose advice, which is why it can be trusted with a planting date at all.
 *
 * The chips send the same digits the 977 hotline menu uses. That is not laziness: a farmer who
 * learns "3 is water" on the phone finds the same thing here, and the one agent answers both.
 *
 * Voice is offered only when the browser actually has a voice for the farmer's language. Reading
 * an Amharic sentence aloud in an English voice is noise, and offering a mic that mishears every
 * word is worse than no mic.
 */
export function AgentChat() {
  const t = useTranslations('farm.agent')
  const locale = useLocale()
  const ask = useAskAgent()
  const dashboard = useFarmerDashboard(1)
  const hotline = dashboard.data?.hotline
  const speech = useSpeech(locale)
  const [turns, setTurns] = useState<Turn[]>([])
  const [draft, setDraft] = useState('')
  const log = useRef<HTMLDivElement>(null)

  function send(text: string) {
    const question = text.trim()
    if (!question) return
    setTurns((prev) => [...prev, { from: 'farmer', text: question }])
    setDraft('')
    ask.mutate(
      { text: question, locale: locale as 'en' | 'am' | 'om', lead_month: 1 },
      {
        onSuccess: (answer) => {
          setTurns((prev) => [...prev, { from: 'agent', text: answer.text, intent: answer.intent }])
          requestAnimationFrame(() => log.current?.scrollTo({ top: log.current.scrollHeight }))
        },
        onError: (err) => {
          setTurns((prev) => [...prev, { from: 'agent', text: (err as Error).message }])
        },
      },
    )
  }

  const last = [...turns].reverse().find((turn) => turn.from === 'agent')

  return (
    <section
      id="agent"
      aria-labelledby="agent-heading"
      className="flex scroll-mt-24 flex-col gap-3 rounded-2xl border border-border bg-surface-raised p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 id="agent-heading" className="font-display text-base font-semibold">
            {t('title')}
          </h2>
          <p className="text-xs text-fg-muted">{t('subtitle')}</p>
        </div>
        {speech.canSpeak && last && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => (speech.speaking ? speech.stop() : speech.speak(last.text))}
            aria-label={speech.speaking ? t('stopReading') : t('readAloud')}
          >
            {speech.speaking ? <Square className="size-3.5" /> : <Volume2 className="size-3.5" />}
            {speech.speaking ? t('stopReading') : t('readAloud')}
          </Button>
        )}
      </div>

      {turns.length > 0 && (
        <div
          ref={log}
          role="log"
          aria-live="polite"
          className="flex max-h-72 flex-col gap-2 overflow-y-auto"
        >
          {turns.map((turn, i) => (
            <p
              key={i}
              className={cn(
                'max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed',
                turn.from === 'farmer'
                  ? 'self-end bg-primary/10 text-fg'
                  : 'self-start bg-surface-sunken text-fg',
              )}
            >
              {turn.text}
            </p>
          ))}
          {ask.isPending && (
            <p className="self-start px-3 py-2 text-sm text-fg-muted">
              <Loader2 className="inline size-3.5 animate-spin" aria-hidden /> {t('thinking')}
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {CHIPS.map((chip) => (
          <button
            key={chip}
            type="button"
            disabled={ask.isPending}
            onClick={() => send(CHIP_TEXT[chip])}
            className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium transition-colors hover:border-primary hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50"
          >
            {t(`chip.${chip}`)}
          </button>
        ))}
      </div>

      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          send(draft)
        }}
      >
        <label htmlFor="agent-input" className="sr-only">
          {t('inputLabel')}
        </label>
        <input
          id="agent-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t('placeholder')}
          maxLength={480}
          disabled={ask.isPending}
          className="h-11 min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 text-base focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        />
        {speech.canListen && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-11 shrink-0"
            aria-label={t('speak')}
            aria-pressed={speech.listening}
            onClick={() => speech.listen(send)}
          >
            <Mic className={cn('size-5', speech.listening && 'text-status-bad')} />
          </Button>
        )}
        <Button type="submit" size="icon" className="size-11 shrink-0" disabled={ask.isPending} aria-label={t('send')}>
          <Send className="size-5" />
        </Button>
      </form>

      {/* Said once, plainly: a feature phone gets the same answers without the app — and said
          only while that is still a plan rather than a working number. */}
      {hotline && (
        <p className="text-[11px] leading-relaxed text-fg-subtle">
          {t(hotline.connected ? 'hotlineLive' : 'hotlineNote', { code: hotline.short_code })}
        </p>
      )}
    </section>
  )
}
