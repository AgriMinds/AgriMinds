import { describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, POST, HF_TTS_MODELS } from './route'

describe('/api/speech/tts route', () => {
  it('defines correct Hugging Face MMS models for Amharic and Oromo', () => {
    expect(HF_TTS_MODELS.am).toBe('facebook/mms-tts-amh')
    expect(HF_TTS_MODELS.om).toBe('facebook/mms-tts-orm')
    expect(HF_TTS_MODELS.or).toBe('facebook/mms-tts-orm')
    expect(HF_TTS_MODELS.en).toBe('facebook/mms-tts-eng')
  })

  it('rejects POST request with missing text parameter', async () => {
    const req = new NextRequest('http://localhost:3000/api/speech/tts', {
      method: 'POST',
      body: JSON.stringify({ locale: 'am' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/Text parameter is required/i)
  })

  it('rejects GET request with missing text parameter', async () => {
    const req = new NextRequest('http://localhost:3000/api/speech/tts?locale=am')
    const res = await GET(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/Text query parameter is required/i)
  })

  it('handles Hugging Face synthesis and returns audio with model header', async () => {
    // Mock global fetch
    const mockAudioData = new Uint8Array([82, 73, 70, 70]).buffer
    const originalFetch = global.fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'audio/wav' }),
      arrayBuffer: () => Promise.resolve(mockAudioData),
    })

    try {
      const req = new NextRequest('http://localhost:3000/api/speech/tts', {
        method: 'POST',
        body: JSON.stringify({ text: 'ሰላም አርሶ አደር', locale: 'am' }),
        headers: { 'Content-Type': 'application/json' },
      })
      const res = await POST(req)
      expect(res.status).toBe(200)
      expect(res.headers.get('Content-Type')).toBe('audio/wav')
      expect(res.headers.get('X-HuggingFace-Model')).toBe('facebook/mms-tts-amh')

      const buf = await res.arrayBuffer()
      expect(buf.byteLength).toBe(4)
    } finally {
      global.fetch = originalFetch
    }
  })

  it('routes Afaan Oromoo synthesis to facebook/mms-tts-orm', async () => {
    const mockAudioData = new Uint8Array([82, 73, 70, 70]).buffer
    const originalFetch = global.fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'audio/wav' }),
      arrayBuffer: () => Promise.resolve(mockAudioData),
    })

    try {
      const req = new NextRequest('http://localhost:3000/api/speech/tts?text=Akkam&locale=om')
      const res = await GET(req)
      expect(res.status).toBe(200)
      expect(res.headers.get('X-HuggingFace-Model')).toBe('facebook/mms-tts-orm')
    } finally {
      global.fetch = originalFetch
    }
  })
})
