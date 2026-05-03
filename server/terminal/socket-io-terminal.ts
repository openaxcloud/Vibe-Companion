/**
 * socket-io-terminal.ts — RETIRED
 *
 * This file previously provided a Socket.IO-based terminal transport.
 * It has been superseded by PTYTerminalService (pty-terminal-service.ts),
 * which operates over a plain WebSocket at /api/terminal/ws and is
 * registered via the central upgrade dispatcher.
 *
 * The legacy Socket.IO terminal endpoint (/socket.io/terminal) returned
 * HTTP 410 Gone as of the Shell Panel parity audit (2026-05-03).
 *
 * DO NOT USE: this module exports no functional code. It exists only to
 * preserve git history and as an explicit retirement marker.
 * Remove entirely in a follow-up cleanup task.
 */

export {};
