/**
 * SSH Key Service — canonical validation and storage operations.
 *
 * Single source of truth imported by:
 *   - server/routes/ssh-info.router.ts  (HTTP layer)
 *   - server/agent/tool-executor.ts     (AI tool layer)
 *
 * Keeping validation in one place prevents the two surfaces from
 * drifting apart on supported key types, fingerprint format, or
 * duplicate-key policy.
 */
import crypto from 'crypto';
import { storage } from '../storage';

/**
 * Supported OpenSSH public-key types (standard + FIDO/security-key variants).
 * Covers the full set documented at:
 *   https://man.openbsd.org/sshd.8#AUTHORIZED_KEYS_FILE_FORMAT
 */
export const SSH_KEY_TYPE_REGEX =
  /^(ssh-rsa|ssh-ed25519|ecdsa-sha2-nistp256|ecdsa-sha2-nistp384|ecdsa-sha2-nistp521|sk-ssh-ed25519@openssh\.com|sk-ecdsa-sha2-nistp256@openssh\.com)\s+[A-Za-z0-9+/]+=*(\s.*)?$/;

export const MAX_PUBLIC_KEY_BYTES = 16384;

/**
 * Compute the standard OpenSSH SHA256 fingerprint (identical to `ssh-keygen -lf`).
 * Format: SHA256:<base64-without-trailing-equals>
 */
export function computeFingerprint(base64KeyBlob: string): string {
  const keyData = Buffer.from(base64KeyBlob, 'base64');
  const hash = crypto.createHash('sha256').update(keyData).digest('base64');
  return `SHA256:${hash.replace(/=+$/, '')}`;
}

export interface ParsedSshKey {
  keyType: string;
  base64Blob: string;
  fingerprint: string;
  trimmedPublicKey: string;
}

export type SshKeyValidationError =
  | { code: 'invalid_format'; message: string }
  | { code: 'unsupported_type'; message: string }
  | { code: 'missing_blob'; message: string };

/**
 * Validate the decoded OpenSSH binary blob structure.
 *
 * Every OpenSSH public key blob begins with:
 *   [4 bytes: uint32 length of key-type string]
 *   [N bytes: key-type string]
 *   [4 bytes: uint32 length of first key-material field]
 *   [M bytes: key material]
 *
 * We verify:
 *  1. Blob is long enough to hold the key-type length prefix
 *  2. Declared key-type length is sane (1–64 bytes)
 *  3. The embedded key-type string matches the declared type from the text line
 *  4. A non-zero key-material length field follows the key-type string
 *
 * This catches keys whose text format looks valid (passes regex) but whose
 * base64 blob is structurally broken (truncated, wrong key type embedded, etc.).
 */
function validateOpensshBlobStructure(
  declaredType: string,
  blobBuffer: Buffer,
): { ok: true } | { ok: false; message: string } {
  if (blobBuffer.length < 4) {
    return { ok: false, message: 'SSH key blob is too short to contain a valid key-type prefix.' };
  }

  const typeLen = blobBuffer.readUInt32BE(0);
  if (typeLen < 1 || typeLen > 64 || 4 + typeLen > blobBuffer.length) {
    return { ok: false, message: 'SSH key blob has an invalid key-type length field.' };
  }

  const embeddedType = blobBuffer.slice(4, 4 + typeLen).toString('utf8');
  if (embeddedType !== declaredType) {
    return {
      ok: false,
      message: `SSH key blob declares type "${embeddedType}" but the key line says "${declaredType}".`,
    };
  }

  const afterType = 4 + typeLen;
  if (afterType + 4 > blobBuffer.length) {
    return { ok: false, message: 'SSH key blob is truncated: missing key-material length field.' };
  }

  const materialLen = blobBuffer.readUInt32BE(afterType);
  if (materialLen === 0) {
    return { ok: false, message: 'SSH key blob contains zero-length key material.' };
  }

  return { ok: true };
}

/**
 * Parse and validate an OpenSSH public key string.
 * Performs both text-format validation (regex) and binary blob structure
 * validation to reject structurally malformed keys early.
 * Returns the parsed components or a typed error.
 */
export function parsePublicKey(
  rawPublicKey: string,
): { ok: true; key: ParsedSshKey } | { ok: false; error: SshKeyValidationError } {
  if (!rawPublicKey || typeof rawPublicKey !== 'string') {
    return {
      ok: false,
      error: { code: 'invalid_format', message: 'Public key must be a non-empty string.' },
    };
  }

  const trimmed = rawPublicKey.trim();

  if (!SSH_KEY_TYPE_REGEX.test(trimmed)) {
    return {
      ok: false,
      error: {
        code: 'unsupported_type',
        message:
          'Invalid SSH public key format. Accepted types: ssh-rsa, ssh-ed25519, ecdsa-sha2-nistp256/384/521, sk-ssh-ed25519@openssh.com, sk-ecdsa-sha2-nistp256@openssh.com.',
      },
    };
  }

  const parts = trimmed.split(/\s+/);
  const keyType = parts[0];
  const base64Blob = parts[1];

  if (!base64Blob) {
    return {
      ok: false,
      error: { code: 'missing_blob', message: 'Malformed SSH public key: missing key material.' },
    };
  }

  // Validate the decoded binary blob structure (not just the base64 charset).
  let blobBuffer: Buffer;
  try {
    blobBuffer = Buffer.from(base64Blob, 'base64');
  } catch {
    return {
      ok: false,
      error: { code: 'invalid_format', message: 'SSH key blob is not valid base64.' },
    };
  }

  const blobCheck = validateOpensshBlobStructure(keyType, blobBuffer);
  if (!blobCheck.ok) {
    return {
      ok: false,
      error: { code: 'invalid_format', message: blobCheck.message },
    };
  }

  return {
    ok: true,
    key: {
      keyType,
      base64Blob,
      fingerprint: computeFingerprint(base64Blob),
      trimmedPublicKey: trimmed,
    },
  };
}

export interface SshKeyRecord {
  id: string;
  label: string;
  fingerprint: string;
  keyType: string;
  createdAt: Date | string;
  lastUsed: null;
}

export interface AddSshKeyResult {
  ok: true;
  key: SshKeyRecord;
}

export interface AddSshKeyError {
  ok: false;
  statusCode: 400 | 409 | 500;
  message: string;
}

/**
 * Validate, deduplicate, and persist a new SSH public key for the given user.
 * Returns a typed result so callers (router or tool executor) can map to
 * the appropriate HTTP status code or tool error without re-implementing policy.
 */
export async function addSshKey(
  userId: string,
  label: string,
  publicKey: string,
): Promise<AddSshKeyResult | AddSshKeyError> {
  const parsed = parsePublicKey(publicKey);
  if (!parsed.ok) {
    return { ok: false, statusCode: 400, message: parsed.error.message };
  }

  try {
    // Use user-scoped lookup so the check is deterministic even when multiple
    // users have registered the same public key (shared deployment keys, etc.).
    const existing = await storage.findSshKeyByFingerprintAndUser(parsed.key.fingerprint, userId);
    if (existing) {
      return { ok: false, statusCode: 409, message: 'This SSH key is already added to your account.' };
    }

    const key = await storage.createSshKey(
      userId,
      label.trim(),
      parsed.key.trimmedPublicKey,
      parsed.key.fingerprint,
    );

    return {
      ok: true,
      key: {
        id: key.id,
        label: key.label,
        fingerprint: key.fingerprint,
        keyType: parsed.key.keyType,
        createdAt: key.createdAt,
        lastUsed: null,
      },
    };
  } catch (err: any) {
    if (err?.code === '23505') {
      return { ok: false, statusCode: 409, message: 'This SSH key is already added to your account.' };
    }
    return { ok: false, statusCode: 500, message: 'Failed to add SSH key' };
  }
}

/**
 * List all SSH keys for a user, formatted for API/tool responses.
 */
export async function listSshKeys(userId: string): Promise<SshKeyRecord[]> {
  const keys = await storage.listSshKeysByUser(userId);
  return keys.map((k) => ({
    id: k.id,
    label: k.label,
    fingerprint: k.fingerprint,
    keyType: k.publicKey.trim().split(/\s+/)[0] ?? 'unknown',
    createdAt: k.createdAt,
    lastUsed: null,
  }));
}

/**
 * Delete an SSH key owned by a user.
 * Returns true on success, false when not found/not owned.
 */
export async function deleteSshKey(keyId: string, userId: string): Promise<boolean> {
  return storage.deleteSshKey(keyId, userId);
}
