import { NextResponse, type NextRequest } from 'next/server'

/**
 * Hugging Face Speech-to-Text (ASR) for Amharic and Afaan Oromoo:
 * Models:
 * - facebook/mms-1b-all (Meta MMS 1-billion parameter multilingual ASR with amh/orm adapters)
 * - openai/whisper-large-v3
 */
export const HF_ASR_MODELS = {
  mms: 'facebook/mms-1b-all',
  whisper: 'openai/whisper-large-v3',
}

export async function POST(req: NextRequest) {
  try {
    const locale = req.headers.get('x-locale') || 'am'
    const token =
      process.env.HUGGINGFACE_API_TOKEN ||
      process.env.HF_TOKEN ||
      process.env.AGRIMINDS_HUGGINGFACE_API_TOKEN

    const audioBytes = await req.arrayBuffer()
    if (!audioBytes || audioBytes.byteLength === 0) {
      return NextResponse.json({ error: 'No audio data provided' }, { status: 400 })
    }

    const model = HF_ASR_MODELS.mms
    const targetLang = locale.startsWith('am') ? 'amh' : locale.startsWith('o') ? 'orm' : 'eng'

    const headers: Record<string, string> = {
      'Content-Type': req.headers.get('content-type') || 'audio/wav',
    }
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }

    const hfRes = await fetch(`https://router.huggingface.co/hf-inference/models/${model}`, {
      method: 'POST',
      headers,
      body: audioBytes,
      signal: AbortSignal.timeout(15000),
    })

    if (!hfRes.ok) {
      // Fallback to whisper
      const whisperRes = await fetch(
        `https://router.huggingface.co/hf-inference/models/${HF_ASR_MODELS.whisper}`,
        {
          method: 'POST',
          headers,
          body: audioBytes,
          signal: AbortSignal.timeout(15000),
        },
      )
      if (whisperRes.ok) {
        const data = (await whisperRes.json()) as { text?: string }
        return NextResponse.json({
          text: data.text || '',
          model: HF_ASR_MODELS.whisper,
          language: targetLang,
        })
      }

      return NextResponse.json(
        {
          error: 'Hugging Face ASR service unavailable',
          model,
          fallback: true,
        },
        { status: 502 },
      )
    }

    const data = (await hfRes.json()) as { text?: string }
    return NextResponse.json({
      text: data.text || '',
      model,
      language: targetLang,
    })
  } catch (err) {
    return NextResponse.json(
      {
        error: 'Failed to transcribe speech',
        message: (err as Error).message,
        fallback: true,
      },
      { status: 500 },
    )
  }
}
