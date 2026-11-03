import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Baseline: the schema as of main @ 8f7d574 (Phases 1–3a), which was built by dev
 * push before migrations existed. A database that already has it (a dev DB) skips
 * the create and just records the baseline; an empty one (Neon) gets it in full.
 */
export async function up({ db, payload }: MigrateUpArgs): Promise<void> {
  const existing = await db.execute(sql`SELECT to_regclass('public.attendance_records') AS t`)
  if (existing.rows[0]?.t) {
    payload.logger.info('baseline: schema already present, skipping create')
    return
  }
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_role" AS ENUM('admin', 'advisor', 'discipline');
  CREATE TYPE "public"."enum_terms_term" AS ENUM('1', '2');
  CREATE TYPE "public"."enum_classrooms_level" AS ENUM('m1', 'm2', 'm3', 'm4', 'm5', 'm6');
  CREATE TYPE "public"."enum_students_prefix" AS ENUM('ด.ช.', 'ด.ญ.', 'นาย', 'น.ส.');
  CREATE TYPE "public"."enum_students_status" AS ENUM('studying', 'transferred', 'on_leave', 'graduated');
  CREATE TYPE "public"."enum_attendance_records_status" AS ENUM('present', 'late', 'leave', 'absent', 'left_early');
  CREATE TYPE "public"."enum_audit_logs_action" AS ENUM('create', 'edit', 'backdate', 'delete');
  CREATE TABLE "users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"full_name" varchar NOT NULL,
  	"role" "enum_users_role" DEFAULT 'advisor' NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"reset_password_requested_at" timestamp(3) with time zone,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "academic_years" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"year" numeric NOT NULL,
  	"is_active" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "terms" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"term" "enum_terms_term" NOT NULL,
  	"academic_year_id" integer NOT NULL,
  	"start_date" timestamp(3) with time zone,
  	"end_date" timestamp(3) with time zone,
  	"is_active" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "classrooms" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"level" "enum_classrooms_level" NOT NULL,
  	"room_number" numeric NOT NULL,
  	"academic_year_id" integer NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "classrooms_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "students" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"student_id" varchar NOT NULL,
  	"prefix" "enum_students_prefix",
  	"first_name" varchar NOT NULL,
  	"last_name" varchar NOT NULL,
  	"class_number" numeric,
  	"classroom_id" integer NOT NULL,
  	"status" "enum_students_status" DEFAULT 'studying' NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "attendance_records" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"student_id" integer NOT NULL,
  	"date" varchar NOT NULL,
  	"status" "enum_attendance_records_status" NOT NULL,
  	"note" varchar,
  	"classroom_id" integer,
  	"academic_year_id" integer,
  	"term_id" integer,
  	"recorded_by_id" integer,
  	"recorded_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "audit_logs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"collection_slug" varchar,
  	"document_id" varchar,
  	"action" "enum_audit_logs_action",
  	"actor_id" integer,
  	"timestamp" timestamp(3) with time zone,
  	"before" jsonb,
  	"after" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer,
  	"academic_years_id" integer,
  	"terms_id" integer,
  	"classrooms_id" integer,
  	"students_id" integer,
  	"attendance_records_id" integer,
  	"audit_logs_id" integer
  );
  
  CREATE TABLE "payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "terms" ADD CONSTRAINT "terms_academic_year_id_academic_years_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "classrooms" ADD CONSTRAINT "classrooms_academic_year_id_academic_years_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "classrooms_rels" ADD CONSTRAINT "classrooms_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."classrooms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "classrooms_rels" ADD CONSTRAINT "classrooms_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "students" ADD CONSTRAINT "students_classroom_id_classrooms_id_fk" FOREIGN KEY ("classroom_id") REFERENCES "public"."classrooms"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_classroom_id_classrooms_id_fk" FOREIGN KEY ("classroom_id") REFERENCES "public"."classrooms"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_academic_year_id_academic_years_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_term_id_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "public"."terms"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_recorded_by_id_users_id_fk" FOREIGN KEY ("recorded_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_academic_years_fk" FOREIGN KEY ("academic_years_id") REFERENCES "public"."academic_years"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_terms_fk" FOREIGN KEY ("terms_id") REFERENCES "public"."terms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_classrooms_fk" FOREIGN KEY ("classrooms_id") REFERENCES "public"."classrooms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_students_fk" FOREIGN KEY ("students_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_attendance_records_fk" FOREIGN KEY ("attendance_records_id") REFERENCES "public"."attendance_records"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_audit_logs_fk" FOREIGN KEY ("audit_logs_id") REFERENCES "public"."audit_logs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
  CREATE UNIQUE INDEX "academic_years_year_idx" ON "academic_years" USING btree ("year");
  CREATE INDEX "academic_years_updated_at_idx" ON "academic_years" USING btree ("updated_at");
  CREATE INDEX "academic_years_created_at_idx" ON "academic_years" USING btree ("created_at");
  CREATE INDEX "terms_academic_year_idx" ON "terms" USING btree ("academic_year_id");
  CREATE INDEX "terms_updated_at_idx" ON "terms" USING btree ("updated_at");
  CREATE INDEX "terms_created_at_idx" ON "terms" USING btree ("created_at");
  CREATE INDEX "classrooms_academic_year_idx" ON "classrooms" USING btree ("academic_year_id");
  CREATE INDEX "classrooms_updated_at_idx" ON "classrooms" USING btree ("updated_at");
  CREATE INDEX "classrooms_created_at_idx" ON "classrooms" USING btree ("created_at");
  CREATE INDEX "classrooms_rels_order_idx" ON "classrooms_rels" USING btree ("order");
  CREATE INDEX "classrooms_rels_parent_idx" ON "classrooms_rels" USING btree ("parent_id");
  CREATE INDEX "classrooms_rels_path_idx" ON "classrooms_rels" USING btree ("path");
  CREATE INDEX "classrooms_rels_users_id_idx" ON "classrooms_rels" USING btree ("users_id");
  CREATE UNIQUE INDEX "students_student_id_idx" ON "students" USING btree ("student_id");
  CREATE INDEX "students_classroom_idx" ON "students" USING btree ("classroom_id");
  CREATE INDEX "students_updated_at_idx" ON "students" USING btree ("updated_at");
  CREATE INDEX "students_created_at_idx" ON "students" USING btree ("created_at");
  CREATE INDEX "attendance_records_student_idx" ON "attendance_records" USING btree ("student_id");
  CREATE INDEX "attendance_records_classroom_idx" ON "attendance_records" USING btree ("classroom_id");
  CREATE INDEX "attendance_records_academic_year_idx" ON "attendance_records" USING btree ("academic_year_id");
  CREATE INDEX "attendance_records_term_idx" ON "attendance_records" USING btree ("term_id");
  CREATE INDEX "attendance_records_recorded_by_idx" ON "attendance_records" USING btree ("recorded_by_id");
  CREATE INDEX "attendance_records_updated_at_idx" ON "attendance_records" USING btree ("updated_at");
  CREATE INDEX "attendance_records_created_at_idx" ON "attendance_records" USING btree ("created_at");
  CREATE UNIQUE INDEX "student_date_idx" ON "attendance_records" USING btree ("student_id","date");
  CREATE INDEX "audit_logs_actor_idx" ON "audit_logs" USING btree ("actor_id");
  CREATE INDEX "audit_logs_updated_at_idx" ON "audit_logs" USING btree ("updated_at");
  CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_locked_documents_rels_academic_years_id_idx" ON "payload_locked_documents_rels" USING btree ("academic_years_id");
  CREATE INDEX "payload_locked_documents_rels_terms_id_idx" ON "payload_locked_documents_rels" USING btree ("terms_id");
  CREATE INDEX "payload_locked_documents_rels_classrooms_id_idx" ON "payload_locked_documents_rels" USING btree ("classrooms_id");
  CREATE INDEX "payload_locked_documents_rels_students_id_idx" ON "payload_locked_documents_rels" USING btree ("students_id");
  CREATE INDEX "payload_locked_documents_rels_attendance_records_id_idx" ON "payload_locked_documents_rels" USING btree ("attendance_records_id");
  CREATE INDEX "payload_locked_documents_rels_audit_logs_id_idx" ON "payload_locked_documents_rels" USING btree ("audit_logs_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "users_sessions" CASCADE;
  DROP TABLE "users" CASCADE;
  DROP TABLE "academic_years" CASCADE;
  DROP TABLE "terms" CASCADE;
  DROP TABLE "classrooms" CASCADE;
  DROP TABLE "classrooms_rels" CASCADE;
  DROP TABLE "students" CASCADE;
  DROP TABLE "attendance_records" CASCADE;
  DROP TABLE "audit_logs" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TYPE "public"."enum_users_role";
  DROP TYPE "public"."enum_terms_term";
  DROP TYPE "public"."enum_classrooms_level";
  DROP TYPE "public"."enum_students_prefix";
  DROP TYPE "public"."enum_students_status";
  DROP TYPE "public"."enum_attendance_records_status";
  DROP TYPE "public"."enum_audit_logs_action";`)
}
