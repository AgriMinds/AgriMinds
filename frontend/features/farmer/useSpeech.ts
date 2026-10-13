'use client'

import { useCallback, useEffect, useState } from 'react'

/** The locales the agent speaks, mapped to the BCP-47 tags a browser voice engine expects. */
const VOICE_TAG: Record<string, string> = { en: 'en-US', am: 'am-ET', om: 'om-ET' }

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
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

/**
 * Speaking and listening with whatever the browser actually has.
 *
 * Both halves are checked against the *farmer's* language rather than assumed, because the thing
 * that matters here is Amharic and Afaan Oromoo support, and most engines have neither. Reading an
 * Amharic sentence aloud with an English voice produces noise, so when no matching voice exists
 * this reports `canSpeak: false` and the UI hides the button instead of offering something that
 * would be worse than silence.
 */
export function useSpeech(locale: string) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [speaking, setSpeaking] = useState(false)
  const [listening, setListening] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    const read = () => setVoices(window.speechSynthesis.getVoices())
    read()
    // Voices load asynchronously in Chrome, so the first read is often empty.
    window.speechSynthesis.addEventListener('voiceschanged', read)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', read)
  }, [])

  const tag = VOICE_TAG[locale] ?? 'en-US'
  const voice = voices.find((v) => v.lang === tag) ?? voices.find((v) => v.lang.startsWith(`${locale}-`))

  const speak = useCallback(
    (text: string) => {
      if (!voice) return
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.voice = voice
      utterance.lang = voice.lang
      // Slower than default: this is advice somebody may be writing down.
      utterance.rate = 0.95
      utterance.onend = () => setSpeaking(false)
      utterance.onerror = () => setSpeaking(false)
      window.speechSynthesis.cancel()
      window.speechSynthesis.speak(utterance)
      setSpeaking(true)
    },
    [voice],
  )

  const stop = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
    setSpeaking(false)
  }, [])

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

  return {
    canSpeak: Boolean(voice),
    canListen: recognitionCtor() !== null,
    speaking,
    listening,
    speak,
    stop,
    listen,
  }
}
