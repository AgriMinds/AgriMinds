import { NextResponse } from 'next/server'

/**
 * Returns active Hugging Face AI models used for Amharic and Afaan Oromoo:
 * - TTS: facebook/mms-tts-amh, facebook/mms-tts-orm
 * - ASR: facebook/mms-1b-all, openai/whisper-large-v3
 * - Language Model: castorini/afriberta_large, meta-llama/Llama-3.2-3B-Instruct
 */
export async function GET() {
  const token =
    process.env.HUGGINGFACE_API_TOKEN ||
    process.env.HF_TOKEN ||
    process.env.AGRIMINDS_HUGGINGFACE_API_TOKEN

  return NextResponse.json({
    provider: 'Hugging Face Hub',
    configured: Boolean(token),
    models: {
      tts: {
        am: {
          id: 'facebook/mms-tts-amh',
          name: 'Meta MMS Amharic TTS (VITS)',
          url: 'https://huggingface.co/facebook/mms-tts-amh',
          language: 'Amharic (አማርኛ)',
        },
        om: {
          id: 'facebook/mms-tts-orm',
          name: 'Meta MMS Oromo TTS (VITS)',
          url: 'https://huggingface.co/facebook/mms-tts-orm',
          language: 'Afaan Oromoo',
        },
        en: {
          id: 'facebook/mms-tts-eng',
          name: 'Meta MMS English TTS (VITS)',
          url: 'https://huggingface.co/facebook/mms-tts-eng',
          language: 'English',
        },
      },
      asr: {
        am: {
          id: 'facebook/mms-1b-all',
          adapter: 'amh',
          name: 'Meta MMS-1B Multilingual ASR (Amharic)',
          url: 'https://huggingface.co/facebook/mms-1b-all',
        },
        om: {
          id: 'facebook/mms-1b-all',
          adapter: 'orm',
          name: 'Meta MMS-1B Multilingual ASR (Oromo)',
          url: 'https://huggingface.co/facebook/mms-1b-all',
        },
      },
      language_model: {
        am: {
          id: 'castorini/afriberta_large',
          name: 'AfriBERTa Large (African Languages)',
          url: 'https://huggingface.co/castorini/afriberta_large',
        },
        om: {
          id: 'meta-llama/Llama-3.2-3B-Instruct',
          name: 'Llama 3.2 Multilingual Instruct',
          url: 'https://huggingface.co/meta-llama/Llama-3.2-3B-Instruct',
        },
      },
    },
  })
}
