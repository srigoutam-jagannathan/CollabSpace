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
  const parts = email.trim().split("@");
  // Exactly one "@", with something on both sides of it.
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  // ASCII only, checked before lower-casing: toLowerCase() folds some
  // non-ASCII letters into ASCII ones (U+212A KELVIN SIGN becomes "k"), so a
  // lookalike domain would otherwise normalise into an allowed one.
  if (!/^[\x21-\x7e]+$/.test(parts[1])) return null;
  return parts[1].toLowerCase();
}

/**
 * Returns the university key if the email is from an allowed institution,
 * or null if it is not permitted on this platform.
 */
export function resolveUniversity(email: string): "qub" | "ulster" | null {
  const domain = extractDomain(email);
  // A membership test, not a plain object lookup: DOMAIN_TO_UNIVERSITY["constructor"]
  // is Object, which is truthy and would pass the lock.
  if (!domain || !(ALLOWED_DOMAINS as readonly string[]).includes(domain)) return null;
  return DOMAIN_TO_UNIVERSITY[domain as AllowedDomain];
}
