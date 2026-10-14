'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { PhoneCall, Radio, Sparkles, Square, Volume2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardHeading,
  CardIcon,
  CardTitle,
} from '@/components/ui/card'
import { HotlineDialog } from '@/components/HotlineDialog'
import { cn } from '@/lib/utils'
import { useSpeech } from './useSpeech'

type Inquiry = {
  id: string
  caller: string
  channel: string
  question: string
  reply: string
}

const INQUIRIES: Record<string, Inquiry[]> = {
  en: [
    {
      id: 'h-1',
      caller: '+251 91 1•• ••45 · Sinan',
      channel: 'SMS · Code 1',
      question: '1 — What is the drought risk for my Tef plot in Sinan?',
      reply: 'Upper field (Tef): 11% chance of drought — Low. Soil moisture currently moderately dry.',
    },
    {
      id: 'h-2',
      caller: '+251 92 3•• ••88 · Gozamin',
      channel: 'Voice IVR · Code 2',
      question: '2 — When should I plant Tef this Meher season?',
      reply: 'Plant at normal rain onset. Early to mid-July for main season (Meher/Kiremt).',
    },
    {
      id: 'h-3',
      caller: '+251 94 7•• ••19 · Bibugn',
      channel: 'SMS · Code 3',
      question: '3 — Water management if dry spell exceeds 14 days?',
      reply: 'Standard rainwater retention (contour ploughing, mulching). Prioritise supplemental water during panicle emergence.',
    },
    {
      id: 'h-4',
      caller: '+251 91 8•• ••32 · Machakel',
      channel: 'USSD · Code 4',
      question: '4 — Which certified seed variety is recommended?',
      reply: 'Proceed with certified Quncho or Boset tef seed. Normal agronomic packages apply.',
    },
  ],
  am: [
    {
      id: 'h-1',
      caller: '+251 91 1•• ••45 · ሲናን',
      channel: 'SMS · ኮድ 1',
      question: '1 — በሲናን ወረዳ ለጤፍ ማሳዬ የድርቅ ስጋቱ ምን ይመስላል?',
      reply: 'የላይኛው ማሳ (ጤፍ)፡ የድርቅ ዕድል 11% — ዝቅተኛ። የአፈር እርጥበት፡ በመጠኑ ደረቅ።',
    },
    {
      id: 'h-2',
      caller: '+251 92 3•• ••88 · ጎዛምን',
      channel: 'የድምፅ IVR · ኮድ 2',
      question: '2 — በዚህ የክረምት ወቅት ጤፍ መቼ ይዘራል?',
      reply: 'በመደበኛ የዝናብ መጀመሪያ ይዝሩ። ለመሃር/ክረምት ከሐምሌ መጀመሪያ እስከ አጋማሽ።',
    },
    {
      id: 'h-3',
      caller: '+251 94 7•• ••19 · ቢቡኝ',
      channel: 'SMS · ኮድ 3',
      question: '3 — የሁለት ሳምንት የዝናብ መቋረጥ ሲያጋጥም የውሃ አያያዝ እንዴት ይሁን?',
      reply: 'መደበኛ የዝናብ ውሃ ማቆር (ኮንቱር እርሻ፣ መሸፈኛ) ይጠቀሙ። ዛላ በሚያወጣበት ወቅት ተጨማሪ ውሃ ያስቀድሙ።',
    },
    {
      id: 'h-4',
      caller: '+251 91 8•• ••32 · ማቻከል',
      channel: 'USSD · ኮድ 4',
      question: '4 — የትኛውን የተረጋገጠ የዘር ዝርያ ልጠቀም?',
      reply: 'የተመረጠውን የተረጋገጠ ኩንቾ ወይም ቦሰት የጤፍ ዘር ይቀጥሉ። መደበኛው የግብርና ጥቅል ይሠራል።',
    },
  ],
  om: [
    {
      id: 'h-1',
      caller: '+251 91 1•• ••45 · Sinaan',
      channel: 'SMS · Koodii 1',
      question: '1 — Sinaan keessatti sodaan hongee lafa xaafii koo maali?',
      reply: 'Lafa gubbaa (xaafii): carraa hongee 11% — Gadi aanaa. Jiidha biyyoof: Giddu galeessaan gogaa.',
    },
    {
      id: 'h-2',
      caller: '+251 92 3•• ••88 · Gozaamiin',
      channel: 'Sagalee IVR · Koodii 2',
      question: '2 — Waqtii Meher kana xaafii yoom facaasu?',
      reply: 'Jalqaba roobaa idilee irratti facaasi. Meher/Kiremt\'f Adoolessa jalqabaa hanga walakkaa.',
    },
    {
      id: 'h-3',
      caller: '+251 94 7•• ••19 · Bibuuny',
      channel: 'SMS · Koodii 3',
      question: '3 — Yoo roobni torban lama dhaabate bishaan akkamitti qabamu?',
      reply: 'Bishaan roobaa idileedhaan kuusi (qotiisa konteerii, uwwisa). Yeroo daraaraa jallisii dabalataa dursa kenni.',
    },
    {
      id: 'h-4',
      caller: '+251 91 8•• ••32 · Maacaakal',
      channel: 'USSD · Koodii 4',
      question: '4 — Sanyii xaafii mirkanaa\'e kam fayyadamuu qaba?',
      reply: 'Sanyii mirkanaa\'e Quncho yookaan Boset itti fufi. Pakeejiin qonnaa idilee hojjeta.',
    },
  ],
}

/**
 * Hotline 977: What farmers asked from a phone, and what went back, AgriMinds.
 * Provides toll-free dial access and voice readout of answered agronomic inquiries.
 */
export function FarmerHotline() {
  const t = useTranslations('hotline')
  const locale = useLocale()
  const speech = useSpeech(locale)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const langKey = locale.startsWith('am') ? 'am' : locale.startsWith('om') || locale.startsWith('or') ? 'om' : 'en'
  const items = (INQUIRIES[langKey] ?? INQUIRIES.en) ?? []

  const handleToggleSpeak = (item: Inquiry) => {
    if (speech.speaking && activeId === item.id) {
      speech.stop()
      setActiveId(null)
      return
    }
    setActiveId(item.id)
    speech.speak(`${item.question}. ${item.reply}`)
  }

  const [autoStart, setAutoStart] = useState(true)

  const handleOpenDialog = (startCall = true) => {
    setAutoStart(startCall)
    setDialogOpen(true)
  }

  return (
    <Card id="hotline" className="scroll-mt-24 border-primary/20 bg-surface-raised p-4 sm:p-6">
      <CardHeader className="p-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <CardHeading>
            <CardIcon className="bg-brand-lime/20 text-brand-lime">
              <PhoneCall className="size-5" />
            </CardIcon>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="font-display text-base font-semibold">
                  {t('title')}
                </CardTitle>
                <Badge variant="outline" className="border-brand-lime/40 bg-brand-lime/10 text-brand-lime text-[11px]">
                  <Radio className="mr-1 size-3 animate-pulse" />
                  977 IVR / SMS
                </Badge>
              </div>
              <CardDescription className="text-xs text-fg-muted">
                {t('desc')}
              </CardDescription>
            </div>
          </CardHeading>
          <Button
            type="button"
            onClick={() => handleOpenDialog(true)}
            size="sm"
            className="h-9 gap-2 rounded-xl bg-emerald-600 font-semibold text-white shadow-sm hover:bg-emerald-500 cursor-pointer"
          >
            <PhoneCall className="size-3.5 animate-pulse" />
            {t('callNow')}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="mt-4 flex flex-col gap-3 p-0">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {items.map((item) => {
            const isSpeaking = speech.speaking && activeId === item.id
            return (
              <div
                key={item.id}
                className={cn(
                  'flex flex-col justify-between gap-2 rounded-xl border border-border/80 bg-surface p-3 transition-colors',
                  isSpeaking && 'border-primary/60 bg-primary/[0.04]',
                )}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="font-medium text-fg-muted">{item.caller}</span>
                    <span className="text-fg-subtle">{item.channel}</span>
                  </div>
                  <p className="mt-1.5 text-xs font-semibold text-fg">
                    {item.question}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-fg-muted">
                    {item.reply}
                  </p>
                </div>
                {speech.canSpeak && (
                  <div className="mt-1 flex items-center justify-between border-t border-border/50 pt-2">
                    <button
                      type="button"
                      onClick={() => handleToggleSpeak(item)}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-fg-muted transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        isSpeaking && 'bg-primary/15 font-semibold text-primary',
                      )}
                      aria-label={isSpeaking ? t('listenTurn') : t('listenTurn')}
                    >
                      {isSpeaking ? (
                        <Square className="size-3.5" />
                      ) : (
                        <Volume2 className="size-3.5 text-primary" />
                      )}
                      <span>{isSpeaking ? t('listenTurn') : t('listenTurn')}</span>
                    </button>
                    <span className="text-[10px] text-fg-subtle">AgriMinds AI-DREWS</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="flex flex-col gap-1 rounded-xl border border-dashed border-border-strong bg-surface/50 p-3 text-xs text-fg-muted sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-1.5">
            <Sparkles className="size-3.5 shrink-0 text-brand-ochre" aria-hidden />
            <span>{t('dialCode')} — {locale === 'am' ? 'ከማንኛውም ስልክ ያለ ስማርት ፎን ይሰራል' : locale.startsWith('o') ? 'Bilbila kamiyyuu irraa bilisaan' : 'Free access from any standard mobile phone'}</span>
          </p>
          <span className="font-mono text-[11px] font-semibold text-primary">tel: 977</span>
        </div>
      </CardContent>
      <HotlineDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        autoStartCall={autoStart}
      />
    </Card>
  )
}
