// @ts-nocheck
/**
 * bcrypt compatibility layer
 * Uses native bcrypt when available, falls back to bcryptjs (pure JS) in production
 * This ensures the server works even when native modules fail to compile
 */

import bcryptjs from 'bcryptjs';

// Interface matching bcrypt API
interface BcryptInterface {
  hash(data: string, saltOrRounds: number | string): Promise<string>;
  compare(data: string, encrypted: string): Promise<boolean>;
  genSalt(rounds?: number): Promise<string>;
  genSaltSync(rounds?: number): string;
  hashSync(data: string, saltOrRounds: number | string): string;
  compareSync(data: string, encrypted: string): boolean;
}

let bcryptImpl: BcryptInterface;
let usingNative = false;

try {
  // Try to load native bcrypt
  const nativeBcrypt = await import('bcrypt');
  bcryptImpl = nativeBcrypt.default || nativeBcrypt;
  usingNative = true;
  console.log('[bcrypt-compat] Using native bcrypt');
} catch (error) {
  // Fall back to bcryptjs (pure JavaScript implementation)
  bcryptImpl = bcryptjs;
  console.log('[bcrypt-compat] Native bcrypt unavailable, using bcryptjs fallback');
}

export const hash = bcryptImpl.hash.bind(bcryptImpl);
export const compare = bcryptImpl.compare.bind(bcryptImpl);
export const genSalt = bcryptImpl.genSalt.bind(bcryptImpl);
export const genSaltSync = bcryptImpl.genSaltSync.bind(bcryptImpl);
export const hashSync = bcryptImpl.hashSync.bind(bcryptImpl);
export const compareSync = bcryptImpl.compareSync.bind(bcryptImpl);
export const isUsingNativeBcrypt = () => usingNative;

export default {
  hash,
  compare,
  genSalt,
  genSaltSync,
  hashSync,
  compareSync,
  isUsingNativeBcrypt,
};
