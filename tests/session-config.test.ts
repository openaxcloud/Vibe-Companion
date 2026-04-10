import { describe, it, expect } from "vitest";

describe("Session configuration consistency", () => {
  it("All session configs use the same maxAge (7 days)", async () => {
    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

    const indexTs = await import("fs").then(fs => fs.readFileSync("server/index.ts", "utf-8"));
    const routesTs = await import("fs").then(fs => fs.readFileSync("server/routes.ts", "utf-8"));
    const passportTs = await import("fs").then(fs => fs.readFileSync("server/middleware/passport-setup.ts", "utf-8"));
    const securityTs = await import("fs").then(fs => fs.readFileSync("server/utils/security.ts", "utf-8"));
    const sessionMgrTs = await import("fs").then(fs => fs.readFileSync("server/auth/session-manager.ts", "utf-8"));

    const pattern = /maxAge:\s*([\d\s*]+)/g;

    function extractMaxAges(code: string): number[] {
      const ages: number[] = [];
      let match;
      const re = /maxAge:\s*([\d\s*]+)/g;
      while ((match = re.exec(code)) !== null) {
        try {
          const val = eval(match[1]);
          if (typeof val === "number" && val > 60000) ages.push(val);
        } catch {}
      }
      return ages;
    }

    const indexAges = extractMaxAges(indexTs);
    const routesAges = extractMaxAges(routesTs);
    const passportAges = extractMaxAges(passportTs);
    const securityAges = extractMaxAges(securityTs);
    const sessionMgrAges = extractMaxAges(sessionMgrTs);

    const allSessionAges = [...indexAges, ...routesAges, ...passportAges, ...securityAges, ...sessionMgrAges];
    const sessionCookieAges = allSessionAges.filter(a => a >= 24 * 60 * 60 * 1000);

    for (const age of sessionCookieAges) {
      expect(age).toBe(SEVEN_DAYS);
    }
  });

  it("Cookie name is ecode.sid everywhere", async () => {
    const fs = await import("fs");
    const files = [
      "server/index.ts",
      "server/routes.ts",
      "server/middleware/passport-setup.ts",
    ];

    for (const file of files) {
      const content = fs.readFileSync(file, "utf-8");
      const nameMatches = content.match(/name:\s*['"]([^'"]+)['"]/g) || [];
      const sessionNames = nameMatches
        .map(m => m.match(/['"]([^'"]+)['"]/)?.[1])
        .filter(n => n && n.includes("sid"));

      for (const name of sessionNames) {
        expect(name).toBe("ecode.sid");
      }
    }
  });
});
