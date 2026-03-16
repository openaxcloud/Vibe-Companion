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

export function generateSelfSignedCert(domain: string): { cert: string; key: string; expiresAt: Date } {
  const crypto = require("crypto") as typeof import("crypto");
  const { X509Certificate } = crypto;

  const { privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

  function encodeLength(length: number): Buffer {
    if (length < 128) return Buffer.from([length]);
    if (length < 256) return Buffer.from([0x81, length]);
    return Buffer.from([0x82, (length >> 8) & 0xff, length & 0xff]);
  }

  function derSequence(...items: Buffer[]): Buffer {
    const content = Buffer.concat(items);
    return Buffer.concat([Buffer.from([0x30]), encodeLength(content.length), content]);
  }

  function derSet(...items: Buffer[]): Buffer {
    const content = Buffer.concat(items);
    return Buffer.concat([Buffer.from([0x31]), encodeLength(content.length), content]);
  }

  function derOid(oid: number[]): Buffer {
    const encoded: number[] = [40 * oid[0] + oid[1]];
    for (let i = 2; i < oid.length; i++) {
      let val = oid[i];
      if (val >= 128) {
        const bytes: number[] = [];
        bytes.unshift(val & 0x7f);
        val >>= 7;
        while (val > 0) { bytes.unshift(0x80 | (val & 0x7f)); val >>= 7; }
        encoded.push(...bytes);
      } else {
        encoded.push(val);
      }
    }
    const buf = Buffer.from(encoded);
    return Buffer.concat([Buffer.from([0x06]), encodeLength(buf.length), buf]);
  }

  function derUtf8(str: string): Buffer {
    const buf = Buffer.from(str, "utf-8");
    return Buffer.concat([Buffer.from([0x0c]), encodeLength(buf.length), buf]);
  }

  function derInteger(val: Buffer): Buffer {
    let v = val;
    if (v[0] & 0x80) v = Buffer.concat([Buffer.from([0x00]), v]);
    return Buffer.concat([Buffer.from([0x02]), encodeLength(v.length), v]);
  }

  function derBitString(data: Buffer): Buffer {
    const content = Buffer.concat([Buffer.from([0x00]), data]);
    return Buffer.concat([Buffer.from([0x03]), encodeLength(content.length), content]);
  }

  function derGeneralizedTime(date: Date): Buffer {
    const str = date.toISOString().replace(/[-:T]/g, "").slice(0, 14) + "Z";
    const buf = Buffer.from(str, "ascii");
    return Buffer.concat([Buffer.from([0x18]), encodeLength(buf.length), buf]);
  }

  function derExplicit(tag: number, content: Buffer): Buffer {
    return Buffer.concat([Buffer.from([0xa0 | tag]), encodeLength(content.length), content]);
  }

  const serialNumber = crypto.randomBytes(16);
  serialNumber[0] &= 0x7f;
  const serial = derInteger(serialNumber);

  const sha256WithRSA = derSequence(derOid([1, 2, 840, 113549, 1, 1, 11]), Buffer.from([0x05, 0x00]));

  const cnAttr = derSequence(derOid([2, 5, 4, 3]), derUtf8(domain));
  const orgAttr = derSequence(derOid([2, 5, 4, 10]), derUtf8("eCode Self-Signed"));
  const issuerName = derSequence(derSet(orgAttr), derSet(cnAttr));

  const notBeforeTime = derGeneralizedTime(new Date());
  const notAfterTime = derGeneralizedTime(expiresAt);
  const validity = derSequence(notBeforeTime, notAfterTime);

  const keyPem = privateKey as string;
  const spkiDer = crypto.createPublicKey(keyPem).export({ type: "spki", format: "der" });

  const version = derExplicit(0, derInteger(Buffer.from([0x02])));
  const tbsCertificate = derSequence(version, serial, sha256WithRSA, issuerName, validity, issuerName, Buffer.from(spkiDer));

  const signer = crypto.createSign("SHA256");
  signer.update(tbsCertificate);
  const signature = signer.sign(keyPem);

  const certificate = derSequence(tbsCertificate, sha256WithRSA, derBitString(signature));

  const certPem = `-----BEGIN CERTIFICATE-----\n${certificate.toString("base64").match(/.{1,64}/g)!.join("\n")}\n-----END CERTIFICATE-----\n`;

  return { cert: certPem, key: keyPem, expiresAt };
}

async function provisionSSL(record: CustomDomainRecord) {
  log(`Provisioning self-signed SSL for ${record.domain}...`, "domain");

  try {
    const { cert, key, expiresAt } = generateSelfSignedCert(record.domain);
    log(`Generated self-signed X.509 certificate for ${record.domain} (expires ${expiresAt.toISOString()})`, "domain");
    log(`Certificate PEM (${cert.length} bytes), Key PEM (${key.length} bytes) generated`, "domain");

    await storage.updateCustomDomain(record.id, {
      sslStatus: "self-signed",
      sslExpiresAt: expiresAt,
    });
    log(`Self-signed SSL provisioned for ${record.domain}. Note: This certificate is for development verification only. Production HTTPS requires external TLS termination (e.g., Let's Encrypt/ACME, Cloudflare, or a load balancer with real certificates).`, "domain");
  } catch (err: any) {
    log(`Failed to provision SSL for ${record.domain}: ${err.message}`, "domain");
    await storage.updateCustomDomain(record.id, {
      sslStatus: "failed",
    }).catch(() => {});
  }
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
