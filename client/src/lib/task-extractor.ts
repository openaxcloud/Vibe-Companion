/**
 * Task Extractor - Parses AI response text to extract structured tasks
 * This enables Replit-like task display from agent planning messages
 */

export interface ExtractedTask {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  estimatedTime?: string;
}

/**
 * Extracts tasks from markdown-formatted AI response text
 * Supports various formats:
 * - Numbered lists: 1. Task name
 * - Bullet lists: - Task name
 * - Checkbox lists: - [ ] Task name, - [x] Completed task
 * - Headers with lists: ## Phase 1 \n - Task
 */
export function extractTasksFromText(content: string): ExtractedTask[] {
  const tasks: ExtractedTask[] = [];
  
  if (!content) return tasks;
  
  // Split into lines for processing
  const lines = content.split('\n');
  let taskIndex = 0;
  let currentPhase = '';
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Detect phase/section headers (e.g., "## Phase 1", "### Step 1")
    const headerMatch = trimmed.match(/^#{1,3}\s+(.+)$/);
    if (headerMatch) {
      currentPhase = headerMatch[1];
      continue;
    }
    
    // Match checkbox format: - [ ] Task or - [x] Completed
    const checkboxMatch = trimmed.match(/^[-*]\s*\[([ xX])\]\s*(.+)$/);
    if (checkboxMatch) {
      const isCompleted = checkboxMatch[1].toLowerCase() === 'x';
      const title = checkboxMatch[2].trim();
      
      tasks.push({
        id: `task-${taskIndex++}`,
        title: currentPhase ? `${currentPhase}: ${title}` : title,
        status: isCompleted ? 'completed' : 'pending'
      });
      continue;
    }
    
    // Match numbered lists: 1. Task, 2) Task
    const numberedMatch = trimmed.match(/^(\d+)[.)]\s+(.+)$/);
    if (numberedMatch) {
      const title = numberedMatch[2].trim();
      
      // Skip generic explanatory text (usually short phrases that aren't tasks)
      if (looksLikeTask(title)) {
        tasks.push({
          id: `task-${taskIndex++}`,
          title,
          status: 'pending'
        });
      }
      continue;
    }
    
    // Match bullet lists: - Task, * Task
    const bulletMatch = trimmed.match(/^[-*]\s+(.+)$/);
    if (bulletMatch) {
      const title = bulletMatch[1].trim();
      
      // Skip if it looks like a feature description rather than a task
      if (looksLikeTask(title) && title.length > 3) {
        tasks.push({
          id: `task-${taskIndex++}`,
          title,
          status: 'pending'
        });
      }
      continue;
    }
  }
  
  return tasks;
}

/**
 * Heuristic to determine if text looks like a task vs explanation
 * Tasks typically start with action verbs
 */
function looksLikeTask(text: string): boolean {
  const lower = text.toLowerCase();
  
  // Skip very short text
  if (text.length < 5) return false;
  
  // Skip explanatory phrases
  const skipPatterns = [
    /^this (is|will|means)/,
    /^here (is|are)/,
    /^(note|tip|warning|important):/i,
    /^(for example|e\.g\.|i\.e\.)/,
    /^(see|refer to)/,
    /^to (understand|learn|see)/
  ];
  
  for (const pattern of skipPatterns) {
    if (pattern.test(lower)) return false;
  }
  
  // Tasks often start with action verbs
  const actionVerbs = [
    'create', 'add', 'build', 'implement', 'design', 'develop',
    'set up', 'setup', 'configure', 'install', 'update', 'modify',
    'write', 'define', 'make', 'enable', 'fix', 'resolve', 
    'integrate', 'connect', 'deploy', 'test', 'validate', 'verify',
    'remove', 'delete', 'refactor', 'optimize', 'improve', 'enhance',
    'generate', 'run', 'execute', 'start', 'initialize', 'init',
    'style', 'format', 'render', 'display', 'show', 'hide'
  ];
  
  const startsWithAction = actionVerbs.some(verb => lower.startsWith(verb));
  
  // Also accept if it contains file paths or technical terms
  const hasTechnicalContent = /\.(ts|js|tsx|jsx|css|html|json|py|go|rs)/.test(text) ||
    /component|function|class|module|api|endpoint|route|page|schema/i.test(text);
  
  return startsWithAction || hasTechnicalContent;
}

/**
 * Check if message content contains a plan or task list
 */
export function containsPlanOrTasks(content: string): boolean {
  if (!content) return false;
  
  // Check for plan indicators
  const planIndicators = [
    /\bplan\b/i,
    /\bstep\s*\d/i,
    /\bphase\s*\d/i,
    /\btask(s)?\b/i,
    /\bimplementation\b/i,
    /will\s+(create|build|implement|add|develop)/i,
    /let me (create|build|implement|add|develop)/i,
    /here('s| is) (the|my) (plan|approach)/i,
    /^\s*(\d+\.|[-*])\s+/m  // Has numbered or bullet lists
  ];
  
  return planIndicators.some(pattern => pattern.test(content));
}

/**
 * Extract and format tasks with proper status based on message context
 */
export function extractAndFormatTasks(
  content: string, 
  isComplete: boolean = false
): ExtractedTask[] {
  const tasks = extractTasksFromText(content);
  
  // If the overall work is complete, mark all tasks as completed
  if (isComplete) {
    return tasks.map(task => ({
      ...task,
      status: 'completed' as const
    }));
  }
  
  // Mark first pending task as in_progress
  let foundFirst = false;
  return tasks.map(task => {
    if (!foundFirst && task.status === 'pending') {
      foundFirst = true;
      return { ...task, status: 'in_progress' as const };
    }
    return task;
  });
}
