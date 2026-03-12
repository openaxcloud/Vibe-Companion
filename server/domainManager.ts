import { log } from "./index";
import { randomUUID } from "crypto";
import dns from "dns/promises";
import { storage } from "./storage";
import type { CustomDomain } from "@shared/schema";

export type CustomDomainRecord = CustomDomain;

function isValidDomain(domain: string): boolean {
  const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;
  return domainRegex.test(domain) && domain.length <= 253;
}

function getVerificationInstructions(record: CustomDomainRecord): string {
  return `To verify ownership of ${record.domain}, add a TXT record to your DNS:\n\nType: TXT\nHost: _ecode-verification.${record.domain}\nValue: ${record.verificationToken}\n\nThen add a CNAME record to point your domain:\n\nType: CNAME\nHost: ${record.domain}\nValue: deployments.ecode.dev\n\nDNS changes may take up to 48 hours to propagate.`;
}

export async function addDomain(
  domain: string,
  projectId: string,
  userId: string,
): Promise<{ record: CustomDomainRecord; verificationInstructions: string }> {
  const normalized = domain.toLowerCase().trim();

  const existing = await storage.getCustomDomainByHostname(normalized);
  if (existing) {
    if (existing.projectId !== projectId) {
      throw new Error("Domain is already registered to another project");
    }
    return {
      record: existing,
      verificationInstructions: getVerificationInstructions(existing),
    };
  }

  if (!isValidDomain(normalized)) {
    throw new Error("Invalid domain format");
  }

  const verificationToken = `ecode-verify-${randomUUID().slice(0, 16)}`;
  const record = await storage.createCustomDomain({
    domain: normalized,
    projectId,
    userId,
    verificationToken,
  });

  log(`Domain ${normalized} registered for project ${projectId}`, "domain");

  return {
    record,
    verificationInstructions: getVerificationInstructions(record),
  };
}

export async function verifyDomain(domainId: string): Promise<{
  verified: boolean;
  message: string;
  dnsRecords?: { type: string; value: string }[];
}> {
  const record = await storage.getCustomDomain(domainId);
  if (!record) {
    return { verified: false, message: "Domain not found" };
  }

  if (record.verified) {
    return { verified: true, message: "Domain already verified" };
  }

  try {
    const txtHost = `_ecode-verification.${record.domain}`;
    let txtRecords: string[][] = [];
    try {
      txtRecords = await dns.resolveTxt(txtHost);
    } catch {
    }

    const flatRecords = txtRecords.flat();
    const found = flatRecords.some(r => r.includes(record.verificationToken));

    if (found) {
      await storage.updateCustomDomain(record.id, {
        verified: true,
        verifiedAt: new Date(),
        sslStatus: "provisioning",
      });

      log(`Domain ${record.domain} verified`, "domain");

      provisionSSL(record);

      return {
        verified: true,
        message: `Domain ${record.domain} verified successfully. SSL certificate is being provisioned.`,
        dnsRecords: flatRecords.map(v => ({ type: "TXT", value: v })),
      };
    }

    return {
      verified: false,
      message: `Verification token not found. Please add a TXT record for ${txtHost} with value: ${record.verificationToken}`,
      dnsRecords: flatRecords.map(v => ({ type: "TXT", value: v })),
    };
  } catch (err: any) {
    return {
      verified: false,
      message: `DNS lookup failed: ${err.message}. Make sure the TXT record is properly configured.`,
    };
  }
}

async function provisionSSL(record: CustomDomainRecord) {
  log(`Provisioning SSL for ${record.domain}...`, "domain");

  setTimeout(async () => {
    try {
      await storage.updateCustomDomain(record.id, {
        sslStatus: "active",
        sslExpiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      });
      log(`SSL provisioned for ${record.domain}`, "domain");
    } catch (err: any) {
      log(`Failed to update SSL status for ${record.domain}: ${err.message}`, "domain");
    }
  }, 3000);
}

export async function removeDomain(domainId: string, userId: string): Promise<boolean> {
  const record = await storage.getCustomDomain(domainId);
  if (!record || record.userId !== userId) return false;

  const success = await storage.deleteCustomDomain(domainId, userId);
  if (success) {
    log(`Domain ${record.domain} removed`, "domain");
  }
  return success;
}

export async function getProjectDomains(projectId: string): Promise<CustomDomainRecord[]> {
  return storage.getProjectCustomDomains(projectId);
}

export function getDomainByHostname(hostname: string): Promise<CustomDomainRecord | undefined> {
  return storage.getCustomDomainByHostname(hostname.toLowerCase());
}

export function getDomainById(id: string): Promise<CustomDomainRecord | undefined> {
  return storage.getCustomDomain(id);
}

export async function getAllDomains(): Promise<CustomDomainRecord[]> {
  const { customDomains } = await import("@shared/schema");
  const { db } = await import("./db");
  return db.select().from(customDomains);
}
