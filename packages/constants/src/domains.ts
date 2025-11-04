// Domain Access Control Configuration

/**
 * Allowed email domains for internal users
 * Internal users get full access based on RBAC
 */
export const INTERNAL_DOMAINS = ['vapourdesal.com'] as const;

/**
 * Allowed email domains for external CLIENT_PM users
 * Loaded from environment variable NEXT_PUBLIC_ALLOWED_CLIENT_DOMAINS
 * Format: "domain1.com,domain2.com,domain3.com"
 */
export function getAllowedClientDomains(): string[] {
  // Check if running in browser
  if (typeof window !== 'undefined') {
    // Client-side: environment variable should be injected at build time
    const envVar = process.env.NEXT_PUBLIC_ALLOWED_CLIENT_DOMAINS;
    if (envVar) {
      return envVar
        .split(',')
        .map((domain: string) => domain.trim().toLowerCase())
        .filter((domain: string) => domain.length > 0);
    }
  } else {
    // Server-side: can access process.env directly
    const envVar = process.env.NEXT_PUBLIC_ALLOWED_CLIENT_DOMAINS;
    if (envVar) {
      return envVar
        .split(',')
        .map((domain: string) => domain.trim().toLowerCase())
        .filter((domain: string) => domain.length > 0);
    }
  }

  // Log warning if no client domains configured
  if (typeof console !== 'undefined' && console.warn) {
    console.warn(
      '⚠️ NEXT_PUBLIC_ALLOWED_CLIENT_DOMAINS environment variable not configured. ' +
      'External CLIENT_PM users will not be able to sign in.'
    );
  }

  return [];
}

/**
 * Domain type
 */
export type DomainType = 'internal' | 'external';

/**
 * Check if email is from internal domain
 */
export function isInternalDomain(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return false;

  return INTERNAL_DOMAINS.some((allowedDomain) => domain === allowedDomain);
}

/**
 * Check if email domain is allowed for CLIENT_PM role
 */
export function isAllowedClientDomain(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return false;

  const allowedDomains = getAllowedClientDomains();
  return allowedDomains.includes(domain);
}

/**
 * Check if email is from an authorized domain (internal OR allowed client)
 */
export function isAuthorizedDomain(email: string): boolean {
  return isInternalDomain(email) || isAllowedClientDomain(email);
}

/**
 * Get domain type from email
 */
export function getDomainType(email: string): DomainType {
  return isInternalDomain(email) ? 'internal' : 'external';
}

/**
 * Validate email domain for specific role
 * CLIENT_PM can only be external
 * All other roles must be internal
 */
export function validateRoleForDomain(
  role: string,
  email: string
): {
  valid: boolean;
  error?: string;
} {
  const isInternal = isInternalDomain(email);

  if (role === 'CLIENT_PM') {
    // CLIENT_PM must be external domain
    if (isInternal) {
      return {
        valid: false,
        error: 'CLIENT_PM role is only for external client project managers',
      };
    }
  } else {
    // All other roles must be internal domain
    if (!isInternal) {
      return {
        valid: false,
        error: `Role ${role} requires @vapourdesal.com email address`,
      };
    }
  }

  return { valid: true };
}

/**
 * Get allowed roles for domain
 */
export function getAllowedRolesForDomain(domainType: DomainType): string[] {
  if (domainType === 'internal') {
    return [
      'SUPER_ADMIN',
      'DIRECTOR',
      'HR_ADMIN',
      'FINANCE_MANAGER',
      'ACCOUNTANT',
      'PROJECT_MANAGER',
      'ENGINEERING_HEAD',
      'ENGINEER',
      'PROCUREMENT_MANAGER',
      'SITE_ENGINEER',
      'TEAM_MEMBER',
    ];
  } else {
    // External domains can only be CLIENT_PM
    return ['CLIENT_PM'];
  }
}

/**
 * Domain validation error messages
 */
export const DOMAIN_ERRORS = {
  INVALID_DOMAIN_FOR_ROLE: 'This role requires a @vapourdesal.com email address',
  EXTERNAL_DOMAIN_NOT_ALLOWED: 'External email domains can only use CLIENT_PM role',
  INTERNAL_DOMAIN_REQUIRED: 'This operation requires a @vapourdesal.com email address',
  CLIENT_PM_MUST_BE_EXTERNAL: 'CLIENT_PM role is only for external client project managers',
} as const;
