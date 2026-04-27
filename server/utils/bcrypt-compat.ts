// @ts-nocheck
import bcryptjs from 'bcryptjs';
import { createRequire } from 'node:module';

interface BcryptInterface {
  hash(data: string, saltOrRounds: number | string): Promise<string>;
  compare(data: string, encrypted: string): Promise<boolean>;
  genSalt(rounds?: number): Promise<string>;
  genSaltSync(rounds?: number): string;
  hashSync(data: string, saltOrRounds: number | string): string;
  compareSync(data: string, encrypted: string): boolean;
}

let bcryptImpl: BcryptInterface = bcryptjs;
let usingNative = false;

function initBcrypt() {
  // Native bcrypt is a CommonJS native addon. In an ESM module ("type":
  // "module") `require` is undefined; using it would silently throw and
  // we'd permanently fall back to the 10×-slower pure-JS bcryptjs (real
  // bug found 2026-04-27). createRequire builds a require function that
  // works inside ESM and lets us load the native addon without making
  // this module async (so synchronous callers in legacy code keep
  // working).
  const req = createRequire(import.meta.url);
  try {
    const nativeBcrypt = req('bcrypt');
    bcryptImpl = nativeBcrypt.default || nativeBcrypt;
    usingNative = true;
    console.log('[bcrypt-compat] Using native bcrypt');
  } catch (err: any) {
    bcryptImpl = bcryptjs;
    if (process.env.NODE_ENV === 'production') {
      console.error('[bcrypt-compat] CRITICAL: native bcrypt unavailable in production, falling back to bcryptjs (10× slower, blocks the event loop). Install bcrypt with native build deps (node-gyp, python3) or rebuild the image. Original error: ' + (err?.message || err));
    } else {
      console.warn('[bcrypt-compat] Native bcrypt unavailable, using bcryptjs fallback (' + (err?.message || err) + ')');
    }
  }
}
initBcrypt();

export const hash: BcryptInterface['hash'] = (...args) => bcryptImpl.hash(...args);
export const compare: BcryptInterface['compare'] = (...args) => bcryptImpl.compare(...args);
export const genSalt: BcryptInterface['genSalt'] = (...args) => bcryptImpl.genSalt(...args);
export const genSaltSync: BcryptInterface['genSaltSync'] = (...args) => bcryptImpl.genSaltSync(...args);
export const hashSync: BcryptInterface['hashSync'] = (...args) => bcryptImpl.hashSync(...args);
export const compareSync: BcryptInterface['compareSync'] = (...args) => bcryptImpl.compareSync(...args);
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
