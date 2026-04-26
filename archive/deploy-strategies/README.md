# Archived deployment strategies

Vibe-Companion runs on **Replit Deployments** as its single canonical
deployment target. The runtime path is:

```
server/index.ts
  └── server/services/deployment-manager.ts   (active, top-level)
  └── server/deploymentEngine.ts              (active, process supervision)
```

Everything in this archive is dormant code that was previously prototyped
for alternative deployment strategies but is **not imported anywhere** in
the runtime path. It is preserved here for historical reference (and in
case we ever need to revive a Kubernetes / blue-green / buildpack workflow)
without polluting the active server directory.

## What's archived

### `server-deployment/` — alternative deployment pipelines
- `autoscale-deployment.ts` — Replit/Knative-style autoscaling driver
- `blue-green-deployment.ts` — blue/green cutover orchestration
- `buildpack-deployment.ts` — Heroku-style buildpack runner
- `k8s-deployment-service.ts` — generic Kubernetes deploy helper
- `real-kubernetes-deployment.ts` — Kubernetes API integration
- `multi-region-failover-service.ts` — multi-region routing
- `ab-testing-service.ts` — A/B traffic splitting
- `container-builder.ts` — OCI image build pipeline
- `container-orchestrator.ts` — *retained in `server/deployment/`* because
  `polyglot-routes.ts` and `edge/edge-manager.ts` still import it; will be
  archived once those routes are removed.
- `deployment-pipeline.ts` — multi-stage pipeline orchestrator
- `real-deployment-service.ts` / `real-deployment-service-v2.ts` —
  earlier iterations of the deploy-manager
- `simple-deployer.ts` — minimal CLI deployer
- `build-pipeline.ts` — build-step DAG runner

## Reviving an archived strategy

1. Move the file back to `server/deployment/`.
2. Wire it into the deploy-manager (`server/services/deployment-manager.ts`).
3. Add tests covering the new path.
4. Update this README with a note about the new active strategy.

Do **not** import from `archive/` directly — the directory is excluded
from the build path on purpose.
