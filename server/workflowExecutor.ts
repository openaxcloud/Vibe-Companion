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

export async function executeWorkflow(
  workflowId: string,
  onStepUpdate?: (stepResults: StepResult[], currentStep: number) => void,
): Promise<{ success: boolean; runId?: string; error?: string }> {
  const workflow = await storage.getWorkflow(workflowId);
  if (!workflow) return { success: false, error: "Workflow not found" };

  const steps = await storage.getWorkflowSteps(workflowId);
  if (steps.length === 0) return { success: false, error: "Workflow has no steps" };

  const run = await storage.createWorkflowRun(workflowId);
  const startTime = Date.now();
  const stepResults: StepResult[] = [];
  let overallSuccess = true;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const stepStartTime = Date.now();

    const stepResult: StepResult = {
      stepId: step.id,
      name: step.name,
      status: "running",
      stdout: "",
      stderr: "",
      exitCode: -1,
      durationMs: 0,
    };

    stepResults.push(stepResult);
    onStepUpdate?.(stepResults, i);

    try {
      const result = await executeCode(step.command, "bash");
      stepResult.stdout = result.stdout || "";
      stepResult.stderr = result.stderr || "";
      stepResult.exitCode = result.exitCode;
      stepResult.durationMs = Date.now() - stepStartTime;
      stepResult.status = result.exitCode === 0 ? "success" : "failed";

      if (result.exitCode !== 0) {
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
    } catch (err: any) {
      stepResult.stderr = err.message;
      stepResult.exitCode = 1;
      stepResult.durationMs = Date.now() - stepStartTime;
      stepResult.status = "failed";
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

    onStepUpdate?.(stepResults, i);
  }

  const totalDuration = Date.now() - startTime;
  await storage.updateWorkflowRun(run.id, {
    status: overallSuccess ? "success" : "failed",
    stepResults,
    durationMs: totalDuration,
    finishedAt: new Date(),
  });

  log(`Workflow "${workflow.name}" completed: ${overallSuccess ? "success" : "failed"} in ${totalDuration}ms`, "workflow");
  return { success: overallSuccess, runId: run.id };
}

export const WORKFLOW_TEMPLATES = [
  {
    name: "Build & Run",
    triggerEvent: "manual",
    steps: [
      { name: "Install dependencies", command: "echo 'Installing dependencies...'" },
      { name: "Build project", command: "echo 'Building project...'" },
      { name: "Run application", command: "echo 'Application started successfully'" },
    ],
  },
  {
    name: "Test & Deploy",
    triggerEvent: "manual",
    steps: [
      { name: "Run tests", command: "echo 'Running tests... All tests passed'" },
      { name: "Build for production", command: "echo 'Building for production...'" },
      { name: "Deploy", command: "echo 'Deploying to production...'" },
    ],
  },
  {
    name: "Lint & Format",
    triggerEvent: "manual",
    steps: [
      { name: "Lint code", command: "echo 'Linting code... No errors found'" },
      { name: "Format code", command: "echo 'Formatting code... Done'" },
      { name: "Check types", command: "echo 'Type checking... No errors'" },
    ],
  },
];
