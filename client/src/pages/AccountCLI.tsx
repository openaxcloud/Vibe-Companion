import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { Terminal, ChevronRight, ArrowLeft } from "lucide-react";
import { useLocation, Link } from "wouter";

interface OutputLine {
  id: number;
  type: "command" | "result" | "error" | "info" | "separator";
  text: string;
}

const ROOT_COMMANDS = [
  { name: "account", description: "Manage your account settings" },
  { name: "trash", description: "View and restore deleted projects" },
  { name: "team", description: "Manage team membership" },
  { name: "clear", description: "Clear the terminal output" },
  { name: "help", description: "Show available commands" },
];

const SUB_COMMANDS: Record<string, { name: string; description: string }[]> = {
  account: [
    { name: "view-warns", description: "View account warnings/violations" },
    { name: "change-username", description: "Change your username (one-time)" },
    { name: "whoami", description: "Show current account info" },
  ],
  trash: [
    { name: "view", description: "List recently deleted projects (last 30 days)" },
    { name: "restore", description: "Restore a deleted project by title" },
  ],
  team: [
    { name: "view", description: "Show teams you belong to" },
    { name: "fork-project-to-team", description: "Fork a project into a team" },
  ],
};

export default function AccountCLI() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [input, setInput] = useState("");
  const [output, setOutput] = useState<OutputLine[]>([
    { id: 0, type: "info", text: "Welcome to E-Code CLI. Type 'help' for available commands." },
    { id: 1, type: "separator", text: "" },
  ]);
  const [commandPath, setCommandPath] = useState<string[]>([]);
  const [nextId, setNextId] = useState(2);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const addLines = useCallback((lines: OutputLine[]) => {
    setOutput(prev => [...prev, ...lines]);
    setNextId(prev => prev + lines.length);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [output]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const getPrompt = () => {
    if (commandPath.length === 0) return "~";
    return commandPath.join(" > ");
  };

  const handleCommand = async (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;

    const id = nextId;
    const promptPrefix = commandPath.length > 0 ? `${commandPath.join(" > ")} > ` : "";
    addLines([{ id, type: "command", text: `${promptPrefix}${trimmed}` }]);

    if (trimmed === "clear") {
      setOutput([]);
      setNextId(0);
      setCommandPath([]);
      return;
    }

    if (trimmed === "help") {
      const cmds = commandPath.length === 0 ? ROOT_COMMANDS : SUB_COMMANDS[commandPath[0]] || [];
      const lines: OutputLine[] = cmds.map((c, i) => ({
        id: id + 1 + i,
        type: "info" as const,
        text: `  ${c.name.padEnd(25)} ${c.description}`,
      }));
      addLines(lines);
      return;
    }

    if (trimmed === "back" || trimmed === "..") {
      setCommandPath(prev => prev.slice(0, -1));
      addLines([{ id: id + 1, type: "info", text: "← Back" }]);
      return;
    }

    if (commandPath.length === 0) {
      const rootCmd = ROOT_COMMANDS.find(c => c.name === trimmed);
      if (rootCmd && SUB_COMMANDS[trimmed]) {
        setCommandPath([trimmed]);
        const subs = SUB_COMMANDS[trimmed];
        addLines([
          { id: id + 1, type: "info", text: `${trimmed} — available sub-commands:` },
          ...subs.map((s, i) => ({ id: id + 2 + i, type: "info" as const, text: `  ${s.name.padEnd(25)} ${s.description}` })),
          { id: id + 2 + subs.length, type: "info", text: "Type a sub-command or 'back' to return." },
        ]);
        return;
      }
      addLines([{ id: id + 1, type: "error", text: `Unknown command: ${trimmed}. Type 'help' for available commands.` }]);
      return;
    }

    const fullCmd = `${commandPath[0]} ${trimmed}`;
    await executeCommand(fullCmd, id);
  };

  const executeCommand = async (fullCmd: string, id: number) => {
    const parts = fullCmd.split(/\s+/);
    const [root, sub, ...args] = parts;

    try {
      if (root === "account") {
        if (sub === "view-warns") {
          const res = await apiRequest("GET", "/api/account/warnings");
          const warnings = await res.json();
          if (warnings.length === 0) {
            addLines([{ id: id + 1, type: "result", text: "✓ No warnings on your account." }]);
          } else {
            addLines([
              { id: id + 1, type: "info", text: `Found ${warnings.length} warning(s):` },
              ...warnings.map((w: any, i: number) => ({
                id: id + 2 + i,
                type: "result" as const,
                text: `  [${w.severity.toUpperCase()}] ${w.reason} — ${new Date(w.issuedAt).toLocaleDateString()}`,
              })),
            ]);
          }
        } else if (sub === "change-username") {
          const newUsername = args.join(" ").trim();
          if (!newUsername) {
            addLines([{ id: id + 1, type: "error", text: "Usage: change-username <new-username>" }]);
            return;
          }
          const res = await apiRequest("PUT", "/api/user/username", { username: newUsername });
          if (res.ok) {
            const data = await res.json();
            addLines([{ id: id + 1, type: "result", text: `✓ Username changed to: ${data.username}` }]);
          } else {
            const err = await res.json();
            addLines([{ id: id + 1, type: "error", text: `✗ ${err.message}` }]);
          }
        } else if (sub === "whoami") {
          addLines([
            { id: id + 1, type: "result", text: `  Email: ${user?.email}` },
            { id: id + 2, type: "result", text: `  Display Name: ${user?.displayName || "Not set"}` },
            { id: id + 3, type: "result", text: `  Username: ${(user as any)?.username || "Not set"}` },
          ]);
        } else {
          addLines([{ id: id + 1, type: "error", text: `Unknown account command: ${sub}` }]);
        }
      } else if (root === "trash") {
        if (sub === "view") {
          const res = await apiRequest("GET", "/api/trash");
          const deleted = await res.json();
          if (deleted.length === 0) {
            addLines([{ id: id + 1, type: "result", text: "Trash is empty." }]);
          } else {
            addLines([
              { id: id + 1, type: "info", text: `${deleted.length} deleted project(s):` },
              ...deleted.map((p: any, i: number) => ({
                id: id + 2 + i,
                type: "result" as const,
                text: `  ${p.name.padEnd(30)} deleted ${new Date(p.deletedAt).toLocaleDateString()}  [${p.id.slice(0, 8)}]`,
              })),
            ]);
          }
        } else if (sub === "restore") {
          const title = args.join(" ").trim();
          if (!title) {
            addLines([{ id: id + 1, type: "error", text: "Usage: restore <project-title>" }]);
            return;
          }
          const res = await apiRequest("POST", "/api/trash/restore-by-title", { title });
          if (res.ok) {
            const restored = await res.json();
            addLines([{ id: id + 1, type: "result", text: `✓ Restored: ${restored.name}` }]);
          } else {
            const err = await res.json();
            addLines([{ id: id + 1, type: "error", text: `✗ ${err.message}` }]);
          }
        } else {
          addLines([{ id: id + 1, type: "error", text: `Unknown trash command: ${sub}` }]);
        }
      } else if (root === "team") {
        if (sub === "view") {
          const res = await apiRequest("GET", "/api/teams");
          const teams = await res.json();
          if (teams.length === 0) {
            addLines([{ id: id + 1, type: "result", text: "You are not a member of any teams." }]);
          } else {
            addLines([
              { id: id + 1, type: "info", text: `${teams.length} team(s):` },
              ...teams.map((t: any, i: number) => ({
                id: id + 2 + i,
                type: "result" as const,
                text: `  ${t.name.padEnd(25)} role: ${t.role}  plan: ${t.plan || "free"}`,
              })),
            ]);
          }
        } else if (sub === "fork-project-to-team") {
          const projectId = args[0]?.trim();
          const teamId = args[1]?.trim();
          if (!projectId || !teamId) {
            addLines([{ id: id + 1, type: "error", text: "Usage: fork-project-to-team <project-id> <team-id>" }]);
            return;
          }
          const res = await apiRequest("POST", `/api/projects/${projectId}/fork`, { teamId });
          if (res.ok) {
            const forked = await res.json();
            addLines([{ id: id + 1, type: "result", text: `✓ Forked to team project: ${forked.name} (${forked.id.slice(0, 8)})` }]);
          } else {
            const err = await res.json();
            addLines([{ id: id + 1, type: "error", text: `✗ ${err.message}` }]);
          }
        } else {
          addLines([{ id: id + 1, type: "error", text: `Unknown team command: ${sub}` }]);
        }
      }
    } catch (err: any) {
      addLines([{ id: id + 1, type: "error", text: `Error: ${err.message || "Command failed"}` }]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCommand(input);
      setInput("");
    }
  };

  return (
    <div className="h-screen flex flex-col bg-[#0E1525] text-[#E0E0E0]" data-testid="page-cli">
      <div className="flex items-center gap-3 px-4 py-3 bg-[#1A1F2E] border-b border-[#2B3245]">
        <Link href="/dashboard">
          <button className="w-8 h-8 rounded-lg flex items-center justify-center text-[#9DA2B0] hover:text-white hover:bg-[#2B3245] transition-colors" data-testid="button-back-cli">
            <ArrowLeft className="w-4 h-4" />
          </button>
        </Link>
        <Terminal className="w-4 h-4 text-[#0079F2]" />
        <h1 className="text-sm font-semibold text-white" data-testid="text-cli-title">E-Code CLI</h1>
        <div className="ml-auto flex items-center gap-1 text-[9px] text-[#6B7280]">
          <span className="bg-[#2B3245] px-2 py-0.5 rounded">v1.0</span>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 font-mono text-[13px] leading-relaxed"
        onClick={() => inputRef.current?.focus()}
        data-testid="cli-output"
      >
        {output.map((line) => (
          <div key={line.id} className={`
            ${line.type === "command" ? "text-[#0079F2]" : ""}
            ${line.type === "result" ? "text-[#0CCE6B]" : ""}
            ${line.type === "error" ? "text-[#F44747]" : ""}
            ${line.type === "info" ? "text-[#9DA2B0]" : ""}
            ${line.type === "separator" ? "h-2" : ""}
          `}>
            {line.type === "command" ? (
              <span><span className="text-[#7C65CB]">❯</span> {line.text}</span>
            ) : (
              <span className="whitespace-pre-wrap">{line.text}</span>
            )}
          </div>
        ))}

        <div className="flex items-center gap-2 mt-1">
          <span className="text-[#7C65CB] shrink-0">❯</span>
          {commandPath.length > 0 && (
            <span className="text-[#0079F2] shrink-0 flex items-center gap-1 text-xs">
              {commandPath.map((p, i) => (
                <span key={i} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight className="w-3 h-3 text-[#4B5563]" />}
                  {p}
                </span>
              ))}
              <ChevronRight className="w-3 h-3 text-[#4B5563]" />
            </span>
          )}
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent outline-none text-white caret-[#0079F2]"
            placeholder={commandPath.length > 0 ? "sub-command..." : "command..."}
            autoFocus
            spellCheck={false}
            data-testid="input-cli"
          />
        </div>
      </div>

      <div className="flex items-center gap-4 px-4 py-2 bg-[#1A1F2E] border-t border-[#2B3245] text-[9px] text-[#6B7280]">
        <span>Type 'help' for commands</span>
        <span>•</span>
        <span>Type 'back' to go up</span>
        <span>•</span>
        <span>Type 'clear' to reset</span>
      </div>
    </div>
  );
}
