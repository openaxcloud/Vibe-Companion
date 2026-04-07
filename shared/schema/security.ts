/**
 * Security Schema Definitions
 * Database tables for security features
 */

import { pgTable, text, timestamp, integer, boolean, jsonb, uuid, index } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

// Authentication attempts tracking
export const authAttempts = pgTable('auth_attempts', {
  id: uuid('id').defaultRandom().primaryKey(),
  username: text('username').notNull(),
  ipAddress: text('ip_address').notNull(),
  attemptType: text('attempt_type').notNull(), // 'success' | 'failed'
  lockedUntil: timestamp('locked_until'),
  metadata: jsonb('metadata').$type<Record<string, any>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  usernameIdx: index('auth_attempts_username_idx').on(table.username),
  ipIdx: index('auth_attempts_ip_idx').on(table.ipAddress),
  createdAtIdx: index('auth_attempts_created_at_idx').on(table.createdAt),
}));

// User sessions for enhanced session management
// #112 FIXED: userId changed from text to integer for consistency with users.id
export const userSessions = pgTable('user_sessions', {
  id: text('id').primaryKey(),
  userId: integer('user_id').notNull(), // #112 FIXED: Changed from text to integer to match users.id
  ipAddress: text('ip_address').notNull(),
  userAgent: text('user_agent').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  revokedAt: timestamp('revoked_at'),
  metadata: jsonb('metadata').$type<Record<string, any>>(),
}, (table) => ({
  userIdIdx: index('user_sessions_user_id_idx').on(table.userId),
  expiresAtIdx: index('user_sessions_expires_at_idx').on(table.expiresAt),
}));

// Security events logging
export const securityEvents = pgTable('security_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  type: text('type').notNull(), // 'failed_login', 'xss_attempt', 'sql_injection', etc.
  severity: text('severity').notNull(), // 'low', 'medium', 'high', 'critical'
  source: text('source').notNull(), // IP address or user ID
  description: text('description').notNull(),
  metadata: jsonb('metadata').$type<Record<string, any>>(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  resolved: boolean('resolved').default(false),
  resolvedAt: timestamp('resolved_at'),
  resolvedBy: text('resolved_by'),
}, (table) => ({
  typeIdx: index('security_events_type_idx').on(table.type),
  severityIdx: index('security_events_severity_idx').on(table.severity),
  sourceIdx: index('security_events_source_idx').on(table.source),
  timestampIdx: index('security_events_timestamp_idx').on(table.timestamp),
}));

// Security alerts
export const alerts = pgTable('alerts', {
  id: uuid('id').defaultRandom().primaryKey(),
  type: text('type').notNull(),
  severity: text('severity').notNull(), // 'warning', 'error', 'critical'
  message: text('message').notNull(),
  status: text('status').notNull(), // 'active', 'acknowledged', 'resolved'
  triggeredAt: timestamp('triggered_at').defaultNow().notNull(),
  acknowledgedBy: text('acknowledged_by'),
  acknowledgedAt: timestamp('acknowledged_at'),
  resolvedAt: timestamp('resolved_at'),
  metadata: jsonb('metadata').$type<Record<string, any>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  statusIdx: index('alerts_status_idx').on(table.status),
  severityIdx: index('alerts_severity_idx').on(table.severity),
  triggeredAtIdx: index('alerts_triggered_at_idx').on(table.triggeredAt),
}));

// Audit logs for sensitive operations
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),
  action: text('action').notNull(),
  resource: text('resource').notNull(),
  resourceId: text('resource_id'),
  oldValue: jsonb('old_value').$type<Record<string, any>>(),
  newValue: jsonb('new_value').$type<Record<string, any>>(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  metadata: jsonb('metadata').$type<Record<string, any>>(),
}, (table) => ({
  userIdIdx: index('audit_logs_user_id_idx').on(table.userId),
  actionIdx: index('audit_logs_action_idx').on(table.action),
  resourceIdx: index('audit_logs_resource_idx').on(table.resource),
  timestampIdx: index('audit_logs_timestamp_idx').on(table.timestamp),
}));

// API keys management
export const apiKeys = pgTable('api_keys', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  keyHash: text('key_hash').notNull(), // Hashed API key
  lastUsed: timestamp('last_used'),
  expiresAt: timestamp('expires_at'),
  scopes: jsonb('scopes').$type<string[]>().default([]),
  revokedAt: timestamp('revoked_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  metadata: jsonb('metadata').$type<Record<string, any>>(),
}, (table) => ({
  userIdIdx: index('api_keys_user_id_idx').on(table.userId),
  keyHashIdx: index('api_keys_key_hash_idx').on(table.keyHash),
  expiresAtIdx: index('api_keys_expires_at_idx').on(table.expiresAt),
}));

// Rate limit tracking
export const rateLimits = pgTable('rate_limits', {
  id: uuid('id').defaultRandom().primaryKey(),
  identifier: text('identifier').notNull(), // IP or user ID
  endpoint: text('endpoint').notNull(),
  count: integer('count').notNull().default(0),
  windowStart: timestamp('window_start').defaultNow().notNull(),
  windowEnd: timestamp('window_end').notNull(),
  blocked: boolean('blocked').default(false),
  blockedUntil: timestamp('blocked_until'),
}, (table) => ({
  identifierIdx: index('rate_limits_identifier_idx').on(table.identifier),
  endpointIdx: index('rate_limits_endpoint_idx').on(table.endpoint),
  windowEndIdx: index('rate_limits_window_end_idx').on(table.windowEnd),
}));

// CSP violation reports
export const cspReports = pgTable('csp_reports', {
  id: uuid('id').defaultRandom().primaryKey(),
  documentUri: text('document_uri').notNull(),
  violatedDirective: text('violated_directive').notNull(),
  blockedUri: text('blocked_uri'),
  lineNumber: integer('line_number'),
  columnNumber: integer('column_number'),
  sourceFile: text('source_file'),
  userAgent: text('user_agent'),
  ipAddress: text('ip_address'),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
}, (table) => ({
  timestampIdx: index('csp_reports_timestamp_idx').on(table.timestamp),
  violatedDirectiveIdx: index('csp_reports_violated_directive_idx').on(table.violatedDirective),
}));

// Two-factor authentication backup codes
export const twoFactorBackupCodes = pgTable('two_factor_backup_codes', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),
  code: text('code').notNull(),
  used: boolean('used').default(false),
  usedAt: timestamp('used_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('two_factor_backup_codes_user_id_idx').on(table.userId),
  codeIdx: index('two_factor_backup_codes_code_idx').on(table.code),
}));

// File uploads tracking for security
export const fileUploads = pgTable('file_uploads', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),
  filename: text('filename').notNull(),
  originalName: text('original_name').notNull(),
  mimeType: text('mime_type').notNull(),
  size: integer('size').notNull(),
  path: text('path').notNull(),
  scanStatus: text('scan_status').default('pending'), // 'pending', 'clean', 'threat', 'quarantined'
  scanResult: jsonb('scan_result').$type<Record<string, any>>(),
  uploadedAt: timestamp('uploaded_at').defaultNow().notNull(),
  metadata: jsonb('metadata').$type<Record<string, any>>(),
}, (table) => ({
  userIdIdx: index('file_uploads_user_id_idx').on(table.userId),
  uploadedAtIdx: index('file_uploads_uploaded_at_idx').on(table.uploadedAt),
  scanStatusIdx: index('file_uploads_scan_status_idx').on(table.scanStatus),
}));

// Create Zod schemas for validation
export const insertAuthAttemptSchema = createInsertSchema(authAttempts);
export const selectAuthAttemptSchema = createSelectSchema(authAttempts);

export const insertUserSessionSchema = createInsertSchema(userSessions);
export const selectUserSessionSchema = createSelectSchema(userSessions);

export const insertSecurityEventSchema = createInsertSchema(securityEvents);
export const selectSecurityEventSchema = createSelectSchema(securityEvents);

export const insertAlertSchema = createInsertSchema(alerts);
export const selectAlertSchema = createSelectSchema(alerts);

export const insertAuditLogSchema = createInsertSchema(auditLogs);
export const selectAuditLogSchema = createSelectSchema(auditLogs);

export const insertApiKeySchema = createInsertSchema(apiKeys);
export const selectApiKeySchema = createSelectSchema(apiKeys);

export const insertRateLimitSchema = createInsertSchema(rateLimits);
export const selectRateLimitSchema = createSelectSchema(rateLimits);

export const insertCspReportSchema = createInsertSchema(cspReports);
export const selectCspReportSchema = createSelectSchema(cspReports);

export const insertTwoFactorBackupCodeSchema = createInsertSchema(twoFactorBackupCodes);
export const selectTwoFactorBackupCodeSchema = createSelectSchema(twoFactorBackupCodes);

export const insertFileUploadSchema = createInsertSchema(fileUploads);
export const selectFileUploadSchema = createSelectSchema(fileUploads);

// Type exports
export type AuthAttempt = z.infer<typeof selectAuthAttemptSchema>;
export type InsertAuthAttempt = z.infer<typeof insertAuthAttemptSchema>;

export type UserSession = z.infer<typeof selectUserSessionSchema>;
export type InsertUserSession = z.infer<typeof insertUserSessionSchema>;

export type SecurityEvent = z.infer<typeof selectSecurityEventSchema>;
export type InsertSecurityEvent = z.infer<typeof insertSecurityEventSchema>;

export type Alert = z.infer<typeof selectAlertSchema>;
export type InsertAlert = z.infer<typeof insertAlertSchema>;

export type AuditLog = z.infer<typeof selectAuditLogSchema>;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;

export type ApiKey = z.infer<typeof selectApiKeySchema>;
export type InsertApiKey = z.infer<typeof insertApiKeySchema>;

export type RateLimit = z.infer<typeof selectRateLimitSchema>;
export type InsertRateLimit = z.infer<typeof insertRateLimitSchema>;

export type CspReport = z.infer<typeof selectCspReportSchema>;
export type InsertCspReport = z.infer<typeof insertCspReportSchema>;

export type TwoFactorBackupCode = z.infer<typeof selectTwoFactorBackupCodeSchema>;
export type InsertTwoFactorBackupCode = z.infer<typeof insertTwoFactorBackupCodeSchema>;

export type FileUpload = z.infer<typeof selectFileUploadSchema>;
export type InsertFileUpload = z.infer<typeof insertFileUploadSchema>;