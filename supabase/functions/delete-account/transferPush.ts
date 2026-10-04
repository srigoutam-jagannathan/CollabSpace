export interface TransferPushDeps {
  pushToken(userId: string): Promise<string | null>;
  sendPush(msg: { to: string; title: string; body: string }): Promise<unknown>;
}

/**
 * Tells the member who inherited a project that they now own it. Sent here,
 * with the service role, rather than through notify-owner, which only
 * accepts a leaver's own JWT. Best effort: a failed push is logged and never
 * stops the account deletion. Returns whether a push went out.
 */
export async function notifyNewOwner(
  newOwnerId: string,
  previousOwnerName: string,
  d: TransferPushDeps,
): Promise<boolean> {
  try {
    const token = await d.pushToken(newOwnerId);
    if (!token) return false;
    await d.sendPush({
      to: token,
      title: "You're now the project owner",
      body: `${previousOwnerName} deleted their account. You've inherited ownership.`,
    });
    return true;
  } catch (err) {
    console.error("delete-account: new-owner push failed:", err);
    return false;
  }
}
