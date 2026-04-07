CREATE TABLE IF NOT EXISTS customer_requests (
    id SERIAL PRIMARY KEY,
    form_type VARCHAR(64) NOT NULL,
    page_path VARCHAR(255) NOT NULL,
    sender_name VARCHAR(255),
    sender_email VARCHAR(320),
    sender_company VARCHAR(255),
    sender_phone VARCHAR(50),
    subject VARCHAR(255),
    message TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'new',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_customer_requests_form_type ON customer_requests(form_type);
CREATE INDEX IF NOT EXISTS idx_customer_requests_status ON customer_requests(status);
CREATE INDEX IF NOT EXISTS idx_customer_requests_created_at ON customer_requests(created_at DESC);
