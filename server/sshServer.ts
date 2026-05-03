import ssh2pkg from "ssh2";
import type {
  Connection,
  ClientInfo,
  AuthContext,
  PublicKeyAuthContext,
  Session,
} from "ssh2";
const { Server: SshServer, utils: sshUtils } = ssh2pkg as any;
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import { spawn } from "child_process";
import { storage } from "./storage";
import { createTerminalSession, materializeProjectFiles, getProjectWorkspaceDir } from "./terminal";
import { log } from "./index";

const HOST_KEY_PATH = path.join(process.cwd(), ".ssh_host_key");

function getOrCreateHostKey(): string {
  try {
    if (fs.existsSync(HOST_KEY_PATH)) {
      return fs.readFileSync(HOST_KEY_PATH, "utf-8");
    }
  } catch {}

  const { privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs1", format: "pem" },
  });

  try {
    fs.writeFileSync(HOST_KEY_PATH, privateKey, { mode: 0o600 });
  } catch (err) {
    log(`Failed to persist SSH host key: ${err}`, "ssh");
  }

  return privateKey;
}

function computeFingerprint(pubKeyData: Buffer): string {
  const hash = crypto.createHash("sha256").update(pubKeyData).digest("base64");
  return `SHA256:${hash.replace(/=+$/, "")}`;
}

export function startSSHServer(port: number = 2222): SshServer {
  const hostKey = getOrCreateHostKey();

  const server = new SshServer(
    { hostKeys: [hostKey] },
    (client: Connection, info: ClientInfo) => {
      log(`SSH client connected: ${info.ip}`, "ssh");

      let authenticatedUserId: string | null = null;
      let requestedProjectId: string | null = null;

      client.on("authentication", async (ctx: AuthContext) => {
        if (ctx.method === "publickey") {
          const pubKeyCtx = ctx as PublicKeyAuthContext;
          try {
            const keyData = pubKeyCtx.key.data;
            const fingerprint = computeFingerprint(keyData);

            requestedProjectId = ctx.username;

            // Resolve project first so we know which user to scope the key
            // lookup to.  Using a user-scoped fingerprint lookup (not global)
            // ensures deterministic auth when multiple users share a public key.
            if (!requestedProjectId) {
              log(`SSH auth rejected: empty username (must be a project ID)`, "ssh");
              return ctx.reject();
            }

            const project = await storage.getProject(requestedProjectId);
            if (!project) {
              log(`SSH auth rejected: project ${requestedProjectId} not found`, "ssh");
              return ctx.reject();
            }

            // Look up the key scoped to the project owner — not globally.
            const sshKey = await storage.findSshKeyByFingerprintAndUser(fingerprint, project.userId);
            if (!sshKey) {
              log(`SSH auth rejected: fingerprint ${fingerprint} not registered for project owner`, "ssh");
              return ctx.reject();
            }

            if (!pubKeyCtx.signature) {
              return ctx.accept();
            }

            const parsedKey = sshUtils.parseKey(sshKey.publicKey);
            if (parsedKey instanceof Error) {
              log(`SSH auth rejected: failed to parse stored key for fingerprint ${fingerprint}`, "ssh");
              return ctx.reject();
            }

            const keyInstance = Array.isArray(parsedKey) ? parsedKey[0] : parsedKey;
            const verified = keyInstance.verify(
              (pubKeyCtx as any).blob,
              pubKeyCtx.signature,
              pubKeyCtx.key.algo
            );

            if (verified) {
              authenticatedUserId = sshKey.userId;
              ctx.accept();
              log(`SSH auth accepted: user ${sshKey.userId} for project ${requestedProjectId}`, "ssh");
            } else {
              log(`SSH auth rejected: signature verification failed for fingerprint ${fingerprint}`, "ssh");
              ctx.reject();
            }
          } catch (err) {
            log(`SSH auth error: ${err}`, "ssh");
            ctx.reject();
          }
        } else {
          ctx.reject(["publickey"]);
        }
      });

      client.on("ready", () => {
        log(`SSH client authenticated: user=${authenticatedUserId} project=${requestedProjectId}`, "ssh");

        client.on("session", (accept: () => Session) => {
          const session = accept();

          let ptyInfo: { cols: number; rows: number } = { cols: 80, rows: 24 };

          session.on("pty", (accept, _reject, info) => {
            ptyInfo = { cols: info.cols, rows: info.rows };
            if (accept) accept();
          });

          // exec channel: run a single non-interactive command and return its output.
          session.on("exec", (accept, _reject, info) => {
            if (!authenticatedUserId || !requestedProjectId) return;

            const channel = accept();
            const wsDir = getProjectWorkspaceDir(requestedProjectId);
            try { fs.mkdirSync(wsDir, { recursive: true }); } catch {}

            const proc = spawn("bash", ["-c", info.command], {
              cwd: wsDir,
              env: { ...process.env, HOME: wsDir, USER: requestedProjectId },
            });

            proc.stdout.on("data", (d: Buffer) => { try { channel.write(d); } catch {} });
            proc.stderr.on("data", (d: Buffer) => { try { channel.stderr.write(d); } catch {} });
            proc.on("close", (code: number | null) => {
              try { channel.exit(code ?? 0); channel.end(); } catch {}
              log(`SSH exec closed: user=${authenticatedUserId} code=${code}`, "ssh");
            });
            proc.on("error", (err: Error) => {
              try { channel.stderr.write(`exec error: ${err.message}\n`); channel.exit(1); channel.end(); } catch {}
            });

            channel.on("close", () => {
              try { proc.kill(); } catch {}
            });

            log(`SSH exec started: user=${authenticatedUserId} cmd=${info.command}`, "ssh");
          });

          session.on("shell", (accept) => {
            if (!authenticatedUserId || !requestedProjectId) {
              return;
            }

            const channel = accept();
            const sshSessionId = `ssh-${crypto.randomBytes(4).toString("hex")}`;

            try {
              const wsDir = getProjectWorkspaceDir(requestedProjectId);
              fs.mkdirSync(wsDir, { recursive: true });
              const ptyProcess = createTerminalSession(
                requestedProjectId,
                authenticatedUserId,
                sshSessionId,
                wsDir,
              );

              try {
                ptyProcess.resize(ptyInfo.cols, ptyInfo.rows);
              } catch {}

              const dataHandler = ptyProcess.onData((data: string) => {
                try {
                  channel.write(data);
                } catch {}
              });

              const exitHandler = ptyProcess.onExit(() => {
                try {
                  channel.close();
                } catch {}
              });

              channel.on("data", (data: Buffer) => {
                try {
                  ptyProcess.write(data.toString());
                } catch {}
              });

              channel.on("close", () => {
                dataHandler.dispose();
                exitHandler.dispose();
                log(`SSH shell closed: user=${authenticatedUserId} project=${requestedProjectId}`, "ssh");
              });

              session.on("window-change", (_accept: any, _reject: any, info: any) => {
                try {
                  ptyProcess.resize(info.cols, info.rows);
                } catch {}
              });

              log(`SSH shell started: user=${authenticatedUserId} project=${requestedProjectId}`, "ssh");
            } catch (err) {
              log(`SSH shell creation error: ${err}`, "ssh");
              try {
                channel.close();
              } catch {}
            }
          });
        });
      });

      client.on("close", () => {
        log(`SSH client disconnected: user=${authenticatedUserId}`, "ssh");
      });

      client.on("error", (err: Error) => {
        log(`SSH client error: ${err.message}`, "ssh");
      });
    }
  );

  server.on("error", (err: Error) => {
    log(`SSH server error: ${err.message}`, "ssh");
  });

  server.listen(port, "0.0.0.0", () => {
    log(`SSH server listening on port ${port}`, "ssh");
  });

  return server;
}
