


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."collab_event_type_enum" AS ENUM (
    'join',
    'chat',
    'milestone',
    'commit',
    'design_sync',
    'mou_signed',
    'member_quit',
    'member_removed'
);


ALTER TYPE "public"."collab_event_type_enum" OWNER TO "postgres";


CREATE TYPE "public"."project_status_enum" AS ENUM (
    'active',
    'completed',
    'paused',
    'recruiting'
);


ALTER TYPE "public"."project_status_enum" OWNER TO "postgres";


CREATE TYPE "public"."university_enum" AS ENUM (
    'qub',
    'ulster'
);


ALTER TYPE "public"."university_enum" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."on_member_join"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO collaboration_events (project_id, user_id, event_type)
  VALUES (NEW.project_id, NEW.user_id, 'join');
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."on_member_join"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_connections_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_connections_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."chat_messages" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "read_by" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "type" "text" DEFAULT 'text'::"text" NOT NULL,
    "metadata" "jsonb"
);


ALTER TABLE "public"."chat_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."collab_invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "recipient_id" "uuid" NOT NULL,
    "role" "text" DEFAULT ''::"text" NOT NULL,
    "message" "text" DEFAULT ''::"text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    CONSTRAINT "collab_invitations_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'declined'::"text"])))
);


ALTER TABLE "public"."collab_invitations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."collaboration_events" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "event_type" "public"."collab_event_type_enum" NOT NULL,
    "metadata" "jsonb"
);


ALTER TABLE "public"."collaboration_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."connections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "requester_id" "uuid" NOT NULL,
    "recipient_id" "uuid" NOT NULL,
    "initiated_by" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "connections_check" CHECK (("requester_id" < "recipient_id")),
    CONSTRAINT "connections_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."connections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."direct_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "connection_id" "uuid" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "type" "text" DEFAULT 'text'::"text" NOT NULL,
    "metadata" "jsonb"
);


ALTER TABLE "public"."direct_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "full_name" "text",
    "avatar_url" "text",
    "university" "public"."university_enum",
    "department" "text",
    "year_of_study" integer,
    "bio" "text",
    "skills" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "badges" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "portfolio_links" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "pvs_score" integer DEFAULT 0 NOT NULL,
    "deleted_at" timestamp with time zone,
    "display_name_at_deletion" "text",
    "expo_push_token" "text"
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_members" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'member'::"text" NOT NULL,
    "intro_message" "text",
    "mou_accepted" boolean DEFAULT false NOT NULL,
    "mou_accepted_at" timestamp with time zone
);


ALTER TABLE "public"."project_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."projects" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "status" "public"."project_status_enum" DEFAULT 'recruiting'::"public"."project_status_enum" NOT NULL,
    "looking_for" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "university_scope" "text" DEFAULT 'both'::"text" NOT NULL,
    "project_health" integer,
    "github_repo_url" "text",
    "figma_url" "text",
    "start_date" "date",
    "end_date" "date",
    "project_type" "text",
    "collaboration_style" "text",
    "team_size" integer DEFAULT 1 NOT NULL,
    "commitment_hours" integer DEFAULT 5 NOT NULL,
    "owner_role" "text",
    "role_requirements" "jsonb" DEFAULT '[]'::"jsonb",
    "chat_icon_url" "text",
    "cover_url" "text"
);


ALTER TABLE "public"."projects" OWNER TO "postgres";


ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."collab_invitations"
    ADD CONSTRAINT "collab_invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."collab_invitations"
    ADD CONSTRAINT "collab_invitations_project_id_recipient_id_key" UNIQUE ("project_id", "recipient_id");



ALTER TABLE ONLY "public"."collaboration_events"
    ADD CONSTRAINT "collaboration_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."connections"
    ADD CONSTRAINT "connections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."connections"
    ADD CONSTRAINT "connections_requester_id_recipient_id_key" UNIQUE ("requester_id", "recipient_id");



ALTER TABLE ONLY "public"."direct_messages"
    ADD CONSTRAINT "direct_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_members"
    ADD CONSTRAINT "project_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_members"
    ADD CONSTRAINT "project_members_project_id_user_id_key" UNIQUE ("project_id", "user_id");



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_profiles_deleted_at" ON "public"."profiles" USING "btree" ("deleted_at") WHERE ("deleted_at" IS NOT NULL);



CREATE OR REPLACE TRIGGER "connections_updated_at" BEFORE UPDATE ON "public"."connections" FOR EACH ROW EXECUTE FUNCTION "public"."update_connections_updated_at"();



CREATE OR REPLACE TRIGGER "trg_member_join" AFTER INSERT ON "public"."project_members" FOR EACH ROW EXECUTE FUNCTION "public"."on_member_join"();



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."collab_invitations"
    ADD CONSTRAINT "collab_invitations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."collab_invitations"
    ADD CONSTRAINT "collab_invitations_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."collab_invitations"
    ADD CONSTRAINT "collab_invitations_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."collaboration_events"
    ADD CONSTRAINT "collaboration_events_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."collaboration_events"
    ADD CONSTRAINT "collaboration_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."connections"
    ADD CONSTRAINT "connections_initiated_by_fkey" FOREIGN KEY ("initiated_by") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."connections"
    ADD CONSTRAINT "connections_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."connections"
    ADD CONSTRAINT "connections_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."direct_messages"
    ADD CONSTRAINT "direct_messages_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "public"."connections"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."direct_messages"
    ADD CONSTRAINT "direct_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_members"
    ADD CONSTRAINT "project_members_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_members"
    ADD CONSTRAINT "project_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE "public"."chat_messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "chat_messages: members and owner read" ON "public"."chat_messages" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."project_members" "pm"
  WHERE (("pm"."project_id" = "chat_messages"."project_id") AND ("pm"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."projects" "p"
  WHERE (("p"."id" = "chat_messages"."project_id") AND ("p"."owner_id" = "auth"."uid"()))))));



CREATE POLICY "chat_messages: members and owner send" ON "public"."chat_messages" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "sender_id") AND ((EXISTS ( SELECT 1
   FROM "public"."project_members" "pm"
  WHERE (("pm"."project_id" = "chat_messages"."project_id") AND ("pm"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."projects" "p"
  WHERE (("p"."id" = "chat_messages"."project_id") AND ("p"."owner_id" = "auth"."uid"())))))));



ALTER TABLE "public"."collab_invitations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."collaboration_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."connections" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "connections_insert" ON "public"."connections" FOR INSERT WITH CHECK ((("auth"."uid"() = "initiated_by") AND (("auth"."uid"() = "requester_id") OR ("auth"."uid"() = "recipient_id"))));



CREATE POLICY "connections_select" ON "public"."connections" FOR SELECT USING ((("auth"."uid"() = "requester_id") OR ("auth"."uid"() = "recipient_id")));



CREATE POLICY "connections_update" ON "public"."connections" FOR UPDATE USING ((("auth"."uid"() <> "initiated_by") AND (("auth"."uid"() = "requester_id") OR ("auth"."uid"() = "recipient_id")))) WITH CHECK (("status" = ANY (ARRAY['accepted'::"text", 'rejected'::"text"])));



ALTER TABLE "public"."direct_messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "dm_insert" ON "public"."direct_messages" FOR INSERT WITH CHECK ((("auth"."uid"() = "sender_id") AND (EXISTS ( SELECT 1
   FROM "public"."connections" "c"
  WHERE (("c"."id" = "direct_messages"."connection_id") AND (("c"."requester_id" = "auth"."uid"()) OR ("c"."recipient_id" = "auth"."uid"())) AND ("c"."status" = 'accepted'::"text"))))));



CREATE POLICY "dm_select" ON "public"."direct_messages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."connections" "c"
  WHERE (("c"."id" = "direct_messages"."connection_id") AND (("c"."requester_id" = "auth"."uid"()) OR ("c"."recipient_id" = "auth"."uid"())) AND ("c"."status" = 'accepted'::"text")))));



CREATE POLICY "events: public read" ON "public"."collaboration_events" FOR SELECT USING (true);



CREATE POLICY "events: self or owner insert" ON "public"."collaboration_events" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "user_id") OR (EXISTS ( SELECT 1
   FROM "public"."projects" "p"
  WHERE (("p"."id" = "collaboration_events"."project_id") AND ("p"."owner_id" = "auth"."uid"()))))));



CREATE POLICY "invitations: recipient select" ON "public"."collab_invitations" FOR SELECT USING (("auth"."uid"() = "recipient_id"));



CREATE POLICY "invitations: recipient update" ON "public"."collab_invitations" FOR UPDATE USING (("auth"."uid"() = "recipient_id")) WITH CHECK (("status" = ANY (ARRAY['accepted'::"text", 'declined'::"text"])));



CREATE POLICY "invitations: sender insert" ON "public"."collab_invitations" FOR INSERT WITH CHECK ((("auth"."uid"() = "sender_id") AND ("project_id" IN ( SELECT "projects"."id"
   FROM "public"."projects"
  WHERE ("projects"."owner_id" = "auth"."uid"())))));



CREATE POLICY "invitations: sender select" ON "public"."collab_invitations" FOR SELECT USING (("auth"."uid"() = "sender_id"));



CREATE POLICY "members: own insert" ON "public"."project_members" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "members: own update" ON "public"."project_members" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "members: project owner update" ON "public"."project_members" FOR UPDATE USING (("project_id" IN ( SELECT "projects"."id"
   FROM "public"."projects"
  WHERE ("projects"."owner_id" = "auth"."uid"()))));



CREATE POLICY "members: public read" ON "public"."project_members" FOR SELECT USING (true);



CREATE POLICY "members: self or owner delete" ON "public"."project_members" FOR DELETE TO "authenticated" USING ((("auth"."uid"() = "user_id") OR (EXISTS ( SELECT 1
   FROM "public"."projects" "p"
  WHERE (("p"."id" = "project_members"."project_id") AND ("p"."owner_id" = "auth"."uid"()))))));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles: own insert" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "profiles: own update" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "profiles: public read" ON "public"."profiles" FOR SELECT USING (true);



ALTER TABLE "public"."project_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."projects" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "projects: owner delete" ON "public"."projects" FOR DELETE USING (("auth"."uid"() = "owner_id"));



CREATE POLICY "projects: owner insert" ON "public"."projects" FOR INSERT WITH CHECK (("auth"."uid"() = "owner_id"));



CREATE POLICY "projects: owner update" ON "public"."projects" FOR UPDATE USING (("auth"."uid"() = "owner_id"));



CREATE POLICY "projects: public read" ON "public"."projects" FOR SELECT USING (true);





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."chat_messages";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."collaboration_events";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."connections";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."direct_messages";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."on_member_join"() TO "anon";
GRANT ALL ON FUNCTION "public"."on_member_join"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."on_member_join"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_connections_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_connections_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_connections_updated_at"() TO "service_role";


















GRANT ALL ON TABLE "public"."chat_messages" TO "anon";
GRANT ALL ON TABLE "public"."chat_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_messages" TO "service_role";



GRANT ALL ON TABLE "public"."collab_invitations" TO "anon";
GRANT ALL ON TABLE "public"."collab_invitations" TO "authenticated";
GRANT ALL ON TABLE "public"."collab_invitations" TO "service_role";



GRANT ALL ON TABLE "public"."collaboration_events" TO "anon";
GRANT ALL ON TABLE "public"."collaboration_events" TO "authenticated";
GRANT ALL ON TABLE "public"."collaboration_events" TO "service_role";



GRANT ALL ON TABLE "public"."connections" TO "anon";
GRANT ALL ON TABLE "public"."connections" TO "authenticated";
GRANT ALL ON TABLE "public"."connections" TO "service_role";



GRANT ALL ON TABLE "public"."direct_messages" TO "anon";
GRANT ALL ON TABLE "public"."direct_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."direct_messages" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."project_members" TO "anon";
GRANT ALL ON TABLE "public"."project_members" TO "authenticated";
GRANT ALL ON TABLE "public"."project_members" TO "service_role";



GRANT ALL ON TABLE "public"."projects" TO "anon";
GRANT ALL ON TABLE "public"."projects" TO "authenticated";
GRANT ALL ON TABLE "public"."projects" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































drop extension if exists "pg_net";

CREATE TRIGGER trg_new_user AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


  create policy "Anyone can view avatars"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'avatars'::text));



  create policy "Users can update own avatar"
  on "storage"."objects"
  as permissive
  for update
  to authenticated
using (((bucket_id = 'avatars'::text) AND (owner = auth.uid())));



  create policy "Users can upload own avatar"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check ((bucket_id = 'avatars'::text));



  create policy "project-media: authenticated update"
  on "storage"."objects"
  as permissive
  for update
  to authenticated
using ((bucket_id = 'project-media'::text));



  create policy "project-media: authenticated write"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check ((bucket_id = 'project-media'::text));



  create policy "project-media: public read"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'project-media'::text));


-- Removed from the pull: protect_bucket_control_insert/update/update_role on
-- storage.buckets. Supabase's storage service owns those triggers and the
-- functions they call; they are not part of this schema, and the local
-- storage image does not ship those functions, so replaying them fails.
