export const SUPPORTED_TLDS = ["com", "net", "org", "io", "dev", "app", "ai", "co"];

export function getRegistrar() {
  return {
    async checkAvailability(domain: string) { return { available: false, domain }; },
    async register(domain: string, _opts: any) { return { success: false, message: "Domain registration not configured" }; },
    async getDnsRecords(domain: string) { return []; },
    async setDnsRecords(domain: string, records: any[]) { return { success: true }; },
  };
}
