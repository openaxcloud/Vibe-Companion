/**
 * Canonical-component regression guard for Task #181.
 *
 * Each IDE surface — desktop IDE, mobile workspace, assistant page — must
 * mount the same canonical AI component (`ReplitAgentPanelV3`). If any
 * surface drifts onto a different implementation, AI chat can silently
 * break on that surface only. This test fails fast if that happens.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SURFACES = [
  { name: "Assistant page", path: "client/src/pages/AssistantPage.tsx" },
  { name: "Desktop IDE", path: "client/src/pages/UnifiedIDELayout.tsx" },
  { name: "Mobile workspace", path: "client/src/pages/MobileWorkspace.tsx" },
];

const CANONICAL_IMPORT_PATH = "@/components/ai/ReplitAgentPanelV3";
const CANONICAL_COMPONENT = "ReplitAgentPanelV3";

describe("AI chat canonical component (Task #181)", () => {
  for (const surface of SURFACES) {
    it(`${surface.name} imports and renders ${CANONICAL_COMPONENT}`, () => {
      const src = readFileSync(resolve(process.cwd(), surface.path), "utf8");
      expect(
        src.includes(CANONICAL_IMPORT_PATH),
        `${surface.path} must import from ${CANONICAL_IMPORT_PATH}`
      ).toBe(true);
      expect(
        new RegExp(`<${CANONICAL_COMPONENT}[\\s/>]`).test(src),
        `${surface.path} must render <${CANONICAL_COMPONENT} />`
      ).toBe(true);
    });
  }

  it("ReplitAgentPanelV3 delegates to the shared AIPanel implementation", () => {
    const src = readFileSync(
      resolve(process.cwd(), "client/src/components/ai/ReplitAgentPanelV3.tsx"),
      "utf8"
    );
    expect(src).toMatch(/from ['"]@\/components\/AIPanel['"]/);
    expect(src).toMatch(/<AIPanel\b/);
  });

  it("streaming endpoint stays at /api/agent/chat/stream", () => {
    const src = readFileSync(
      resolve(process.cwd(), "server/api/ai-streaming.ts"),
      "utf8"
    );
    expect(src).toMatch(/['"]\/agent\/chat\/stream['"]/);
  });
});
