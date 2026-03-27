import { log } from "./index";
import { storage } from "./storage";

export interface DomainSearchResult {
  domain: string;
  tld: string;
  available: boolean;
  registrationPrice: number;
  renewalPrice: number;
  premium?: boolean;
}

export interface DomainRegistrarAdapter {
  searchAvailability(query: string, tlds: string[]): Promise<DomainSearchResult[]>;
  purchaseDomain(domain: string, tld: string, userId: string): Promise<{ success: boolean; expiresAt: Date }>;
  configureDns(domain: string, records: { type: string; name: string; value: string; ttl: number }[]): Promise<boolean>;
  checkRenewalStatus(domain: string): Promise<{ autoRenew: boolean; expiresAt: Date; status: string }>;
}

const TLD_PRICING: Record<string, { registration: number; renewal: number }> = {
  ".com": { registration: 1099, renewal: 1499 },
  ".ai": { registration: 7999, renewal: 7999 },
  ".dev": { registration: 1299, renewal: 1299 },
  ".io": { registration: 3999, renewal: 3999 },
  ".app": { registration: 1499, renewal: 1499 },
  ".net": { registration: 1199, renewal: 1599 },
  ".org": { registration: 1199, renewal: 1599 },
  ".co": { registration: 2999, renewal: 2999 },
  ".xyz": { registration: 299, renewal: 1299 },
  ".tech": { registration: 499, renewal: 4999 },
};

export const SUPPORTED_TLDS = Object.keys(TLD_PRICING);

export class DemoRegistrarAdapter implements DomainRegistrarAdapter {
  async searchAvailability(query: string, tlds: string[]): Promise<DomainSearchResult[]> {
    const normalized = query.toLowerCase().replace(/[^a-z0-9-]/g, "");
    if (!normalized) return [];

    const results: DomainSearchResult[] = [];
    const targetTlds = tlds.length > 0 ? tlds : SUPPORTED_TLDS;

    for (const tld of targetTlds) {
      const fullDomain = `${normalized}${tld}`;
      const pricing = TLD_PRICING[tld];
      if (!pricing) continue;

      const existing = await storage.getPurchasedDomainByName(fullDomain);
      const hash = Array.from(fullDomain).reduce((acc, c) => acc + c.charCodeAt(0), 0);
      const available = !existing && hash % 5 !== 0;

      results.push({
        domain: fullDomain,
        tld,
        available,
        registrationPrice: pricing.registration,
        renewalPrice: pricing.renewal,
        premium: tld === ".ai" || (hash % 7 === 0),
      });
    }

    return results.sort((a, b) => {
      if (a.available !== b.available) return a.available ? -1 : 1;
      return a.registrationPrice - b.registrationPrice;
    });
  }

  async purchaseDomain(domain: string, tld: string, userId: string): Promise<{ success: boolean; expiresAt: Date }> {
    const fullDomain = domain.includes(tld) ? domain : `${domain}${tld}`;
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    log(`[registrar-demo] Domain ${fullDomain} purchased for user ${userId}`, "domain");
    return { success: true, expiresAt };
  }

  async configureDns(domain: string, records: { type: string; name: string; value: string; ttl: number }[]): Promise<boolean> {
    log(`[registrar-demo] Configured ${records.length} DNS records for ${domain}`, "domain");
    return true;
  }

  async checkRenewalStatus(domain: string): Promise<{ autoRenew: boolean; expiresAt: Date; status: string }> {
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    return { autoRenew: true, expiresAt, status: "active" };
  }
}

export class ProductionRegistrarAdapter implements DomainRegistrarAdapter {
  private apiKey: string;
  private apiSecret: string;
  private provider: string;

  constructor(provider: string, apiKey: string, apiSecret: string) {
    this.provider = provider;
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    log(`[registrar] Production adapter initialized for ${provider}`, "domain");
  }

  async searchAvailability(query: string, tlds: string[]): Promise<DomainSearchResult[]> {
    const normalized = query.toLowerCase().replace(/[^a-z0-9-]/g, "");
    if (!normalized) return [];

    const targetTlds = tlds.length > 0 ? tlds : SUPPORTED_TLDS;
    const results: DomainSearchResult[] = [];

    for (const tld of targetTlds) {
      const fullDomain = `${normalized}${tld}`;
      const pricing = TLD_PRICING[tld];
      if (!pricing) continue;

      const existing = await storage.getPurchasedDomainByName(fullDomain);
      let available = !existing;

      if (available && this.provider === "namecheap") {
        try {
          const res = await fetch(
            `https://api.namecheap.com/xml.response?ApiUser=${this.apiKey}&ApiKey=${this.apiSecret}&UserName=${this.apiKey}&Command=namecheap.domains.check&ClientIp=0.0.0.0&DomainList=${fullDomain}`
          );
          const text = await res.text();
          available = text.includes('Available="true"');
        } catch (err) {
          log(`[registrar] Namecheap API error for ${fullDomain}: ${err}`, "error");
        }
      } else if (available && this.provider === "cloudflare") {
        try {
          const res = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${this.apiSecret}/registrar/domains/${fullDomain}`,
            { headers: { "Authorization": `Bearer ${this.apiKey}`, "Content-Type": "application/json" } }
          );
          const data = await res.json() as { success: boolean; result?: { available: boolean } };
          available = data.success && !!data.result?.available;
        } catch (err) {
          log(`[registrar] Cloudflare API error for ${fullDomain}: ${err}`, "error");
        }
      }

      results.push({
        domain: fullDomain,
        tld,
        available,
        registrationPrice: pricing.registration,
        renewalPrice: pricing.renewal,
        premium: tld === ".ai" || false,
      });
    }

    return results.sort((a, b) => {
      if (a.available !== b.available) return a.available ? -1 : 1;
      return a.registrationPrice - b.registrationPrice;
    });
  }

  async purchaseDomain(domain: string, tld: string, userId: string): Promise<{ success: boolean; expiresAt: Date }> {
    const fullDomain = domain.includes(tld) ? domain : `${domain}${tld}`;
    log(`[registrar] Purchasing ${fullDomain} via ${this.provider} for user ${userId}`, "domain");

    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    if (this.provider === "namecheap") {
      try {
        const res = await fetch(
          `https://api.namecheap.com/xml.response?ApiUser=${this.apiKey}&ApiKey=${this.apiSecret}&UserName=${this.apiKey}&Command=namecheap.domains.create&ClientIp=0.0.0.0&DomainName=${fullDomain}&Years=1`
        );
        const text = await res.text();
        if (!text.includes('Registered="true"')) {
          log(`[registrar] Namecheap purchase failed for ${fullDomain}`, "error");
          return { success: false, expiresAt };
        }
      } catch (err) {
        log(`[registrar] Namecheap API error: ${err}`, "error");
        return { success: false, expiresAt };
      }
    } else if (this.provider === "cloudflare") {
      try {
        const res = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${this.apiSecret}/registrar/domains/${fullDomain}/register`,
          {
            method: "POST",
            headers: { "Authorization": `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ auto_renew: true, privacy: true, years: 1 }),
          }
        );
        const data = await res.json() as { success: boolean };
        if (!data.success) {
          log(`[registrar] Cloudflare purchase failed for ${fullDomain}`, "error");
          return { success: false, expiresAt };
        }
      } catch (err) {
        log(`[registrar] Cloudflare API error: ${err}`, "error");
        return { success: false, expiresAt };
      }
    }

    return { success: true, expiresAt };
  }

  async configureDns(domain: string, records: { type: string; name: string; value: string; ttl: number }[]): Promise<boolean> {
    log(`[registrar] Configuring ${records.length} DNS records for ${domain} via ${this.provider}`, "domain");

    if (this.provider === "cloudflare") {
      try {
        const zoneRes = await fetch(
          `https://api.cloudflare.com/client/v4/zones?name=${domain}`,
          { headers: { "Authorization": `Bearer ${this.apiKey}` } }
        );
        const zoneData = await zoneRes.json() as { result?: { id: string }[] };
        const zoneId = zoneData.result?.[0]?.id;
        if (!zoneId) {
          log(`[registrar] Cloudflare zone not found for ${domain}`, "error");
          return false;
        }

        for (const record of records) {
          await fetch(
            `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`,
            {
              method: "POST",
              headers: { "Authorization": `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({ type: record.type, name: record.name, content: record.value, ttl: record.ttl }),
            }
          );
        }
        return true;
      } catch (err) {
        log(`[registrar] Cloudflare DNS error: ${err}`, "error");
        return false;
      }
    }

    return true;
  }

  async checkRenewalStatus(domain: string): Promise<{ autoRenew: boolean; expiresAt: Date; status: string }> {
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    return { autoRenew: true, expiresAt, status: "active" };
  }
}

let registrarInstance: DomainRegistrarAdapter | null = null;

export function getRegistrar(): DomainRegistrarAdapter {
  if (!registrarInstance) {
    const provider = process.env.DOMAIN_REGISTRAR_PROVIDER;
    const apiKey = process.env.DOMAIN_REGISTRAR_API_KEY;
    const apiSecret = process.env.DOMAIN_REGISTRAR_API_SECRET;

    if (provider && apiKey && apiSecret) {
      registrarInstance = new ProductionRegistrarAdapter(provider, apiKey, apiSecret);
      log(`[registrar] Using production registrar: ${provider}`, "domain");
    } else {
      registrarInstance = new DemoRegistrarAdapter();
      log("[registrar] Using demo registrar adapter (set DOMAIN_REGISTRAR_PROVIDER, DOMAIN_REGISTRAR_API_KEY, DOMAIN_REGISTRAR_API_SECRET for production)", "domain");
    }
  }
  return registrarInstance;
}
