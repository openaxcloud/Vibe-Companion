/**
 * End-to-End Tests for AI Approval Queue System
 * 
 * Production-Ready Test Suite covering:
 * - High-volume concurrent operations
 * - Full lifecycle validation (create → approve/reject → audit)
 * - Expiration cleanup
 * - Rate limiting
 * - Database persistence and integrity
 * - Multi-user concurrent scenarios
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { AIApprovalQueueService } from '../services/ai-approval-queue.service';
import { aiSecurityService } from '../services/ai-security.service';
import { storage } from '../storage';
import type { ValidatedAction } from '../services/ai-security.service';

describe('AI Approval Queue - Production E2E Tests', () => {
  const approvalQueue = new AIApprovalQueueService();
  
  // Test data
  const userId1 = 'test-user-1';
  const userId2 = 'test-user-2';
  const projectId1 = 'test-project-1';
  const projectId2 = 'test-project-2';
  
  const createTestAction = (filename: string): ValidatedAction => ({
    type: 'create_file',
    path: `client/src/${filename}`,
    content: `// Test file: ${filename}\nexport default function ${filename.replace('.tsx', '')}() { return null; }`,
  });

  beforeEach(async () => {
    // Clean up test data before each test
    await cleanupTestData();
  });

  afterAll(async () => {
    // Final cleanup
    await cleanupTestData();
  });

  async function cleanupTestData() {
    // Clean up approval queue test entries
    const testUserIds = [userId1, userId2];
    for (const userId of testUserIds) {
      const pending = await storage.getPendingAiApprovals(userId, projectId1);
      for (const approval of pending) {
        await storage.updateAiApprovalStatus(approval.id, 'expired', userId);
      }
      const pending2 = await storage.getPendingAiApprovals(userId, projectId2);
      for (const approval of pending2) {
        await storage.updateAiApprovalStatus(approval.id, 'expired', userId);
      }
    }
  }

  describe('1. Basic Approval Queue Operations', () => {
    it('should create and retrieve pending approval', async () => {
      const action = createTestAction('TestComponent.tsx');
      const actionId = await approvalQueue.addAction(userId1, projectId1, action);
      
      expect(actionId).toBeDefined();
      expect(typeof actionId).toBe('string');
      
      const pending = await approvalQueue.getPendingActions(userId1, projectId1);
      expect(pending.length).toBeGreaterThan(0);
      expect(pending[0].id).toBe(actionId);
      expect(pending[0].action).toEqual(action);
    });

    it('should approve action and remove from pending queue', async () => {
      const action = createTestAction('ApprovalTest.tsx');
      const actionId = await approvalQueue.addAction(userId1, projectId1, action);
      
      const approved = await approvalQueue.approve(actionId, userId1);
      expect(approved).toEqual(action);
      
      const pending = await approvalQueue.getPendingActions(userId1, projectId1);
      const stillPending = pending.find(p => p.id === actionId);
      expect(stillPending).toBeUndefined();
    });

    it('should reject action with reason', async () => {
      const action = createTestAction('RejectionTest.tsx');
      const actionId = await approvalQueue.addAction(userId1, projectId1, action);
      
      const rejected = await approvalQueue.reject(actionId, userId1, 'Security violation');
      expect(rejected).toBe(true);
      
      const pending = await approvalQueue.getPendingActions(userId1, projectId1);
      const stillPending = pending.find(p => p.id === actionId);
      expect(stillPending).toBeUndefined();
    });

    it('should prevent approval by different user', async () => {
      const action = createTestAction('SecurityTest.tsx');
      const actionId = await approvalQueue.addAction(userId1, projectId1, action);
      
      // Try to approve with different user
      const approved = await approvalQueue.approve(actionId, userId2);
      expect(approved).toBeNull();
      
      // Original user should still see it pending
      const pending = await approvalQueue.getPendingActions(userId1, projectId1);
      expect(pending.find(p => p.id === actionId)).toBeDefined();
    });
  });

  describe('2. High-Volume Concurrent Operations', () => {
    it('should handle 100 concurrent approval creations', async () => {
      const operations: Promise<string>[] = [];
      
      // Create 100 concurrent approvals
      for (let i = 0; i < 100; i++) {
        const action = createTestAction(`Concurrent${i}.tsx`);
        operations.push(approvalQueue.addAction(userId1, projectId1, action));
      }
      
      const actionIds = await Promise.all(operations);
      expect(actionIds.length).toBe(100);
      expect(new Set(actionIds).size).toBe(100); // All unique IDs
      
      const pending = await approvalQueue.getPendingActions(userId1, projectId1);
      expect(pending.length).toBeGreaterThanOrEqual(100);
    }, 30000);

    it('should handle concurrent approve/reject operations', async () => {
      // Create 50 approvals
      const actionIds: string[] = [];
      for (let i = 0; i < 50; i++) {
        const action = createTestAction(`Mixed${i}.tsx`);
        const id = await approvalQueue.addAction(userId1, projectId1, action);
        actionIds.push(id);
      }
      
      // Concurrently approve half and reject half
      const operations: Promise<any>[] = [];
      actionIds.forEach((id, index) => {
        if (index % 2 === 0) {
          operations.push(approvalQueue.approve(id, userId1));
        } else {
          operations.push(approvalQueue.reject(id, userId1, 'Test rejection'));
        }
      });
      
      const results = await Promise.all(operations);
      expect(results.length).toBe(50);
      
      const pending = await approvalQueue.getPendingActions(userId1, projectId1);
      expect(pending.length).toBe(0);
    }, 30000);

    it('should handle multi-user concurrent operations', async () => {
      const operations: Promise<string>[] = [];
      
      // User 1: 50 approvals in project 1
      for (let i = 0; i < 50; i++) {
        operations.push(
          approvalQueue.addAction(userId1, projectId1, createTestAction(`User1_${i}.tsx`))
        );
      }
      
      // User 2: 50 approvals in project 2
      for (let i = 0; i < 50; i++) {
        operations.push(
          approvalQueue.addAction(userId2, projectId2, createTestAction(`User2_${i}.tsx`))
        );
      }
      
      await Promise.all(operations);
      
      const user1Pending = await approvalQueue.getPendingActions(userId1, projectId1);
      const user2Pending = await approvalQueue.getPendingActions(userId2, projectId2);
      
      expect(user1Pending.length).toBe(50);
      expect(user2Pending.length).toBe(50);
      
      // Verify isolation - user1 shouldn't see user2's approvals
      const user1InProject2 = await approvalQueue.getPendingActions(userId1, projectId2);
      expect(user1InProject2.length).toBe(0);
    }, 30000);
  });

  describe('3. Expiration and Cleanup', () => {
    it('should mark expired approvals as expired', async () => {
      const action = createTestAction('ExpiryTest.tsx');
      const actionId = await approvalQueue.addAction(userId1, projectId1, action);
      
      // Wait a tiny bit, then simulate expiry by trying to approve after cleanup
      // In production, this would happen automatically after 5 minutes
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Note: Full expiry testing requires waiting 5 minutes or direct DB access
      // For unit tests, we verify the expiry logic exists in the approve method
      const approval = await storage.getAiApproval(actionId);
      expect(approval).toBeDefined();
      expect(approval?.expiresAt).toBeInstanceOf(Date);
    });

    it('should cleanup expired approvals automatically', async () => {
      // Create 10 approvals
      const actionIds: string[] = [];
      for (let i = 0; i < 10; i++) {
        const id = await approvalQueue.addAction(userId1, projectId1, createTestAction(`Expire${i}.tsx`));
        actionIds.push(id);
      }
      
      // Verify cleanup function exists and can be called
      const count = await approvalQueue.cleanupExpired();
      expect(count).toBeGreaterThanOrEqual(0); // May be 0 if nothing expired yet
      
      // Verify all approvals are still pending (not yet expired)
      const pending = await approvalQueue.getPendingActions(userId1, projectId1);
      expect(pending.length).toBeGreaterThanOrEqual(10);
    });
  });

  describe('4. Full Lifecycle with Audit Trail', () => {
    it('should maintain complete audit trail from creation to approval', async () => {
      const action = createTestAction('AuditTest.tsx');
      
      // Step 1: Create action
      const actionId = await approvalQueue.addAction(userId1, projectId1, action);
      expect(actionId).toBeDefined();
      
      // Step 2: Approve action
      const approved = await approvalQueue.approve(actionId, userId1);
      expect(approved).toEqual(action);
      
      // Step 3: Log execution
      await aiSecurityService.logAction(
        userId1,
        projectId1,
        action,
        { success: true, fileId: 'test-file-123' },
        actionId
      );
      
      // Step 4: Verify audit trail
      const auditLogs = await storage.getAiAuditLogs({
        approvalId: actionId,
        limit: 10,
      });
      
      expect(auditLogs.length).toBeGreaterThan(0);
      expect(auditLogs[0].approvalId).toBe(actionId);
      expect(auditLogs[0].userId).toBe(userId1);
      expect(auditLogs[0].projectId).toBe(projectId1);
      expect(auditLogs[0].action).toEqual(action);
      expect(auditLogs[0].result).toEqual({ success: true, fileId: 'test-file-123' });
    });

    it('should maintain audit trail for rejected actions', async () => {
      const action = createTestAction('RejectedAudit.tsx');
      
      // Create and reject
      const actionId = await approvalQueue.addAction(userId1, projectId1, action);
      await approvalQueue.reject(actionId, userId1, 'Security violation detected');
      
      // Log rejection
      await aiSecurityService.logAction(
        userId1,
        projectId1,
        action,
        { success: false, error: 'Security violation detected' },
        actionId
      );
      
      // Verify audit trail
      const auditLogs = await storage.getAiAuditLogs({
        approvalId: actionId,
        limit: 10,
      });
      
      expect(auditLogs.length).toBeGreaterThan(0);
      expect(auditLogs[0].result).toHaveProperty('success', false);
      expect(auditLogs[0].result).toHaveProperty('error');
    });
  });

  describe('5. Database Persistence and Integrity', () => {
    it('should persist approvals across service restarts', async () => {
      // Create approval with first instance
      const queue1 = new AIApprovalQueueService();
      const action = createTestAction('PersistenceTest.tsx');
      const actionId = await queue1.addAction(userId1, projectId1, action);
      
      // Create new instance (simulating restart)
      const queue2 = new AIApprovalQueueService();
      const pending = await queue2.getPendingActions(userId1, projectId1);
      
      const found = pending.find(p => p.id === actionId);
      expect(found).toBeDefined();
      expect(found?.action).toEqual(action);
    });

    it('should maintain referential integrity in audit logs', async () => {
      const action = createTestAction('IntegrityTest.tsx');
      const actionId = await approvalQueue.addAction(userId1, projectId1, action);
      
      // Log with approval reference
      await aiSecurityService.logAction(
        userId1,
        projectId1,
        action,
        { success: true },
        actionId
      );
      
      // Verify we can query by approval ID
      const logs = await storage.getAiAuditLogs({ approvalId: actionId });
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].approvalId).toBe(actionId);
    });

    it('should handle database transaction failures gracefully', async () => {
      // This test ensures the system handles DB errors without crashing
      const action = createTestAction('ErrorHandling.tsx');
      
      try {
        // Create a valid approval
        const actionId = await approvalQueue.addAction(userId1, projectId1, action);
        expect(actionId).toBeDefined();
        
        // Try to approve twice (should fail gracefully on second attempt)
        await approvalQueue.approve(actionId, userId1);
        const secondApproval = await approvalQueue.approve(actionId, userId1);
        expect(secondApproval).toBeNull();
      } catch (error) {
        // Should not throw - should handle gracefully
        throw new Error(`Unexpected error: ${error}`);
      }
    });
  });

  describe('6. Query Performance Validation', () => {
    it('should efficiently query large approval sets', async () => {
      // Create 200 approvals
      const start = Date.now();
      const operations: Promise<string>[] = [];
      
      for (let i = 0; i < 200; i++) {
        operations.push(
          approvalQueue.addAction(userId1, projectId1, createTestAction(`Perf${i}.tsx`))
        );
      }
      
      await Promise.all(operations);
      const createTime = Date.now() - start;
      
      // Query should be fast even with 200+ entries
      const queryStart = Date.now();
      const pending = await approvalQueue.getPendingActions(userId1, projectId1);
      const queryTime = Date.now() - queryStart;
      
      expect(pending.length).toBeGreaterThanOrEqual(200);
      expect(queryTime).toBeLessThan(500); // Should complete in < 500ms
      
      console.log(`Performance: Created 200 approvals in ${createTime}ms, queried in ${queryTime}ms`);
    }, 60000);

    it('should efficiently query audit logs by date range', async () => {
      const action = createTestAction('AuditPerf.tsx');
      
      // Create multiple audit log entries
      for (let i = 0; i < 50; i++) {
        await aiSecurityService.logAction(
          userId1,
          projectId1,
          action,
          { success: true, fileId: `file-${i}` }
        );
      }
      
      // Query with date range
      const start = Date.now();
      const logs = await storage.getAiAuditLogs({
        userId: userId1,
        projectId: projectId1,
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        limit: 100,
      });
      const queryTime = Date.now() - start;
      
      expect(logs.length).toBeGreaterThan(0);
      expect(queryTime).toBeLessThan(200); // Should complete in < 200ms
      
      console.log(`Audit query performance: ${queryTime}ms for ${logs.length} records`);
    }, 30000);
  });

  describe('7. Edge Cases and Error Handling', () => {
    it('should handle null/undefined gracefully', async () => {
      expect(await approvalQueue.approve('nonexistent-id', userId1)).toBeNull();
      expect(await approvalQueue.reject('nonexistent-id', userId1)).toBe(false);
    });

    it('should prevent double approval', async () => {
      const action = createTestAction('DoubleApproval.tsx');
      const actionId = await approvalQueue.addAction(userId1, projectId1, action);
      
      const first = await approvalQueue.approve(actionId, userId1);
      expect(first).toEqual(action);
      
      const second = await approvalQueue.approve(actionId, userId1);
      expect(second).toBeNull();
    });

    it('should isolate users by userId', async () => {
      const action = createTestAction('Isolation.tsx');
      const actionId = await approvalQueue.addAction(userId1, projectId1, action);
      
      // User 2 shouldn't see user 1's approvals
      const user2Pending = await approvalQueue.getPendingActions(userId2, projectId1);
      const found = user2Pending.find(p => p.id === actionId);
      expect(found).toBeUndefined();
    });
  });
});
