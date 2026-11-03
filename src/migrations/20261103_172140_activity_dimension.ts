import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Optional subject/activity dimension on attendance (hand-edited from
 * `migrate:create`; the .json snapshot matches the resulting schema).
 *
 * 1. Status 5 renamed in place: `left_early` → `resigned` (label ลาออก). RENAME VALUE
 *    keeps every existing row; the generated drop/recreate of the enum would fail on
 *    them. Old AuditLog JSON keeps the old string — the log is append-only.
 * 2. New `activities` collection (+ its payload_locked_documents_rels column).
 * 3. `attendance_records.activity_id` (nullable; null = daily homeroom).
 * 4. unique(student, date) becomes two partial unique indexes: one homeroom record per
 *    student per day, and one record per student per day per activity.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  -- 1. status enum: rename, never drop/recreate
  ALTER TYPE "public"."enum_attendance_records_status" RENAME VALUE 'left_early' TO 'resigned';

  -- 2. activities collection
  CREATE TYPE "public"."enum_activities_type" AS ENUM('subject', 'activity');
  CREATE TABLE "activities" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"type" "enum_activities_type" DEFAULT 'subject' NOT NULL,
  	"name" varchar NOT NULL,
  	"description" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  CREATE INDEX "activities_updated_at_idx" ON "activities" USING btree ("updated_at");
  CREATE INDEX "activities_created_at_idx" ON "activities" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "activities_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_activities_fk" FOREIGN KEY ("activities_id") REFERENCES "public"."activities"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_activities_id_idx" ON "payload_locked_documents_rels" USING btree ("activities_id");

  -- 3. attendance_records.activity (ON DELETE set null is never reached: Activity's
  --    beforeDelete hook refuses to delete an activity that records still use)
  ALTER TABLE "attendance_records" ADD COLUMN "activity_id" integer;
  ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "attendance_records_activity_idx" ON "attendance_records" USING btree ("activity_id");

  -- 4. uniqueness: drop unique(student, date), add the two partial indexes
  DROP INDEX "student_date_idx";
  CREATE UNIQUE INDEX "attendance_records_student_date_homeroom_idx" ON "attendance_records" USING btree ("student_id","date") WHERE "attendance_records"."activity_id" IS NULL;
  CREATE UNIQUE INDEX "attendance_records_student_date_activity_idx" ON "attendance_records" USING btree ("student_id","date","activity_id") WHERE "attendance_records"."activity_id" IS NOT NULL;`)
}

/**
 * Reverse of `up`. Fails by design while activity records exist that would
 * duplicate a homeroom (student, date) once `activity_id` is gone — delete those
 * first; nothing is silently merged.
 */
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  DROP INDEX "attendance_records_student_date_activity_idx";
  DROP INDEX "attendance_records_student_date_homeroom_idx";
  ALTER TABLE "attendance_records" DROP CONSTRAINT "attendance_records_activity_id_activities_id_fk";
  DROP INDEX "attendance_records_activity_idx";
  ALTER TABLE "attendance_records" DROP COLUMN "activity_id";
  CREATE UNIQUE INDEX "student_date_idx" ON "attendance_records" USING btree ("student_id","date");

  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_activities_fk";
  DROP INDEX "payload_locked_documents_rels_activities_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "activities_id";
  DROP TABLE "activities";
  DROP TYPE "public"."enum_activities_type";

  ALTER TYPE "public"."enum_attendance_records_status" RENAME VALUE 'resigned' TO 'left_early';`)
}
