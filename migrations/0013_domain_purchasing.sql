CREATE TABLE IF NOT EXISTS "purchased_domains" (
  "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "domain" text NOT NULL UNIQUE,
  "tld" text NOT NULL,
  "user_id" varchar(36) NOT NULL,
  "project_id" varchar(36),
  "purchase_price" integer NOT NULL DEFAULT 0,
  "renewal_price" integer NOT NULL DEFAULT 0,
  "status" text NOT NULL DEFAULT 'active',
  "auto_renew" boolean NOT NULL DEFAULT true,
  "whois_privacy" boolean NOT NULL DEFAULT true,
  "expires_at" timestamp NOT NULL DEFAULT now(),
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "dns_records" (
  "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "domain_id" varchar(36) NOT NULL,
  "record_type" text NOT NULL,
  "name" text NOT NULL,
  "value" text NOT NULL,
  "ttl" integer NOT NULL DEFAULT 3600,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "purchased_domains_user_idx" ON "purchased_domains" ("user_id");
CREATE INDEX IF NOT EXISTS "purchased_domains_project_idx" ON "purchased_domains" ("project_id");
CREATE INDEX IF NOT EXISTS "dns_records_domain_idx" ON "dns_records" ("domain_id");

ALTER TABLE "dns_records" ADD CONSTRAINT "dns_records_domain_id_fk" FOREIGN KEY ("domain_id") REFERENCES "purchased_domains"("id") ON DELETE CASCADE;
