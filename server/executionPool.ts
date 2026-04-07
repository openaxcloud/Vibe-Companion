class ExecutionPool {
  private running = 0;
  private maxConcurrent: number;
  private queue: Array<{ resolve: () => void }> = [];

  constructor(maxConcurrent = 10) {
    this.maxConcurrent = maxConcurrent;
    console.log(`Execution pool initialized`);
  }

  async acquire(): Promise<void> {
    if (this.running < this.maxConcurrent) {
      this.running++;
      return;
    }
    return new Promise((resolve) => {
      this.queue.push({ resolve });
    });
  }

  release(): void {
    this.running--;
    const next = this.queue.shift();
    if (next) {
      this.running++;
      next.resolve();
    }
  }

  get active(): number {
    return this.running;
  }

  get pending(): number {
    return this.queue.length;
  }
}

export const executionPool = new ExecutionPool();
