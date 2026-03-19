import { storage } from "./storage";
import { log } from "./index";

export interface MergeConflict {
  filename: string;
  type: "modified_both" | "deleted_in_main" | "deleted_in_task" | "new_in_both";
  mainContent?: string;
  taskContent?: string;
  originalContent?: string;
  mergedWithMarkers?: string;
}

export interface MergeResult {
  success: boolean;
  appliedFiles: string[];
  conflicts: MergeConflict[];
  error?: string;
}

/**
 * LCS (Longest Common Subsequence) for lines.
 * Returns the LCS table for backtracking.
 */
function lcsTable(a: string[], b: string[]): number[][] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  return dp;
}

/**
 * Compute a diff between two line arrays using LCS.
 * Returns an array of hunks: each hunk is { type, aStart, aEnd, bStart, bEnd }
 */
interface DiffHunk {
  type: "equal" | "delete" | "insert" | "replace";
  aStart: number;
  aEnd: number;
  bStart: number;
  bEnd: number;
}

function computeDiff(a: string[], b: string[]): DiffHunk[] {
  const dp = lcsTable(a, b);
  // Backtrack to find matching lines
  const matches: [number, number][] = [];
  let i = a.length;
  let j = b.length;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      matches.unshift([i - 1, j - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  const hunks: DiffHunk[] = [];
  let ai = 0;
  let bi = 0;

  for (const [ma, mb] of matches) {
    // Lines before this match
    if (ai < ma || bi < mb) {
      if (ai < ma && bi < mb) {
        hunks.push({ type: "replace", aStart: ai, aEnd: ma, bStart: bi, bEnd: mb });
      } else if (ai < ma) {
        hunks.push({ type: "delete", aStart: ai, aEnd: ma, bStart: bi, bEnd: bi });
      } else {
        hunks.push({ type: "insert", aStart: ai, aEnd: ai, bStart: bi, bEnd: mb });
      }
    }
    hunks.push({ type: "equal", aStart: ma, aEnd: ma + 1, bStart: mb, bEnd: mb + 1 });
    ai = ma + 1;
    bi = mb + 1;
  }

  // Trailing lines
  if (ai < a.length || bi < b.length) {
    if (ai < a.length && bi < b.length) {
      hunks.push({ type: "replace", aStart: ai, aEnd: a.length, bStart: bi, bEnd: b.length });
    } else if (ai < a.length) {
      hunks.push({ type: "delete", aStart: ai, aEnd: a.length, bStart: bi, bEnd: bi });
    } else {
      hunks.push({ type: "insert", aStart: ai, aEnd: ai, bStart: bi, bEnd: b.length });
    }
  }

  return hunks;
}

/**
 * Three-way merge using diff3 approach:
 * 1. Diff original→main to get main's changes
 * 2. Diff original→task to get task's changes
 * 3. Apply both change sets, detecting true conflicts only where both
 *    modified the same region of the original.
 */
function threeWayMerge(original: string, main: string, task: string): { merged: string; hasConflict: boolean } {
  // Fast paths
  if (main === task) return { merged: main, hasConflict: false };
  if (main === original) return { merged: task, hasConflict: false };
  if (task === original) return { merged: main, hasConflict: false };

  const origLines = original.split("\n");
  const mainLines = main.split("\n");
  const taskLines = task.split("\n");

  // Compute what main changed relative to original
  const mainDiff = computeDiff(origLines, mainLines);
  const taskDiff = computeDiff(origLines, taskLines);

  // Build a map of original line ranges that were changed by each side
  type Change = { origStart: number; origEnd: number; newLines: string[] };

  function extractChanges(hunks: DiffHunk[], bLines: string[]): Change[] {
    const changes: Change[] = [];
    for (const h of hunks) {
      if (h.type !== "equal") {
        changes.push({
          origStart: h.aStart,
          origEnd: h.aEnd,
          newLines: bLines.slice(h.bStart, h.bEnd),
        });
      }
    }
    return changes;
  }

  const mainChanges = extractChanges(mainDiff, mainLines);
  const taskChanges = extractChanges(taskDiff, taskLines);

  // Check for overlapping changes (conflicts)
  function overlaps(a: Change, b: Change): boolean {
    // Two regions overlap if they touch any of the same original lines
    // or if both are insertions at the same point
    if (a.origStart === a.origEnd && b.origStart === b.origEnd) {
      return a.origStart === b.origStart;
    }
    return a.origStart < b.origEnd && b.origStart < a.origEnd;
  }

  // Build the merged result by applying non-conflicting changes
  // and marking conflicts
  const result: string[] = [];
  let hasConflict = false;

  // Merge changes into a unified timeline
  type MergeOp = { origStart: number; origEnd: number; mainNew?: string[]; taskNew?: string[]; conflict: boolean };
  const ops: MergeOp[] = [];

  // Collect all changed regions
  const allRegions: { origStart: number; origEnd: number; side: "main" | "task"; newLines: string[] }[] = [];
  for (const c of mainChanges) allRegions.push({ ...c, side: "main" });
  for (const c of taskChanges) allRegions.push({ ...c, side: "task" });
  allRegions.sort((a, b) => a.origStart - b.origStart || a.origEnd - b.origEnd);

  // Process regions, merging overlapping ones
  let idx = 0;
  while (idx < allRegions.length) {
    const region = allRegions[idx];
    // Check if the next region from the other side overlaps
    let conflicting = false;
    let mergedEnd = region.origEnd;
    const mainParts: string[] = region.side === "main" ? region.newLines : [];
    const taskParts: string[] = region.side === "task" ? region.newLines : [];

    let next = idx + 1;
    while (next < allRegions.length && allRegions[next].origStart < mergedEnd + 1) {
      const nr = allRegions[next];
      if (nr.side !== region.side || overlaps(region, nr)) {
        if (nr.side !== region.side) conflicting = true;
        mergedEnd = Math.max(mergedEnd, nr.origEnd);
        if (nr.side === "main") mainParts.push(...nr.newLines);
        else taskParts.push(...nr.newLines);
      }
      next++;
    }

    ops.push({
      origStart: region.origStart,
      origEnd: Math.max(mergedEnd, region.origEnd),
      mainNew: mainParts.length > 0 ? mainParts : undefined,
      taskNew: taskParts.length > 0 ? taskParts : undefined,
      conflict: conflicting,
    });

    idx = next > idx + 1 ? next : idx + 1;
  }

  // Build the merged output
  let origIdx = 0;
  for (const op of ops) {
    // Copy unchanged lines before this operation
    while (origIdx < op.origStart && origIdx < origLines.length) {
      result.push(origLines[origIdx]);
      origIdx++;
    }

    if (op.conflict) {
      hasConflict = true;
      result.push("<<<<<<< MAIN");
      if (op.mainNew) result.push(...op.mainNew);
      result.push("=======");
      if (op.taskNew) result.push(...op.taskNew);
      result.push(">>>>>>> TASK");
    } else {
      // Non-conflicting change — apply whichever side changed
      if (op.mainNew && op.mainNew.length > 0) {
        result.push(...op.mainNew);
      } else if (op.taskNew && op.taskNew.length > 0) {
        result.push(...op.taskNew);
      }
    }

    origIdx = op.origEnd;
  }

  // Copy remaining original lines
  while (origIdx < origLines.length) {
    result.push(origLines[origIdx]);
    origIdx++;
  }

  return { merged: result.join("\n"), hasConflict };
}

export async function mergeTaskToMain(
  taskId: string,
  projectId: string,
): Promise<MergeResult> {
  try {
    const snapshots = await storage.getTaskFileSnapshots(taskId);
    const modifiedSnapshots = snapshots.filter(s => s.isModified);

    if (modifiedSnapshots.length === 0) {
      return { success: true, appliedFiles: [], conflicts: [] };
    }

    const mainFiles = await storage.getFiles(projectId);
    const mainFileMap = new Map(mainFiles.map(f => [f.filename, f]));

    const appliedFiles: string[] = [];
    const conflicts: MergeConflict[] = [];

    for (const snapshot of modifiedSnapshots) {
      const mainFile = mainFileMap.get(snapshot.filename);

      // New file created by task
      if (!mainFile) {
        if (!snapshot.originalContent || snapshot.originalContent === "") {
          // Truly new file
          await storage.createFile(projectId, {
            filename: snapshot.filename,
            content: snapshot.content,
            isBinary: false,
          });
          appliedFiles.push(snapshot.filename);
        } else {
          // File was deleted in main but modified in task
          conflicts.push({
            filename: snapshot.filename,
            type: "deleted_in_main",
            taskContent: snapshot.content,
            originalContent: snapshot.originalContent,
          });
        }
        continue;
      }

      // File unchanged in main — safe to apply task changes directly
      if (mainFile.content === snapshot.originalContent) {
        await storage.updateFileContent(mainFile.id, snapshot.content);
        appliedFiles.push(snapshot.filename);
        continue;
      }

      // Both sides modified — perform three-way merge
      const { merged, hasConflict } = threeWayMerge(
        snapshot.originalContent,
        mainFile.content,
        snapshot.content,
      );

      if (hasConflict) {
        conflicts.push({
          filename: snapshot.filename,
          type: "modified_both",
          mainContent: mainFile.content,
          taskContent: snapshot.content,
          originalContent: snapshot.originalContent,
          mergedWithMarkers: merged,
        });
      } else {
        // Clean merge — apply
        await storage.updateFileContent(mainFile.id, merged);
        appliedFiles.push(snapshot.filename);
      }
    }

    // Check for files deleted in task but modified in main
    for (const snapshot of snapshots) {
      if (snapshot.isModified) continue; // already handled above
      const mainFile = mainFileMap.get(snapshot.filename);
      if (mainFile && mainFile.content !== snapshot.originalContent) {
        // Main modified a file the task didn't touch — that's fine, no conflict
        continue;
      }
    }

    log(`Merged task ${taskId}: ${appliedFiles.length} applied, ${conflicts.length} conflicts`, "task");

    return {
      success: conflicts.length === 0,
      appliedFiles,
      conflicts,
    };
  } catch (err: any) {
    log(`Merge failed for task ${taskId}: ${err.message}`, "task");
    return {
      success: false,
      appliedFiles: [],
      conflicts: [],
      error: err.message,
    };
  }
}

/**
 * Resolve a single conflict by choosing a resolution strategy.
 */
export async function resolveConflict(
  taskId: string,
  projectId: string,
  filename: string,
  resolution: "accept_main" | "accept_task" | "accept_merged",
  manualContent?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const mainFiles = await storage.getFiles(projectId);
    const mainFile = mainFiles.find(f => f.filename === filename);
    const snapshot = (await storage.getTaskFileSnapshots(taskId)).find(s => s.filename === filename);

    if (!snapshot) return { success: false, error: "Snapshot not found" };

    let resolvedContent: string;

    switch (resolution) {
      case "accept_main":
        // Keep main's version (do nothing to the file)
        return { success: true };

      case "accept_task":
        resolvedContent = snapshot.content;
        break;

      case "accept_merged":
        if (!manualContent) return { success: false, error: "Merged content is required" };
        resolvedContent = manualContent;
        break;

      default:
        return { success: false, error: "Invalid resolution strategy" };
    }

    if (mainFile) {
      await storage.updateFileContent(mainFile.id, resolvedContent);
    } else {
      await storage.createFile(projectId, {
        filename,
        content: resolvedContent,
        isBinary: false,
      });
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getTaskDiff(taskId: string): Promise<{ filename: string; added: number; removed: number; modified: boolean }[]> {
  const snapshots = await storage.getTaskFileSnapshots(taskId);
  const diffs: { filename: string; added: number; removed: number; modified: boolean }[] = [];

  for (const snapshot of snapshots) {
    if (!snapshot.isModified) continue;

    const origLines = snapshot.originalContent.split("\n");
    const newLines = snapshot.content.split("\n");

    // Use LCS-based diff for accurate counts
    const diffHunks = computeDiff(origLines, newLines);
    let added = 0;
    let removed = 0;

    for (const h of diffHunks) {
      if (h.type === "insert") {
        added += h.bEnd - h.bStart;
      } else if (h.type === "delete") {
        removed += h.aEnd - h.aStart;
      } else if (h.type === "replace") {
        added += h.bEnd - h.bStart;
        removed += h.aEnd - h.aStart;
      }
    }

    diffs.push({ filename: snapshot.filename, added, removed, modified: true });
  }

  return diffs;
}
