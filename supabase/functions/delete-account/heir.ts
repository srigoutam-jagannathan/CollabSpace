export type MemberRow = { user_id: string; status: string; created_at: string };

/**
 * Who inherits a project when its owner deletes their account: the
 * earliest approved member other than the owner. A pending requester was
 * never let in by the owner, so never inherits. Null means no heir, and
 * the project is deleted.
 */
export function pickHeir(rows: MemberRow[], departingOwnerId: string): string | null {
  const heir = rows
    .filter((r) => r.status === "approved" && r.user_id !== departingOwnerId)
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))[0];
  return heir?.user_id ?? null;
}
