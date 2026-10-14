import { NextResponse, type NextRequest } from 'next/server'

/**
 * Hugging Face Text-to-Speech (TTS) models for Ethiopian languages:
 * - Amharic (አማርኛ): facebook/mms-tts-amh (Meta Massively Multilingual Speech)
 * - Afaan Oromoo: facebook/mms-tts-orm (Meta Massively Multilingual Speech)
 * - English: facebook/mms-tts-eng
 */
export const HF_TTS_MODELS = {
  am: 'facebook/mms-tts-amh',
  om: 'facebook/mms-tts-orm',
  or: 'facebook/mms-tts-orm',
  en: 'facebook/mms-tts-eng',
} as const

// In-memory LRU-like audio cache to minimize Hugging Face API calls and reduce latency
const AUDIO_CACHE = new Map<string, { buffer: ArrayBuffer; contentType: string }>()
const MAX_CACHE_ENTRIES = 120

function getCacheKey(locale: string, text: string): string {
  return `${locale}:${text.trim().toLowerCase()}`
}

function resolveModel(locale: string): string {
  const norm = locale.toLowerCase()
  if (norm.startsWith('am')) return HF_TTS_MODELS.am
  if (norm.startsWith('om') || norm.startsWith('or')) return HF_TTS_MODELS.om
  return HF_TTS_MODELS.en
}

async function synthesizeHuggingFace(text: string, model: string): Promise<Response> {
  const token =
    process.env.HUGGINGFACE_API_TOKEN ||
    process.env.HF_TOKEN ||
    process.env.AGRIMINDS_HUGGINGFACE_API_TOKEN

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  // Primary: router.huggingface.co
  const routerUrl = `https://router.huggingface.co/hf-inference/models/${model}`
  const legacyUrl = `https://api-inference.huggingface.co/models/${model}`

  try {
    const res = await fetch(routerUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ inputs: text }),
      signal: AbortSignal.timeout(12000),
    })

    if (res.ok) return res

    // If router returned 404 or 401 and legacy is available, attempt fallback
    if (res.status === 404) {
      return await fetch(legacyUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ inputs: text }),
        signal: AbortSignal.timeout(12000),
      })
    }

    return res
  } catch {
    // If router fetch failed, try legacy
    return await fetch(legacyUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ inputs: text }),
      signal: AbortSignal.timeout(12000),
    })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { text?: string; locale?: string }
    const text = body.text?.trim()
    const locale = body.locale || 'am'

    if (!text) {
      return NextResponse.json({ error: 'Text parameter is required' }, { status: 400 })
    }

    const model = resolveModel(locale)
    const cacheKey = getCacheKey(locale, text)

    // Check cache first
    const cached = AUDIO_CACHE.get(cacheKey)
    if (cached) {
      return new NextResponse(cached.buffer, {
        status: 200,
        headers: {
          'Content-Type': cached.contentType,
          'X-HuggingFace-Model': model,
          'X-Cache': 'HIT',
          'Cache-Control': 'public, max-age=86400, s-maxage=86400',
        },
      })
    }

    // Call Hugging Face
    const hfRes = await synthesizeHuggingFace(text, model)

    if (!hfRes.ok) {
      const errText = await hfRes.text().catch(() => '')
      return NextResponse.json(
        {
          error: 'Hugging Face TTS synthesis unavailable',
          details: errText,
          model,
          fallback: true,
        },
        { status: hfRes.status >= 500 ? 502 : hfRes.status },
      )
    }

    const contentType = hfRes.headers.get('content-type') || 'audio/wav'
    const audioBuffer = await hfRes.arrayBuffer()

    // Store in cache
    if (AUDIO_CACHE.size >= MAX_CACHE_ENTRIES) {
      const oldestKey = AUDIO_CACHE.keys().next().value
      if (oldestKey) AUDIO_CACHE.delete(oldestKey)
    }
    AUDIO_CACHE.set(cacheKey, { buffer: audioBuffer, contentType })

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'X-HuggingFace-Model': model,
        'X-Cache': 'MISS',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      },
    })
  } catch (err) {
    return NextResponse.json(
      {
        error: 'Failed to synthesize speech',
        message: (err as Error).message,
        fallback: true,
      },
      { status: 500 },
    )
  }
}

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams
  const text = searchParams.get('text')?.trim()
  const locale = searchParams.get('locale') || 'am'

  if (!text) {
    return NextResponse.json({ error: 'Text query parameter is required' }, { status: 400 })
  }

  const model = resolveModel(locale)
  const cacheKey = getCacheKey(locale, text)

  const cached = AUDIO_CACHE.get(cacheKey)
  if (cached) {
    return new NextResponse(cached.buffer, {
      status: 200,
      headers: {
        'Content-Type': cached.contentType,
        'X-HuggingFace-Model': model,
        'X-Cache': 'HIT',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      },
    })
  }

  try {
    const hfRes = await synthesizeHuggingFace(text, model)
    if (!hfRes.ok) {
      const errText = await hfRes.text().catch(() => '')
      return NextResponse.json(
        {
          error: 'Hugging Face TTS synthesis unavailable',
          details: errText,
          model,
          fallback: true,
        },
        { status: hfRes.status >= 500 ? 502 : hfRes.status },
      )
    }

    const contentType = hfRes.headers.get('content-type') || 'audio/wav'
    const audioBuffer = await hfRes.arrayBuffer()

    if (AUDIO_CACHE.size >= MAX_CACHE_ENTRIES) {
      const oldestKey = AUDIO_CACHE.keys().next().value
      if (oldestKey) AUDIO_CACHE.delete(oldestKey)
    }
    AUDIO_CACHE.set(cacheKey, { buffer: audioBuffer, contentType })

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'X-HuggingFace-Model': model,
        'X-Cache': 'MISS',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      },
    })
  } catch (err) {
    return NextResponse.json(
      {
        error: 'Failed to synthesize speech',
        message: (err as Error).message,
        fallback: true,
      },
      { status: 500 },
    )
  }
}
