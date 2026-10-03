type ProfileBit = { full_name: string | null; avatar_url: string | null } | null;

/** An incoming pending connections row as notifications.tsx selects it. */
export type ConnectionRequestRow = {
  id: string;
  requester_id: string;
  recipient_id: string;
  initiated_by: string;
  created_at: string;
  updated_at: string;
  requester: ProfileBit;
  recipient: ProfileBit;
};

/** One incoming connection request card. */
export type ConnectionRequest = {
  id: string;
  requesterId: string;
  requesterName: string | null;   // null if profile missing
  requesterAvatarUrl: string | null;
  /** When the request was sent: updated_at, see below. */
  createdAt: string;
};

/**
 * The incoming connection request cards, newest first.
 *
 * A pair has a single connections row, and request_connection() reopens a
 * rejected row as a fresh pending request, so created_at can be weeks older
 * than the request itself. updated_at is set on every update (by
 * update_connections_updated_at) and a pending row has had no update since it
 * was sent or reopened, so it is when the request was sent.
 */
export function buildConnectionRequests(rows: ConnectionRequestRow[]): ConnectionRequest[] {
  return [...rows]
    .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at))
    .map((c) => {
      // The initiator's profile (the person who sent the request)
      const initiatorProfile = c.initiated_by === c.requester_id ? c.requester : c.recipient;
      return {
        id: c.id,
        requesterId: c.initiated_by,
        requesterName: initiatorProfile?.full_name ?? null,
        requesterAvatarUrl: initiatorProfile?.avatar_url ?? null,
        createdAt: c.updated_at,
      };
    });
}
