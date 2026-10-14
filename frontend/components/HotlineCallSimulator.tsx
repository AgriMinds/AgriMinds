'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import {
  Delete,
  Mic,
  MicOff,
  Phone,
  PhoneCall,
  PhoneOff,
  Radio,
  RotateCcw,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useSpeech } from '@/features/farmer/useSpeech'
import { playDtmfTone, playRingbackTone } from '@/lib/telephony'
import { cn } from '@/lib/utils'

export type CallState = 'idle' | 'calling' | 'connected' | 'ended'

export interface Turn {
  id: string
  speaker: 'farmer' | 'ai'
  text: string
  digit?: string
  timestamp: string
}

const KEYPAD_BUTTONS = [
  { digit: '1', sub: '.,\'' },
  { digit: '2', sub: 'ABC' },
  { digit: '3', sub: 'DEF' },
  { digit: '4', sub: 'GHI' },
  { digit: '5', sub: 'JKL' },
  { digit: '6', sub: 'MNO' },
  { digit: '7', sub: 'PQRS' },
  { digit: '8', sub: 'TUV' },
  { digit: '9', sub: 'WXYZ' },
  { digit: '*', sub: ' ' },
  { digit: '0', sub: '+ / Menu' },
  { digit: '#', sub: ' ' },
] as const

interface ResponseEntry {
  topic: string
  reply: string
}

const HOTLINE_RESPONSES: Record<string, Record<string, ResponseEntry>> = {
  en: {
    '1': {
      topic: 'Drought Risk',
      reply: 'Upper field (Tef): 11% chance of drought — Low. Soil moisture is currently moderately dry in Sinan woreda.',
    },
    '2': {
      topic: 'When to Plant',
      reply: 'Plant at normal rain onset. Early to mid-July for main Meher/Kiremt season. Ensure soil has received at least 25mm of rain.',
    },
    '3': {
      topic: 'Water Management',
      reply: 'Standard rainwater retention (contour ploughing, mulching). Prioritise supplemental water during panicle emergence if dry spell exceeds 14 days.',
    },
    '4': {
      topic: 'Seed Selection',
      reply: 'Proceed with certified Quncho or Boset tef seed. Certified drought-tolerant varieties have shown highest yield resilience in the Choke Watershed.',
    },
    '5': {
      topic: 'My Plots',
      reply: 'You have 3 registered plots in Sinan: Upper field (0.92 ha, Tef), Lower field (2.70 ha, Tef), and Home plot (0.51 ha, Tef).',
    },
    '6': {
      topic: 'Season Outlook',
      reply: 'Kiremt (Main Rainy Season / Meher). Equatorial Pacific Niño 3.4 is currently in High El Niño (+1.58 °C). Early dry-spell probability is moderately elevated.',
    },
    '7': {
      topic: 'Preparedness Actions',
      reply: 'Maintain standard input distribution and routine agro-meteorological monitoring through your Kebele development agent (DA).',
    },
    '8': {
      topic: 'ENSO Pacific State',
      reply: 'Pacific Niño 3.4 is at +1.58 °C (El Niño phase). For the Choke Watershed, this typically suppresses late rainfall and increases mid-season dry spells.',
    },
    '0': {
      topic: 'Main Menu',
      reply: 'AgriMinds 977 hotline menu: Press 1 for drought risk, 2 for planting window, 3 for water advice, 4 for seeds, 5 for your plots, 6 for the season outlook, or 0 to repeat this menu.',
    },
  },
  am: {
    '1': {
      topic: 'የድርቅ ስጋት',
      reply: 'የላይኛው ማሳ (ጤፍ)፡ የድርቅ ዕድል 11% — ዝቅተኛ። በሲናን ወረዳ የአፈር እርጥበት በመጠኑ ደረቅ ነው።',
    },
    '2': {
      topic: 'የመዝሪያ ጊዜ',
      reply: 'በመደበኛ የዝናብ መጀመሪያ ይዝሩ። ለመሃር/ክረምት ከሐምሌ መጀመሪያ እስከ አጋማሽ። አፈሩ ቢያንስ 25 ሚሜ ዝናብ ማግኘቱን ያረጋግጡ።',
    },
    '3': {
      topic: 'የውሃ አያያዝ',
      reply: 'መደበኛ የዝናብ ውሃ ማቆር (ኮንቱር እርሻ፣ መሸፈኛ) ይጠቀሙ። የሁለት ሳምንት የዝናብ መቋረጥ ካጋጠመ ዛላ በሚያወጣበት ወቅት ተጨማሪ ውሃ ያስቀድሙ።',
    },
    '4': {
      topic: 'የዘር ዝርያ',
      reply: 'የተመረጠውን የተረጋገጠ ኩንቾ ወይም ቦሰት የጤፍ ዘር ይቀጥሉ። በቾክ ተፋሰስ ከፍተኛ ምርት ማስገኘታቸው ተረጋግጧል።',
    },
    '5': {
      topic: 'ማሳዎቼ',
      reply: 'በሲናን ወረዳ 3 የተመዘገቡ ማሳዎች አሉዎት፡ የላይኛው ማሳ (0.92 ሄክታር)፣ የታችኛው ማሳ (2.7 ሄክታር)፣ እና የቤት ማሳ (0.51 ሄክታር)።',
    },
    '6': {
      topic: 'ወቅታዊ ትንበያ',
      reply: 'ክረምት (መሃር ወቅት)። የፓስፊክ ውቅያኖስ ኒኞ 3.4 በከፍተኛ ኤል ኒኞ (+1.58 °C) ላይ ይገኛል። የቀደምት ደረቅ ቀናት ስጋት መጠነኛ ጭማሪ አሳይቷል።',
    },
    '7': {
      topic: 'የቅድመ ዝግጅት እርምጃዎች',
      reply: 'መደበኛ የግብዓት ስርጭትና በቀበሌ ልማት ሠራተኞች (DA) በኩል የአየር ሁኔታ ክትትል ያድርጉ።',
    },
    '8': {
      topic: 'የኤል ኒኞ ሁኔታ',
      reply: 'ፓስፊክ ኒኞ 3.4 በ+1.58 °C (ኤል ኒኞ) ላይ ነው። ለቾክ ተፋሰስ ይህ አብዛኛውን ጊዜ የክረምቱን ዝናብ ይቀንሳል ወይም ያዘገያል።',
    },
    '0': {
      topic: 'ዋና ምናሌ',
      reply: 'የአግሪማይንድስ 977 የስልክ ምናሌ፡ ለድርቅ ስጋት 1ን፣ ለመዝሪያ ጊዜ 2ን፣ ለውሃ አያያዝ 3ን፣ ለዘር ዝርያ 4ን፣ ለማሳዎችዎ 5ን፣ ለወቅቱ ትንበያ 6ን፣ ምናሌውን ለመድገም 0ን ይጫኑ።',
    },
  },
  om: {
    '1': {
      topic: 'Sodaa Hongee',
      reply: 'Lafa gubbaa (xaafii): carraa hongee 11% — Gadi aanaa. Jiidha biyyoof aanaa Sinaan keessatti giddu galeessaan gogaa dha.',
    },
    '2': {
      topic: 'Yoom Facaasuu',
      reply: 'Jalqaba roobaa idilee irratti facaasi. Meher/Kiremt\'f Adoolessa jalqabaa hanga walakkaa. Rooba yoo xiqqaate 25mm eegaa.',
    },
    '3': {
      topic: 'Gorsa Bishaanii',
      reply: 'Bishaan roobaa idileedhaan kuusi (qotiisa konteerii, uwwisa). Yoo roobni torban lama dhaabbate yeroo daraaraa jallisii dabalataa dursa kenni.',
    },
    '4': {
      topic: 'Filannoo Sanyii',
      reply: 'Sanyii mirkanaa\'e Quncho yookaan Boset itti fufi. Tuffiin dandeettii hongee qabu tulluu Choketti bu\'a qabeessa ta\'uun mirkanaa\'eera.',
    },
    '5': {
      topic: 'Lafa Koo',
      reply: 'Aanaa Sinaan keessatti lafa galmeeffame 3 qabdu: Lafa gubbaa (0.92 ha), Lafa gadii (2.70 ha), fi Lafa mana jireenyaa (0.51 ha).',
    },
    '6': {
      topic: 'Haala Waqtii',
      reply: 'Waqtii Kiremt (Meher). Haalli Paasifiik Niño 3.4 El Niño ol aanaa (+1.58 °C) irratti argama.',
    },
    '7': {
      topic: 'Tarkaanfii Qophii',
      reply: 'Raabsaa meeshaa idilee fi hordoffii haala qilleensaa hojjettoota misooma gandaa (DA) waliin itti fufaa.',
    },
    '8': {
      topic: 'Haala El Niño',
      reply: 'Paasifiik Niño 3.4 +1.58 °C (El Niño) dha. Tulluu Choke keessatti rooba kiremtii hir\'isuu danda\'a.',
    },
    '0': {
      topic: 'Gabatee Guddaa',
      reply: 'AgriMinds 977: Sodaa hongeef 1, yeroo facaasaaf 2, bishaaniif 3, sanyii midhaaniif 4, lafa keessaniif 5, haala waqtiif 6, irra deebi\'uuf 0 cuqaasaa.',
    },
  },
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

function matchVoiceIntent(spoken: string): string {
  const text = spoken.toLowerCase()
  if (/drought|risk|hongee|balaa|ድርቅ|ስጋት|አደጋ/.test(text)) return '1'
  if (/plant|sow|when|time|facaasuu|dhaabuu|yoom|መዝራት|ዝረት|መቼ/.test(text)) return '2'
  if (/water|rain|irrigation|bishaan|jallisii|ውሃ|መስኖ|ዝናብ/.test(text)) return '3'
  if (/crop|seed|variety|sanyii|midhaan|ዘር|ዝርያ|ሰብል/.test(text)) return '4'
  if (/plot|land|farm|lafa|qonnaa|ማሳ|መሬት/.test(text)) return '5'
  if (/season|kiremt|meher|belg|waqtii|ወቅት|ክረምት|መሃር/.test(text)) return '6'
  if (/prepare|action|qophii|ዝግጅት/.test(text)) return '7'
  if (/nino|nina|enso|pacific|paasifiik|ኒኞ|ፓስፊክ/.test(text)) return '8'
  if (/help|menu|start|hello|hi|selam|gargaarsa|ሰላም|እርዳታ/.test(text)) return '0'
  return '1'
}

interface HotlineCallSimulatorProps {
  onClose?: () => void
  initialDialed?: string
  autoCall?: boolean
  plotName?: string
  crop?: string
  droughtProbability?: number
  riskLevel?: string
}

export function HotlineCallSimulator({
  onClose,
  initialDialed = '977',
  autoCall = false,
  plotName,
  crop,
  droughtProbability,
  riskLevel,
}: HotlineCallSimulatorProps) {
  const t = useTranslations('hotline')
  const locale = useLocale()
  const speech = useSpeech(locale)
  const transcriptId = useId()

  const langKey = locale.startsWith('am')
    ? 'am'
    : locale.startsWith('om') || locale.startsWith('or')
      ? 'om'
      : 'en'

  const [callState, setCallState] = useState<CallState>(autoCall ? 'calling' : 'idle')
  const [dialed, setDialed] = useState(initialDialed)
  const [duration, setDuration] = useState(0)
  const [audioMuted, setAudioMuted] = useState(false)
  const [showKeypad, setShowKeypad] = useState(true)
  const [activeDigit, setActiveDigit] = useState<string | null>(null)
  const [turns, setTurns] = useState<Turn[]>([])

  const transcriptEndRef = useRef<HTMLDivElement>(null)
  const ringStopRef = useRef<(() => void) | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const stopAllAudio = useCallback(() => {
    if (ringStopRef.current) {
      ringStopRef.current()
      ringStopRef.current = null
    }
    speech.stop()
  }, [speech])

  // End the call cleanly
  const handleEndCall = useCallback(() => {
    stopAllAudio()
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    setCallState('ended')
  }, [stopAllAudio])

  // Start Call Flow
  const handleStartCall = useCallback(() => {
    stopAllAudio()
    setTurns([])
    setDuration(0)
    setCallState('calling')

    // Ringing sound
    if (!audioMuted) {
      ringStopRef.current = playRingbackTone()
    }

    // Connect after 1.4s
    const connectTimer = setTimeout(() => {
      if (ringStopRef.current) {
        ringStopRef.current()
        ringStopRef.current = null
      }
      setCallState('connected')

      // Timer start
      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1)
      }, 1000)

      // Initial automated greeting
      const greetingText = t('ivrGreetingShort')
      const initialTurn: Turn = {
        id: `turn-init-${Date.now()}`,
        speaker: 'ai',
        text: greetingText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
      setTurns([initialTurn])

      // Speak initial greeting if not muted
      if (!audioMuted && speech.canSpeak) {
        speech.speak(greetingText)
      }
    }, 1400)

    return () => clearTimeout(connectTimer)
  }, [audioMuted, speech, t, stopAllAudio])

  // Auto-start on mount if requested
  useEffect(() => {
    if (!autoCall) return

    if (!audioMuted) {
      ringStopRef.current = playRingbackTone()
    }

    const connectTimer = setTimeout(() => {
      if (ringStopRef.current) {
        ringStopRef.current()
        ringStopRef.current = null
      }
      setCallState('connected')

      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1)
      }, 1000)

      const greetingText = t('ivrGreetingShort')
      const initialTurn: Turn = {
        id: `turn-init-${Date.now()}`,
        speaker: 'ai',
        text: greetingText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
      setTurns([initialTurn])

      if (!audioMuted && speech.canSpeak) {
        speech.speak(greetingText)
      }
    }, 1400)

    return () => {
      clearTimeout(connectTimer)
      stopAllAudio()
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [autoCall, audioMuted, speech, t, stopAllAudio])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAllAudio()
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [stopAllAudio])

  // Scroll to bottom of conversation
  useEffect(() => {
    if (callState === 'connected' && transcriptEndRef.current) {
      transcriptEndRef.current?.scrollIntoView?.({ behavior: 'smooth' })
    }
  }, [turns, callState])

  // Process IVR response for digit
  const sendIvrDigit = useCallback(
    (digit: string) => {
      if (callState !== 'connected') return

      playDtmfTone(digit)
      setActiveDigit(digit)
      setTimeout(() => setActiveDigit(null), 250)

      const dict: Record<string, ResponseEntry> = HOTLINE_RESPONSES[langKey] ?? HOTLINE_RESPONSES.en ?? {}
      const item = dict[digit] ?? dict['1']
      const topic = item?.topic ?? 'Advisory'

      // Farmer turn
      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      const farmerTurn: Turn = {
        id: `turn-farmer-${Date.now()}`,
        speaker: 'farmer',
        text: t('pressedKey', { key: digit, topic }),
        digit,
        timestamp: nowStr,
      }

      // Dynamic advisory tailoring if plot props exist
      let replyText = item?.reply ?? ''
      if (digit === '1' && plotName) {
        const pct = droughtProbability ? Math.round(droughtProbability <= 1 ? droughtProbability * 100 : droughtProbability) : 11
        const level = riskLevel ?? 'Low'
        const c = crop ?? 'Tef'
        if (langKey === 'am') {
          replyText = `${plotName} (${c})፡ የድርቅ ዕድል ${pct}% — ${level}። የአፈር እርጥበት፡ በመጠኑ ደረቅ።`
        } else if (langKey === 'om') {
          replyText = `${plotName} (${c}): carraa hongee ${pct}% — ${level}. Jiidha biyyoof: Giddu galeessaan gogaa.`
        } else {
          replyText = `${plotName} (${c}): ${pct}% chance of drought — ${level}. Soil moisture currently moderately dry.`
        }
      }

      const aiTurn: Turn = {
        id: `turn-ai-${Date.now()}`,
        speaker: 'ai',
        text: replyText,
        timestamp: nowStr,
      }

      setTurns((prev) => [...prev, farmerTurn, aiTurn])

      if (!audioMuted && speech.canSpeak) {
        speech.speak(replyText)
      }
    },
    [callState, langKey, t, plotName, crop, droughtProbability, riskLevel, audioMuted, speech],
  )

  // Process Voice speech recognition
  const handleVoiceInput = useCallback(() => {
    if (!speech.canListen) return
    speech.listen((transcript) => {
      if (!transcript.trim()) return
      const matched = matchVoiceIntent(transcript)
      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

      const farmerTurn: Turn = {
        id: `turn-voice-${Date.now()}`,
        speaker: 'farmer',
        text: t('spokeQuestion', { text: transcript }),
        timestamp: nowStr,
      }

      const dict: Record<string, ResponseEntry> = HOTLINE_RESPONSES[langKey] ?? HOTLINE_RESPONSES.en ?? {}
      const item = dict[matched] ?? dict['1']
      const aiTurn: Turn = {
        id: `turn-ai-${Date.now()}`,
        speaker: 'ai',
        text: item?.reply ?? '',
        timestamp: nowStr,
      }

      setTurns((prev) => [...prev, farmerTurn, aiTurn])

      if (!audioMuted && speech.canSpeak && item?.reply) {
        speech.speak(item.reply)
      }
    })
  }, [speech, t, langKey, audioMuted])

  // Keypad click handler
  const handleKeypadPress = (digit: string) => {
    if (callState === 'connected') {
      sendIvrDigit(digit)
    } else if (callState === 'idle') {
      playDtmfTone(digit)
      setDialed((prev) => (prev.length < 12 ? prev + digit : prev))
    }
  }

  const handleBackspace = () => {
    setDialed((prev) => (prev.length > 0 ? prev.slice(0, -1) : ''))
  }

  // Quick topics for farmer taps
  const quickDigits = ['1', '2', '3', '4', '5', '6', '0'] as const
  const activeDict: Record<string, ResponseEntry> = HOTLINE_RESPONSES[langKey] ?? HOTLINE_RESPONSES.en ?? {}
  const quickTopics = quickDigits.map((d) => ({
    digit: d,
    label: `${d} · ${activeDict[d]?.topic ?? 'Advisory'}`,
  }))

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-surface-raised shadow-xl">
      {/* Phone Screen Header */}
      <div className="relative border-b border-border/80 bg-surface px-4 py-3 sm:px-5">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 font-medium text-fg-muted">
            <Radio className="size-3.5 text-primary animate-pulse" />
            <span>Ethio Telecom · HD Voice</span>
          </div>
          <Badge
            variant="outline"
            className={cn(
              'text-[10px] uppercase font-bold tracking-wider',
              callState === 'connected' && 'border-primary/50 bg-primary/10 text-primary',
              callState === 'calling' && 'border-amber-500/50 bg-amber-500/10 text-amber-500 animate-pulse',
              callState === 'idle' && 'border-border text-fg-muted',
              callState === 'ended' && 'border-border text-fg-subtle',
            )}
          >
            {callState === 'connected'
              ? `${t('callStatusConnected')} · ${formatDuration(duration)}`
              : callState === 'calling'
                ? t('callStatusCalling')
                : callState === 'ended'
                  ? t('callStatusEnded')
                  : t('callStatusIdle')}
          </Badge>
        </div>

        {/* Dynamic Voice Activity Bar Visualizer */}
        <div className="mt-2.5 flex items-center justify-between">
          <div>
            <h3 className="font-display text-base font-bold text-foreground">
              {t('aiHotline')}
            </h3>
            <p className="text-[11px] text-fg-muted">
              {callState === 'connected'
                ? '977 Interactive Agronomic Voice Assistant'
                : 'FDRE Ministry of Agriculture · Toll-Free 977'}
            </p>
          </div>

          {/* Sound equalizer bars */}
          <div className="flex items-end gap-1 h-5 px-2 py-0.5">
            {[1, 2, 3, 4, 5].map((bar) => {
              const isActive = callState === 'connected' && speech.speaking && !audioMuted
              return (
                <span
                  key={bar}
                  className={cn(
                    'w-1 rounded-full bg-primary/70 transition-all duration-150',
                    isActive
                      ? bar % 2 === 0
                        ? 'h-4 animate-bounce'
                        : 'h-5 animate-pulse'
                      : 'h-1.5 bg-border',
                  )}
                />
              )
            })}
          </div>
        </div>
      </div>

      {/* Main Interactive Phone Body */}
      <div className="flex flex-col p-4 sm:p-5">
        {/* State 1: IDLE / DIALER */}
        {callState === 'idle' && (
          <div className="flex flex-col items-center">
            {/* Number Display */}
            <div className="my-2 flex w-full items-center justify-between rounded-xl border border-border bg-surface px-4 py-2.5 shadow-inner">
              <span className="font-display text-3xl font-extrabold tracking-wider text-foreground sm:text-4xl">
                {dialed || <span className="text-fg-subtle">977</span>}
              </span>
              {dialed.length > 0 && (
                <button
                  type="button"
                  onClick={handleBackspace}
                  className="rounded-lg p-1.5 text-fg-muted hover:bg-surface-sunken hover:text-foreground"
                  aria-label={t('clearKeypad')}
                >
                  <Delete className="size-5" />
                </button>
              )}
            </div>

            <p className="text-center text-xs text-fg-muted mb-3">
              {t('simulateCallSubtitle')}
            </p>

            {/* Keypad */}
            <div className="grid w-full max-w-[280px] grid-cols-3 gap-2.5 my-2">
              {KEYPAD_BUTTONS.map((item) => (
                <button
                  key={item.digit}
                  type="button"
                  onClick={() => handleKeypadPress(item.digit)}
                  className="group flex flex-col items-center justify-center rounded-2xl border border-border bg-surface py-2.5 transition-all hover:border-primary/50 hover:bg-primary/5 active:scale-95"
                >
                  <span className="font-display text-xl font-bold text-foreground group-hover:text-primary">
                    {item.digit}
                  </span>
                  <span className="text-[9px] font-semibold tracking-wider text-fg-subtle uppercase">
                    {item.sub}
                  </span>
                </button>
              ))}
            </div>

            {/* Big Green Dial Button */}
            <div className="mt-4 flex w-full justify-center">
              <Button
                type="button"
                size="lg"
                onClick={handleStartCall}
                className="h-12 w-full max-w-[280px] gap-2 rounded-2xl bg-emerald-600 font-bold text-white shadow-md hover:bg-emerald-500 active:scale-95 cursor-pointer"
              >
                <PhoneCall className="size-5" />
                {t('startCall')}
              </Button>
            </div>
          </div>
        )}

        {/* State 2: CALLING (RINGING) */}
        {callState === 'calling' && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="relative mb-6 flex size-20 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
              <span className="absolute inset-0 size-20 animate-ping rounded-full bg-emerald-500/20" />
              <PhoneCall className="size-9 animate-bounce" />
            </div>
            <h4 className="font-display text-2xl font-bold text-foreground">
              977
            </h4>
            <p className="mt-1 text-sm font-medium text-emerald-500">
              {t('callStatusCalling')}
            </p>
            <p className="mt-2 text-xs text-fg-muted">
              AgriMinds AI Agronomic Advisory · FDRE Ministry of Agriculture
            </p>

            <div className="mt-8">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleEndCall}
                className="gap-2 rounded-xl border-destructive/40 text-destructive hover:bg-destructive/10"
              >
                <PhoneOff className="size-4" />
                {t('endCall')}
              </Button>
            </div>
          </div>
        )}

        {/* State 3: CONNECTED (LIVE IN-CALL CONVERSATION) */}
        {callState === 'connected' && (
          <div className="flex flex-col gap-3">
            {/* Live Conversation Stream */}
            <div
              id={transcriptId}
              role="log"
              aria-live="polite"
              aria-label="Hotline Conversation Transcript"
              className="flex max-h-56 min-h-[160px] flex-col gap-2.5 overflow-y-auto rounded-xl border border-border/80 bg-surface p-3"
            >
              {turns.map((turn) => {
                const isAi = turn.speaker === 'ai'
                return (
                  <div
                    key={turn.id}
                    className={cn(
                      'flex max-w-[88%] flex-col gap-1',
                      isAi ? 'self-start items-start' : 'self-end items-end',
                    )}
                  >
                    <div className="flex items-center gap-1.5 text-[10px] text-fg-subtle">
                      <span>{isAi ? t('aiHotline') : t('farmerYou')}</span>
                      <span>·</span>
                      <span>{turn.timestamp}</span>
                    </div>
                    <div
                      className={cn(
                        'rounded-2xl px-3 py-2 text-xs leading-relaxed shadow-xs',
                        isAi
                          ? 'border border-primary/20 bg-surface-raised text-foreground font-normal'
                          : 'bg-primary text-primary-fg font-medium',
                      )}
                    >
                      {turn.text}
                    </div>
                  </div>
                )
              })}
              <div ref={transcriptEndRef} />
            </div>

            {/* Quick Touch IVR Menu Chips */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-medium text-fg-muted">
                {t('quickMenuHint')}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {quickTopics.map((item) => (
                  <button
                    key={item.digit}
                    type="button"
                    onClick={() => sendIvrDigit(item.digit)}
                    className={cn(
                      'rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-semibold text-foreground transition-all hover:border-primary hover:bg-primary/10 active:scale-95',
                      activeDigit === item.digit && 'border-primary bg-primary/20 text-primary',
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Keypad Drawer during call */}
            {showKeypad && (
              <div className="rounded-xl border border-border/60 bg-surface/50 p-2.5">
                <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-6">
                  {KEYPAD_BUTTONS.map((item) => (
                    <button
                      key={item.digit}
                      type="button"
                      onClick={() => handleKeypadPress(item.digit)}
                      className={cn(
                        'flex flex-col items-center justify-center rounded-lg border border-border bg-surface py-1.5 transition-all hover:bg-primary/10 active:scale-95',
                        activeDigit === item.digit && 'border-primary bg-primary/25',
                      )}
                    >
                      <span className="font-display text-sm font-bold text-foreground">
                        {item.digit}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* In-Call Action Bar */}
            <div className="mt-1 flex items-center justify-between rounded-xl border border-border bg-surface px-3 py-2">
              <div className="flex items-center gap-1">
                {/* Audio Mute */}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => {
                    if (!audioMuted) speech.stop()
                    setAudioMuted((prev) => !prev)
                  }}
                  aria-label={audioMuted ? t('audioUnmuted') : t('audioMuted')}
                  className={cn(audioMuted && 'text-amber-500')}
                >
                  {audioMuted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
                </Button>

                {/* Voice Mic Input */}
                {speech.canListen && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={handleVoiceInput}
                    aria-label={t('speakToAi')}
                    className={cn(speech.listening && 'text-destructive animate-pulse')}
                  >
                    {speech.listening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
                  </Button>
                )}

                {/* Keypad Toggle */}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowKeypad((prev) => !prev)}
                  className="h-8 text-xs font-semibold px-2"
                >
                  {showKeypad ? t('hideKeypad') : t('keypadToggle')}
                </Button>
              </div>

              {/* Red Hangup Button */}
              <Button
                type="button"
                size="sm"
                onClick={handleEndCall}
                className="h-9 gap-1.5 rounded-xl bg-destructive px-3.5 font-bold text-destructive-fg hover:bg-destructive/90 cursor-pointer"
              >
                <PhoneOff className="size-4" />
                {t('endCall')}
              </Button>
            </div>
          </div>
        )}

        {/* State 4: CALL ENDED */}
        {callState === 'ended' && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <span className="mb-3 flex size-14 items-center justify-center rounded-2xl bg-surface-sunken text-fg-muted">
              <Phone className="size-6" />
            </span>
            <h4 className="font-display text-xl font-bold text-foreground">
              {t('callStatusEnded')}
            </h4>
            <p className="mt-1 text-xs text-fg-muted">
              {t('callDuration')}: {formatDuration(duration)} ·{' '}
              {t('turnsAnswered', { count: turns.filter((tr) => tr.speaker === 'farmer').length })}
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Button
                type="button"
                size="sm"
                onClick={handleStartCall}
                className="gap-2 rounded-xl bg-emerald-600 font-semibold text-white hover:bg-emerald-500 cursor-pointer"
              >
                <RotateCcw className="size-4" />
                {t('callAgain')}
              </Button>

              {onClose && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onClose}
                  className="rounded-xl"
                >
                  Close
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
