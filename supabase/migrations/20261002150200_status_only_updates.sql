-- ============================================================
-- Connections and invitations: the other party may change the status only.
-- ============================================================
--
-- connections_update and "invitations: recipient update" check only the new
-- status, so the recipient could also rewrite requester_id / recipient_id
-- (an accepted connection with someone who never agreed, which dm_insert
-- then honours) or an invitation's project and role. The app only ever
-- writes status (app/(app)/notifications.tsx). Column grants close the rest
-- without touching the policies. update_connections_updated_at still sets
-- updated_at: triggers are not subject to column privileges.
-- ============================================================

revoke update on public.connections from anon, authenticated;
grant update (status) on public.connections to authenticated;

revoke update on public.collab_invitations from anon, authenticated;
grant update (status) on public.collab_invitations to authenticated;
