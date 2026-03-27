import type { Diagnostic } from "@codemirror/lint";
import type { Completion } from "@codemirror/autocomplete";

export type LSPLanguage = "typescript" | "javascript" | "python" | "go";

interface LSPPosition {
  line: number;
  character: number;
}

interface LSPRange {
  start: LSPPosition;
  end: LSPPosition;
}

interface LSPLocation {
  uri: string;
  range: LSPRange;
}

interface LSPDiagnostic {
  range: LSPRange;
  severity?: number;
  code?: string | number;
  source?: string;
  message: string;
  relatedInformation?: any[];
}

interface LSPTextEdit {
  range: LSPRange;
  newText: string;
}

interface LSPCompletionItem {
  label: string;
  kind?: number;
  detail?: string;
  documentation?: string | { kind: string; value: string };
  insertText?: string;
  insertTextFormat?: number;
  textEdit?: LSPTextEdit & { range: LSPRange };
  additionalTextEdits?: LSPTextEdit[];
  sortText?: string;
  filterText?: string;
}

interface LSPHoverResult {
  contents: string | { kind: string; value: string } | Array<string | { kind: string; value: string }>;
  range?: LSPRange;
}

interface LSPSignatureHelp {
  signatures: Array<{
    label: string;
    documentation?: string | { kind: string; value: string };
    parameters?: Array<{
      label: string | [number, number];
      documentation?: string | { kind: string; value: string };
    }>;
  }>;
  activeSignature?: number;
  activeParameter?: number;
}

interface PendingRequest {
  resolve: (result: any) => void;
  reject: (error: any) => void;
  method: string;
  timestamp: number;
}

type DiagnosticsCallback = (uri: string, diagnostics: LSPDiagnostic[]) => void;
type StatusCallback = (status: Record<LSPLanguage, boolean>) => void;
type ConnectionCallback = (connected: boolean) => void;

const COMPLETION_KIND_MAP: Record<number, string> = {
  1: "text",
  2: "method",
  3: "function",
  4: "function",
  5: "variable",
  6: "variable",
  7: "class",
  8: "interface",
  9: "namespace",
  10: "property",
  11: "constant",
  12: "enum",
  13: "keyword",
  14: "text",
  15: "text",
  16: "constant",
  17: "type",
  18: "type",
  19: "type",
  20: "variable",
  21: "constant",
  22: "class",
  23: "type",
  24: "keyword",
  25: "text",
};

export class LSPClient {
  private ws: WebSocket | null = null;
  private projectId: string;
  private language: LSPLanguage;
  private rootUri: string;
  private nextId = 1;
  private pendingRequests = new Map<number | string, PendingRequest>();
  private diagnosticsCallbacks = new Set<DiagnosticsCallback>();
  private statusCallbacks = new Set<StatusCallback>();
  private connectionCallbacks = new Set<ConnectionCallback>();
  private readyCallbacks = new Set<() => void>();
  private connected = false;
  private serverRunning = false;
  private initialized = false;
  private supportsIncrementalSync = false;
  private openDocuments = new Map<string, number>();
  private documentContents = new Map<string, string>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private requestTimeout = 10000;
  private documentVersions = new Map<string, number>();

  constructor(projectId: string, language: LSPLanguage, rootUri: string = "") {
    this.projectId = projectId;
    this.language = language;
    this.rootUri = rootUri || `file:///home/runner/workspace`;
  }

  connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${window.location.host}/ws/lsp?projectId=${this.projectId}`;

    try {
      this.ws = new WebSocket(url);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.connected = true;
      this.notifyConnection(true);
      this.startServer();
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleMessage(data);
      } catch {}
    };

    this.ws.onclose = () => {
      this.connected = false;
      this.serverRunning = false;
      this.initialized = false;
      this.notifyConnection(false);
      this.rejectAllPending("Connection closed");
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      this.connected = false;
      this.notifyConnection(false);
    };
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.rejectAllPending("Client disconnecting");

    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      if (this.ws.readyState === WebSocket.OPEN) {
        this.send({ type: "lsp:stop", language: this.language });
        this.ws.close();
      }
      this.ws = null;
    }

    this.connected = false;
    this.serverRunning = false;
    this.initialized = false;
    this.openDocuments.clear();
    this.documentVersions.clear();
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 3000);
  }

  private send(data: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  private startServer(): void {
    this.send({
      type: "lsp:start",
      language: this.language,
      rootPath: this.rootUri.replace("file://", ""),
    });
  }

  private handleMessage(data: any): void {
    switch (data.type) {
      case "lsp:connected":
        break;

      case "lsp:serverStarted":
        if (data.language === this.language && data.success) {
          this.serverRunning = true;
          if (data.alreadyInitialized) {
            this.initialized = true;
            if (data.capabilities) {
              const sync = data.capabilities.textDocumentSync;
              if (typeof sync === "number") {
                this.supportsIncrementalSync = sync === 2;
              } else if (sync && typeof sync === "object") {
                this.supportsIncrementalSync = sync.change === 2;
              } else {
                this.supportsIncrementalSync = false;
              }
            }
            this.reopenDocuments();
            for (const cb of this.readyCallbacks) cb();
          } else {
            this.initializeServer();
          }
        }
        if (data.status) this.notifyStatus(data.status);
        break;

      case "lsp:serverStopped":
        if (data.language === this.language) {
          this.serverRunning = false;
          this.initialized = false;
          this.supportsIncrementalSync = false;
        }
        if (data.status) this.notifyStatus(data.status);
        break;

      case "lsp:serverCrashed":
        if (data.language === this.language) {
          this.serverRunning = false;
          this.initialized = false;
          this.supportsIncrementalSync = false;
          if (data.restarting) {
            console.log(`[LSP] Server crashed for ${this.language}, restarting...`);
            setTimeout(() => {
              if (this.ws?.readyState === WebSocket.OPEN) {
                this.startServer();
              }
            }, 3000);
          }
        }
        if (data.status) this.notifyStatus(data.status);
        break;

      case "lsp:message":
        if (data.language === this.language) {
          this.handleLSPMessage(data.message);
        }
        break;

      case "lsp:status":
        if (data.status) this.notifyStatus(data.status);
        break;
    }
  }

  private handleLSPMessage(msg: any): void {
    if (msg.id !== undefined && !msg.method) {
      const pending = this.pendingRequests.get(msg.id);
      if (pending) {
        this.pendingRequests.delete(msg.id);
        if (msg.error) {
          pending.reject(msg.error);
        } else {
          pending.resolve(msg.result);
        }
      }

      if (msg.id === "__init__") {
        if (msg.error) {
          console.error("[LSP] Initialize failed:", msg.error);
          this.initialized = false;
          return;
        }
        this.initialized = true;
        const caps = msg.result?.capabilities;
        if (caps) {
          const sync = caps.textDocumentSync;
          if (typeof sync === "number") {
            this.supportsIncrementalSync = sync === 2;
          } else if (sync && typeof sync === "object") {
            this.supportsIncrementalSync = sync.change === 2;
          }
        }
        this.sendNotification("initialized", {});
        this.reopenDocuments();
        for (const cb of this.readyCallbacks) cb();
      }
      return;
    }

    if (msg.method) {
      this.handleServerNotification(msg);
    }
  }

  private handleServerNotification(msg: any): void {
    switch (msg.method) {
      case "textDocument/publishDiagnostics":
        if (msg.params) {
          for (const cb of this.diagnosticsCallbacks) {
            cb(msg.params.uri, msg.params.diagnostics || []);
          }
        }
        break;

      case "window/logMessage":
      case "window/showMessage":
        break;
    }

    if (msg.id !== undefined) {
      this.send({
        type: "lsp:notification",
        language: this.language,
        message: {
          jsonrpc: "2.0",
          id: msg.id,
          result: null,
        },
      });
    }
  }

  private initializeServer(): void {
    const initParams = {
      processId: null,
      clientInfo: { name: "ecode-editor", version: "1.0.0" },
      rootUri: this.rootUri,
      rootPath: this.rootUri.replace("file://", ""),
      capabilities: {
        textDocument: {
          synchronization: {
            dynamicRegistration: false,
            willSave: false,
            willSaveWaitUntil: false,
            didSave: true,
          },
          completion: {
            dynamicRegistration: false,
            completionItem: {
              snippetSupport: true,
              commitCharactersSupport: true,
              documentationFormat: ["markdown", "plaintext"],
              deprecatedSupport: true,
              preselectSupport: true,
              resolveSupport: { properties: ["documentation", "detail"] },
            },
            contextSupport: true,
          },
          hover: {
            dynamicRegistration: false,
            contentFormat: ["markdown", "plaintext"],
          },
          signatureHelp: {
            dynamicRegistration: false,
            signatureInformation: {
              documentationFormat: ["markdown", "plaintext"],
              parameterInformation: { labelOffsetSupport: true },
            },
          },
          definition: { dynamicRegistration: false },
          references: { dynamicRegistration: false },
          rename: {
            dynamicRegistration: false,
            prepareSupport: true,
          },
          publishDiagnostics: {
            relatedInformation: true,
            tagSupport: { valueSet: [1, 2] },
          },
          codeAction: {
            dynamicRegistration: false,
          },
        },
        workspace: {
          workspaceFolders: true,
          didChangeConfiguration: { dynamicRegistration: false },
        },
      },
      workspaceFolders: [
        { uri: this.rootUri, name: this.projectId },
      ],
    };

    this.send({
      type: "lsp:request",
      language: this.language,
      message: {
        jsonrpc: "2.0",
        id: "__init__",
        method: "initialize",
        params: initParams,
      },
    });
  }

  private reopenDocuments(): void {
    for (const [uri, version] of this.openDocuments) {
      const content = this.getDocumentContent(uri);
      if (content !== null) {
        this.sendNotification("textDocument/didOpen", {
          textDocument: {
            uri,
            languageId: this.getLanguageId(uri),
            version,
            text: content,
          },
        });
      }
    }
  }

  private getDocumentContent(uri: string): string | null {
    return this.documentContents.get(uri) ?? null;
  }

  private getLanguageId(uri: string): string {
    const ext = uri.split(".").pop()?.toLowerCase() || "";
    switch (ext) {
      case "ts": case "tsx": return "typescript";
      case "js": case "jsx": case "mjs": case "cjs": return "javascript";
      case "py": return "python";
      case "go": return "go";
      case "json": return "json";
      case "html": return "html";
      case "css": return "css";
      case "md": return "markdown";
      default: return "plaintext";
    }
  }

  private async sendRequest(method: string, params: any): Promise<any> {
    if (!this.serverRunning || !this.initialized) {
      throw new Error(`LSP server not ready (running=${this.serverRunning}, initialized=${this.initialized})`);
    }

    const id = this.nextId++;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`LSP request timeout: ${method}`));
      }, this.requestTimeout);

      this.pendingRequests.set(id, {
        resolve: (result) => {
          clearTimeout(timer);
          resolve(result);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
        method,
        timestamp: Date.now(),
      });

      this.send({
        type: "lsp:request",
        language: this.language,
        message: {
          jsonrpc: "2.0",
          id,
          method,
          params,
        },
      });
    });
  }

  private sendNotification(method: string, params: any): void {
    this.send({
      type: "lsp:notification",
      language: this.language,
      message: {
        jsonrpc: "2.0",
        method,
        params,
      },
    });
  }

  private rejectAllPending(reason: string): void {
    for (const [id, req] of this.pendingRequests) {
      req.reject(new Error(reason));
    }
    this.pendingRequests.clear();
  }

  didOpen(uri: string, languageId: string, version: number, text: string): void {
    if (!this.serverRunning || !this.initialized) return;

    this.openDocuments.set(uri, version);
    this.documentVersions.set(uri, version);
    this.documentContents.set(uri, text);

    this.sendNotification("textDocument/didOpen", {
      textDocument: { uri, languageId, version, text },
    });
  }

  hasIncrementalSync(): boolean {
    return this.supportsIncrementalSync;
  }

  didChange(
    uri: string,
    version: number,
    text: string,
    contentChanges?: Array<{
      range: { start: { line: number; character: number }; end: { line: number; character: number } };
      rangeLength: number;
      text: string;
    }>
  ): void {
    if (!this.serverRunning || !this.initialized) return;

    this.openDocuments.set(uri, version);
    this.documentVersions.set(uri, version);
    this.documentContents.set(uri, text);

    const useIncremental = this.supportsIncrementalSync && contentChanges && contentChanges.length > 0;
    this.sendNotification("textDocument/didChange", {
      textDocument: { uri, version },
      contentChanges: useIncremental ? contentChanges : [{ text }],
    });
  }

  didClose(uri: string): void {
    if (!this.serverRunning || !this.initialized) return;

    this.openDocuments.delete(uri);
    this.documentVersions.delete(uri);
    this.documentContents.delete(uri);

    this.sendNotification("textDocument/didClose", {
      textDocument: { uri },
    });
  }

  didSave(uri: string, text?: string): void {
    if (!this.serverRunning || !this.initialized) return;

    const params: any = { textDocument: { uri } };
    if (text !== undefined) params.text = text;

    this.sendNotification("textDocument/didSave", params);
  }

  async completion(uri: string, line: number, character: number): Promise<Completion[]> {
    try {
      const result = await this.sendRequest("textDocument/completion", {
        textDocument: { uri },
        position: { line, character },
      });

      if (!result) return [];

      const items: LSPCompletionItem[] = Array.isArray(result) ? result : (result.items || []);

      return items.map((item) => {
        const doc = typeof item.documentation === "string"
          ? item.documentation
          : item.documentation?.value || "";

        const completion: Completion = {
          label: item.label,
          type: COMPLETION_KIND_MAP[item.kind || 1] || "text",
          detail: item.detail || undefined,
          info: doc || undefined,
          boost: item.sortText ? -parseInt(item.sortText, 10) || 0 : 0,
        };

        if (item.textEdit) {
          const te = item.textEdit;
          const additionalEdits = item.additionalTextEdits || [];
          completion.apply = (view, _completion, from, to) => {
            const changes: Array<{ from: number; to: number; insert: string }> = [];

            if ("range" in te) {
              const startLine = view.state.doc.line(te.range.start.line + 1);
              const endLine = view.state.doc.line(te.range.end.line + 1);
              const editFrom = startLine.from + te.range.start.character;
              const editTo = endLine.from + te.range.end.character;
              changes.push({ from: editFrom, to: editTo, insert: te.newText });
            } else {
              changes.push({ from, to, insert: (te as any).newText });
            }

            for (const ae of additionalEdits) {
              const aeStartLine = view.state.doc.line(ae.range.start.line + 1);
              const aeEndLine = view.state.doc.line(ae.range.end.line + 1);
              changes.push({
                from: aeStartLine.from + ae.range.start.character,
                to: aeEndLine.from + ae.range.end.character,
                insert: ae.newText,
              });
            }

            view.dispatch({ changes: changes.sort((a, b) => b.from - a.from) });
          };
        } else {
          completion.apply = item.insertText || item.label;
        }

        return completion;
      });
    } catch {
      return [];
    }
  }

  async hover(uri: string, line: number, character: number): Promise<string | null> {
    try {
      const result: LSPHoverResult | null = await this.sendRequest("textDocument/hover", {
        textDocument: { uri },
        position: { line, character },
      });

      if (!result || !result.contents) return null;

      return this.formatHoverContents(result.contents);
    } catch {
      return null;
    }
  }

  private formatHoverContents(contents: LSPHoverResult["contents"]): string {
    if (typeof contents === "string") return contents;
    if ("value" in contents) return contents.value;
    if (Array.isArray(contents)) {
      return contents.map(c => typeof c === "string" ? c : c.value).join("\n\n");
    }
    return "";
  }

  async definition(uri: string, line: number, character: number): Promise<LSPLocation[]> {
    try {
      const result = await this.sendRequest("textDocument/definition", {
        textDocument: { uri },
        position: { line, character },
      });

      if (!result) return [];
      if (Array.isArray(result)) {
        return result.map(this.normalizeLocation);
      }
      return [this.normalizeLocation(result)];
    } catch {
      return [];
    }
  }

  async references(uri: string, line: number, character: number): Promise<LSPLocation[]> {
    try {
      const result = await this.sendRequest("textDocument/references", {
        textDocument: { uri },
        position: { line, character },
        context: { includeDeclaration: true },
      });

      if (!result || !Array.isArray(result)) return [];
      return result.map(this.normalizeLocation);
    } catch {
      return [];
    }
  }

  async rename(uri: string, line: number, character: number, newName: string): Promise<any> {
    try {
      return await this.sendRequest("textDocument/rename", {
        textDocument: { uri },
        position: { line, character },
        newName,
      });
    } catch {
      return null;
    }
  }

  async signatureHelp(uri: string, line: number, character: number): Promise<LSPSignatureHelp | null> {
    try {
      return await this.sendRequest("textDocument/signatureHelp", {
        textDocument: { uri },
        position: { line, character },
      });
    } catch {
      return null;
    }
  }

  private normalizeLocation(loc: any): LSPLocation {
    if (loc.targetUri) {
      return { uri: loc.targetUri, range: loc.targetRange || loc.targetSelectionRange };
    }
    return { uri: loc.uri, range: loc.range };
  }

  onDiagnostics(callback: DiagnosticsCallback): () => void {
    this.diagnosticsCallbacks.add(callback);
    return () => this.diagnosticsCallbacks.delete(callback);
  }

  onStatusChange(callback: StatusCallback): () => void {
    this.statusCallbacks.add(callback);
    return () => this.statusCallbacks.delete(callback);
  }

  onConnectionChange(callback: ConnectionCallback): () => void {
    this.connectionCallbacks.add(callback);
    return () => this.connectionCallbacks.delete(callback);
  }

  private notifyStatus(status: Record<LSPLanguage, boolean>): void {
    for (const cb of this.statusCallbacks) cb(status);
  }

  private notifyConnection(connected: boolean): void {
    for (const cb of this.connectionCallbacks) cb(connected);
  }

  onReady(callback: () => void): () => void {
    this.readyCallbacks.add(callback);
    return () => { this.readyCallbacks.delete(callback); };
  }

  isConnected(): boolean {
    return this.connected;
  }

  isReady(): boolean {
    return this.connected && this.serverRunning && this.initialized;
  }

  getLanguage(): LSPLanguage {
    return this.language;
  }

  getDocumentVersion(uri: string): number {
    return this.documentVersions.get(uri) || 0;
  }

  makeUri(filename: string): string {
    return `${this.rootUri}/${filename}`;
  }

  static lspDiagnosticsToCodeMirror(
    diagnostics: LSPDiagnostic[],
    doc: { line: (n: number) => { from: number; to: number; text: string }; lines: number },
  ): Diagnostic[] {
    const result: Diagnostic[] = [];

    for (const diag of diagnostics) {
      const startLine = diag.range.start.line + 1;
      const endLine = diag.range.end.line + 1;

      if (startLine < 1 || startLine > doc.lines) continue;

      const startLineObj = doc.line(Math.min(startLine, doc.lines));
      const endLineObj = doc.line(Math.min(endLine, doc.lines));

      const from = startLineObj.from + Math.min(diag.range.start.character, startLineObj.text.length);
      const to = endLineObj.from + Math.min(diag.range.end.character, endLineObj.text.length);

      let severity: "error" | "warning" | "info" | "hint" = "info";
      switch (diag.severity) {
        case 1: severity = "error"; break;
        case 2: severity = "warning"; break;
        case 3: severity = "info"; break;
        case 4: severity = "hint"; break;
      }

      result.push({
        from: Math.max(0, from),
        to: Math.max(from, to),
        severity: severity === "hint" ? "info" : severity,
        message: diag.message,
        source: diag.source || undefined,
      });
    }

    return result;
  }
}

export function detectLSPLanguage(filename: string): LSPLanguage | null {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  switch (ext) {
    case "ts": case "tsx": return "typescript";
    case "js": case "jsx": case "mjs": case "cjs": return "javascript";
    case "py": case "pyw": return "python";
    case "go": return "go";
    default: return null;
  }
}
