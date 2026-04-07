export interface SecurityPolicy {
  name: string;
  description: string;
  syscalls: SyscallPolicy;
  capabilities: CapabilityPolicy;
  filesystem: FilesystemPolicy;
  network: NetworkPolicy;
  resources: ResourcePolicy;
}

export interface SyscallPolicy {
  // Allow or deny by default
  defaultAction: 'allow' | 'deny';
  
  // Explicitly allowed syscalls
  allowed: string[];
  
  // Explicitly denied syscalls
  denied: string[];
  
  // Conditional rules
  rules?: SyscallRule[];
}

export interface SyscallRule {
  syscall: string;
  conditions?: {
    args?: number[];
    values?: (number | string)[];
  };
  action: 'allow' | 'deny' | 'trace' | 'kill';
}

export interface CapabilityPolicy {
  // Linux capabilities to drop
  drop: string[];
  
  // Linux capabilities to keep
  keep: string[];
}

export interface FilesystemPolicy {
  // Read-only paths
  readOnly: string[];
  
  // No access paths
  noAccess: string[];
  
  // Writable paths
  writable: string[];
  
  // Temporary directory settings
  tmpSize: number; // in MB
  tmpNoExec: boolean;
}

export interface NetworkPolicy {
  // Enable/disable network
  enabled: boolean;
  
  // IP addresses/ranges allowed
  allowedIPs?: string[];
  
  // Domains allowed
  allowedDomains?: string[];
  
  // Ports allowed
  allowedPorts?: {
    tcp?: number[];
    udp?: number[];
  };
  
  // Rate limiting
  rateLimit?: {
    connections: number;    // max connections per minute
    bandwidth: number;      // max bandwidth in KB/s
  };
}

export interface ResourcePolicy {
  cpu: {
    cores: number;          // CPU cores limit
    shares: number;         // CPU shares (relative weight)
    period: number;         // CPU period in microseconds
    quota: number;          // CPU quota in microseconds
  };
  
  memory: {
    limit: number;          // Memory limit in MB
    swap: number;           // Swap limit in MB
    kernel: number;         // Kernel memory limit in MB
  };
  
  io: {
    readBps: number;        // Read bytes per second
    writeBps: number;       // Write bytes per second
    readIops: number;       // Read I/O operations per second
    writeIops: number;      // Write I/O operations per second
  };
  
  pids: {
    max: number;            // Maximum number of processes
  };
}

// Predefined security policies
export const SecurityPolicies: Record<string, SecurityPolicy> = {
  // Most restrictive - for untrusted code
  untrusted: {
    name: 'untrusted',
    description: 'Highly restrictive policy for untrusted code execution',
    syscalls: {
      defaultAction: 'deny',
      allowed: [
        // Essential syscalls only
        'read', 'write', 'open', 'close', 'stat', 'fstat', 'lstat',
        'poll', 'lseek', 'mmap', 'mprotect', 'munmap', 'brk',
        'rt_sigaction', 'rt_sigprocmask', 'rt_sigreturn',
        'ioctl', 'pread64', 'pwrite64', 'readv', 'writev',
        'access', 'pipe', 'select', 'sched_yield', 'mremap',
        'msync', 'mincore', 'madvise', 'shmget', 'shmat',
        'shmctl', 'dup', 'dup2', 'pause', 'nanosleep',
        'getitimer', 'alarm', 'setitimer', 'getpid', 'sendfile',
        'socket', 'connect', 'accept', 'sendto', 'recvfrom',
        'shutdown', 'bind', 'listen', 'getsockname', 'getpeername',
        'socketpair', 'setsockopt', 'getsockopt', 'clone',
        'fork', 'vfork', 'execve', 'exit', 'wait4', 'kill',
        'uname', 'semget', 'semop', 'semctl', 'shmdt',
        'msgget', 'msgsnd', 'msgrcv', 'msgctl', 'fcntl',
        'flock', 'fsync', 'fdatasync', 'truncate', 'ftruncate',
        'getdents', 'getcwd', 'chdir', 'fchdir', 'rename',
        'mkdir', 'rmdir', 'creat', 'link', 'unlink', 'symlink',
        'readlink', 'chmod', 'fchmod', 'chown', 'fchown',
        'lchown', 'umask', 'gettimeofday', 'getrlimit',
        'getrusage', 'sysinfo', 'times', 'ptrace', 'getuid',
        'syslog', 'getgid', 'setuid', 'setgid', 'geteuid',
        'getegid', 'setpgid', 'getppid', 'getpgrp', 'setsid',
        'setreuid', 'setregid', 'getgroups', 'setgroups',
        'setresuid', 'getresuid', 'setresgid', 'getresgid',
        'getpgid', 'setfsuid', 'setfsgid', 'getsid', 'capget',
        'capset', 'rt_sigpending', 'rt_sigtimedwait',
        'rt_sigqueueinfo', 'rt_sigsuspend', 'sigaltstack',
        'utime', 'mknod', 'uselib', 'personality', 'ustat',
        'statfs', 'fstatfs', 'sysfs', 'getpriority',
        'setpriority', 'sched_setparam', 'sched_getparam',
        'sched_setscheduler', 'sched_getscheduler',
        'sched_get_priority_max', 'sched_get_priority_min',
        'sched_rr_get_interval', 'mlock', 'munlock', 'mlockall',
        'munlockall', 'vhangup', 'modify_ldt', 'pivot_root',
        '_sysctl', 'prctl', 'arch_prctl', 'adjtimex', 'setrlimit',
        'chroot', 'sync', 'acct', 'settimeofday', 'mount',
        'umount2', 'swapon', 'swapoff', 'reboot', 'sethostname',
        'setdomainname', 'iopl', 'ioperm', 'create_module',
        'init_module', 'delete_module', 'get_kernel_syms',
        'query_module', 'quotactl', 'nfsservctl', 'getpmsg',
        'putpmsg', 'afs_syscall', 'tuxcall', 'security',
        'gettid', 'readahead', 'setxattr', 'lsetxattr',
        'fsetxattr', 'getxattr', 'lgetxattr', 'fgetxattr',
        'listxattr', 'llistxattr', 'flistxattr', 'removexattr',
        'lremovexattr', 'fremovexattr', 'tkill', 'time',
        'futex', 'sched_setaffinity', 'sched_getaffinity',
        'set_thread_area', 'io_setup', 'io_destroy', 'io_getevents',
        'io_submit', 'io_cancel', 'get_thread_area',
        'lookup_dcookie', 'epoll_create', 'epoll_ctl_old',
        'epoll_wait_old', 'remap_file_pages', 'getdents64',
        'set_tid_address', 'restart_syscall', 'semtimedop',
        'fadvise64', 'timer_create', 'timer_settime',
        'timer_gettime', 'timer_getoverrun', 'timer_delete',
        'clock_settime', 'clock_gettime', 'clock_getres',
        'clock_nanosleep', 'exit_group', 'epoll_wait',
        'epoll_ctl', 'tgkill', 'utimes', 'vserver', 'mbind',
        'set_mempolicy', 'get_mempolicy', 'mq_open', 'mq_unlink',
        'mq_timedsend', 'mq_timedreceive', 'mq_notify',
        'mq_getsetattr', 'kexec_load', 'waitid', 'add_key',
        'request_key', 'keyctl', 'ioprio_set', 'ioprio_get',
        'inotify_init', 'inotify_add_watch', 'inotify_rm_watch',
        'migrate_pages', 'openat', 'mkdirat', 'mknodat',
        'fchownat', 'futimesat', 'newfstatat', 'unlinkat',
        'renameat', 'linkat', 'symlinkat', 'readlinkat',
        'fchmodat', 'faccessat', 'pselect6', 'ppoll', 'unshare',
        'set_robust_list', 'get_robust_list', 'splice', 'tee',
        'sync_file_range', 'vmsplice', 'move_pages',
        'utimensat', 'epoll_pwait', 'signalfd', 'timerfd_create',
        'eventfd', 'fallocate', 'timerfd_settime',
        'timerfd_gettime', 'accept4', 'signalfd4', 'eventfd2',
        'epoll_create1', 'dup3', 'pipe2', 'inotify_init1',
        'preadv', 'pwritev', 'rt_tgsigqueueinfo',
        'perf_event_open', 'recvmmsg', 'fanotify_init',
        'fanotify_mark', 'prlimit64', 'name_to_handle_at',
        'open_by_handle_at', 'clock_adjtime', 'syncfs',
        'sendmmsg', 'setns', 'getcpu', 'process_vm_readv',
        'process_vm_writev', 'kcmp', 'finit_module',
        'sched_setattr', 'sched_getattr', 'renameat2',
        'seccomp', 'getrandom', 'memfd_create', 'kexec_file_load',
        'bpf', 'execveat', 'userfaultfd', 'membarrier',
        'mlock2', 'copy_file_range', 'preadv2', 'pwritev2',
        'pkey_mprotect', 'pkey_alloc', 'pkey_free', 'statx'
      ],
      denied: [
        // Dangerous syscalls
        'ptrace', 'mount', 'umount', 'chroot', 'pivot_root',
        'setns', 'unshare', 'init_module', 'finit_module',
        'delete_module', 'iopl', 'ioperm', 'swapon', 'swapoff',
        'reboot', 'kexec_load', 'kexec_file_load'
      ],
      rules: []
    },
    capabilities: {
      drop: ['ALL'],
      keep: []
    },
    filesystem: {
      readOnly: ['/bin', '/usr', '/lib', '/lib64'],
      noAccess: ['/proc/sys', '/sys', '/dev'],
      writable: ['/tmp', '/workspace'],
      tmpSize: 100,
      tmpNoExec: true
    },
    network: {
      enabled: false
    },
    resources: {
      cpu: {
        cores: 1,
        shares: 256,
        period: 100000,
        quota: 50000
      },
      memory: {
        limit: 512,
        swap: 0,
        kernel: 64
      },
      io: {
        readBps: 10 * 1024 * 1024,  // 10 MB/s
        writeBps: 10 * 1024 * 1024, // 10 MB/s
        readIops: 1000,
        writeIops: 1000
      },
      pids: {
        max: 50
      }
    }
  },

  // Standard policy - for regular user code
  standard: {
    name: 'standard',
    description: 'Standard policy for regular user code execution',
    syscalls: {
      defaultAction: 'allow',
      allowed: [],
      denied: [
        'mount', 'umount', 'chroot', 'pivot_root', 'setns',
        'unshare', 'init_module', 'finit_module', 'delete_module',
        'iopl', 'ioperm', 'swapon', 'swapoff', 'reboot',
        'kexec_load', 'kexec_file_load', 'ptrace'
      ],
      rules: []
    },
    capabilities: {
      drop: [
        'CAP_SYS_ADMIN', 'CAP_SYS_MODULE', 'CAP_SYS_RAWIO',
        'CAP_SYS_BOOT', 'CAP_SYS_NICE', 'CAP_SYS_RESOURCE',
        'CAP_SYS_TIME', 'CAP_MKNOD', 'CAP_AUDIT_WRITE',
        'CAP_AUDIT_CONTROL'
      ],
      keep: []
    },
    filesystem: {
      readOnly: ['/bin', '/usr', '/lib', '/lib64'],
      noAccess: ['/proc/sys/kernel', '/sys/kernel'],
      writable: ['/tmp', '/workspace', '/home'],
      tmpSize: 500,
      tmpNoExec: false
    },
    network: {
      enabled: true,
      allowedPorts: {
        tcp: [80, 443, 8080, 8443],
        udp: [53]
      },
      rateLimit: {
        connections: 100,
        bandwidth: 1024 // 1 MB/s
      }
    },
    resources: {
      cpu: {
        cores: 2,
        shares: 512,
        period: 100000,
        quota: 100000
      },
      memory: {
        limit: 1024,
        swap: 512,
        kernel: 128
      },
      io: {
        readBps: 50 * 1024 * 1024,  // 50 MB/s
        writeBps: 50 * 1024 * 1024, // 50 MB/s
        readIops: 5000,
        writeIops: 5000
      },
      pids: {
        max: 200
      }
    }
  },

  // Privileged policy - for trusted code
  privileged: {
    name: 'privileged',
    description: 'Privileged policy for trusted code execution',
    syscalls: {
      defaultAction: 'allow',
      allowed: [],
      denied: [
        'kexec_load', 'kexec_file_load', 'reboot'
      ],
      rules: []
    },
    capabilities: {
      drop: ['CAP_SYS_BOOT'],
      keep: []
    },
    filesystem: {
      readOnly: [],
      noAccess: [],
      writable: ['/'],
      tmpSize: 2048,
      tmpNoExec: false
    },
    network: {
      enabled: true
    },
    resources: {
      cpu: {
        cores: 4,
        shares: 1024,
        period: 100000,
        quota: 400000
      },
      memory: {
        limit: 4096,
        swap: 2048,
        kernel: 512
      },
      io: {
        readBps: 0,  // unlimited
        writeBps: 0, // unlimited
        readIops: 0,
        writeIops: 0
      },
      pids: {
        max: 1000
      }
    }
  }
};

export function getPolicyByName(name: string): SecurityPolicy | null {
  return SecurityPolicies[name] || null;
}

export function createCustomPolicy(
  base: string,
  overrides: Partial<SecurityPolicy>
): SecurityPolicy {
  const basePolicy = SecurityPolicies[base];
  if (!basePolicy) {
    throw new Error(`Base policy '${base}' not found`);
  }
  
  return {
    ...basePolicy,
    ...overrides,
    syscalls: {
      ...basePolicy.syscalls,
      ...(overrides.syscalls || {})
    },
    capabilities: {
      ...basePolicy.capabilities,
      ...(overrides.capabilities || {})
    },
    filesystem: {
      ...basePolicy.filesystem,
      ...(overrides.filesystem || {})
    },
    network: {
      ...basePolicy.network,
      ...(overrides.network || {})
    },
    resources: {
      ...basePolicy.resources,
      ...(overrides.resources || {})
    }
  };
}