/**
 * Native bcrypt regression test.
 *
 * Background: an audit on 2026-04-27 found that the bcrypt-compat layer
 * (server/utils/bcrypt-compat.ts) used `require('bcrypt')` to load the
 * native addon. The package.json declares `"type": "module"`, so `require`
 * is undefined in this ESM module, the call always threw, and the compat
 * layer permanently fell back to the pure-JS `bcryptjs` — 10× slower than
 * native and event-loop-blocking under any meaningful login throughput.
 *
 * Fix: replaced `require` with `createRequire(import.meta.url)`, which
 * works inside ESM and synchronously loads the native CJS addon.
 *
 * This test locks in three guarantees:
 *   1. Native bcrypt is actually loaded (`isUsingNativeBcrypt() === true`).
 *   2. Hashing a password at cost=12 takes < 2s (native target; bcryptjs
 *      at the same cost runs 5-8s on this hardware, which would fail
 *      this test).
 *   3. Round-trip hash/compare works on a known password.
 *
 * If anyone reverts the createRequire fix or downgrades the bcrypt
 * package, this test fails on the next CI run.
 */

import { describe, it, expect } from "vitest";
import { hash, compare, isUsingNativeBcrypt } from "../server/utils/bcrypt-compat";

describe("bcrypt-compat — native loading", () => {
  it("loads the native bcrypt addon, not the bcryptjs fallback", () => {
    expect(
      isUsingNativeBcrypt(),
      "bcrypt-compat fell back to bcryptjs. Check that the `bcrypt` package " +
      "is installed with native build deps (node-gyp, python3) and that " +
      "createRequire(import.meta.url) is being used (not bare `require`).",
    ).toBe(true);
  });

  it("round-trips a password through hash() and compare()", async () => {
    const password = "fortune-500-test-password-2026";
    const h = await hash(password, 12);
    expect(h).toMatch(/^\$2[ayb]\$12\$/);
    expect(await compare(password, h)).toBe(true);
    expect(await compare("wrong", h)).toBe(false);
  });

  it("hashes at cost=12 in well under 2s (native, not bcryptjs)", async () => {
    const start = Date.now();
    await hash("perf-canary", 12);
    const elapsed = Date.now() - start;
    expect(
      elapsed,
      `hash() at cost=12 took ${elapsed}ms — native bcrypt should be < 2000ms ` +
      `on any modern CPU. bcryptjs at the same cost takes 5-8s. If this fails, ` +
      `the compat layer is silently using bcryptjs again.`,
    ).toBeLessThan(2000);
  });

  it("verifies hashes produced by bcryptjs (cross-compat for legacy DB rows)", async () => {
    // Hash of "hello" produced by bcryptjs@^3 at cost=10. Both bcrypt and
    // bcryptjs produce/verify $2a$ and $2b$ interchangeably, so any
    // existing DB hashes from the bcryptjs-fallback era keep working after
    // the migration to native.
    const bcryptjsHash = "$2b$10$jy2xUUBb/xsQ59i0TXVjaOf2QVwllvbPXNxlI89dUeAcILzmxlcc.";
    expect(await compare("hello", bcryptjsHash)).toBe(true);
  });
});
