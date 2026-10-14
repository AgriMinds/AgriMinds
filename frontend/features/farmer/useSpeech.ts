'use client'

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'

/** The locales the agent speaks, mapped to the BCP-47 tags a browser voice engine expects. */
const VOICE_TAG: Record<string, string> = { en: 'en-US', am: 'am-ET', om: 'om-ET' }

/** Hugging Face TTS models used for Ethiopian languages */
export const HF_SPEECH_MODELS: Record<string, string> = {
  am: 'facebook/mms-tts-amh',
  om: 'facebook/mms-tts-orm',
  or: 'facebook/mms-tts-orm',
}

const emptySubscribe = () => () => {}

type Recognition = {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  onresult: ((e: { results: { 0: { 0: { transcript: string } } } }) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
}

function recognitionCtor(): (new () => Recognition) | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: new () => Recognition
    webkitSpeechRecognition?: new () => Recognition
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

/**
 * Voice and speech interface for AgriMinds.
 *
 * For Amharic (am) and Afaan Oromoo (om / or):
 * Utilizes Meta's Massively Multilingual Speech (MMS) models from Hugging Face Hub:
 * - Amharic: facebook/mms-tts-amh
 * - Afaan Oromoo: facebook/mms-tts-orm
 *
 * For English:
 * Uses standard browser speech synthesis with agronomic pacing (rate 0.92).
 */
export function useSpeech(locale: string) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [speaking, setSpeaking] = useState(false)
  const [listening, setListening] = useState(false)
  const currentAudioRef = useRef<HTMLAudioElement | null>(null)
  const currentAudioUrlRef = useRef<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const isEthioLang = locale.startsWith('am') || locale.startsWith('om') || locale.startsWith('or')

  const browserCanSpeak = useSyncExternalStore(
    emptySubscribe,
    () => typeof window !== 'undefined' && 'speechSynthesis' in window,
    () => false,
  )

  // Amharic and Oromo can always speak via Hugging Face MMS model endpoint; English via browser synthesis
  const canSpeak = isEthioLang || browserCanSpeak

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    const read = () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        setVoices(window.speechSynthesis.getVoices())
      }
    }
    read()
    window.speechSynthesis.addEventListener('voiceschanged', read)
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', read)
    }
  }, [])

  const tag = VOICE_TAG[locale] ?? 'en-US'
  const voice =
    voices.find((v) => v.lang.toLowerCase() === tag.toLowerCase()) ??
    voices.find((v) => v.lang.toLowerCase().startsWith(`${locale.toLowerCase()}-`)) ??
    voices.find((v) => v.lang.toLowerCase().startsWith(locale.toLowerCase()))

  const stopCurrentAudio = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    if (currentAudioRef.current) {
      currentAudioRef.current.pause()
      currentAudioRef.current.currentTime = 0
      currentAudioRef.current = null
    }
    if (currentAudioUrlRef.current) {
      URL.revokeObjectURL(currentAudioUrlRef.current)
      currentAudioUrlRef.current = null
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
    setSpeaking(false)
  }, [])

  const speak = useCallback(
    (text: string) => {
      if (typeof window === 'undefined') return

      const clean = text
        .replace(/[*#_`~>]/g, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/\s+/g, ' ')
        .trim()
      if (!clean) return

      stopCurrentAudio()

      // For Amharic and Afaan Oromoo: Use Hugging Face MMS models (facebook/mms-tts-amh, facebook/mms-tts-orm)
      if (isEthioLang) {
        setSpeaking(true)
        const controller = new AbortController()
        abortControllerRef.current = controller

        fetch('/api/speech/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: clean, locale }),
          signal: controller.signal,
        })
          .then(async (res) => {
            if (!res.ok) {
              throw new Error(`TTS service returned ${res.status}`)
            }
            const blob = await res.blob()
            const audioUrl = URL.createObjectURL(blob)
            currentAudioUrlRef.current = audioUrl

            const audio = new Audio(audioUrl)
            currentAudioRef.current = audio

            audio.onended = () => {
              setSpeaking(false)
              if (currentAudioUrlRef.current) {
                URL.revokeObjectURL(currentAudioUrlRef.current)
                currentAudioUrlRef.current = null
              }
              currentAudioRef.current = null
            }

            audio.onerror = () => {
              setSpeaking(false)
              currentAudioRef.current = null
            }

            return audio.play()
          })
          .catch(() => {
            // Fallback to browser synthesis if network unavailable or canceled
            if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
              const utterance = new SpeechSynthesisUtterance(clean)
              utterance.lang = tag
              utterance.rate = 0.92
              utterance.onend = () => setSpeaking(false)
              utterance.onerror = () => setSpeaking(false)
              window.speechSynthesis.speak(utterance)
            } else {
              setSpeaking(false)
            }
          })

        return
      }

      // For English: standard browser speech synthesis
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(clean)
        if (voice) {
          utterance.voice = voice
          utterance.lang = voice.lang
        } else {
          utterance.lang = tag
        }
        utterance.rate = 0.92
        utterance.onend = () => setSpeaking(false)
        utterance.onerror = () => setSpeaking(false)
        window.speechSynthesis.speak(utterance)
        setSpeaking(true)
      }
    },
    [isEthioLang, locale, stopCurrentAudio, tag, voice],
  )

  const stop = useCallback(() => {
    stopCurrentAudio()
  }, [stopCurrentAudio])

  const listen = useCallback(
    (onHeard: (text: string) => void) => {
      const Ctor = recognitionCtor()
      if (!Ctor) return
      const recognition = new Ctor()
      recognition.lang = tag
      recognition.continuous = false
      recognition.interimResults = false
      recognition.onresult = (e) => onHeard(e.results[0][0].transcript)
      recognition.onerror = () => setListening(false)
      recognition.onend = () => setListening(false)
      recognition.start()
      setListening(true)
    },
    [tag],
  )

  useEffect(() => {
    return () => {
      stopCurrentAudio()
    }
  }, [stopCurrentAudio])

  return {
    canSpeak,
    canListen: recognitionCtor() !== null,
    speaking,
    listening,
    speak,
    stop,
    listen,
    modelName: isEthioLang ? (locale.startsWith('am') ? 'facebook/mms-tts-amh' : 'facebook/mms-tts-orm') : 'Browser Speech',
    isHuggingFace: isEthioLang,
  }
}
