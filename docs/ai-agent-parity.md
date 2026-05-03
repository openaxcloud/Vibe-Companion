# AI Agent — Replit Parity Report

**Date:** 2026-05-03
**Scope:** Cross-IDE surface audit against Replit documented agent concepts.

---

## Canonical components & surfaces

| IDE Surface | Component rendered | Backend endpoint |
|---|---|---|
| Web IDE (`IDEPage` → `UnifiedIDELayout`) | `ReplitAgentPanelV3` → `AIPanel` | `/api/agent/chat/stream` |
| Mobile workspace (`MobileWorkspace`) | `ReplitAgentPanelV3` → `AIPanel` | `/api/agent/chat/stream` |
| Assistant page (`AssistantPage`) | `ReplitAgentPanelV3` → `AIPanel` | `/api/agent/chat/stream` |
| Agent Studio (`AIAgentStudio`) | Standalone preview generator | `/api/ai/generate-preview`, `/api/ai/apply-preview/:id` |
| AI Agent marketing page (`AIAgent`) | Static marketing page | — (no chat) |
| Desktop download page (`Desktop`) | Static download page | — (no chat) |

All three IDE chat surfaces now mount the same canonical `ReplitAgentPanelV3` component backed by the same streaming pipeline. `AIAgentStudio` is a distinct "preview generator" tool (not a chat surface) and intentionally keeps its own endpoints.

---

## Retired legacy components (removed 2026-05-03)

| Component file | Status | Reason |
|---|---|---|
| `client/src/components/AIAssistant.tsx` | **Deleted** | Only used in `AssistantPage`; replaced by `ReplitAgentPanelV3`. Talked to legacy `/api/ai/:projectId/chat` endpoint. |
| `client/src/components/AgentV2Interface.tsx` | **Deleted** | Unused in production routing. |
| `client/src/components/AdvancedAIPanel.tsx` | **Deleted** | Unused in production routing. |
| `client/src/components/MobileChatInterface.tsx` | **Deleted** | Unused in production routing. |
| `client/src/components/UnifiedAIInterface.tsx` | **Deleted** | Not mounted on any route. |

---

## Endpoint matrix — canonical agent panel controls

Every interactive control in `AIPanel` is traced below.

| UI action | Component handler | API route | Router file | Storage / effect |
|---|---|---|---|---|
| Send message (chat/agent mode) | `handleSubmit` | `POST /api/agent/chat/stream` (SSE) | `server/api/ai-streaming.ts` | Conversation + messages persisted via `aiConversations` / `agentMessages` tables |
| Send message (lite mode) | `handleSubmit` | `POST /api/ai/lite` (SSE) | `server/api/ai-streaming.ts` | Same SSE pipeline, lighter context |
| Send message (plan mode) | `handleSubmit` | `POST /api/ai/plan` (SSE) | `server/api/ai-streaming.ts` | `aiConversations.agentMode = 'plan'` |
| Stop stream | `handleStop` / AbortController | Client-side close → server AbortController abort | `server/api/ai-streaming.ts` | SSE connection closed, no DB write |
| Queue message (while busy) | `addToQueue` | `POST /api/ai/queue/:projectId` | `server/routes/ai.router.ts` | Persisted to `messageQueue` table |
| Remove queued message | `removeFromQueue` | `DELETE /api/ai/queue/:projectId/:id` | `server/routes/ai.router.ts` | Deleted from `messageQueue` |
| Reorder queue | `reorderQueue` | `POST /api/ai/queue/:projectId/reorder` | `server/routes/ai.router.ts` | Updated order in `messageQueue` |
| Clear all queued | `clearQueue` | `DELETE /api/ai/queue/:projectId` | `server/routes/ai.router.ts` | All rows deleted for project |
| Switch conversation mode (plan↔build) | `switchMode` | `POST /api/agent/conversation/:id/mode` | `server/routes/agent.router.ts` | `aiConversations.agentMode` updated |
| Load conversation | `loadConversation` | `GET /api/ai/conversations/:projectId/load/:convId` | `server/routes/ai.router.ts` | Reads `agentMessages` for conversation |
| History list | `fetchHistory` | `GET /api/ai/conversations/:projectId/history` | `server/routes/ai.router.ts` | Reads `aiConversations` for project |
| Approve plan (→ build) | `approvePlan` | `POST /api/agent/build/execute` | `server/routes/agent-build.router.ts` | Kicks off build executor; one active build per project |
| Build progress stream | — | `GET /api/agent/build/:id/stream` (SSE) | `server/routes/agent-build.router.ts` | Real-time task completion events |
| Cancel build | `cancelBuild` | `POST /api/agent/build/:id/cancel` | `server/routes/agent-build.router.ts` | Marks build cancelled in DB |
| Checkpoint list | `fetchCheckpoints` | `GET /api/projects/:id/checkpoints` | `server/routes/checkpoints.router.ts` | Reads `checkpoints` table |
| Rollback to checkpoint | `rollbackCheckpoint` | `POST /api/projects/:id/checkpoints/:cpId/restore` | `server/routes/checkpoints.router.ts` | Restores file contents from snapshot |
| Auto-checkpoint (pre-edit) | Tool executor hook | Internal in `server/agent/tool-executor.ts` | — | Creates checkpoint before file mutations |
| Attach file | `addFiles` | `POST /api/agent/attachments` | `server/routes/agent.router.ts` | Stored as base64 blob; injected as context |
| Web search toggle | `agentToolsConfig.webSearch` | Passed as `capabilities.webSearch` in stream body | `server/api/ai-streaming.ts` | Provider performs real web search (Tavily/Perplexity) when enabled |
| Image generation | `generateImage` | `POST /api/ai/agent` with image tool | `server/api/ai-streaming.ts` | DALL-E / Stable Diffusion via existing image service |
| App testing | `agentToolsConfig.appTesting` | `POST /api/agent/testing/run` | `server/routes/agent-testing.router.ts` | Runs test suite; results streamed back |
| Skills list | `fetchSkills` | `GET /api/skills` | `server/routes/legacy-skills.ts` | Reads `skills` table |
| Model picker | `onModelChange` | Passed as `model` in stream body | `server/api/ai-streaming.ts` | Selected model used for next turn |
| Autonomy slider | `onModeChange` (economy/power/turbo) | Passed as provider preference to stream | `server/api/ai-streaming.ts` | Controls context depth and loop limits |
| Voice input | `onVoice` | `POST /api/voice/transcribe` | `server/routes/voice-transcribe.router.ts` | Returns transcript; set as input |
| TTS output | internal | `POST /api/ai/tts` | `server/api/ai-streaming.ts` | Returns audio data URI |
| `replit.md` injection | `ProjectContextProvider` | Read from `projects/:id/files` on every turn | `server/agent/project-context.ts` | Injected into system prompt |
| MCP tool calls | `McpToolCallTimeline` | Proxied through agent turn | `server/agent/tool-executor.ts` | Results surface in `mcpToolCalls` SSE events |

---

## Replit Agent concept coverage

| Concept | Implementation file | Test | Notes |
|---|---|---|---|
| Chat (streaming SSE) | `server/api/ai-streaming.ts` | — | Fully wired; all IDE surfaces use same endpoint |
| Message queue | `server/routes/ai.router.ts` (queue endpoints) | — | Persisted in DB; drain logic in `AIPanel` |
| Checkpoints / rollback | `server/routes/checkpoints.router.ts`, `server/checkpointService.ts` | — | Auto-checkpoint fires pre-edit via tool executor |
| Plan mode | `server/routes/agent-plan.router.ts` | — | Real LLM plan generation; approval → build transition |
| Build mode | `server/routes/agent-build.router.ts` | — | Executor runs approved plan with real tool calls |
| Tool calls (file ops) | `server/agent/tool-executor.ts` | — | Reads/writes real project files |
| Tool calls (shell) | `server/agent/tool-executor.ts` | — | Executes shell commands in project context |
| Tool calls (packages) | `server/agent/tool-executor.ts` | — | Installs packages via package manager |
| Tool calls (workflows) | `server/agent/tool-executor.ts` | — | Triggers workflow engine |
| Tool calls (database) | `server/agent/tool-executor.ts` | — | Runs SQL via provisioned DB |
| Tool calls (git) | `server/agent/tool-executor.ts` | — | Git operations on project repo |
| Web search | `server/api/ai-streaming.ts` (capabilities.webSearch) | — | Wired to search provider when toggled on |
| Image generation | `server/api/ai-streaming.ts` (image tool) | — | Via existing image service |
| App testing | `server/routes/agent-testing.router.ts` | — | Runs test suite; results returned |
| `replit.md` injection | `server/agent/project-context.ts` | — | Loaded each turn into system prompt |
| Skills | `server/routes/legacy-skills.ts` | — | Listed from DB; skill context injected |
| Automations | `server/routes/automations.router.ts` | — | Trigger endpoints wired |
| Code optimizations | `server/routes/ai-optimization.router.ts` | — | Optimization actions available |
| MCP tools | `server/mcp/` | — | MCP server tool calls proxied through agent |
| Voice transcription | `server/routes/voice-transcribe.router.ts` | — | Whisper-backed; result feeds chat input |
| Mobile parity | `MobileWorkspace` → `ReplitAgentPanelV3` | — | Same component; SSE reconnect on network change |

---

## Explicit non-goals

- Adding new LLM providers beyond the existing catalog.
- Redesigning the visual look of agent panels.
- Changes to billing/usage metering (existing meters fire from unified pipeline).
- Automated E2E Playwright tests (covered by separate task in project backlog).

---

## Production hardening (2026-05-03)

- **Per-user concurrency cap**: Enforced via the shared `enforceStreamConcurrency(req, res)` helper in `server/utils/stream-concurrency.ts`, backed by a single process-scoped counter so all streaming routers share the same per-user budget. Returns HTTP 429 when exceeded. Coverage:
  - `POST /api/agent/chat/stream` (`server/api/ai-streaming.ts`) — guarded; release wired into the SSE connection-close cleanup so the slot is freed on success, error, and client disconnect. `/agent/chat/stop` and `/agent/models` in the same file are non-streaming and intentionally unguarded. The internal `streamOpenAI` / `streamAnthropic` / `streamGemini` / `streamXAI` / `streamMoonshot` provider helpers are invoked only from `/agent/chat/stream`, so they inherit its guard.
  - `POST /api/conversations/:id/messages` (`server/replit_integrations/audio/routes.ts`) — TTS / voice streaming endpoint, now guarded with the same helper; release runs on stream completion, error, and client disconnect.
  - The helper is exported from `server/utils/stream-concurrency.ts` so any future streaming route (image generation, dedicated provider passthroughs, etc.) can adopt the cap with two lines and inherit identical 429 semantics.
  - Cap is configurable via the `AI_MAX_CONCURRENT_STREAMS` environment variable (default `3`). Non-numeric or non-positive values fall back to the default to prevent a misconfiguration from disabling the cap.
- **Structured observability**: Every completed turn logs `request_id`, `user_id`, `project_id`, `model`, `provider`, `tokens_input`, `tokens_output`, `latency_ms`, `tool_count`, `stream_end_reason` to the Winston logger.
- **Secrets**: All provider API keys loaded exclusively from environment variables (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, etc.) via the environment-secrets pipeline — never hardcoded.
