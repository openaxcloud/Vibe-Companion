/**
 * Marketing Demo Helper: Simulates AI streaming responses
 * 
 * NOTE: This is for DEMO PURPOSES ONLY on the landing page.
 * Real AI Agent uses Server-Sent Events (SSE) - see ReplitAgentPanelV3.
 * 
 * @param content - Full response text to simulate streaming
 * @param onUpdate - Callback invoked with incremental chunks
 * @param delayMs - Delay between words (default 75ms for natural feel)
 */
export async function simulateStreaming(
  content: string, 
  onUpdate: (chunk: string) => void,
  delayMs: number = 75
): Promise<void> {
  const words = content.split(' ');
  let currentContent = '';
  
  for (let i = 0; i < words.length; i++) {
    currentContent += (i > 0 ? ' ' : '') + words[i];
    onUpdate(currentContent);
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
}
