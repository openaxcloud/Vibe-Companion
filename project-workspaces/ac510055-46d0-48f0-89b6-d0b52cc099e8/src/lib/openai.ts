
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true, // Only for development, for production use a backend proxy
});

export const getAIResponseStream = async (messages: any[]) => {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4", // Or "gpt-3.5-turbo"
      messages: messages,
      stream: true,
      temperature: 0.7,
      max_tokens: 1000,
    });
    return response;
  } catch (error) {
    console.error("Error getting AI response stream:", error);
    throw error;
  }
};
