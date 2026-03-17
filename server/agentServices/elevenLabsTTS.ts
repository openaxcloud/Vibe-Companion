export interface TTSVoice {
  id: string;
  name: string;
  description: string;
}

export const AVAILABLE_VOICES: TTSVoice[] = [
  { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel", description: "Calm, warm female voice" },
  { id: "29vD33N1CtxCmqQRPOHJ", name: "Drew", description: "Well-rounded male voice" },
  { id: "2EiwWnXFnvU5JabPnv8n", name: "Clyde", description: "Deep, authoritative male voice" },
  { id: "AZnzlk1XvdvUeBnXmlld", name: "Domi", description: "Strong, confident female voice" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Bella", description: "Soft, friendly female voice" },
  { id: "ErXwobaYiN019PkySvjV", name: "Antoni", description: "Crisp, professional male voice" },
  { id: "MF3mGyEYCl7XYWbV9V6O", name: "Elli", description: "Young, expressive female voice" },
  { id: "TxGEqnHWrfWFTfGW9XjX", name: "Josh", description: "Deep, engaging male voice" },
  { id: "VR6AewLTigWG4xSOukaG", name: "Arnold", description: "Strong, bold male voice" },
  { id: "pNInz6obpgDQGcFmaJgB", name: "Adam", description: "Clear, versatile male voice" },
  { id: "yoZ06aMxZJJ28mfd3POQ", name: "Sam", description: "Raspy, authentic male voice" },
];

export interface TTSResult {
  audioBase64: string;
  mimeType: string;
  voice: string;
  voiceName: string;
  durationEstimate: number;
  textLength: number;
}

export const TTS_CREDIT_COST = 2;

export async function generateSpeech(
  text: string,
  voiceId?: string,
  modelId: string = "eleven_multilingual_v2"
): Promise<TTSResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error("ElevenLabs TTS is not configured. The ELEVENLABS_API_KEY environment variable is required.");
  }

  const selectedVoice = AVAILABLE_VOICES.find((v) => v.id === voiceId) || AVAILABLE_VOICES[0];

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${selectedVoice.id}`,
    {
      method: "POST",
      headers: {
        Accept: "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text: text.slice(0, 5000),
        model_id: modelId,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
      signal: AbortSignal.timeout(30000),
    }
  );

  if (!response.ok) {
    throw new Error(`ElevenLabs API returned status ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const audioBase64 = Buffer.from(arrayBuffer).toString("base64");
  const durationEstimate = Math.ceil(text.split(/\s+/).length / 2.5);

  return {
    audioBase64,
    mimeType: "audio/mpeg",
    voice: selectedVoice.id,
    voiceName: selectedVoice.name,
    durationEstimate,
    textLength: text.length,
  };
}
