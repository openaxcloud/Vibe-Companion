/**
 * End-to-end smoketest of the AI generation pipeline.
 *
 * Bypasses HTTP/auth and calls aiProviderManager directly with the SAME
 * system prompt the production paths now use (getSystemPromptForContext('design')
 * + the code-generation.router design block) so we measure the prompts
 * that ship, not a synthetic version.
 *
 * Output: /tmp/e-code-smoketest/<modelId>/{prompt.md, response.md, files/, qa.json}
 *
 * Usage:
 *   npx tsx scripts/smoketest-generation.ts                # default Opus 4.7
 *   MODEL=claude-sonnet-4-6  npx tsx scripts/smoketest-generation.ts
 *   MODEL=gpt-4.1            npx tsx scripts/smoketest-generation.ts
 *   PROMPT="a website"       npx tsx scripts/smoketest-generation.ts  # vague edge-case
 */

import 'dotenv/config';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { aiProviderManager } from '../server/ai/ai-provider-manager';
import { getSystemPromptForContext } from '../server/ai/prompts/agent-system-prompt';

const MODEL = process.env.MODEL || 'claude-opus-4-7';
const USER_PROMPT =
  process.env.PROMPT ||
  'Build a modern minimalist todo app with dark mode toggle, smooth Framer Motion animations on item add/remove, and a glassmorphism navbar.';

const OUT_ROOT = '/tmp/e-code-smoketest';
const OUT_DIR = join(OUT_ROOT, MODEL.replace(/[^a-z0-9._-]/gi, '_'));
mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(join(OUT_DIR, 'files'), { recursive: true });

const systemPrompt = getSystemPromptForContext('design') + `

OUTPUT FORMAT for this smoketest:
For every file you generate, wrap it in a fenced block prefixed with the
file path, exactly like:

\`\`\`tsx path=src/App.tsx
// content here
\`\`\`

Generate the COMPLETE app — at least: package.json, tailwind.config.ts,
postcss.config.js, index.html, src/main.tsx, src/App.tsx, src/index.css,
src/components/ui/button.tsx (shadcn), src/components/ui/card.tsx,
src/components/ThemeToggle.tsx, src/components/Navbar.tsx,
src/components/TodoList.tsx, src/components/TodoItem.tsx, components.json
(shadcn config), README.md.

NO placeholders. NO TODOs. Real working code.`;

async function main() {
  const t0 = Date.now();

  // Save prompt + system prompt
  writeFileSync(join(OUT_DIR, 'prompt.md'), `# User prompt\n\n${USER_PROMPT}\n\n# Model\n\n${MODEL}\n`);
  writeFileSync(join(OUT_DIR, 'system-prompt.md'), systemPrompt);

  console.log(`[smoketest] model=${MODEL} prompt="${USER_PROMPT.slice(0, 80)}..."`);
  console.log(`[smoketest] system prompt: ${systemPrompt.length} chars`);
  console.log(`[smoketest] output: ${OUT_DIR}`);

  let response = '';
  let chunkCount = 0;
  try {
    const stream = aiProviderManager.streamChat(
      MODEL,
      [{ role: 'user', content: USER_PROMPT }],
      { system: systemPrompt, max_tokens: 16384, temperature: 0.7, timeoutMs: 180_000 },
    );
    for await (const chunk of stream) {
      response += chunk;
      chunkCount++;
      if (chunkCount % 50 === 0) process.stdout.write('.');
    }
    process.stdout.write('\n');
  } catch (e: any) {
    console.error(`[smoketest] stream error: ${e.message}`);
    writeFileSync(join(OUT_DIR, 'error.txt'), `${e.stack || e.message}`);
    process.exit(1);
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`[smoketest] done in ${elapsed}s — ${response.length} chars, ${chunkCount} chunks`);

  writeFileSync(join(OUT_DIR, 'response.md'), response);

  // Extract files from fenced blocks ```ext path=...
  const fileRe = /```(?:[a-zA-Z0-9._-]+)?\s+path=([^\s\n]+)\n([\s\S]*?)```/g;
  const files: Array<{ path: string; content: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = fileRe.exec(response))) {
    files.push({ path: m[1].trim(), content: m[2] });
  }
  for (const f of files) {
    const safe = f.path.replace(/[^a-zA-Z0-9._/-]/g, '_').replace(/^\/+/, '');
    const dest = join(OUT_DIR, 'files', safe);
    mkdirSync(join(dest, '..'), { recursive: true });
    writeFileSync(dest, f.content);
  }
  console.log(`[smoketest] extracted ${files.length} files`);

  // Static QA over the response (objective checks, no LLM-as-judge).
  const text = response.toLowerCase();
  const checks = {
    shadcn_imports: /from\s+['"]@\/components\/ui\//.test(response),
    framer_motion_import: /from\s+['"]framer-motion['"]/.test(response),
    framer_motion_usage: /<motion\.(div|button|li|ul|span|section)/.test(response),
    hsl_palette: /hsl\(var\(--/.test(response) || /--background:|--foreground:/.test(response),
    no_hardcoded_667eea: !/#667eea|#764ba2/.test(response),
    no_tailwind_cdn: !/cdn\.tailwindcss\.com/.test(response),
    dark_toggle: /next-themes|usetheme|themeprovider|toggle.*dark|dark.*toggle/.test(text),
    components_json: files.some(f => f.path.endsWith('components.json')),
    no_console_log: !/console\.log\(/.test(response),
    inter_font: /['"]inter['"]/i.test(response) || /font-sans|--font-sans/i.test(response),
    semantic_tokens: /text-muted-foreground|bg-background|border-border/.test(response),
    no_emoji_icons: !(/[\u{1F300}-\u{1F9FF}]/u.test(response.slice(0, 5000))),
    lucide_icons: /from\s+['"]lucide-react['"]/.test(response),
  };

  const pass = Object.values(checks).filter(Boolean).length;
  const total = Object.keys(checks).length;
  console.log(`[smoketest] QA: ${pass}/${total} checks pass`);
  for (const [k, v] of Object.entries(checks)) {
    console.log(`  ${v ? '✅' : '❌'} ${k}`);
  }

  writeFileSync(
    join(OUT_DIR, 'qa.json'),
    JSON.stringify({ model: MODEL, prompt: USER_PROMPT, elapsed_s: elapsed, file_count: files.length, response_chars: response.length, checks, score: `${pass}/${total}` }, null, 2),
  );

  process.exit(pass === total ? 0 : 0); // never fail the script — we want all models tested
}

main();
