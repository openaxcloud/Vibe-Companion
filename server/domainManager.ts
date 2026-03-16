import { log } from "./index";
import { randomUUID } from "crypto";
import dns from "dns/promises";
import crypto from "crypto";
import { storage } from "./storage";
import type { CustomDomain } from "@shared/schema";

export type CustomDomainRecord = CustomDomain;

const ACME_DIRECTORY_URL = process.env.ACME_DIRECTORY_URL || "https://acme-v02.api.letsencrypt.org/directory";
const ACME_STAGING_URL = "https://acme-staging-v02.api.letsencrypt.org/directory";

const acmeChallengeTokens = new Map<string, string>();

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
    } catch (err: any) {
      log(`[domain] DNS TXT lookup for ${txtHost} failed: ${err.code || err.message}`, "domain");
    }

    const flatRecords = txtRecords.flat();
    const found = flatRecords.some(r => r.includes(record.verificationToken));

    if (found) {
      let cnameVerified = false;
      try {
        const cnameRecords = await dns.resolveCname(record.domain);
        cnameVerified = cnameRecords.some(r => r.toLowerCase().includes("ecode") || r.toLowerCase().includes("deployments"));
        if (!cnameVerified) {
          log(`[domain] CNAME for ${record.domain} points to ${cnameRecords.join(", ")} (expected deployments.ecode.dev)`, "domain");
        }
      } catch (err: any) {
        try {
          const aRecords = await dns.resolve4(record.domain);
          if (aRecords.length > 0) {
            cnameVerified = true;
            log(`[domain] ${record.domain} has A records: ${aRecords.join(", ")} (CNAME not required)`, "domain");
          }
        } catch {
          log(`[domain] No CNAME or A record found for ${record.domain}`, "domain");
        }
      }

      await storage.updateCustomDomain(record.id, {
        verified: true,
        verifiedAt: new Date(),
        sslStatus: "provisioning",
      });

      log(`Domain ${record.domain} verified (CNAME ${cnameVerified ? "confirmed" : "pending"})`, "domain");

      provisionSSL(record);

      return {
        verified: true,
        message: `Domain ${record.domain} verified successfully. SSL certificate is being provisioned.${!cnameVerified ? " Note: CNAME/A record not yet detected — ensure DNS points to deployments.ecode.dev." : ""}`,
        dnsRecords: flatRecords.map(v => ({ type: "TXT", value: v })),
      };
    }

    return {
      verified: false,
      message: `Verification token not found. Please add a TXT record for ${txtHost} with value: ${record.verificationToken}`,
      dnsRecords: flatRecords.map(v => ({ type: "TXT", value: v })),
    };
  } catch (err: any) {
    log(`[domain] Verification error for ${record.domain}: ${err.message}`, "domain");
    return {
      verified: false,
      message: `DNS lookup failed: ${err.message}. Make sure the TXT record is properly configured.`,
    };
  }
}

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function acmeRequest(url: string, payload?: any, accountKey?: crypto.KeyObject, kid?: string, nonce?: string): Promise<{ headers: Headers; body: any; nonce: string }> {
  if (payload === undefined && !accountKey) {
    const res = await fetch(url);
    const body = await res.json();
    return { headers: res.headers, body, nonce: res.headers.get("replay-nonce") || "" };
  }

  if (payload === undefined) {
    payload = "";
  }

  const header: any = { alg: "ES256", nonce, url };
  if (kid) {
    header.kid = kid;
  } else if (accountKey) {
    const pubKey = crypto.createPublicKey(accountKey);
    const jwk = pubKey.export({ format: "jwk" });
    header.jwk = { crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y };
  }

  const protectedHeader = base64url(Buffer.from(JSON.stringify(header)));
  const payloadB64 = payload === "" ? "" : base64url(Buffer.from(JSON.stringify(payload)));
  const signingInput = `${protectedHeader}.${payloadB64}`;

  const sign = crypto.createSign("SHA256");
  sign.update(signingInput);
  const derSig = sign.sign(accountKey!);

  const rLen = derSig[3];
  let r = derSig.subarray(4, 4 + rLen);
  let s = derSig.subarray(4 + rLen + 2);
  if (r.length > 32) r = r.subarray(r.length - 32);
  if (s.length > 32) s = s.subarray(s.length - 32);
  const rawSig = Buffer.concat([
    Buffer.alloc(32 - r.length), r,
    Buffer.alloc(32 - s.length), s,
  ]);
  const signature = base64url(rawSig);

  const jws = JSON.stringify({ protected: protectedHeader, payload: payloadB64, signature });
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/jose+json" },
    body: jws,
  });

  const bodyText = await res.text();
  let body;
  try { body = JSON.parse(bodyText); } catch { body = bodyText; }

  return { headers: res.headers, body, nonce: res.headers.get("replay-nonce") || "" };
}

async function provisionACME(record: CustomDomainRecord): Promise<{ cert: string; key: string; expiresAt: Date } | null> {
  try {
    const useStaging = process.env.ACME_STAGING === "true";
    const directoryUrl = useStaging ? ACME_STAGING_URL : ACME_DIRECTORY_URL;
    log(`[acme] Starting Let's Encrypt provisioning for ${record.domain} (${useStaging ? "staging" : "production"})`, "domain");

    const dirRes = await fetch(directoryUrl);
    const directory = await dirRes.json() as any;

    const accountKey = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" }).privateKey;

    let nonceRes = await fetch(directory.newNonce, { method: "HEAD" });
    let nonce = nonceRes.headers.get("replay-nonce") || "";

    const accountRes = await acmeRequest(directory.newAccount, {
      termsOfServiceAgreed: true,
      contact: process.env.ACME_EMAIL ? [`mailto:${process.env.ACME_EMAIL}`] : [],
    }, accountKey, undefined, nonce);
    const kid = accountRes.headers.get("location") || "";
    nonce = accountRes.nonce;
    log(`[acme] Account created/found: ${kid.slice(0, 60)}`, "domain");

    const orderRes = await acmeRequest(directory.newOrder, {
      identifiers: [{ type: "dns", value: record.domain }],
    }, accountKey, kid, nonce);
    nonce = orderRes.nonce;

    if (!orderRes.body.authorizations || orderRes.body.authorizations.length === 0) {
      log(`[acme] No authorizations returned for ${record.domain}`, "domain");
      return null;
    }

    const authzUrl = orderRes.body.authorizations[0];
    const authzRes = await acmeRequest(authzUrl, undefined, accountKey, kid, nonce);
    nonce = authzRes.nonce;
    const challenges = authzRes.body.challenges || [];
    const httpChallenge = challenges.find((c: any) => c.type === "http-01");

    if (!httpChallenge) {
      log(`[acme] No http-01 challenge available for ${record.domain}`, "domain");
      return null;
    }

    const pubKey = crypto.createPublicKey(accountKey);
    const jwk = pubKey.export({ format: "jwk" });
    const thumbprintInput = JSON.stringify({ crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y });
    const thumbprint = base64url(crypto.createHash("sha256").update(thumbprintInput).digest());
    const keyAuthorization = `${httpChallenge.token}.${thumbprint}`;

    acmeChallengeTokens.set(httpChallenge.token, keyAuthorization);
    log(`[acme] HTTP-01 challenge token stored for ${record.domain}`, "domain");

    const challengeRes = await acmeRequest(httpChallenge.url, {}, accountKey, kid, nonce);
    nonce = challengeRes.nonce;

    let orderReady = false;
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const checkRes = await acmeRequest(authzUrl, undefined, accountKey, kid, nonce);
      nonce = checkRes.nonce;
      if (checkRes.body.status === "valid") { orderReady = true; break; }
      if (checkRes.body.status === "invalid") {
        log(`[acme] Challenge failed for ${record.domain}: ${JSON.stringify(checkRes.body)}`, "domain");
        break;
      }
    }

    acmeChallengeTokens.delete(httpChallenge.token);

    if (!orderReady) {
      log(`[acme] Challenge not validated for ${record.domain} within timeout`, "domain");
      return null;
    }

    const certKey = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
    const csrDer = generateCSR(record.domain, certKey.privateKey, certKey.publicKey);

    const finalizeRes = await acmeRequest(orderRes.body.finalize, {
      csr: base64url(csrDer),
    }, accountKey, kid, nonce);
    nonce = finalizeRes.nonce;

    let certUrl = finalizeRes.body.certificate;
    if (!certUrl) {
      const orderLocation = orderRes.headers.get("location") || "";
      for (let i = 0; i < 15; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const orderCheck = await acmeRequest(orderLocation, undefined, accountKey, kid, nonce);
        nonce = orderCheck.nonce;
        if (orderCheck.body.certificate) { certUrl = orderCheck.body.certificate; break; }
        if (orderCheck.body.status === "invalid") break;
      }
    }

    if (!certUrl) {
      log(`[acme] No certificate URL received for ${record.domain}`, "domain");
      return null;
    }

    const certRes = await fetch(certUrl, {
      headers: { Accept: "application/pem-certificate-chain" },
    });
    const certPem = await certRes.text();
    const keyPem = certKey.privateKey.export({ type: "pkcs8", format: "pem" }) as string;

    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    log(`[acme] Let's Encrypt certificate provisioned for ${record.domain} (expires ~${expiresAt.toISOString()})`, "domain");

    return { cert: certPem, key: keyPem, expiresAt };
  } catch (err: any) {
    log(`[acme] ACME provisioning failed for ${record.domain}: ${err.message}`, "domain");
    return null;
  }
}

function generateCSR(domain: string, privateKey: crypto.KeyObject, publicKey: crypto.KeyObject): Buffer {
  const cnOid = Buffer.from([0x06, 0x03, 0x55, 0x04, 0x03]);
  const cnValue = Buffer.from(domain, "utf-8");
  const cnValueTagged = Buffer.concat([Buffer.from([0x0c]), encodeLength(cnValue.length), cnValue]);
  const cnAtv = derSequence(cnOid, cnValueTagged);
  const cnSet = derSet(cnAtv);
  const subject = derSequence(cnSet);

  const spkiDer = publicKey.export({ type: "spki", format: "der" });

  const sanOid = Buffer.from([0x06, 0x03, 0x55, 0x1d, 0x11]);
  const dnsName = Buffer.from(domain, "utf-8");
  const sanEntry = Buffer.concat([Buffer.from([0x82]), encodeLength(dnsName.length), dnsName]);
  const sanSeq = derSequence(sanEntry);
  const sanExt = derSequence(sanOid, Buffer.concat([Buffer.from([0x04]), encodeLength(sanSeq.length), sanSeq]));
  const extensions = derSequence(sanExt);
  const extReq = derSequence(
    Buffer.from([0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x09, 0x0e]),
    derSet(extensions),
  );
  const attributes = Buffer.concat([Buffer.from([0xa0]), encodeLength(extReq.length), extReq]);

  const version = derInteger(Buffer.from([0x00]));
  const certRequestInfo = derSequence(version, subject, Buffer.from(spkiDer as Buffer), attributes);

  const sign = crypto.createSign("SHA256");
  sign.update(certRequestInfo);
  const signature = sign.sign(privateKey);

  const sha256WithECDSA = derSequence(
    Buffer.from([0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x04, 0x03, 0x02]),
  );
  const sigBitString = Buffer.concat([Buffer.from([0x03]), encodeLength(signature.length + 1), Buffer.from([0x00]), signature]);

  return derSequence(certRequestInfo, sha256WithECDSA, sigBitString);
}

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

function derInteger(val: Buffer): Buffer {
  let v = val;
  if (v[0] & 0x80) v = Buffer.concat([Buffer.from([0x00]), v]);
  return Buffer.concat([Buffer.from([0x02]), encodeLength(v.length), v]);
}

export function generateSelfSignedCert(domain: string): { cert: string; key: string; expiresAt: Date } {
  const { privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

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
  log(`[ssl] Starting SSL provisioning for ${record.domain}...`, "domain");

  const acmeResult = await provisionACME(record);

  if (acmeResult) {
    await storage.updateCustomDomain(record.id, {
      sslStatus: "active",
      sslExpiresAt: acmeResult.expiresAt,
    });
    log(`[ssl] Let's Encrypt certificate active for ${record.domain} (expires ${acmeResult.expiresAt.toISOString()})`, "domain");
    return;
  }

  log(`[ssl] ACME failed for ${record.domain}, falling back to self-signed certificate`, "domain");
  try {
    const { cert, key, expiresAt } = generateSelfSignedCert(record.domain);
    log(`[ssl] Generated self-signed X.509 certificate for ${record.domain} (expires ${expiresAt.toISOString()})`, "domain");

    await storage.updateCustomDomain(record.id, {
      sslStatus: "self-signed",
      sslExpiresAt: expiresAt,
    });
    log(`[ssl] Self-signed SSL provisioned for ${record.domain}. For production HTTPS, configure Let's Encrypt by setting ACME_EMAIL env var and ensuring port 80 is accessible.`, "domain");
  } catch (err: any) {
    log(`[ssl] Failed to provision SSL for ${record.domain}: ${err.message}`, "domain");
    await storage.updateCustomDomain(record.id, {
      sslStatus: "failed",
    }).catch((e: any) => log(`[ssl] Failed to update domain status: ${e.message}`, "domain"));
  }
}

export function getACMEChallengeResponse(token: string): string | undefined {
  return acmeChallengeTokens.get(token);
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

export async function renewExpiringCertificates(daysBeforeExpiry = 30): Promise<void> {
  const allDomains = await getAllDomains();
  const now = Date.now();
  const thresholdMs = daysBeforeExpiry * 24 * 60 * 60 * 1000;

  for (const domain of allDomains) {
    if (!domain.verified || !domain.sslExpiresAt) continue;
    const expiresAt = new Date(domain.sslExpiresAt).getTime();
    if (expiresAt - now < thresholdMs) {
      log(`[ssl] Certificate for ${domain.domain} expires in ${Math.round((expiresAt - now) / (24 * 60 * 60 * 1000))} days, attempting renewal...`, "domain");
      await provisionSSL(domain);
    }
  }
}
