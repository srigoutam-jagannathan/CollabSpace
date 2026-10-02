-- ============================================================
-- Connections and invitations: created pending, and the other party may
-- change the status only.
-- ============================================================
--
-- Update side: connections_update and "invitations: recipient update" check
-- only the new status, so the recipient could also rewrite requester_id /
-- recipient_id (an accepted connection with someone who never agreed, which
-- dm_insert then honours) or an invitation's project and role. The app only
-- ever writes status (app/(app)/notifications.tsx). Column grants close the
-- rest without touching those policies. update_connections_updated_at still
-- sets updated_at: triggers are not subject to column privileges.
--
-- Insert side: connections_insert and "invitations: sender insert" never
-- constrained status, so the sender could create a row already 'accepted'
-- and skip the other party's consent entirely (then DM them). The app's
-- inserts never send status (users/[id].tsx, ConnectTeamSheet.tsx,
-- InviteSheet.tsx), so they get the 'pending' default. The baseline
-- conditions are kept verbatim; only status = 'pending' is added.
-- ============================================================

revoke update on public.connections from anon, authenticated;
grant update (status) on public.connections to authenticated;

revoke update on public.collab_invitations from anon, authenticated;
grant update (status) on public.collab_invitations to authenticated;

alter policy connections_insert on public.connections
  with check (auth.uid() = initiated_by
              and auth.uid() in (requester_id, recipient_id)
              and status = 'pending');

alter policy "invitations: sender insert" on public.collab_invitations
  with check (auth.uid() = sender_id
              and status = 'pending'
              and project_id in (select id from public.projects where owner_id = auth.uid()));
