'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Check, Copy, ExternalLink, PhoneCall, Radio, Square, Volume2, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useSpeech } from '@/features/farmer/useSpeech'
import { HotlineCallSimulator } from '@/components/HotlineCallSimulator'
import { cn } from '@/lib/utils'

interface HotlineDialogProps {
  open: boolean
  onClose: () => void
  initialTab?: 'simulate' | 'info'
  autoStartCall?: boolean
}

export function HotlineDialog({
  open,
  onClose,
  initialTab = 'simulate',
  autoStartCall = false,
}: HotlineDialogProps) {
  const t = useTranslations('hotline')
  const tc = useTranslations('common')
  const locale = useLocale()
  const speech = useSpeech(locale)
  const [tab, setTab] = useState<'simulate' | 'info'>(initialTab)
  const [copied, setCopied] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)

  const handleClose = useCallback(() => {
    speech.stop()
    setCopied(false)
    onClose()
  }, [onClose, speech])

  useEffect(() => {
    if (!open) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      speech.stop()
    }
  }, [open, handleClose, speech])

  if (!open) return null

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText('977')
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }
  }

  const handleToggleVoice = () => {
    if (speech.speaking) {
      speech.stop()
    } else {
      speech.speak(t('ivrGreeting'))
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-brand-forest-deep/60 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) {
          handleClose()
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="hotline-dialog-title"
        className="max-h-[95svh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-border bg-surface-raised p-4 shadow-2xl sm:rounded-2xl sm:p-6 animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-lime/20 text-brand-lime">
              <PhoneCall className="size-5" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="hotline-dialog-title" className="font-display text-lg font-bold">
                  {t('dialogTitle')}
                </h2>
                <Badge variant="outline" className="border-brand-lime/40 bg-brand-lime/10 text-brand-lime text-[11px]">
                  <Radio className="mr-1 size-3 animate-pulse" />
                  {t('tollFreeBadge')}
                </Badge>
                {locale.startsWith('am') && (
                  <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-500 text-[10px]">
                    🤗 Hugging Face MMS
                  </Badge>
                )}
                {(locale.startsWith('om') || locale.startsWith('or')) && (
                  <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-500 text-[10px]">
                    🤗 Hugging Face MMS
                  </Badge>
                )}
              </div>
              <p className="text-xs text-fg-muted">{t('dialogSubtitle')}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={tc('close')}
            onClick={handleClose}
          >
            <X className="size-4" />
          </Button>
        </div>

        {/* Tab Switcher */}
        <div className="mt-4 flex rounded-xl border border-border bg-surface p-1">
          <button
            type="button"
            onClick={() => setTab('simulate')}
            className={cn(
              'flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all cursor-pointer',
              tab === 'simulate'
                ? 'bg-primary text-primary-fg shadow-xs'
                : 'text-fg-muted hover:text-foreground',
            )}
          >
            {t('simulateTab')}
          </button>
          <button
            type="button"
            onClick={() => setTab('info')}
            className={cn(
              'flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all cursor-pointer',
              tab === 'info'
                ? 'bg-primary text-primary-fg shadow-xs'
                : 'text-fg-muted hover:text-foreground',
            )}
          >
            {t('infoTab')}
          </button>
        </div>

        {/* Tab 1: Interactive Call Simulation */}
        {tab === 'simulate' && (
          <div className="mt-4">
            <HotlineCallSimulator
              onClose={handleClose}
              autoCall={autoStartCall}
            />
          </div>
        )}

        {/* Tab 2: Number info & copy */}
        {tab === 'info' && (
          <div className="mt-4 flex flex-col gap-4">
            <div className="rounded-2xl border border-brand-lime/30 bg-gradient-to-br from-brand-lime/[0.08] via-surface to-brand-forest/[0.05] p-5 text-center">
              <p className="text-xs font-semibold tracking-wider text-primary uppercase">
                {t('dialFromPhone')}
              </p>
              <div className="my-2 font-display text-5xl font-black tracking-tight text-foreground sm:text-6xl">
                977
              </div>
              <p className="mx-auto max-w-sm text-xs leading-relaxed text-fg-muted">
                {t('dialogNote')}
              </p>

              <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
                <Button
                  type="button"
                  variant={copied ? 'outline' : 'default'}
                  size="sm"
                  onClick={handleCopy}
                  className="h-9 gap-1.5 px-4 font-semibold"
                >
                  {copied ? (
                    <>
                      <Check className="size-4 text-brand-lime" />
                      {t('copiedNumber')}
                    </>
                  ) : (
                    <>
                      <Copy className="size-4" />
                      {t('copyNumber')}
                    </>
                  )}
                </Button>

                {speech.canSpeak && (
                  <Button
                    type="button"
                    variant={speech.speaking ? 'outline' : 'subtle'}
                    size="sm"
                    onClick={handleToggleVoice}
                    className="h-9 gap-1.5 px-4 font-semibold"
                  >
                    {speech.speaking ? (
                      <>
                        <Square className="size-3.5 fill-current text-primary" />
                        {t('stopIvr')}
                      </>
                    ) : (
                      <>
                        <Volume2 className="size-4 text-primary" />
                        {t('listenIvr')}
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>

            {speech.speaking && (
              <div className="rounded-xl border border-primary/30 bg-primary/[0.05] p-3 text-xs leading-relaxed text-foreground animate-in fade-in duration-150">
                <div className="flex items-center gap-2 mb-1.5 font-semibold text-primary">
                  <Volume2 className="size-4 animate-bounce" />
                  <span>977 Automated IVR Voice Broadcast</span>
                </div>
                <p className="italic text-fg-muted">&ldquo;{t('ivrGreeting')}&rdquo;</p>
              </div>
            )}
          </div>
        )}

        {/* Optional Desktop / Phone Dialer link with clear label */}
        <div className="mt-4 flex flex-col gap-2 rounded-xl border border-border/80 bg-surface-sunken p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] text-fg-muted">
              <span className="font-semibold text-foreground">{t('launchDialer')}</span>
              <p>{t('launchDialerHint')}</p>
            </div>
            <a
              href="tel:977"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-medium text-foreground shadow-xs transition-colors hover:bg-surface-raised"
            >
              <ExternalLink className="size-3" />
              tel:977
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
