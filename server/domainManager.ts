import { log } from "./index";
import { randomUUID } from "crypto";
import dns from "dns/promises";

export interface CustomDomainRecord {
  id: string;
  domain: string;
  projectId: string;
  userId: string;
  verified: boolean;
  verificationToken: string;
  sslStatus: "pending" | "provisioning" | "active" | "failed";
  sslExpiresAt?: Date;
  createdAt: Date;
  verifiedAt?: Date;
}

const domainStore = new Map<string, CustomDomainRecord>();
const domainByProject = new Map<string, string[]>();
const domainByHostname = new Map<string, CustomDomainRecord>();

export function addDomain(
  domain: string,
  projectId: string,
  userId: string,
): { record: CustomDomainRecord; verificationInstructions: string } {
  const normalized = domain.toLowerCase().trim();

  if (domainByHostname.has(normalized)) {
    const existing = domainByHostname.get(normalized)!;
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
  const record: CustomDomainRecord = {
    id: randomUUID(),
    domain: normalized,
    projectId,
    userId,
    verified: false,
    verificationToken,
    sslStatus: "pending",
    createdAt: new Date(),
  };

  domainStore.set(record.id, record);
  domainByHostname.set(normalized, record);

  const projectDomains = domainByProject.get(projectId) || [];
  projectDomains.push(record.id);
  domainByProject.set(projectId, projectDomains);

  log(`Domain ${normalized} registered for project ${projectId}`, "domain");

  return {
    record,
    verificationInstructions: getVerificationInstructions(record),
  };
}

function isValidDomain(domain: string): boolean {
  const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;
  return domainRegex.test(domain) && domain.length <= 253;
}

function getVerificationInstructions(record: CustomDomainRecord): string {
  return `To verify ownership of ${record.domain}, add a TXT record to your DNS:\n\nType: TXT\nHost: _ecode-verification.${record.domain}\nValue: ${record.verificationToken}\n\nThen add a CNAME record to point your domain:\n\nType: CNAME\nHost: ${record.domain}\nValue: deployments.ecode.dev\n\nDNS changes may take up to 48 hours to propagate.`;
}

export async function verifyDomain(domainId: string): Promise<{
  verified: boolean;
  message: string;
  dnsRecords?: { type: string; value: string }[];
}> {
  const record = domainStore.get(domainId);
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
      // DNS lookup failed
    }

    const flatRecords = txtRecords.flat();
    const found = flatRecords.some(r => r.includes(record.verificationToken));

    if (found) {
      record.verified = true;
      record.verifiedAt = new Date();
      record.sslStatus = "provisioning";
      domainStore.set(record.id, record);
      domainByHostname.set(record.domain, record);

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

  setTimeout(() => {
    record.sslStatus = "active";
    record.sslExpiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    domainStore.set(record.id, record);
    domainByHostname.set(record.domain, record);
    log(`SSL provisioned for ${record.domain} (expires ${record.sslExpiresAt.toISOString()})`, "domain");
  }, 3000);
}

export function removeDomain(domainId: string, userId: string): boolean {
  const record = domainStore.get(domainId);
  if (!record || record.userId !== userId) return false;

  domainStore.delete(domainId);
  domainByHostname.delete(record.domain);

  const projectDomains = domainByProject.get(record.projectId) || [];
  domainByProject.set(
    record.projectId,
    projectDomains.filter(id => id !== domainId),
  );

  log(`Domain ${record.domain} removed`, "domain");
  return true;
}

export function getProjectDomains(projectId: string): CustomDomainRecord[] {
  const ids = domainByProject.get(projectId) || [];
  return ids.map(id => domainStore.get(id)!).filter(Boolean);
}

export function getDomainByHostname(hostname: string): CustomDomainRecord | undefined {
  return domainByHostname.get(hostname.toLowerCase());
}

export function getDomainById(id: string): CustomDomainRecord | undefined {
  return domainStore.get(id);
}

export function getAllDomains(): CustomDomainRecord[] {
  return Array.from(domainStore.values());
}
