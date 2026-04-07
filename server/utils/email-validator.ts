// E-Code Design Email Validation
export function validateEmail(email: string): { valid: boolean; error?: string } {
  // Check if email is provided
  if (!email || email.trim() === '') {
    return { valid: false, error: 'Email address is required' };
  }

  // Convert to lowercase for consistency
  email = email.toLowerCase().trim();

  // E-Code Design: Enhanced email validation regex
  // Matches standard email format with additional constraints
  const emailRegex = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}@[a-zA-Z0-9][a-zA-Z0-9.-]{0,62}\.[a-zA-Z]{2,}$/;
  
  if (!emailRegex.test(email)) {
    return { valid: false, error: 'Please enter a valid email address' };
  }

  // Check email length
  if (email.length > 254) { // RFC 5321
    return { valid: false, error: 'Email address is too long' };
  }

  // Extract domain
  const [localPart, domain] = email.split('@');

  // Validate local part
  if (localPart.length > 64) { // RFC 5321
    return { valid: false, error: 'Email username is too long' };
  }

  // Check for consecutive dots
  if (email.includes('..')) {
    return { valid: false, error: 'Email cannot contain consecutive dots' };
  }

  // Check if starts or ends with special characters
  if (localPart.startsWith('.') || localPart.endsWith('.')) {
    return { valid: false, error: 'Email username cannot start or end with a dot' };
  }

  // E-Code Design: Block disposable email domains
  const blockedDomains = [
    'tempmail.com', 'throwaway.email', '10minutemail.com', 'guerrillamail.com',
    'mailinator.com', 'maildrop.cc', 'trashmail.com', 'temp-mail.org',
    'fakeinbox.com', 'yopmail.com', 'sharklasers.com', 'guerrillamail.info',
    'spam4.me', 'grr.la', 'guerrillamail.biz', 'guerrillamail.net'
  ];

  if (blockedDomains.includes(domain)) {
    return { valid: false, error: 'Please use a permanent email address' };
  }

  // E-Code Design: Suggest common domain corrections
  const commonDomains: Record<string, string> = {
    'gmial.com': 'gmail.com',
    'gmai.com': 'gmail.com',
    'gmil.com': 'gmail.com',
    'yahooo.com': 'yahoo.com',
    'yaho.com': 'yahoo.com',
    'hotmial.com': 'hotmail.com',
    'hotmai.com': 'hotmail.com',
    'outlok.com': 'outlook.com',
    'iclod.com': 'icloud.com',
    'icloud.co': 'icloud.com'
  };

  if (commonDomains[domain]) {
    return { 
      valid: false, 
      error: `Did you mean ${localPart}@${commonDomains[domain]}?` 
    };
  }

  return { valid: true };
}

// Check if email looks like a business email
export function isBusinessEmail(email: string): boolean {
  const freeEmailDomains = [
    'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com',
    'icloud.com', 'mail.com', 'protonmail.com', 'yandex.com', 'zoho.com',
    'gmx.com', 'mail.ru', 'inbox.com', 'live.com', 'msn.com'
  ];

  const domain = email.split('@')[1]?.toLowerCase();
  return domain ? !freeEmailDomains.includes(domain) : false;
}

// Sanitize email for safe storage
export function sanitizeEmail(email: string): string {
  return email.toLowerCase().trim();
}