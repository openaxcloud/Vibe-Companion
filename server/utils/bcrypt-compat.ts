// @ts-nocheck
import bcryptjs from 'bcryptjs';

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
  try {
    const nativeBcrypt = require('bcrypt');
    bcryptImpl = nativeBcrypt.default || nativeBcrypt;
    usingNative = true;
    console.log('[bcrypt-compat] Using native bcrypt');
  } catch {
    bcryptImpl = bcryptjs;
    console.log('[bcrypt-compat] Native bcrypt unavailable, using bcryptjs fallback');
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
