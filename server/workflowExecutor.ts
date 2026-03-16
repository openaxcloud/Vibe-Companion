import { storage } from "./storage";
import { executeCode } from "./executor";
import { log } from "./index";

interface StepResult {
  stepId: string;
  name: string;
  status: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
}

const MAX_WORKFLOW_DEPTH = 5;

function resolveInstallCommand(command: string): string {
  const pkg = command.trim();
  if (!pkg) return "npm install";
  if (pkg.includes(" ")) return pkg;
  const managers: Record<string, string> = {
    npm: `npm install ${pkg}`,
    pip: `pip install ${pkg}`,
    yarn: `yarn add ${pkg}`,
    pnpm: `pnpm add ${pkg}`,
  };
  for (const [prefix, cmd] of Object.entries(managers)) {
    if (pkg.startsWith(`${prefix}:`)) return cmd.replace(pkg, pkg.slice(prefix.length + 1));
  }
  return `npm install ${pkg}`;
}

async function executeStep(
  step: { id: string; name: string; command: string; taskType: string; continueOnError: boolean },
  depth: number,
  onLog?: (message: string, type: "info" | "error" | "success") => void,
): Promise<StepResult> {
  const stepStartTime = Date.now();
  try {
    let result;
    if (step.taskType === "install_packages") {
      const installCmd = resolveInstallCommand(step.command);
      onLog?.(`[${step.name}] $ ${installCmd}`, "info");
      result = await executeCode(installCmd, "bash");
    } else if (step.taskType === "run_workflow") {
      const targetId = step.command.trim();
      const innerResult = await executeWorkflow(targetId, undefined, onLog, depth + 1);
      return {
        stepId: step.id,
        name: step.name,
        status: innerResult.success ? "success" : "failed",
        stdout: innerResult.error || "",
        stderr: innerResult.error || "",
        exitCode: innerResult.success ? 0 : 1,
        durationMs: Date.now() - stepStartTime,
      };
    } else {
      onLog?.(`[${step.name}] $ ${step.command}`, "info");
      result = await executeCode(step.command, "bash");
    }

    if (result.stdout) onLog?.(result.stdout, "info");
    if (result.stderr) onLog?.(result.stderr, result.exitCode === 0 ? "info" : "error");

    return {
      stepId: step.id,
      name: step.name,
      status: result.exitCode === 0 ? "success" : "failed",
      stdout: result.stdout || "",
      stderr: result.stderr || "",
      exitCode: result.exitCode,
      durationMs: Date.now() - stepStartTime,
    };
  } catch (err: any) {
    onLog?.(`[${step.name}] Error: ${err.message}`, "error");
    return {
      stepId: step.id,
      name: step.name,
      status: "failed",
      stdout: "",
      stderr: err.message,
      exitCode: 1,
      durationMs: Date.now() - stepStartTime,
    };
  }
}

export async function executeWorkflow(
  workflowId: string,
  onStepUpdate?: (stepResults: StepResult[], currentStep: number) => void,
  onLog?: (message: string, type: "info" | "error" | "success") => void,
  depth: number = 0,
): Promise<{ success: boolean; runId?: string; error?: string }> {
  if (depth > MAX_WORKFLOW_DEPTH) {
    return { success: false, error: `Maximum workflow nesting depth (${MAX_WORKFLOW_DEPTH}) exceeded` };
  }

  const workflow = await storage.getWorkflow(workflowId);
  if (!workflow) return { success: false, error: "Workflow not found" };

  const steps = await storage.getWorkflowSteps(workflowId);
  if (steps.length === 0) return { success: false, error: "Workflow has no steps" };

  const run = await storage.createWorkflowRun(workflowId);
  const startTime = Date.now();

  onLog?.(`\x1b[36m━━━ Workflow "${workflow.name}" started ━━━\x1b[0m`, "info");

  let stepResults: StepResult[];
  let overallSuccess: boolean;

  if (workflow.executionMode === "parallel") {
    const promises = steps.map((step) => executeStep(step, depth, onLog));
    stepResults = await Promise.all(promises);
    overallSuccess = stepResults.every((r) => r.status === "success");
    onStepUpdate?.(stepResults, steps.length - 1);
  } else {
    stepResults = [];
    overallSuccess = true;

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const stepResult = await executeStep(step, depth, onLog);
      stepResults.push(stepResult);
      onStepUpdate?.(stepResults, i);

      if (stepResult.status === "failed") {
        overallSuccess = false;
        if (!step.continueOnError) {
          for (let j = i + 1; j < steps.length; j++) {
            stepResults.push({
              stepId: steps[j].id,
              name: steps[j].name,
              status: "skipped",
              stdout: "",
              stderr: "",
              exitCode: -1,
              durationMs: 0,
            });
          }
          break;
        }
      }
    }
  }

  const totalDuration = Date.now() - startTime;
  await storage.updateWorkflowRun(run.id, {
    status: overallSuccess ? "success" : "failed",
    stepResults,
    durationMs: totalDuration,
    finishedAt: new Date(),
  });

  const statusMsg = overallSuccess
    ? `\x1b[32m✓ Workflow "${workflow.name}" completed successfully in ${totalDuration}ms\x1b[0m`
    : `\x1b[31m✗ Workflow "${workflow.name}" failed in ${totalDuration}ms\x1b[0m`;
  onLog?.(statusMsg, overallSuccess ? "success" : "error");

  log(`Workflow "${workflow.name}" completed: ${overallSuccess ? "success" : "failed"} in ${totalDuration}ms`, "workflow");
  return { success: overallSuccess, runId: run.id };
}

export const WORKFLOW_TEMPLATES = [
  {
    name: "Build & Run",
    triggerEvent: "manual",
    steps: [
      { name: "Install dependencies", command: "npm install", taskType: "shell" },
      { name: "Build project", command: "npm run build", taskType: "shell" },
      { name: "Run application", command: "npm start", taskType: "shell" },
    ],
  },
  {
    name: "Test & Deploy",
    triggerEvent: "manual",
    steps: [
      { name: "Run tests", command: "npm test", taskType: "shell" },
      { name: "Build for production", command: "npm run build", taskType: "shell" },
      { name: "Deploy", command: "npm run deploy || echo 'Deploy step completed'", taskType: "shell" },
    ],
  },
  {
    name: "Lint & Format",
    triggerEvent: "manual",
    steps: [
      { name: "Lint code", command: "npx eslint . --ext .js,.jsx,.ts,.tsx || true", taskType: "shell" },
      { name: "Format code", command: "npx prettier --write . || true", taskType: "shell" },
      { name: "Check types", command: "npx tsc --noEmit || true", taskType: "shell" },
    ],
  },
  {
    name: "Python Build & Test",
    triggerEvent: "manual",
    steps: [
      { name: "Install dependencies", command: "pip install -r requirements.txt", taskType: "shell" },
      { name: "Run tests", command: "pytest || python -m unittest discover", taskType: "shell" },
      { name: "Lint", command: "flake8 . || true", taskType: "shell" },
    ],
  },
];

const triggerDebounceMap = new Map<string, NodeJS.Timeout>();

let broadcastFn: ((projectId: string, data: any) => void) | null = null;

export function setBroadcastFn(fn: (projectId: string, data: any) => void): void {
  broadcastFn = fn;
}

export async function fireTrigger(projectId: string, triggerEvent: string): Promise<void> {
  const debounceKey = `${projectId}:${triggerEvent}`;
  if (triggerDebounceMap.has(debounceKey)) {
    clearTimeout(triggerDebounceMap.get(debounceKey)!);
  }

  const delay = triggerEvent === "on-save" ? 2000 : 500;
  triggerDebounceMap.set(debounceKey, setTimeout(async () => {
    triggerDebounceMap.delete(debounceKey);
    try {
      const triggeredWorkflows = await storage.getWorkflowsByTrigger(projectId, triggerEvent);
      for (const wf of triggeredWorkflows) {
        log(`Auto-triggering workflow "${wf.name}" (${triggerEvent}) for project ${projectId}`, "workflow");

        broadcastFn?.(projectId, {
          type: "workflow_status",
          workflowId: wf.id,
          workflowName: wf.name,
          status: "running",
        });

        const onLog = broadcastFn ? (message: string, logType: "info" | "error" | "success") => {
          broadcastFn!(projectId, {
            type: "workflow_log",
            workflowId: wf.id,
            workflowName: wf.name,
            message,
            logType,
            timestamp: Date.now(),
          });
        } : undefined;

        executeWorkflow(wf.id, undefined, onLog).then((result) => {
          broadcastFn?.(projectId, {
            type: "workflow_status",
            workflowId: wf.id,
            workflowName: wf.name,
            status: result.success ? "completed" : "failed",
          });
        }).catch((err) => {
          log(`Failed to auto-trigger workflow "${wf.name}": ${err.message}`, "workflow");
        });
      }
    } catch (err: any) {
      log(`Failed to fire trigger ${triggerEvent} for project ${projectId}: ${err.message}`, "workflow");
    }
  }, delay));
}
