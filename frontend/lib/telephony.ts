/**
 * Dual-Tone Multi-Frequency (DTMF) and telephony audio simulation for 977 Agronomic Hotline.
 * Uses standard Web Audio API with soft, calibrated volumes.
 */

export const DTMF_FREQUENCIES: Record<string, [number, number]> = {
  '1': [697, 1209],
  '2': [697, 1336],
  '3': [697, 1477],
  '4': [770, 1209],
  '5': [770, 1336],
  '6': [770, 1477],
  '7': [852, 1209],
  '8': [852, 1336],
  '9': [852, 1477],
  '*': [941, 1209],
  '0': [941, 1336],
  '#': [941, 1477],
}

/**
 * Play a standard telephone DTMF tone safely using Web Audio API.
 */
export function playDtmfTone(digit: string, durationMs = 120): void {
  if (typeof window === 'undefined') return
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const freqs = DTMF_FREQUENCIES[digit]
    if (!freqs) return

    const [f1, f2] = freqs
    const osc1 = ctx.createOscillator()
    const osc2 = ctx.createOscillator()
    const gain = ctx.createGain()

    // Soft, calibrated volume (0.05)
    gain.gain.setValueAtTime(0.05, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000)

    osc1.frequency.value = f1
    osc2.frequency.value = f2

    osc1.connect(gain)
    osc2.connect(gain)
    gain.connect(ctx.destination)

    osc1.start()
    osc2.start()

    setTimeout(() => {
      try {
        osc1.stop()
        osc2.stop()
        void ctx.close()
      } catch {}
    }, durationMs + 20)
  } catch {}
}

/**
 * Play a simulated telephone ringback tone (440Hz + 480Hz).
 * Returns a cancel function.
 */
export function playRingbackTone(): () => void {
  if (typeof window === 'undefined') return () => {}
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return () => {}
    const ctx = new AudioCtx()

    const osc1 = ctx.createOscillator()
    const osc2 = ctx.createOscillator()
    const gain = ctx.createGain()

    osc1.frequency.value = 440
    osc2.frequency.value = 480
    gain.gain.setValueAtTime(0.035, ctx.currentTime)

    osc1.connect(gain)
    osc2.connect(gain)
    gain.connect(ctx.destination)

    osc1.start()
    osc2.start()

    const stop = () => {
      try {
        osc1.stop()
        osc2.stop()
        void ctx.close()
      } catch {}
    }

    setTimeout(stop, 850)
    return stop
  } catch {
    return () => {}
  }
}
