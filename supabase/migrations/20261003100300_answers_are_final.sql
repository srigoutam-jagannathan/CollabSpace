-- ============================================================
-- Answers are final (decision 2026-10-02): only a pending request or
-- invitation can be answered. Before this, a rejected connection could later
-- be flipped to accepted, and an invitation could go accepted -> declined ->
-- accepted. The existing WITH CHECK clauses stay; only USING gains the
-- pending condition. accept_invitation() already checks status = 'pending'
-- itself. Reconnecting after a rejection is request_connection() (100350).
-- ============================================================

alter policy "connections_update" on public.connections
  using (auth.uid() <> initiated_by
         and (auth.uid() = requester_id or auth.uid() = recipient_id)
         and status = 'pending');

alter policy "invitations: recipient update" on public.collab_invitations
  using (auth.uid() = recipient_id and status = 'pending');
