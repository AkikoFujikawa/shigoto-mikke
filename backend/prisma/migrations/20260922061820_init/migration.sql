-- CreateEnum
CREATE TYPE "contract_status" AS ENUM ('trial', 'active');

-- CreateEnum
CREATE TYPE "academic_category" AS ENUM ('liberal_arts', 'science', 'mixed');

-- CreateTable
CREATE TABLE "schools" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "school_code" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "schools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "school_admins" (
    "id" SERIAL NOT NULL,
    "school_id" INTEGER NOT NULL,
    "firebase_uid" VARCHAR(128) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "school_admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "students" (
    "id" SERIAL NOT NULL,
    "school_id" INTEGER NOT NULL,
    "nickname" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contracts" (
    "id" SERIAL NOT NULL,
    "school_id" INTEGER NOT NULL,
    "status" "contract_status" NOT NULL DEFAULT 'trial',
    "trial_ends_at" TIMESTAMPTZ NOT NULL,
    "stripe_customer_id" VARCHAR(64),
    "stripe_subscription_id" VARCHAR(64),
    "activated_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stripe_events" (
    "event_id" VARCHAR(64) NOT NULL,
    "type" VARCHAR(64) NOT NULL,
    "processed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stripe_events_pkey" PRIMARY KEY ("event_id")
);

-- CreateTable
CREATE TABLE "interests" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "label" VARCHAR(30) NOT NULL,
    "emoji" VARCHAR(8) NOT NULL,
    "sort_order" SMALLINT NOT NULL,

    CONSTRAINT "interests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "traits" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "label" VARCHAR(30) NOT NULL,
    "description" VARCHAR(200) NOT NULL,
    "sort_order" SMALLINT NOT NULL,

    CONSTRAINT "traits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" INTEGER NOT NULL,
    "text" VARCHAR(100) NOT NULL,
    "sort_order" SMALLINT NOT NULL,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_options" (
    "id" INTEGER NOT NULL,
    "question_id" INTEGER NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "emoji" VARCHAR(8),
    "trait_id" INTEGER NOT NULL,
    "sort_order" SMALLINT NOT NULL,

    CONSTRAINT "question_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_groups" (
    "id" INTEGER NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "sort_order" SMALLINT NOT NULL,

    CONSTRAINT "job_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" INTEGER NOT NULL,
    "job_group_id" INTEGER NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "summary" VARCHAR(120) NOT NULL,
    "description" TEXT NOT NULL,
    "image_url" VARCHAR(255),
    "emoji" VARCHAR(8),
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_interests" (
    "job_id" INTEGER NOT NULL,
    "interest_id" INTEGER NOT NULL,

    CONSTRAINT "job_interests_pkey" PRIMARY KEY ("job_id","interest_id")
);

-- CreateTable
CREATE TABLE "job_traits" (
    "job_id" INTEGER NOT NULL,
    "trait_id" INTEGER NOT NULL,

    CONSTRAINT "job_traits_pkey" PRIMARY KEY ("job_id","trait_id")
);

-- CreateTable
CREATE TABLE "academic_fields" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(40) NOT NULL,
    "category" "academic_category" NOT NULL,
    "representative_topics" VARCHAR(200),
    "sort_order" SMALLINT NOT NULL,

    CONSTRAINT "academic_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_academic_fields" (
    "job_id" INTEGER NOT NULL,
    "academic_field_id" INTEGER NOT NULL,

    CONSTRAINT "job_academic_fields_pkey" PRIMARY KEY ("job_id","academic_field_id")
);

-- CreateTable
CREATE TABLE "diagnoses" (
    "id" SERIAL NOT NULL,
    "student_id" INTEGER NOT NULL,
    "input_hash" CHAR(64) NOT NULL,
    "ai_model" VARCHAR(40),
    "used_fallback" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diagnoses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagnosis_interests" (
    "diagnosis_id" INTEGER NOT NULL,
    "interest_id" INTEGER NOT NULL,

    CONSTRAINT "diagnosis_interests_pkey" PRIMARY KEY ("diagnosis_id","interest_id")
);

-- CreateTable
CREATE TABLE "diagnosis_answers" (
    "diagnosis_id" INTEGER NOT NULL,
    "question_id" INTEGER NOT NULL,
    "option_id" INTEGER NOT NULL,

    CONSTRAINT "diagnosis_answers_pkey" PRIMARY KEY ("diagnosis_id","question_id")
);

-- CreateTable
CREATE TABLE "diagnosis_strengths" (
    "diagnosis_id" INTEGER NOT NULL,
    "rank" SMALLINT NOT NULL,
    "trait_id" INTEGER NOT NULL,
    "description" VARCHAR(200) NOT NULL,

    CONSTRAINT "diagnosis_strengths_pkey" PRIMARY KEY ("diagnosis_id","rank")
);

-- CreateTable
CREATE TABLE "diagnosis_jobs" (
    "diagnosis_id" INTEGER NOT NULL,
    "rank" SMALLINT NOT NULL,
    "job_id" INTEGER NOT NULL,
    "score" SMALLINT NOT NULL,
    "why_text" VARCHAR(300) NOT NULL,

    CONSTRAINT "diagnosis_jobs_pkey" PRIMARY KEY ("diagnosis_id","rank")
);

-- CreateIndex
CREATE UNIQUE INDEX "schools_school_code_key" ON "schools"("school_code");

-- CreateIndex
CREATE UNIQUE INDEX "school_admins_firebase_uid_key" ON "school_admins"("firebase_uid");

-- CreateIndex
CREATE INDEX "school_admins_school_id_idx" ON "school_admins"("school_id");

-- CreateIndex
CREATE INDEX "students_school_id_idx" ON "students"("school_id");

-- CreateIndex
CREATE INDEX "students_created_at_idx" ON "students"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_school_id_key" ON "contracts"("school_id");

-- CreateIndex
CREATE UNIQUE INDEX "interests_code_key" ON "interests"("code");

-- CreateIndex
CREATE UNIQUE INDEX "traits_code_key" ON "traits"("code");

-- CreateIndex
CREATE INDEX "job_interests_interest_id_idx" ON "job_interests"("interest_id");

-- CreateIndex
CREATE INDEX "job_traits_trait_id_idx" ON "job_traits"("trait_id");

-- CreateIndex
CREATE UNIQUE INDEX "academic_fields_name_key" ON "academic_fields"("name");

-- CreateIndex
CREATE INDEX "diagnoses_student_id_created_at_idx" ON "diagnoses"("student_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "diagnoses_input_hash_idx" ON "diagnoses"("input_hash");

-- CreateIndex
CREATE UNIQUE INDEX "diagnosis_jobs_diagnosis_id_job_id_key" ON "diagnosis_jobs"("diagnosis_id", "job_id");

-- AddForeignKey
ALTER TABLE "school_admins" ADD CONSTRAINT "school_admins_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_options" ADD CONSTRAINT "question_options_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_options" ADD CONSTRAINT "question_options_trait_id_fkey" FOREIGN KEY ("trait_id") REFERENCES "traits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_job_group_id_fkey" FOREIGN KEY ("job_group_id") REFERENCES "job_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_interests" ADD CONSTRAINT "job_interests_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_interests" ADD CONSTRAINT "job_interests_interest_id_fkey" FOREIGN KEY ("interest_id") REFERENCES "interests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_traits" ADD CONSTRAINT "job_traits_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_traits" ADD CONSTRAINT "job_traits_trait_id_fkey" FOREIGN KEY ("trait_id") REFERENCES "traits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_academic_fields" ADD CONSTRAINT "job_academic_fields_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_academic_fields" ADD CONSTRAINT "job_academic_fields_academic_field_id_fkey" FOREIGN KEY ("academic_field_id") REFERENCES "academic_fields"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnoses" ADD CONSTRAINT "diagnoses_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnosis_interests" ADD CONSTRAINT "diagnosis_interests_diagnosis_id_fkey" FOREIGN KEY ("diagnosis_id") REFERENCES "diagnoses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnosis_interests" ADD CONSTRAINT "diagnosis_interests_interest_id_fkey" FOREIGN KEY ("interest_id") REFERENCES "interests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnosis_answers" ADD CONSTRAINT "diagnosis_answers_diagnosis_id_fkey" FOREIGN KEY ("diagnosis_id") REFERENCES "diagnoses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnosis_answers" ADD CONSTRAINT "diagnosis_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnosis_answers" ADD CONSTRAINT "diagnosis_answers_option_id_fkey" FOREIGN KEY ("option_id") REFERENCES "question_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnosis_strengths" ADD CONSTRAINT "diagnosis_strengths_diagnosis_id_fkey" FOREIGN KEY ("diagnosis_id") REFERENCES "diagnoses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnosis_strengths" ADD CONSTRAINT "diagnosis_strengths_trait_id_fkey" FOREIGN KEY ("trait_id") REFERENCES "traits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnosis_jobs" ADD CONSTRAINT "diagnosis_jobs_diagnosis_id_fkey" FOREIGN KEY ("diagnosis_id") REFERENCES "diagnoses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnosis_jobs" ADD CONSTRAINT "diagnosis_jobs_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
