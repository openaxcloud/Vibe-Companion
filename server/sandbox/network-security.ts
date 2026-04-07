/**
 * Network Layer Security for Enterprise Sandboxing
 * Implements network isolation, firewall rules, and traffic filtering
 */

import { execSync, spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createLogger } from '../utils/logger';

const logger = createLogger('network-security');

export interface NetworkSecurityConfig {
  enableNetworkIsolation: boolean;
  allowLoopback: boolean;
  allowDNS: boolean;
  allowedPorts: number[];
  allowedHosts: string[];
  bandwidthLimit?: number; // in Mbps
  packetRateLimit?: number; // packets per second
  connectionLimit?: number; // max concurrent connections
}

export interface NetworkNamespace {
  name: string;
  vethHost: string;
  vethGuest: string;
  bridgeName: string;
  ipAddress: string;
  gateway: string;
}

export class NetworkSecurityManager {
  private namespaces: Map<string, NetworkNamespace> = new Map();
  private bridgeInitialized = false;
  private readonly bridgeName = 'ecode-bridge';
  private readonly bridgeSubnet = '10.200.0.0/16';
  private readonly bridgeGateway = '10.200.0.1';
  private ipCounter = 2;

  /**
   * Initialize the network security manager
   */
  async initialize(): Promise<void> {
    try {
      // Check if we have CAP_NET_ADMIN capability
      const hasNetAdmin = await this.checkNetAdminCapability();
      if (!hasNetAdmin) {
        logger.warn('CAP_NET_ADMIN capability not available. Network isolation will be limited.');
        return;
      }

      // Initialize bridge network
      await this.initializeBridge();
    } catch (error) {
      logger.error('Failed to initialize network security: ' + String(error));
    }
  }

  /**
   * Create network namespace with isolation
   */
  async createNetworkNamespace(sandboxId: string, config: NetworkSecurityConfig): Promise<NetworkNamespace> {
    const namespace: NetworkNamespace = {
      name: `ecode-${sandboxId}`,
      vethHost: `veth-h-${sandboxId.substring(0, 8)}`,
      vethGuest: `veth-g-${sandboxId.substring(0, 8)}`,
      bridgeName: this.bridgeName,
      ipAddress: `10.200.0.${this.ipCounter++}`,
      gateway: this.bridgeGateway
    };

    try {
      // Create network namespace
      execSync(`ip netns add ${namespace.name}`);

      // Create veth pair
      execSync(`ip link add ${namespace.vethHost} type veth peer name ${namespace.vethGuest}`);

      // Move guest end to namespace
      execSync(`ip link set ${namespace.vethGuest} netns ${namespace.name}`);

      // Attach host end to bridge
      execSync(`ip link set ${namespace.vethHost} master ${this.bridgeName}`);
      execSync(`ip link set ${namespace.vethHost} up`);

      // Configure namespace network
      execSync(`ip netns exec ${namespace.name} ip link set lo up`);
      execSync(`ip netns exec ${namespace.name} ip link set ${namespace.vethGuest} up`);
      execSync(`ip netns exec ${namespace.name} ip addr add ${namespace.ipAddress}/24 dev ${namespace.vethGuest}`);
      execSync(`ip netns exec ${namespace.name} ip route add default via ${namespace.gateway}`);

      // Apply network security rules
      await this.applyNetworkRules(namespace, config);

      this.namespaces.set(sandboxId, namespace);
      return namespace;
    } catch (error) {
      logger.error(`Failed to create network namespace for ${sandboxId}: ${String(error)}`);
      throw error;
    }
  }

  /**
   * Apply iptables rules for network security
   */
  private async applyNetworkRules(namespace: NetworkNamespace, config: NetworkSecurityConfig): Promise<void> {
    const { name } = namespace;

    // Flush existing rules
    execSync(`ip netns exec ${name} iptables -F`);
    execSync(`ip netns exec ${name} iptables -X`);

    // Default policies
    if (config.enableNetworkIsolation) {
      execSync(`ip netns exec ${name} iptables -P INPUT DROP`);
      execSync(`ip netns exec ${name} iptables -P OUTPUT DROP`);
      execSync(`ip netns exec ${name} iptables -P FORWARD DROP`);
    } else {
      execSync(`ip netns exec ${name} iptables -P INPUT ACCEPT`);
      execSync(`ip netns exec ${name} iptables -P OUTPUT ACCEPT`);
      execSync(`ip netns exec ${name} iptables -P FORWARD DROP`);
    }

    // Allow established connections
    execSync(`ip netns exec ${name} iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT`);
    execSync(`ip netns exec ${name} iptables -A OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT`);

    // Allow loopback if configured
    if (config.allowLoopback) {
      execSync(`ip netns exec ${name} iptables -A INPUT -i lo -j ACCEPT`);
      execSync(`ip netns exec ${name} iptables -A OUTPUT -o lo -j ACCEPT`);
    }

    // Allow DNS if configured
    if (config.allowDNS) {
      execSync(`ip netns exec ${name} iptables -A OUTPUT -p udp --dport 53 -j ACCEPT`);
      execSync(`ip netns exec ${name} iptables -A OUTPUT -p tcp --dport 53 -j ACCEPT`);
    }

    // Allow specific ports
    for (const port of config.allowedPorts) {
      execSync(`ip netns exec ${name} iptables -A OUTPUT -p tcp --dport ${port} -j ACCEPT`);
      execSync(`ip netns exec ${name} iptables -A OUTPUT -p udp --dport ${port} -j ACCEPT`);
    }

    // Allow specific hosts
    for (const host of config.allowedHosts) {
      execSync(`ip netns exec ${name} iptables -A OUTPUT -d ${host} -j ACCEPT`);
    }

    // Apply rate limiting if configured
    if (config.packetRateLimit) {
      execSync(`ip netns exec ${name} iptables -A OUTPUT -m limit --limit ${config.packetRateLimit}/second --limit-burst 100 -j ACCEPT`);
      execSync(`ip netns exec ${name} iptables -A OUTPUT -j DROP`);
    }

    // Apply connection limiting if configured
    if (config.connectionLimit) {
      execSync(`ip netns exec ${name} iptables -A OUTPUT -p tcp -m connlimit --connlimit-above ${config.connectionLimit} -j DROP`);
    }

    // Apply bandwidth limiting with tc (traffic control)
    if (config.bandwidthLimit) {
      await this.applyBandwidthLimit(namespace, config.bandwidthLimit);
    }

    // Log dropped packets for monitoring
    execSync(`ip netns exec ${name} iptables -A INPUT -j LOG --log-prefix "SANDBOX-DROP-IN: " --log-level 4`);
    execSync(`ip netns exec ${name} iptables -A OUTPUT -j LOG --log-prefix "SANDBOX-DROP-OUT: " --log-level 4`);
  }

  /**
   * Apply bandwidth limiting using tc (traffic control)
   */
  private async applyBandwidthLimit(namespace: NetworkNamespace, limitMbps: number): Promise<void> {
    const { name, vethGuest } = namespace;

    try {
      // Clear existing qdisc
      try {
        execSync(`ip netns exec ${name} tc qdisc del dev ${vethGuest} root`);
      } catch (e) {
        // Ignore if no existing qdisc
      }

      // Add htb qdisc
      execSync(`ip netns exec ${name} tc qdisc add dev ${vethGuest} root handle 1: htb default 10`);
      
      // Add class with bandwidth limit
      execSync(`ip netns exec ${name} tc class add dev ${vethGuest} parent 1: classid 1:10 htb rate ${limitMbps}mbit`);
      
      // Add sfq for fairness
      execSync(`ip netns exec ${name} tc qdisc add dev ${vethGuest} parent 1:10 handle 10: sfq perturb 10`);
    } catch (error) {
      logger.error('Failed to apply bandwidth limit: ' + String(error));
    }
  }

  /**
   * Monitor network traffic for a namespace
   */
  async monitorNetworkTraffic(sandboxId: string): Promise<{
    bytesIn: number;
    bytesOut: number;
    packetsIn: number;
    packetsOut: number;
    droppedIn: number;
    droppedOut: number;
  }> {
    const namespace = this.namespaces.get(sandboxId);
    if (!namespace) {
      throw new Error(`Network namespace not found for ${sandboxId}`);
    }

    try {
      const stats = execSync(`ip netns exec ${namespace.name} ip -s link show ${namespace.vethGuest}`).toString();
      
      // Parse the output to extract statistics
      const lines = stats.split('\n');
      const rxLine = lines.find(l => l.includes('RX:'))?.trim() || '';
      const txLine = lines.find(l => l.includes('TX:'))?.trim() || '';
      
      // This is a simplified parser - actual implementation would need more robust parsing
      return {
        bytesIn: 0,
        bytesOut: 0,
        packetsIn: 0,
        packetsOut: 0,
        droppedIn: 0,
        droppedOut: 0
      };
    } catch (error) {
      logger.error('Failed to get network statistics: ' + String(error));
      return {
        bytesIn: 0,
        bytesOut: 0,
        packetsIn: 0,
        packetsOut: 0,
        droppedIn: 0,
        droppedOut: 0
      };
    }
  }

  /**
   * Create firewall rules at host level
   */
  async createHostFirewallRules(sandboxId: string): Promise<void> {
    const namespace = this.namespaces.get(sandboxId);
    if (!namespace) {
      throw new Error(`Network namespace not found for ${sandboxId}`);
    }

    try {
      // Create a chain for this sandbox
      const chainName = `SANDBOX-${sandboxId.substring(0, 8)}`;
      execSync(`iptables -N ${chainName} 2>/dev/null || true`);

      // Add rules to isolate sandbox traffic
      execSync(`iptables -A FORWARD -i ${namespace.vethHost} -j ${chainName}`);
      execSync(`iptables -A FORWARD -o ${namespace.vethHost} -j ${chainName}`);

      // Default drop all traffic from sandbox
      execSync(`iptables -A ${chainName} -j DROP`);
    } catch (error) {
      logger.error('Failed to create host firewall rules: ' + String(error));
    }
  }

  /**
   * Clean up network namespace
   */
  async destroyNetworkNamespace(sandboxId: string): Promise<void> {
    const namespace = this.namespaces.get(sandboxId);
    if (!namespace) {
      return;
    }

    try {
      // Remove host firewall rules
      const chainName = `SANDBOX-${sandboxId.substring(0, 8)}`;
      try {
        execSync(`iptables -D FORWARD -i ${namespace.vethHost} -j ${chainName}`);
        execSync(`iptables -D FORWARD -o ${namespace.vethHost} -j ${chainName}`);
        execSync(`iptables -F ${chainName}`);
        execSync(`iptables -X ${chainName}`);
      } catch (e) {
        // Ignore errors during cleanup
      }

      // Delete veth pair (automatically removes both ends)
      try {
        execSync(`ip link del ${namespace.vethHost}`);
      } catch (e) {
        // Ignore if already deleted
      }

      // Delete network namespace
      execSync(`ip netns del ${namespace.name}`);

      this.namespaces.delete(sandboxId);
    } catch (error) {
      logger.error(`Failed to destroy network namespace for ${sandboxId}: ${String(error)}`);
    }
  }

  /**
   * Initialize bridge network for sandboxes
   */
  private async initializeBridge(): Promise<void> {
    if (this.bridgeInitialized) {
      return;
    }

    try {
      // Check if bridge exists
      try {
        execSync(`ip link show ${this.bridgeName}`);
      } catch (e) {
        // Create bridge
        execSync(`ip link add ${this.bridgeName} type bridge`);
      }

      // Configure bridge
      execSync(`ip addr add ${this.bridgeGateway}/16 dev ${this.bridgeName} 2>/dev/null || true`);
      execSync(`ip link set ${this.bridgeName} up`);

      // Enable IP forwarding
      await fs.writeFile('/proc/sys/net/ipv4/ip_forward', '1');

      // Setup NAT for sandbox network
      execSync(`iptables -t nat -A POSTROUTING -s ${this.bridgeSubnet} ! -d ${this.bridgeSubnet} -j MASQUERADE`);
      execSync(`iptables -A FORWARD -s ${this.bridgeSubnet} -j ACCEPT`);
      execSync(`iptables -A FORWARD -d ${this.bridgeSubnet} -m state --state ESTABLISHED,RELATED -j ACCEPT`);

      this.bridgeInitialized = true;
      logger.info('Network bridge initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize bridge: ' + String(error));
      throw error;
    }
  }

  /**
   * Check if we have NET_ADMIN capability
   */
  private async checkNetAdminCapability(): Promise<boolean> {
    try {
      // Try to list network namespaces - requires NET_ADMIN
      execSync('ip netns list');
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Get network isolation status
   */
  getNetworkStatus(): {
    initialized: boolean;
    activeNamespaces: number;
    bridgeStatus: string;
  } {
    return {
      initialized: this.bridgeInitialized,
      activeNamespaces: this.namespaces.size,
      bridgeStatus: this.bridgeInitialized ? 'active' : 'inactive'
    };
  }

  /**
   * Clean up all resources
   */
  async cleanup(): Promise<void> {
    // Clean up all namespaces
    for (const [sandboxId] of Array.from(this.namespaces)) {
      await this.destroyNetworkNamespace(sandboxId);
    }

    // Remove bridge if no namespaces
    if (this.namespaces.size === 0 && this.bridgeInitialized) {
      try {
        execSync(`ip link del ${this.bridgeName}`);
        this.bridgeInitialized = false;
      } catch (e) {
        // Ignore errors during cleanup
      }
    }
  }
}

// Export singleton instance
export const networkSecurityManager = new NetworkSecurityManager();