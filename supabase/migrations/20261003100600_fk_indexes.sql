-- No foreign key had an index; every chat, membership and inbox read scanned.
-- Not duplicated by existing constraints: the unique keys on project_members,
-- collab_invitations and connections all lead with a different column.
create index if not exists idx_chat_messages_project_created on public.chat_messages (project_id, created_at);
create index if not exists idx_project_members_user on public.project_members (user_id);
create index if not exists idx_events_project_type on public.collaboration_events (project_id, event_type);
create index if not exists idx_dm_connection_created on public.direct_messages (connection_id, created_at);
create index if not exists idx_projects_owner on public.projects (owner_id);
create index if not exists idx_invitations_recipient on public.collab_invitations (recipient_id, status);
create index if not exists idx_connections_recipient on public.connections (recipient_id);
