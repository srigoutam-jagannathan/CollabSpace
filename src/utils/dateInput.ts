/**
 * Typing a DD/MM/YYYY date without the slashes.
 *
 * `formatDateInput` is an onChangeText filter: it keeps up to eight digits and
 * adds the slash after the day and after the month as soon as each is complete.
 * When the user is deleting, it doesn't add a trailing slash back, so backspace
 * can get past one.
 */
export function formatDateInput(next: string, prev: string): string {
  const digits = next.replace(/\D/g, "").slice(0, 8);
  const deleting = next.length < prev.length;

  let out = digits.slice(0, 2);
  if (digits.length > 2 || (digits.length === 2 && !deleting)) out += "/";
  out += digits.slice(2, 4);
  if (digits.length > 4 || (digits.length === 4 && !deleting)) out += "/";
  out += digits.slice(4);
  return out;
}

/**
 * DD/MM/YYYY → YYYY-MM-DD, or null when the text is incomplete or names a day
 * that doesn't exist. Postgres would read a slashed date month-first, so a date
 * column must only ever get the ISO form.
 */
export function ddmmyyyyToIso(text: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const date = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
  // Date.UTC rolls 31/04 over to 01/05; a round trip catches it.
  if (
    date.getUTCFullYear() !== Number(yyyy) ||
    date.getUTCMonth() !== Number(mm) - 1 ||
    date.getUTCDate() !== Number(dd)
  ) {
    return null;
  }
  return `${yyyy}-${mm}-${dd}`;
}
