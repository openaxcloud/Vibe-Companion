# Container Runtime Design — Vibe-Companion

> Status: PROPOSED · Date: 2026-04-27 · Author: Claude

## 1. Trade-off Table

| Criterion | Docker (runc) | Firecracker microVM | gVisor (runsc) | Current (bare process) |
|---|---|---|---|---|
| **Cold-start** | 300–800 ms | 100–150 ms | 150–300 ms | ~10 ms |
| **Isolation strength** | Kernel shared, namespace + seccomp | Full VM boundary, separate KVM guest | User-space syscall filter (ptrace/KVM), shared kernel visible | None — shared PID namespace |
| **Host kernel req.** | Any Linux ≥ 3.10 + cgroups v2 | KVM enabled (`/dev/kvm`), Linux ≥ 5.10 | Linux ≥ 4.14, optionally KVM for platform=kvm | Any |
| **Ops complexity** | Low — standard toolchain, broad docs | High — custom VMM, no standard registry integration | Medium — Drop-in OCI runtime, but debugging harder | Near-zero |
| **Image/FS model** | OCI layers + overlay2 | Custom rootfs (ext4 snapshot), no OCI natively | OCI via containerd shim | Host FS + project-workspaces/ dir |
| **Network namespacing** | Full veth + bridge, easy CNI | Full virtio-net, TAP device per VM | Full veth (same as Docker) | Host network, no isolation |
| **Memory overhead** | ~5 MB per container | ~3 MB per microVM + 64 MB RAM floor for kernel | ~10 MB per sandbox | 0 |
| **Ecosystem / tooling** | Enormous — Compose, BuildKit, registries | AWS Lambda / Fly.io / Cloudflare Workers pattern; no Compose | Google Cloud Run, containerd native | N/A |
| **Multi-tenant safety** | Good with seccomp + capabilities drop | Excellent — exploits must escape VM hypervisor | Good — reduced attack surface vs Docker | Unsafe |
| **Replit parity** | Closest OSS equivalent to Replit's model | Closest to modern FaaS | Middle ground | Current state |

## 2. Recommendation — Docker (runc) for v1

**Pick Docker with a hardened seccomp profile and cgroups v2 resource limits.**

Rationale:
- Replit itself ships its environment as OCI containers (nix layers → OCI). Our existing `project-workspaces/<id>/` model maps directly to a bind-mounted volume — zero change to file materialisation logic.
- Firecracker is the correct long-term answer for hostile multi-tenant workloads (think untrusted user code running crypto miners). But it requires KVM on the host, a custom VMM integration, and a non-OCI image pipeline. For v1, that is 6–8 weeks of infra work with no user-visible feature delta.
- gVisor's syscall interception breaks Node.js `io_uring`, Python's `ctypes`, and several native addons silently — unacceptable for a general code runner.
- Docker's cold-start (300–800 ms) is acceptable: user interaction (type → run) dominates; the terminal `spawn()` path already has a ~50 ms shell init delay.
- Migration path from Docker → Firecracker is straightforward: replace the OCI runtime shim, keep the rest of the API contract.

## 3. Security Model

**Network namespace strategy**
- Each project container gets its own network namespace with a `veth` pair bridged to a per-tenant Docker network (`vibe-tenant-<userId>`).
- Egress: an `iptables`/nftables allow-list on the bridge permits `443/tcp` to curated registries (npm, PyPI, pkg.go.dev, apt mirrors) plus `53/udp` to the host DNS resolver. All other egress is DROPped by default.
- No inter-container routing within the same user tenant unless explicitly enabled (future "team network" feature).
- Inbound: only the preview proxy (§5) may reach the container's dev-server port; no public inbound.

**seccomp profile**
- Base: Docker's `default.json` profile minus `ptrace`, `process_vm_readv`, `process_vm_writev`, `keyctl`, `add_key`, `request_key`.
- Add block: `mount`, `unshare`, `clone` with `CLONE_NEWUSER` flag, `pivot_root`, `chroot`, `perf_event_open`.
- Profile stored at `server/container/seccomp-profile.json`, loaded via `--security-opt seccomp=`.

**Linux capabilities to drop**
`CAP_NET_ADMIN`, `CAP_NET_RAW`, `CAP_SYS_ADMIN`, `CAP_SYS_PTRACE`, `CAP_SYS_MODULE`, `CAP_MKNOD`, `CAP_AUDIT_WRITE`, `CAP_SETUID`, `CAP_SETGID` (run as uid 1000 non-root inside container).

**AppArmor / no-new-privileges**
`--security-opt no-new-privileges:true` on every `docker run` invocation.

## 4. File-System Mounting

Current state: `terminal.ts` materialises DB files to `./project-workspaces/<projectId>/` via `syncFilesToDisk()`. `preview-service.ts` independently writes to `/tmp/preview-<projectId>/`.

Container model:
1. **tmpfs workspace volume** — at container start, create a named Docker volume (tmpfs-backed for free tier, device-mapper thin-provisioned for pro/team) and mount it at `/workspace` inside the container.
2. **Materialisation at start** — `server/container/workspace-init.ts` (new) replaces the inline `syncFilesToDisk()` logic: reads project files from Postgres `files` table, writes them into the volume via `docker cp` or a pre-start init container.
3. **Live sync** — write operations from the editor continue to hit the existing REST `POST /api/projects/:id/files` route; the container-side `/workspace` is the single source of truth for the running process. A lightweight inotify watcher in the container can push changed files back to Postgres on save (replacing the current `terminal.ts` in-process file-watcher).
4. **terminal.ts workspace dir mapping** — `WORKSPACE_DIR` env var injected into the container points to `/workspace`; the PTY bash shell CDs there on start. No change to the PTY protocol itself.
5. **Preview artefact separation** — `/tmp/preview-<id>` moves inside the container to `/workspace/.vibe-preview/`; no longer a host path. `preview-service.ts` references this via the container FS API.

Disk quota enforced at the volume level (see §6).

## 5. Port Forwarding

Current: `localWorkspaceManager` allocates a host port in `10000–20000`, `preview-service.ts` allocates `20000–29999`. `/api/preview/projects/:id/preview` HTTP-proxies to `localhost:<port>`.

Container model:
- Each container exposes **one fixed internal port** (`8080` by convention; overridden by `PORT` env var).
- **No host port binding** — containers join the bridge network only.
- A **single shared reverse-proxy** (Caddy or `http-proxy` middleware, already used in `preview-service.ts`) routes by project ID:
  - Route: `GET /api/preview/projects/:id/*` → resolved container IP + port `8080` via Docker network DNS (`container-<id>.vibe-tenant-<userId>`).
  - WebSocket upgrades pass through unchanged.
- Port pool management (`localWorkspaceManager.allocatePort()`, `preview-service.ts` pool) is eliminated — replaced by container DNS lookup.
- For the external-runner path (`runnerClient.ts`), the preview proxy URL pattern `/preview/{workspaceId}/{port}` is already abstracted; swap the base URL to the container network endpoint.

## 6. Resource Limits

Limits enforced via Docker `--cgroups` flags at container creation time.

| Resource | Free | Pro | Team |
|---|---|---|---|
| CPU shares (`--cpu-shares`) | 256 (¼ core) | 512 (½ core) | 1024 (1 core) |
| CPU hard cap (`--cpus`) | 0.5 | 1.0 | 2.0 |
| RAM (`--memory`) | 256 MB | 512 MB | 1 GB |
| Swap (`--memory-swap`) | = RAM (no swap) | = RAM | 2× RAM |
| PIDs (`--pids-limit`) | 64 | 128 | 256 |
| Disk (volume quota) | 512 MB | 2 GB | 10 GB |
| Network egress (tc) | 1 Mbps | 5 Mbps | 20 Mbps |

OOM kill: Docker default (`--oom-kill-disable=false`). OOM event emitted as `container:oom` to the project WebSocket to show a user-visible banner.

## 7. Cleanup

| Trigger | Action |
|---|---|
| Idle TTL: **20 min** no terminal/preview activity | `docker stop --time 5 <id>` + volume detach |
| Project close (WebSocket disconnect) | Immediate `docker stop --time 10` |
| Preview idle: **10 min** no HTTP hits | Stop only the dev-server process inside container (SIGTERM to PID 1); container stays warm for terminal use |
| Container stop | Volume preserved for 24 h (so files survive a re-open) |
| Volume GC | Nightly cron: delete volumes whose last-modified project `updated_at` > 24 h and no running container |
| Orphan GC | On server boot: `docker ps -a` diff against `project_containers` table; kill stale entries |
| Hard cap | Max 200 containers per host; above that, reject new starts with 503 and queue |

Container lifecycle state stored in a new Postgres table `project_containers(project_id, container_id, status, started_at, last_activity_at)`.

## 8. Migration Plan

| File | Change required | Est. days |
|---|---|---|
| `server/terminal.ts` | Replace `spawn("bash")` + `project-workspaces/` path with `docker exec -it <container_id> bash`; delegate `syncFilesToDisk()` to new `workspace-init.ts`; remove host-path workspace dir logic | 3 d |
| `server/localWorkspaceManager.ts` | Replace `spawn("sh", ["-c", cmd])` + port-pool with `docker run` + container-DNS preview URL; keep idle-timeout logic, wire to `docker stop` | 3 d |
| `server/runnerClient.ts` | Swap `RUNNER_BASE_URL` target from remote HTTP to container-network endpoint; remove `execLocal()` fallback (now handled by container exec) | 1 d |
| `server/preview/preview-service.ts` | Remove host `/tmp/preview-*` dirs and port pool (20000–29999); proxy to container:8080 via Docker network DNS; keep framework-detection and health-check logic intact | 4 d |
| `server/preview/preview-websocket.ts` | Update proxy target resolution from host-port to container-network address | 0.5 d |
| New: `server/container/manager.ts` | Docker SDK wrapper — create/start/stop/exec/inspect; lifecycle state in Postgres; GC cron | 4 d |
| New: `server/container/workspace-init.ts` | File materialisation from Postgres → volume; replaces scattered `syncFilesToDisk()` calls | 2 d |
| New: `server/container/seccomp-profile.json` | Hardened seccomp JSON (see §3) | 0.5 d |
| Infra: host Docker setup | `dockerd` + cgroups v2 on Replit deploy host; iptables egress rules; Caddy or nginx for preview proxy | 2 d |

**Total estimate: ~20 person-days ≈ 4 man-weeks** (single backend engineer, not counting QA and load testing).

**Suggested sequencing:**
1. Week 1 — `container/manager.ts` + `workspace-init.ts` + infra setup; smoke-test container boot in isolation.
2. Week 2 — `terminal.ts` migration; run both paths behind `CONTAINER_RUNTIME=docker` feature flag.
3. Week 3 — `localWorkspaceManager.ts` + `preview-service.ts`; validate preview proxy.
4. Week 4 — `runnerClient.ts` cleanup; GC cron; load/security testing; cut-over.
