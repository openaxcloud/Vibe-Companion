import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY, // Ensure this is set in your .env file
  dangerouslyAllowBrowser: true, // Only for client-side testing, not recommended for production
});

export async function sendMessageToOpenAI(messages: any[]) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4-1106-preview', // Using a powerful GPT-4 model
    messages: messages,
    temperature: 0.7,
    max_tokens: 1500,
  });
  return response.choices[0].message.content;
}

export async function* streamGeminiResponse(messages: any[]) {
  // In a real application, you'd integrate with a streaming API here.
  // For demonstration, we'll simulate a streaming response.
  const fullResponse = await sendMessageToOpenAI(messages);
  if (fullResponse) {
    const chunks = fullResponse.split(' ');
    for (const chunk of chunks) {
      yield chunk + ' ';
      await new Promise(resolve => setTimeout(resolve, 50)); // Simulate delay
    }
  }
}