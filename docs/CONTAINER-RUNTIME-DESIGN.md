# Container Runtime Design — Vibe-Companion

> Status: DESIGN DRAFT — 2026-04-30  
> Deferred from `docs/AUDIT-CRITICAL-PATH-2026-04-27.md` (hors-scope item)

---

## 1. Trade-off Table

| | **Docker** | **Firecracker** | **gVisor (runsc)** | **Nix jail (current)** |
|---|---|---|---|---|
| **Cold start** | 1–3 s | ~125 ms | 200–400 ms | ~0 ms |
| **Isolation strength** | Namespace + cgroups (shared kernel) | Full microVM, separate guest kernel | User-space syscall interception | None |
| **Host kernel req.** | Any Linux w/ cgroups v2 | `/dev/kvm` (bare-metal or nested-virt VM) | Any Linux ≥ 4.14 | Any |
| **Ops complexity** | Low — Docker daemon, well-known tooling | High — Jailer binary, Firecracker API, image layer management | Medium — runsc drop-in for Docker/containerd | None |
| **seccomp / caps** | Standard Docker seccomp profile | Guest kernel owns syscalls; host fully isolated | Sentry intercepts all syscalls; strong by default | None |
| **Multi-tenant safety** | Acceptable with hardened profiles | Excellent (VM-grade boundary) | Good (kernel CVEs don't reach host) | Unsafe |
| **Port forwarding** | `docker run -p` or overlay network | TAP device + virtio-net; needs separate proxy | Same as Docker (CNI or host-net) | Localhost only |
| **File I/O overhead** | ~5 % via overlayfs | ~10 % via virtio-fs | ~15–30 % (syscall round-trips) | Zero |
| **Ecosystem / images** | Massive (Docker Hub, Buildkit) | Custom rootfs or OCI via `docker2firecracker` | OCI-compatible; standard runtime | N/A |
| **Replit/Fly precedent** | Standard industry default | AWS Lambda, Fly.io, Replit post-2022 | Google gVisor on GKE Sandbox | Replit pre-2022 |

---

## 2. Recommendation — Docker (v1)

**Pick Docker with cgroups-v2 + hardened seccomp for v1.**

Rationale:
- The codebase already has `server/docker-executor.ts` with a working skeleton (images, resource limits, port pool 3000–4000, non-root UID 1000). This is weeks of bootstrapping that exists.
- `server/runnerClient.ts` already proves the split between orchestrator and runner; Docker is a local runner that doesn't require an external service.
- Firecracker requires `/dev/kvm` — unavailable on most VPS/cloud VMs without nested virtualisation. Provisioning bare-metal is a separate ops project.
- gVisor's syscall interception imposes 15–30 % I/O overhead and breaks some Node.js internals (`io_uring`, `AF_NETLINK`); debugging PTY failures inside gVisor is painful.
- Docker on a hardened Debian/Ubuntu host with cgroups v2, a custom seccomp profile (based on Docker's default minus 15 calls), and `--cap-drop ALL --cap-add NET_BIND_SERVICE` is sufficient isolation for a hosted IDE. CVE surface is the Linux kernel, same as gVisor, but ops burden is far lower.

**Firecracker is the right v2 target** when the team has a bare-metal fleet or AWS EC2 metal instances and needs VM-grade multi-tenancy guarantees.

---

## 3. Security Model

### Network namespace
- Each container runs with `--network none` by default.
- Projects that declare a `port` in `package.json` / `pyproject.toml` get a dedicated bridge network (`vibe-proj-<projectId>`) joined by both the container and a per-project Caddy reverse-proxy sidecar.
- **Egress allowlist (bridge mode)**: iptables OUTPUT chain on the bridge drops all traffic except: `ESTABLISHED,RELATED`, DNS on `127.0.0.11:53` (Docker embedded DNS), and an operator-configured CIDR allowlist (`CONTAINER_EGRESS_ALLOWLIST`, default empty — no outbound internet). Free-tier: no egress. Pro/Team: opt-in allowlist per project.

### seccomp
- Use Docker's default seccomp profile as base, additionally block: `add_key`, `bpf`, `clone` (with CLONE_NEWUSER), `keyctl`, `mount`, `pivot_root`, `ptrace`, `reboot`, `setns`, `syslog`, `unshare`, `userfaultfd`.
- Ship the profile as `infra/seccomp/container-default.json`; loaded via `--security-opt seccomp=...`.

### Capabilities
```
--cap-drop ALL
--cap-add CHOWN DAC_OVERRIDE FOWNER SETGID SETUID NET_BIND_SERVICE
```
No `SYS_ADMIN`, `SYS_PTRACE`, `NET_ADMIN`, `NET_RAW`.

### User / filesystem
- Containers run as UID/GID 1000 (non-root). Host bind-mount is `chown`-ed to 1000:1000 before `docker run`.
- `--read-only` root filesystem + explicit `--tmpfs /tmp:size=64m,exec` + writable overlay for the project workspace only (see §4).
- `--no-new-privileges` always set.

---

## 4. File-system Mounting

**Current state:** `terminal.ts` calls `materializeProjectFiles()` which writes rows from the `files` Postgres table to `project-workspaces/<projectId>/` on the host disk.

**Container strategy — overlay on tmpfs:**

```
host tmpfs: /run/vibe/workspaces/<projectId>/   (upper layer, rw, 512 MB quota)
base image:  node:20-alpine or python:3.11-alpine (lower layer, ro)
overlay:     merged at /workspace inside container
```

1. On container start, `materializeProjectFiles()` writes files into the host tmpfs dir (unchanged logic, just a different base path: `/run/vibe/workspaces/<projectId>/` instead of `project-workspaces/<projectId>/`).
2. Docker bind-mount: `--mount type=bind,source=/run/vibe/workspaces/<projectId>,target=/workspace`.
3. File saves (via `/api/files`) write to the tmpfs dir; a background debounced flush (500 ms) syncs dirty inodes back to Postgres.
4. On container stop / idle eviction, the tmpfs dir is unmounted and freed; a final DB sync runs first.

**Why tmpfs over ext4 volume?** Terminal I/O is latency-sensitive; tmpfs avoids fsync to disk. DB is the persistent store — disk is ephemeral by design.

---

## 5. Port Forwarding

**Current state:** `localWorkspaceManager.ts` allocates a host port (10 000–20 000) per project process. `preview.ts` proxies `/api/preview/projects/:id/preview` → `http://localhost:<port>`.

**Container state:** the project's dev server binds to port 3000 inside the container. The host must expose it without conflicting with other containers.

**Strategy — shared Caddy edge proxy:**

```
Browser → HTTPS :443 (Caddy) → /preview/<projectId>/* → http://127.0.0.1:<hostPort>
                                                           ↑
                                              docker run -p 127.0.0.1:<hostPort>:3000
```

1. `ContainerManager` (new, wraps `docker-executor.ts`) allocates a host port from pool 20 000–30 000 (larger than the existing 10 000–20 000 to avoid collisions during migration).
2. On container start, it registers a Caddy admin-API route: `POST /config/apps/http/servers/srv0/routes` adding a `handle` that matches `Host: preview-<projectId>.vibe.run` or path prefix `/preview/<projectId>/`.
3. `preview.ts` route delegates to `ContainerManager.getPreviewUrl(projectId)` instead of `localWorkspaceManager.getPort()`.
4. WebSocket preview upgrades: Caddy natively proxies `Upgrade: websocket` — no change to `preview-websocket.ts` client-side protocol.

No per-container Caddy sidecar needed for v1 — one shared Caddy instance is simpler and handles TLS termination.

---

## 6. Resource Limits

| | **Free** | **Pro** | **Team** |
|---|---|---|---|
| CPU shares (`--cpu-shares`) | 256 (¼ core) | 512 (½ core) | 1024 (1 core) |
| CPU hard cap (`--cpus`) | 0.5 | 1.0 | 2.0 |
| Memory (`--memory`) | 256 MB | 512 MB | 1 GB |
| Memory + swap | 256 MB (swap=0) | 512 MB | 1 GB |
| PIDs (`--pids-limit`) | 64 | 128 | 256 |
| Disk (tmpfs quota) | 256 MB | 512 MB | 2 GB |
| Egress internet | None | Opt-in allowlist | Opt-in allowlist |
| Concurrent containers / user | 1 | 3 | 10 |

Limits applied via `ContainerManager.buildRunArgs(plan: 'free'|'pro'|'team')`. Plan resolved from `users.plan` column (already in schema).

---

## 7. Cleanup

| Trigger | Action |
|---|---|
| No WS client for **15 min** (free) / **30 min** (pro/team) | `docker stop --time 5 <id>` + final DB sync + tmpfs unmount |
| User closes project tab | WS disconnect → debounced 30 s stop (allows quick re-open) |
| `POST /api/runtime/:id/stop` | Immediate stop |
| Process exits (crash) | Docker `--restart no`; container enters `Exited` state; status pushed via WS to UI |
| Server restart | On boot, `ContainerManager.reconcile()` lists all `Exited`/`Dead` containers matching label `vibe.projectId=*` and removes them with `docker rm` |
| Orphan GC (cron, every 5 min) | `docker ps --filter label=vibe.projectId --filter status=exited -q \| xargs docker rm` |

Idle TTL env vars: `CONTAINER_IDLE_TTL_FREE_MS` (default 900 000), `CONTAINER_IDLE_TTL_PRO_MS` (default 1 800 000).

---

## 8. Migration Plan

| File | Change required | Est. days |
|---|---|---|
| `server/docker-executor.ts` | Promote to `server/container/ContainerManager.ts`; add plan-based limits, Caddy registration, label scheme, reconcile() | 3 |
| `server/localWorkspaceManager.ts` | Deprecate process-based runner; replace `startWorkspace()` with `ContainerManager.start()`; keep as thin shim during transition | 1 |
| `server/terminal.ts` | Replace `spawnTerminal()` (spawns bash on host) with `docker exec -it <containerId> bash`; PTY piped via dockerode `container.attach()` | 2 |
| `server/terminal/pty-terminal-service.ts` | Update to call `ContainerManager.getContainerId(projectId)` before attaching | 0.5 |
| `server/runnerClient.ts` | Keep as-is for remote-runner fallback; no changes needed in v1 | 0 |
| `server/preview/preview-service.ts` | Replace `localWorkspaceManager.getPort()` lookup with `ContainerManager.getPreviewUrl()` | 0.5 |
| `server/preview/preview-websocket.ts` | Port proxy target changes; no protocol change | 0.5 |
| `server/routes/preview.ts` | Delegate to new `ContainerManager` method; remove direct port construction | 0.5 |
| `server/routes/legacy-workspace-runner.ts` | Remove process-spawn logic; proxy to ContainerManager | 1 |
| `server/routes/shell.ts` / `shell.router.ts` | Shell attach → `docker exec` | 0.5 |
| `infra/seccomp/container-default.json` | **New file** — hardened seccomp profile | 0.5 |
| `infra/caddy/Caddyfile` | **New file** — base Caddy config with admin API enabled | 0.5 |
| `server/container/ContainerManager.ts` | **New file** — core abstraction (start, stop, exec, reconcile, getPreviewUrl) | 3 |

**Total estimate: ~14 days (≈ 3 man-weeks including testing and staged rollout).**

Staged rollout: gate on `CONTAINER_RUNTIME=docker` env var (default `local` for dev, `docker` in production). `localWorkspaceManager` remains the fallback when Docker socket is unavailable.
