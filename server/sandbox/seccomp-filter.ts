/**
 * Seccomp (Secure Computing Mode) filter builder for Linux sandboxing
 * Generates BPF (Berkeley Packet Filter) programs for syscall filtering
 */

export interface SeccompRule {
  syscall: string | number;
  action: 'allow' | 'deny' | 'trace' | 'kill' | 'errno';
  args?: {
    index: number;
    op: 'eq' | 'ne' | 'gt' | 'ge' | 'lt' | 'le' | 'masked_eq';
    value: number;
    mask?: number;
  }[];
  errno?: number;
}

export interface SeccompFilter {
  defaultAction: 'allow' | 'deny' | 'trace' | 'kill';
  rules: SeccompRule[];
  architecture?: string;
}

// Syscall numbers for x86_64 architecture
export const SYSCALL_NUMBERS_X64: Record<string, number> = {
  read: 0,
  write: 1,
  open: 2,
  close: 3,
  stat: 4,
  fstat: 5,
  lstat: 6,
  poll: 7,
  lseek: 8,
  mmap: 9,
  mprotect: 10,
  munmap: 11,
  brk: 12,
  rt_sigaction: 13,
  rt_sigprocmask: 14,
  rt_sigreturn: 15,
  ioctl: 16,
  pread64: 17,
  pwrite64: 18,
  readv: 19,
  writev: 20,
  access: 21,
  pipe: 22,
  select: 23,
  sched_yield: 24,
  mremap: 25,
  msync: 26,
  mincore: 27,
  madvise: 28,
  shmget: 29,
  shmat: 30,
  shmctl: 31,
  dup: 32,
  dup2: 33,
  pause: 34,
  nanosleep: 35,
  getitimer: 36,
  alarm: 37,
  setitimer: 38,
  getpid: 39,
  sendfile: 40,
  socket: 41,
  connect: 42,
  accept: 43,
  sendto: 44,
  recvfrom: 45,
  sendmsg: 46,
  recvmsg: 47,
  shutdown: 48,
  bind: 49,
  listen: 50,
  getsockname: 51,
  getpeername: 52,
  socketpair: 53,
  setsockopt: 54,
  getsockopt: 55,
  clone: 56,
  fork: 57,
  vfork: 58,
  execve: 59,
  exit: 60,
  wait4: 61,
  kill: 62,
  uname: 63,
  semget: 64,
  semop: 65,
  semctl: 66,
  shmdt: 67,
  msgget: 68,
  msgsnd: 69,
  msgrcv: 70,
  msgctl: 71,
  fcntl: 72,
  flock: 73,
  fsync: 74,
  fdatasync: 75,
  truncate: 76,
  ftruncate: 77,
  getdents: 78,
  getcwd: 79,
  chdir: 80,
  fchdir: 81,
  rename: 82,
  mkdir: 83,
  rmdir: 84,
  creat: 85,
  link: 86,
  unlink: 87,
  symlink: 88,
  readlink: 89,
  chmod: 90,
  fchmod: 91,
  chown: 92,
  fchown: 93,
  lchown: 94,
  umask: 95,
  gettimeofday: 96,
  getrlimit: 97,
  getrusage: 98,
  sysinfo: 99,
  times: 100,
  ptrace: 101,
  getuid: 102,
  syslog: 103,
  getgid: 104,
  setuid: 105,
  setgid: 106,
  geteuid: 107,
  getegid: 108,
  setpgid: 109,
  getppid: 110,
  getpgrp: 111,
  setsid: 112,
  setreuid: 113,
  setregid: 114,
  getgroups: 115,
  setgroups: 116,
  setresuid: 117,
  getresuid: 118,
  setresgid: 119,
  getresgid: 120,
  getpgid: 121,
  setfsuid: 122,
  setfsgid: 123,
  getsid: 124,
  capget: 125,
  capset: 126,
  rt_sigpending: 127,
  rt_sigtimedwait: 128,
  rt_sigqueueinfo: 129,
  rt_sigsuspend: 130,
  sigaltstack: 131,
  utime: 132,
  mknod: 133,
  uselib: 134,
  personality: 135,
  ustat: 136,
  statfs: 137,
  fstatfs: 138,
  sysfs: 139,
  getpriority: 140,
  setpriority: 141,
  sched_setparam: 142,
  sched_getparam: 143,
  sched_setscheduler: 144,
  sched_getscheduler: 145,
  sched_get_priority_max: 146,
  sched_get_priority_min: 147,
  sched_rr_get_interval: 148,
  mlock: 149,
  munlock: 150,
  mlockall: 151,
  munlockall: 152,
  vhangup: 153,
  modify_ldt: 154,
  pivot_root: 155,
  _sysctl: 156,
  prctl: 157,
  arch_prctl: 158,
  adjtimex: 159,
  setrlimit: 160,
  chroot: 161,
  sync: 162,
  acct: 163,
  settimeofday: 164,
  mount: 165,
  umount2: 166,
  swapon: 167,
  swapoff: 168,
  reboot: 169,
  sethostname: 170,
  setdomainname: 171,
  iopl: 172,
  ioperm: 173,
  create_module: 174,
  init_module: 175,
  delete_module: 176,
  get_kernel_syms: 177,
  query_module: 178,
  quotactl: 179,
  nfsservctl: 180,
  getpmsg: 181,
  putpmsg: 182,
  afs_syscall: 183,
  tuxcall: 184,
  security: 185,
  gettid: 186,
  readahead: 187,
  setxattr: 188,
  lsetxattr: 189,
  fsetxattr: 190,
  getxattr: 191,
  lgetxattr: 192,
  fgetxattr: 193,
  listxattr: 194,
  llistxattr: 195,
  flistxattr: 196,
  removexattr: 197,
  lremovexattr: 198,
  fremovexattr: 199,
  tkill: 200,
  time: 201,
  futex: 202,
  sched_setaffinity: 203,
  sched_getaffinity: 204,
  set_thread_area: 205,
  io_setup: 206,
  io_destroy: 207,
  io_getevents: 208,
  io_submit: 209,
  io_cancel: 210,
  get_thread_area: 211,
  lookup_dcookie: 212,
  epoll_create: 213,
  epoll_ctl_old: 214,
  epoll_wait_old: 215,
  remap_file_pages: 216,
  getdents64: 217,
  set_tid_address: 218,
  restart_syscall: 219,
  semtimedop: 220,
  fadvise64: 221,
  timer_create: 222,
  timer_settime: 223,
  timer_gettime: 224,
  timer_getoverrun: 225,
  timer_delete: 226,
  clock_settime: 227,
  clock_gettime: 228,
  clock_getres: 229,
  clock_nanosleep: 230,
  exit_group: 231,
  epoll_wait: 232,
  epoll_ctl: 233,
  tgkill: 234,
  utimes: 235,
  vserver: 236,
  mbind: 237,
  set_mempolicy: 238,
  get_mempolicy: 239,
  mq_open: 240,
  mq_unlink: 241,
  mq_timedsend: 242,
  mq_timedreceive: 243,
  mq_notify: 244,
  mq_getsetattr: 245,
  kexec_load: 246,
  waitid: 247,
  add_key: 248,
  request_key: 249,
  keyctl: 250,
  ioprio_set: 251,
  ioprio_get: 252,
  inotify_init: 253,
  inotify_add_watch: 254,
  inotify_rm_watch: 255,
  migrate_pages: 256,
  openat: 257,
  mkdirat: 258,
  mknodat: 259,
  fchownat: 260,
  futimesat: 261,
  newfstatat: 262,
  unlinkat: 263,
  renameat: 264,
  linkat: 265,
  symlinkat: 266,
  readlinkat: 267,
  fchmodat: 268,
  faccessat: 269,
  pselect6: 270,
  ppoll: 271,
  unshare: 272,
  set_robust_list: 273,
  get_robust_list: 274,
  splice: 275,
  tee: 276,
  sync_file_range: 277,
  vmsplice: 278,
  move_pages: 279,
  utimensat: 280,
  epoll_pwait: 281,
  signalfd: 282,
  timerfd_create: 283,
  eventfd: 284,
  fallocate: 285,
  timerfd_settime: 286,
  timerfd_gettime: 287,
  accept4: 288,
  signalfd4: 289,
  eventfd2: 290,
  epoll_create1: 291,
  dup3: 292,
  pipe2: 293,
  inotify_init1: 294,
  preadv: 295,
  pwritev: 296,
  rt_tgsigqueueinfo: 297,
  perf_event_open: 298,
  recvmmsg: 299,
  fanotify_init: 300,
  fanotify_mark: 301,
  prlimit64: 302,
  name_to_handle_at: 303,
  open_by_handle_at: 304,
  clock_adjtime: 305,
  syncfs: 306,
  sendmmsg: 307,
  setns: 308,
  getcpu: 309,
  process_vm_readv: 310,
  process_vm_writev: 311,
  kcmp: 312,
  finit_module: 313,
  sched_setattr: 314,
  sched_getattr: 315,
  renameat2: 316,
  seccomp: 317,
  getrandom: 318,
  memfd_create: 319,
  kexec_file_load: 320,
  bpf: 321,
  execveat: 322,
  userfaultfd: 323,
  membarrier: 324,
  mlock2: 325,
  copy_file_range: 326,
  preadv2: 327,
  pwritev2: 328,
  pkey_mprotect: 329,
  pkey_alloc: 330,
  pkey_free: 331,
  statx: 332
};

export class SeccompFilterBuilder {
  private filter: SeccompFilter;

  constructor(defaultAction: 'allow' | 'deny' | 'trace' | 'kill' = 'deny') {
    this.filter = {
      defaultAction,
      rules: [],
      architecture: 'x86_64'
    };
  }

  /**
   * Add a rule to allow a syscall
   */
  allow(syscall: string | number, args?: SeccompRule['args']): this {
    this.filter.rules.push({
      syscall,
      action: 'allow',
      args
    });
    return this;
  }

  /**
   * Add a rule to deny a syscall
   */
  deny(syscall: string | number, args?: SeccompRule['args']): this {
    this.filter.rules.push({
      syscall,
      action: 'deny',
      args
    });
    return this;
  }

  /**
   * Add a rule to trace a syscall (for debugging)
   */
  trace(syscall: string | number, args?: SeccompRule['args']): this {
    this.filter.rules.push({
      syscall,
      action: 'trace',
      args
    });
    return this;
  }

  /**
   * Add a rule to kill the process if syscall is attempted
   */
  kill(syscall: string | number, args?: SeccompRule['args']): this {
    this.filter.rules.push({
      syscall,
      action: 'kill',
      args
    });
    return this;
  }

  /**
   * Add a rule to return an errno value
   */
  errno(syscall: string | number, errno: number, args?: SeccompRule['args']): this {
    this.filter.rules.push({
      syscall,
      action: 'errno',
      errno,
      args
    });
    return this;
  }

  /**
   * Allow multiple syscalls at once
   */
  allowMultiple(syscalls: (string | number)[]): this {
    syscalls.forEach(syscall => this.allow(syscall));
    return this;
  }

  /**
   * Deny multiple syscalls at once
   */
  denyMultiple(syscalls: (string | number)[]): this {
    syscalls.forEach(syscall => this.deny(syscall));
    return this;
  }

  /**
   * Build the filter configuration
   */
  build(): SeccompFilter {
    return { ...this.filter };
  }

  /**
   * Generate libseccomp C code
   */
  generateCCode(): string {
    const lines: string[] = [
      '#include <seccomp.h>',
      '#include <errno.h>',
      '',
      'int setup_seccomp() {',
      '    scmp_filter_ctx ctx;',
      ''
    ];

    // Set default action
    const defaultAction = this.getSeccompAction(this.filter.defaultAction);
    lines.push(`    ctx = seccomp_init(${defaultAction});`);
    lines.push('    if (ctx == NULL) return -1;');
    lines.push('');

    // Add rules
    for (const rule of this.filter.rules) {
      const syscallNum = this.getSyscallNumber(rule.syscall);
      const action = this.getSeccompAction(rule.action, rule.errno);
      
      if (rule.args && rule.args.length > 0) {
        lines.push(`    if (seccomp_rule_add(ctx, ${action}, ${syscallNum},`);
        rule.args.forEach((arg, index) => {
          const cmpOp = this.getCompareOp(arg.op);
          const isLast = index === rule.args!.length - 1;
          const comma = isLast ? '' : ',';
          if (arg.mask !== undefined) {
            lines.push(`        SCMP_A${arg.index}(${cmpOp}, ${arg.value}, ${arg.mask})${comma}`);
          } else {
            lines.push(`        SCMP_A${arg.index}(${cmpOp}, ${arg.value})${comma}`);
          }
        });
        lines.push('    ) < 0) goto error;');
      } else {
        lines.push(`    if (seccomp_rule_add(ctx, ${action}, ${syscallNum}, 0) < 0) goto error;`);
      }
      lines.push('');
    }

    lines.push('    if (seccomp_load(ctx) < 0) goto error;');
    lines.push('    seccomp_release(ctx);');
    lines.push('    return 0;');
    lines.push('');
    lines.push('error:');
    lines.push('    seccomp_release(ctx);');
    lines.push('    return -1;');
    lines.push('}');

    return lines.join('\n');
  }

  /**
   * Generate JSON configuration for seccomp
   */
  generateJSON(): string {
    const config = {
      defaultAction: this.filter.defaultAction.toUpperCase(),
      architectures: [this.filter.architecture],
      syscalls: this.filter.rules.map(rule => {
        const syscallName = typeof rule.syscall === 'string' 
          ? rule.syscall 
          : this.getSyscallName(rule.syscall);
        
        const ruleConfig: any = {
          name: syscallName,
          action: rule.action.toUpperCase()
        };

        if (rule.errno) {
          ruleConfig.errno = rule.errno;
        }

        if (rule.args && rule.args.length > 0) {
          ruleConfig.args = rule.args.map(arg => ({
            index: arg.index,
            value: arg.value,
            op: arg.op.toUpperCase(),
            ...(arg.mask !== undefined && { mask: arg.mask })
          }));
        }

        return ruleConfig;
      })
    };

    return JSON.stringify(config, null, 2);
  }

  private getSyscallNumber(syscall: string | number): number {
    if (typeof syscall === 'number') {
      return syscall;
    }
    const num = SYSCALL_NUMBERS_X64[syscall];
    if (num === undefined) {
      throw new Error(`Unknown syscall: ${syscall}`);
    }
    return num;
  }

  private getSyscallName(num: number): string {
    for (const [name, syscallNum] of Object.entries(SYSCALL_NUMBERS_X64)) {
      if (syscallNum === num) {
        return name;
      }
    }
    return `syscall_${num}`;
  }

  private getSeccompAction(action: string, errno?: number): string {
    switch (action) {
      case 'allow':
        return 'SCMP_ACT_ALLOW';
      case 'deny':
        return 'SCMP_ACT_ERRNO(EPERM)';
      case 'trace':
        return 'SCMP_ACT_TRACE(1)';
      case 'kill':
        return 'SCMP_ACT_KILL';
      case 'errno':
        return `SCMP_ACT_ERRNO(${errno || 'EPERM'})`;
      default:
        return 'SCMP_ACT_ERRNO(EPERM)';
    }
  }

  private getCompareOp(op: string): string {
    switch (op) {
      case 'eq':
        return 'SCMP_CMP_EQ';
      case 'ne':
        return 'SCMP_CMP_NE';
      case 'gt':
        return 'SCMP_CMP_GT';
      case 'ge':
        return 'SCMP_CMP_GE';
      case 'lt':
        return 'SCMP_CMP_LT';
      case 'le':
        return 'SCMP_CMP_LE';
      case 'masked_eq':
        return 'SCMP_CMP_MASKED_EQ';
      default:
        return 'SCMP_CMP_EQ';
    }
  }
}

/**
 * Create a basic seccomp filter for untrusted code
 */
export function createUntrustedFilter(): SeccompFilter {
  return new SeccompFilterBuilder('deny')
    .allowMultiple([
      'read', 'write', 'close', 'fstat', 'lseek', 'mmap', 'mprotect',
      'munmap', 'brk', 'rt_sigaction', 'rt_sigprocmask', 'rt_sigreturn',
      'ioctl', 'access', 'nanosleep', 'getpid', 'gettimeofday', 'getuid',
      'getgid', 'geteuid', 'getegid', 'getppid', 'getpgrp', 'exit',
      'exit_group', 'futex', 'set_tid_address', 'clock_gettime',
      'clock_getres', 'getrandom', 'pread64', 'pwrite64', 'readv',
      'writev', 'pipe', 'select', 'mremap', 'msync', 'mincore', 'madvise',
      'dup', 'dup2', 'fcntl', 'flock', 'fsync', 'fdatasync', 'truncate',
      'ftruncate', 'getcwd', 'chdir', 'fchdir', 'umask', 'gettimeofday',
      'getrlimit', 'getrusage', 'sysinfo', 'times', 'getgroups',
      'setgroups', 'uname', 'prctl', 'arch_prctl', 'set_robust_list',
      'get_robust_list', 'futex', 'epoll_create', 'epoll_ctl', 'epoll_wait',
      'epoll_create1', 'eventfd', 'eventfd2', 'signalfd', 'signalfd4',
      'clone', 'fork', 'vfork', 'execve', 'wait4', 'waitid'
    ])
    // Explicitly deny dangerous syscalls
    .denyMultiple([
      'mount', 'umount', 'umount2', 'pivot_root', 'chroot',
      'setns', 'unshare', 'ptrace', 'process_vm_readv', 'process_vm_writev',
      'kcmp', 'init_module', 'finit_module', 'delete_module',
      'kexec_load', 'kexec_file_load', 'reboot', 'swapon', 'swapoff',
      'iopl', 'ioperm', 'syslog', 'setuid', 'setgid', 'setreuid',
      'setregid', 'setresuid', 'setresgid', 'capset'
    ])
    .build();
}

/**
 * Create a standard seccomp filter for regular user code
 */
export function createStandardFilter(): SeccompFilter {
  return new SeccompFilterBuilder('allow')
    // Deny only the most dangerous syscalls
    .denyMultiple([
      'mount', 'umount', 'umount2', 'pivot_root', 'chroot',
      'setns', 'unshare', 'init_module', 'finit_module', 'delete_module',
      'kexec_load', 'kexec_file_load', 'reboot', 'swapon', 'swapoff',
      'iopl', 'ioperm', 'ptrace'
    ])
    .build();
}

/**
 * Create a privileged seccomp filter (minimal restrictions)
 */
export function createPrivilegedFilter(): SeccompFilter {
  return new SeccompFilterBuilder('allow')
    // Only deny the most critical syscalls
    .denyMultiple([
      'kexec_load', 'kexec_file_load', 'reboot'
    ])
    .build();
}