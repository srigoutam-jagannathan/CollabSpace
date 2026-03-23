/**
 * The Belfast Lock — approved email domains.
 * Extending to other universities in Phase 5 means adding to this list only.
 */
export const ALLOWED_DOMAINS = ["qub.ac.uk", "ulster.ac.uk"] as const;

export type AllowedDomain = (typeof ALLOWED_DOMAINS)[number];

export const DOMAIN_TO_UNIVERSITY: Record<AllowedDomain, "qub" | "ulster"> = {
  "qub.ac.uk": "qub",
  "ulster.ac.uk": "ulster",
};

/**
 * Extracts the domain from an email address.
 * Returns null for malformed inputs.
 */
export function extractDomain(email: string): string | null {
  const parts = email.toLowerCase().trim().split("@");
  return parts.length === 2 ? parts[1] : null;
}

/**
 * Returns the university key if the email is from an allowed institution,
 * or null if it is not permitted on this platform.
 */
export function resolveUniversity(email: string): "qub" | "ulster" | null {
  const domain = extractDomain(email);
  if (!domain) return null;
  return DOMAIN_TO_UNIVERSITY[domain as AllowedDomain] ?? null;
}
