import { spawn, exec } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface ExecutionOptions {
  language: string;
  code: string;
  stdin?: string;
  timeout?: number;
  memoryLimit?: number;
  cpuLimit?: number;
}

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTime: number;
  memoryUsed?: number;
}

export class ContainerExecutor {
  private containersDir: string;
  
  constructor() {
    this.containersDir = path.join(process.cwd(), 'containers');
  }

  async init() {
    await fs.mkdir(this.containersDir, { recursive: true });
    await this.setupSeccompProfile();
  }

  private async setupSeccompProfile() {
    const seccompProfile = {
      defaultAction: 'SCMP_ACT_ERRNO',
      syscalls: [
        {
          names: [
            'read', 'write', 'open', 'close', 'stat', 'fstat', 'lstat',
            'poll', 'lseek', 'mmap', 'mprotect', 'munmap', 'brk',
            'rt_sigaction', 'rt_sigprocmask', 'ioctl', 'pread64', 'pwrite64',
            'readv', 'writev', 'access', 'pipe', 'select', 'sched_yield',
            'mremap', 'msync', 'mincore', 'madvise', 'shmget', 'shmat',
            'shmctl', 'dup', 'dup2', 'pause', 'nanosleep', 'getitimer',
            'alarm', 'setitimer', 'getpid', 'sendfile', 'socket', 'connect',
            'accept', 'sendto', 'recvfrom', 'sendmsg', 'recvmsg', 'shutdown',
            'bind', 'listen', 'getsockname', 'getpeername', 'socketpair',
            'setsockopt', 'getsockopt', 'clone', 'fork', 'vfork', 'execve',
            'exit', 'wait4', 'kill', 'uname', 'semget', 'semop', 'semctl',
            'shmdt', 'msgget', 'msgsnd', 'msgrcv', 'msgctl', 'fcntl',
            'flock', 'fsync', 'fdatasync', 'truncate', 'ftruncate',
            'getdents', 'getcwd', 'chdir', 'fchdir', 'rename', 'mkdir',
            'rmdir', 'creat', 'link', 'unlink', 'symlink', 'readlink',
            'chmod', 'fchmod', 'chown', 'fchown', 'lchown', 'umask',
            'gettimeofday', 'getrlimit', 'getrusage', 'sysinfo', 'times',
            'ptrace', 'getuid', 'syslog', 'getgid', 'setuid', 'setgid',
            'geteuid', 'getegid', 'setpgid', 'getppid', 'getpgrp', 'setsid',
            'setreuid', 'setregid', 'getgroups', 'setgroups', 'setresuid',
            'getresuid', 'setresgid', 'getresgid', 'getpgid', 'setfsuid',
            'setfsgid', 'getsid', 'capget', 'capset', 'rt_sigpending',
            'rt_sigtimedwait', 'rt_sigqueueinfo', 'rt_sigsuspend', 'sigaltstack',
            'utime', 'mknod', 'uselib', 'personality', 'ustat', 'statfs',
            'fstatfs', 'sysfs', 'getpriority', 'setpriority', 'sched_setparam',
            'sched_getparam', 'sched_setscheduler', 'sched_getscheduler',
            'sched_get_priority_max', 'sched_get_priority_min', 'sched_rr_get_interval',
            'mlock', 'munlock', 'mlockall', 'munlockall', 'vhangup', 'modify_ldt',
            'pivot_root', '_sysctl', 'prctl', 'arch_prctl', 'adjtimex',
            'setrlimit', 'chroot', 'sync', 'acct', 'settimeofday', 'mount',
            'umount2', 'swapon', 'swapoff', 'reboot', 'sethostname',
            'setdomainname', 'iopl', 'ioperm', 'create_module', 'init_module',
            'delete_module', 'get_kernel_syms', 'query_module', 'quotactl',
            'nfsservctl', 'getpmsg', 'putpmsg', 'afs_syscall', 'tuxcall',
            'security', 'gettid', 'readahead', 'setxattr', 'lsetxattr',
            'fsetxattr', 'getxattr', 'lgetxattr', 'fgetxattr', 'listxattr',
            'llistxattr', 'flistxattr', 'removexattr', 'lremovexattr',
            'fremovexattr', 'tkill', 'time', 'futex', 'sched_setaffinity',
            'sched_getaffinity', 'set_thread_area', 'io_setup', 'io_destroy',
            'io_getevents', 'io_submit', 'io_cancel', 'get_thread_area',
            'lookup_dcookie', 'epoll_create', 'epoll_ctl_old', 'epoll_wait_old',
            'remap_file_pages', 'getdents64', 'set_tid_address', 'restart_syscall',
            'semtimedop', 'fadvise64', 'timer_create', 'timer_settime',
            'timer_gettime', 'timer_getoverrun', 'timer_delete', 'clock_settime',
            'clock_gettime', 'clock_getres', 'clock_nanosleep', 'exit_group',
            'epoll_wait', 'epoll_ctl', 'tgkill', 'utimes', 'vserver', 'mbind',
            'set_mempolicy', 'get_mempolicy', 'mq_open', 'mq_unlink',
            'mq_timedsend', 'mq_timedreceive', 'mq_notify', 'mq_getsetattr',
            'kexec_load', 'waitid', 'add_key', 'request_key', 'keyctl',
            'ioprio_set', 'ioprio_get', 'inotify_init', 'inotify_add_watch',
            'inotify_rm_watch', 'migrate_pages', 'openat', 'mkdirat', 'mknodat',
            'fchownat', 'futimesat', 'newfstatat', 'unlinkat', 'renameat',
            'linkat', 'symlinkat', 'readlinkat', 'fchmodat', 'faccessat',
            'pselect6', 'ppoll', 'unshare', 'set_robust_list', 'get_robust_list',
            'splice', 'tee', 'sync_file_range', 'vmsplice', 'move_pages',
            'utimensat', 'epoll_pwait', 'signalfd', 'timerfd_create', 'eventfd',
            'fallocate', 'timerfd_settime', 'timerfd_gettime', 'accept4',
            'signalfd4', 'eventfd2', 'epoll_create1', 'dup3', 'pipe2',
            'inotify_init1', 'preadv', 'pwritev', 'rt_tgsigqueueinfo',
            'perf_event_open', 'recvmmsg', 'fanotify_init', 'fanotify_mark',
            'prlimit64', 'name_to_handle_at', 'open_by_handle_at', 'clock_adjtime',
            'syncfs', 'sendmmsg', 'setns', 'getcpu', 'process_vm_readv',
            'process_vm_writev', 'kcmp', 'finit_module'
          ],
          action: 'SCMP_ACT_ALLOW'
        }
      ]
    };

    const profilePath = path.join(this.containersDir, 'seccomp.json');
    await fs.writeFile(profilePath, JSON.stringify(seccompProfile, null, 2));
  }

  async execute(options: ExecutionOptions): Promise<ExecutionResult> {
    const containerId = crypto.randomBytes(16).toString('hex');
    const containerDir = path.join(this.containersDir, containerId);
    
    try {
      // Create container directory
      await fs.mkdir(containerDir, { recursive: true });
      
      // Write code to file
      const codeFile = await this.writeCodeFile(containerDir, options.language, options.code);
      
      // Build Docker image for the language if not exists
      await this.ensureDockerImage(options.language);
      
      // Execute in container
      const result = await this.runInContainer(containerId, options.language, codeFile, options);
      
      return result;
    } finally {
      // Cleanup
      await fs.rm(containerDir, { recursive: true, force: true });
    }
  }

  private async writeCodeFile(containerDir: string, language: string, code: string): Promise<string> {
    const extensions: Record<string, string> = {
      python: 'py',
      javascript: 'js',
      typescript: 'ts',
      java: 'java',
      cpp: 'cpp',
      c: 'c',
      go: 'go',
      rust: 'rs',
      ruby: 'rb',
      php: 'php',
    };

    const extension = extensions[language] || 'txt';
    const fileName = `main.${extension}`;
    const filePath = path.join(containerDir, fileName);
    
    await fs.writeFile(filePath, code);
    return fileName;
  }

  private async ensureDockerImage(language: string): Promise<void> {
    const dockerfiles: Record<string, string> = {
      python: `
FROM python:3.11-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /code
`,
      javascript: `
FROM node:20-slim
WORKDIR /code
`,
      typescript: `
FROM node:20-slim
RUN npm install -g typescript ts-node
WORKDIR /code
`,
      java: `
FROM openjdk:17-slim
WORKDIR /code
`,
      cpp: `
FROM gcc:latest
WORKDIR /code
`,
      c: `
FROM gcc:latest
WORKDIR /code
`,
      go: `
FROM golang:1.21-alpine
WORKDIR /code
`,
      rust: `
FROM rust:latest
WORKDIR /code
`,
      ruby: `
FROM ruby:3.2-slim
WORKDIR /code
`,
      php: `
FROM php:8.2-cli
WORKDIR /code
`,
    };

    const dockerfile = dockerfiles[language];
    if (!dockerfile) {
      throw new Error(`Unsupported language: ${language}`);
    }

    const imageName = `e-code-${language}:latest`;
    
    // Check if image exists
    try {
      await execAsync(`docker image inspect ${imageName}`);
    } catch {
      // Build image
      const dockerfilePath = path.join(this.containersDir, `Dockerfile.${language}`);
      await fs.writeFile(dockerfilePath, dockerfile);
      await execAsync(`docker build -t ${imageName} -f ${dockerfilePath} .`);
    }
  }

  private async runInContainer(
    containerId: string,
    language: string,
    codeFile: string,
    options: ExecutionOptions
  ): Promise<ExecutionResult> {
    const imageName = `e-code-${language}:latest`;
    const containerDir = path.join(this.containersDir, containerId);
    
    const commands: Record<string, string> = {
      python: `python ${codeFile}`,
      javascript: `node ${codeFile}`,
      typescript: `ts-node ${codeFile}`,
      java: `javac ${codeFile} && java ${codeFile.replace('.java', '')}`,
      cpp: `g++ -o main ${codeFile} && ./main`,
      c: `gcc -o main ${codeFile} && ./main`,
      go: `go run ${codeFile}`,
      rust: `rustc ${codeFile} -o main && ./main`,
      ruby: `ruby ${codeFile}`,
      php: `php ${codeFile}`,
    };

    const command = commands[language];
    if (!command) {
      throw new Error(`No command defined for language: ${language}`);
    }

    const dockerCmd = [
      'docker', 'run',
      '--rm',
      '--network', 'none',
      '--memory', `${options.memoryLimit || 512}m`,
      '--cpus', `${options.cpuLimit || 0.5}`,
      '--security-opt', `seccomp=${path.join(this.containersDir, 'seccomp.json')}`,
      '-v', `${containerDir}:/code:ro`,
      imageName,
      '/bin/sh', '-c', command
    ];

    return new Promise((resolve) => {
      const startTime = Date.now();
      let stdout = '';
      let stderr = '';
      
      const proc = spawn(dockerCmd[0], dockerCmd.slice(1));
      
      // Set timeout
      const timeout = setTimeout(() => {
        proc.kill('SIGKILL');
      }, options.timeout || 10000);

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        clearTimeout(timeout);
        const executionTime = Date.now() - startTime;
        
        resolve({
          stdout,
          stderr,
          exitCode: code || 0,
          executionTime,
        });
      });

      // Send stdin if provided
      if (options.stdin) {
        proc.stdin.write(options.stdin);
        proc.stdin.end();
      }
    });
  }
}

export const containerExecutor = new ContainerExecutor();