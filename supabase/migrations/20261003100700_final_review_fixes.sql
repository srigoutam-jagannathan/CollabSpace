-- ============================================================
-- Phase 1 final review fixes.
-- ============================================================

-- ── 1. Members update their commitment only; owners update nothing ──────
-- "members: project owner update" (baseline) allowed any column: an owner
-- could set mou_accepted on a member (forging a committed event) or set
-- status back to pending and re-approve (one extra mou_signed each time),
-- and "members: own update" let a member rename their role to "Owner".
-- The app's only update is Profile's Commit button
-- ((tabs)/profile.tsx: mou_accepted, mou_accepted_at). intro_message and
-- role are set on insert by the join form. Approval goes through
-- approve_member / accept_invitation, which are SECURITY DEFINER and run
-- as postgres, so column grants don't apply to them. guard_member_status
-- stays as a backstop.
drop policy "members: project owner update" on public.project_members;

revoke update on public.project_members from anon, authenticated;
grant update (mou_accepted, mou_accepted_at) on public.project_members to authenticated;
