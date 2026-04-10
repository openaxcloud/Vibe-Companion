// @ts-nocheck
import { Router, Request, Response } from 'express';
import multer from 'multer';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ensureAuthenticated } from '../middleware/auth';
import { tierRateLimiters } from '../middleware/tier-rate-limiter';
import { createLogger } from '../utils/logger';
import { toFile } from 'openai';

const logger = createLogger('voice-transcribe');
const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/wav', 'audio/mpeg', 'audio/mp3', 'audio/x-m4a'];
    if (allowed.includes(file.mimetype) || file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'));
    }
  }
});

/**
 * Transcribe audio using OpenAI Whisper (primary — best accuracy for code)
 */
async function transcribeWithOpenAI(
  buffer: Buffer,
  mimetype: string,
  language?: string,
  prompt?: string
): Promise<{ text: string; language: string | null }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

  const openai = new OpenAI({ apiKey });
  const ext = mimetype.includes('ogg') ? 'ogg'
    : mimetype.includes('mp4') || mimetype.includes('m4a') ? 'mp4'
    : mimetype.includes('wav') ? 'wav'
    : 'webm';

  const audioFile = await toFile(buffer, `recording.${ext}`, { type: mimetype });
  const transcription = await openai.audio.transcriptions.create({
    file: audioFile,
    model: 'whisper-1',
    language: language || undefined,
    prompt: prompt || 'Code, programming, software development',
  });

  return { text: transcription.text, language: transcription.language ?? null };
}

/**
 * Transcribe audio using Gemini 2.0 Flash (fallback — supports inline audio via multimodal API)
 * Note: Anthropic and xAI do NOT support audio transcription APIs.
 */
async function transcribeWithGemini(
  buffer: Buffer,
  mimetype: string
): Promise<{ text: string; language: null }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const result = await model.generateContent([
    {
      inlineData: {
        data: buffer.toString('base64'),
        mimeType: mimetype as any
      }
    },
    'Transcribe this audio accurately. Output ONLY the transcription text with no preamble, labels, or explanation. Preserve programming terminology, variable names, and technical terms exactly as spoken.'
  ]);

  const text = result.response.text().trim();
  return { text, language: null };
}

router.post(
  '/transcribe',
  ensureAuthenticated,
  tierRateLimiters.api,
  upload.single('audio'),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No audio file provided' });
      }

      const hasOpenAI = !!process.env.OPENAI_API_KEY;
      const hasGemini = !!process.env.GEMINI_API_KEY;

      if (!hasOpenAI && !hasGemini) {
        return res.status(503).json({
          error: 'Voice transcription unavailable. No AI provider configured (requires OPENAI_API_KEY or GEMINI_API_KEY).'
        });
      }

      let result: { text: string; language: string | null };
      let provider = 'openai';

      if (hasOpenAI) {
        try {
          result = await transcribeWithOpenAI(
            req.file.buffer,
            req.file.mimetype,
            req.body.language,
            req.body.prompt
          );
          provider = 'openai-whisper';
        } catch (openaiErr: any) {
          logger.warn('OpenAI Whisper failed, falling back to Gemini', { error: openaiErr.message });

          if (!hasGemini) {
            if (openaiErr.status === 429) {
              return res.status(429).json({ error: 'Rate limit exceeded. Please wait a moment.' });
            }
            throw openaiErr;
          }

          result = await transcribeWithGemini(req.file.buffer, req.file.mimetype);
          provider = 'gemini-2.0-flash';
        }
      } else {
        result = await transcribeWithGemini(req.file.buffer, req.file.mimetype);
        provider = 'gemini-2.0-flash';
      }

      logger.info('Voice transcription completed', {
        userId: (req.user as any)?.id,
        sizeBytes: req.file.size,
        chars: result.text.length,
        provider
      });

      res.json({
        transcript: result.text,
        language: result.language,
        provider
      });
    } catch (error: any) {
      logger.error('Voice transcription failed', { error: error.message });

      if (error.status === 400) {
        return res.status(400).json({ error: 'Invalid audio file. Please try again.' });
      }
      if (error.status === 429) {
        return res.status(429).json({ error: 'Rate limit exceeded. Please wait a moment.' });
      }

      res.status(500).json({ error: 'Transcription failed. Please try again.' });
    }
  }
);

/**
 * POST /api/voice/tts — Text-to-Speech via OpenAI tts-1
 * Returns an MP3 audio stream of the given text.
 * Falls back to a 503 so the client can use the browser's speechSynthesis API.
 */
router.post(
  '/tts',
  ensureAuthenticated,
  tierRateLimiters.api,
  async (req: Request, res: Response) => {
    const { text, voice = 'alloy', speed = 1.0 } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'text is required' });
    }

    const trimmed = text.slice(0, 4096);

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: 'TTS not available — OPENAI_API_KEY not configured' });
    }

    try {
      const openai = new OpenAI({ apiKey });
      const mp3 = await openai.audio.speech.create({
        model: 'tts-1',
        voice: voice as any,
        input: trimmed,
        speed: Math.min(4.0, Math.max(0.25, Number(speed) || 1.0)),
        response_format: 'mp3',
      });

      const buffer = Buffer.from(await mp3.arrayBuffer());

      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Length', buffer.length);
      res.setHeader('Cache-Control', 'no-store');
      res.send(buffer);

      logger.info('TTS generated', {
        userId: (req.user as any)?.id,
        chars: trimmed.length,
        voice,
      });
    } catch (error: any) {
      logger.error('TTS failed', { error: error.message });
      res.status(500).json({ error: 'TTS generation failed' });
    }
  }
);

export default router;
