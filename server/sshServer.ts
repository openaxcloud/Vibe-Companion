import * as ssh2 from "ssh2";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
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

export function startSSHServer(port: number = 2222): ssh2.Server {
  const hostKey = getOrCreateHostKey();

  const server = new ssh2.Server(
    { hostKeys: [hostKey] },
    (client: ssh2.Connection, info: ssh2.ClientInfo) => {
      log(`SSH client connected: ${info.ip}`, "ssh");

      let authenticatedUserId: string | null = null;
      let requestedProjectId: string | null = null;

      client.on("authentication", async (ctx: ssh2.AuthContext) => {
        if (ctx.method === "publickey") {
          const pubKeyCtx = ctx as ssh2.PublicKeyAuthContext;
          try {
            const keyData = pubKeyCtx.key.data;
            const fingerprint = computeFingerprint(keyData);

            const sshKey = await storage.findSshKeyByFingerprint(fingerprint);
            if (!sshKey) {
              log(`SSH auth rejected: unknown key fingerprint ${fingerprint}`, "ssh");
              return ctx.reject();
            }

            requestedProjectId = ctx.username;

            if (requestedProjectId) {
              const project = await storage.getProject(requestedProjectId);
              if (!project) {
                log(`SSH auth rejected: project ${requestedProjectId} not found`, "ssh");
                return ctx.reject();
              }
              if (project.userId !== sshKey.userId) {
                log(`SSH auth rejected: user ${sshKey.userId} does not own project ${requestedProjectId}`, "ssh");
                return ctx.reject();
              }
            }

            if (!pubKeyCtx.signature) {
              return ctx.accept();
            }

            const parsedKey = ssh2.utils.parseKey(sshKey.publicKey);
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

        client.on("session", (accept: () => ssh2.Session) => {
          const session = accept();

          let ptyInfo: { cols: number; rows: number } = { cols: 80, rows: 24 };

          session.on("pty", (accept, _reject, info) => {
            ptyInfo = { cols: info.cols, rows: info.rows };
            if (accept) accept();
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
