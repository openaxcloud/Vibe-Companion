import { Router, Request, Response } from 'express';
import os from 'os';
import { z } from 'zod';
import { ensureAuthenticated } from '../middleware/auth';
import { resourcesRateLimiter } from '../middleware/custom-rate-limiter';

const resourcesQuerySchema = z.object({
  projectId: z.coerce.number().int().positive().optional()
});

const router = Router();

interface CpuUsage {
  user: number;
  nice: number;
  sys: number;
  idle: number;
  irq: number;
}

let previousCpuUsage: CpuUsage | null = null;
let networkStats = { bytesIn: 0, bytesOut: 0 };

function getCpuUsage(): { usage: number; cores: number } {
  const cpus = os.cpus();
  const cores = cpus.length;
  
  let totalIdle = 0;
  let totalTick = 0;
  
  for (const cpu of cpus) {
    totalIdle += cpu.times.idle;
    totalTick += cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.idle + cpu.times.irq;
  }
  
  const currentUsage: CpuUsage = {
    user: cpus.reduce((acc, cpu) => acc + cpu.times.user, 0),
    nice: cpus.reduce((acc, cpu) => acc + cpu.times.nice, 0),
    sys: cpus.reduce((acc, cpu) => acc + cpu.times.sys, 0),
    idle: totalIdle,
    irq: cpus.reduce((acc, cpu) => acc + cpu.times.irq, 0)
  };
  
  let usage = 0;
  if (previousCpuUsage) {
    const idleDiff = currentUsage.idle - previousCpuUsage.idle;
    const totalDiff = (currentUsage.user + currentUsage.nice + currentUsage.sys + currentUsage.idle + currentUsage.irq) -
                      (previousCpuUsage.user + previousCpuUsage.nice + previousCpuUsage.sys + previousCpuUsage.idle + previousCpuUsage.irq);
    usage = totalDiff > 0 ? ((totalDiff - idleDiff) / totalDiff) * 100 : 0;
  } else {
    const idlePercent = totalIdle / totalTick;
    usage = (1 - idlePercent) * 100;
  }
  
  previousCpuUsage = currentUsage;
  
  return {
    usage: Math.min(100, Math.max(0, usage)),
    cores
  };
}

function getMemoryMetrics(): { used: number; total: number; percentage: number } {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  const percentage = (used / total) * 100;
  
  return { used, total, percentage };
}

function getStorageMetrics(): { used: number; total: number; percentage: number } {
  try {
    const fs = require('fs');
    const path = require('path');
    const { execSync } = require('child_process');
    
    const dfOutput = execSync('df -B1 / 2>/dev/null || echo "0 0 0"', { encoding: 'utf-8' });
    const lines = dfOutput.trim().split('\n');
    
    if (lines.length >= 2) {
      const parts = lines[1].split(/\s+/);
      if (parts.length >= 4) {
        const total = parseInt(parts[1], 10);
        const used = parseInt(parts[2], 10);
        
        // Return unavailable if parsing failed or values are invalid
        if (isNaN(total) || isNaN(used) || total <= 0) {
          return {
            used: -1,
            total: -1,
            percentage: -1
          };
        }
        
        const percentage = (used / total) * 100;
        return { used, total, percentage };
      }
    }
  } catch (error) {
  }
  
  // Return unavailable indicator instead of synthetic data
  return {
    used: -1,
    total: -1,
    percentage: -1
  };
}

function getNetworkMetrics(): { bytesIn: number; bytesOut: number; latency: number } {
  try {
    const { execSync } = require('child_process');
    const netstatOutput = execSync('cat /proc/net/dev 2>/dev/null || echo ""', { encoding: 'utf-8' });
    
    let bytesIn = 0;
    let bytesOut = 0;
    
    const lines = netstatOutput.split('\n');
    for (const line of lines) {
      if (line.includes(':') && !line.includes('lo:')) {
        const parts = line.split(':')[1]?.trim().split(/\s+/);
        if (parts && parts.length >= 9) {
          bytesIn += parseInt(parts[0], 10) || 0;
          bytesOut += parseInt(parts[8], 10) || 0;
        }
      }
    }
    
    if (bytesIn > 0 || bytesOut > 0) {
      networkStats = { bytesIn, bytesOut };
    }
  } catch (error) {
  }
  
  return {
    ...networkStats,
    latency: -1 // -1 indicates unavailable - network latency requires external monitoring
  };
}

function getProcesses(): Array<{ name: string; pid: number; cpu: number; memory: number; status: string }> {
  const processes: Array<{ name: string; pid: number; cpu: number; memory: number; status: string }> = [];
  
  processes.push({
    name: 'node (main)',
    pid: process.pid,
    cpu: getCpuUsage().usage / os.cpus().length,
    memory: process.memoryUsage().rss,
    status: 'running'
  });
  
  try {
    const { execSync } = require('child_process');
    const psOutput = execSync('ps aux --no-headers 2>/dev/null | head -10 || echo ""', { encoding: 'utf-8' });
    
    const lines = psOutput.trim().split('\n');
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 11) {
        const pid = parseInt(parts[1], 10);
        if (pid !== process.pid && !isNaN(pid)) {
          const cpu = parseFloat(parts[2]) || 0;
          const mem = parseFloat(parts[3]) || 0;
          const command = parts.slice(10).join(' ').split('/').pop()?.split(' ')[0] || 'unknown';
          
          if (command && !command.startsWith('[')) {
            processes.push({
              name: command.substring(0, 20),
              pid,
              cpu,
              memory: (mem / 100) * os.totalmem(),
              status: 'running'
            });
          }
        }
      }
    }
  } catch (error) {
  }
  
  return processes.slice(0, 10);
}

router.get('/resources', resourcesRateLimiter, ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const parseResult = resourcesQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: parseResult.error.errors
      });
    }
    
    const { projectId } = parseResult.data;
    
    const cpu = getCpuUsage();
    const memory = getMemoryMetrics();
    const storage = getStorageMetrics();
    const network = getNetworkMetrics();
    const processes = getProcesses();
    const uptime = process.uptime();
    
    res.json({
      cpu,
      memory,
      storage,
      network,
      processes,
      uptime,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching resource metrics:', error);
    res.status(500).json({ 
      error: 'Failed to fetch resource metrics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
