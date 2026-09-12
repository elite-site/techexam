-- ============================================================
-- ELITE Online Examination Management System - Schema
-- Supabase PostgreSQL (Postgres 17)
-- ============================================================

CREATE TABLE IF NOT EXISTS students (
  id            BIGSERIAL PRIMARY KEY,
  roll_number   TEXT NOT NULL UNIQUE,
  student_name  TEXT NOT NULL,
  year          TEXT DEFAULT '',
  section       TEXT DEFAULT '',
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE students ADD COLUMN IF NOT EXISTS round2_winner boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS admins (
  id            SERIAL PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tests (
  id               BIGSERIAL PRIMARY KEY,
  name             TEXT NOT NULL,
  type             TEXT NOT NULL DEFAULT 'quiz',   -- 'quiz' | 'debugging'
  round            INTEGER,                        -- 1 / 2 / NULL
  duration_seconds INTEGER NOT NULL DEFAULT 1800,
  status           TEXT NOT NULL DEFAULT 'STOPPED',-- 'ACTIVE' | 'STOPPED'
  started_at       TIMESTAMPTZ,
  stopped_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS questions (
  id             BIGSERIAL PRIMARY KEY,
  test_id        BIGINT NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  question_text  TEXT NOT NULL,
  question_type  TEXT NOT NULL DEFAULT 'mcq',  -- 'mcq' | 'text' | 'code'
  option_a       TEXT,
  option_b       TEXT,
  option_c       TEXT,
  option_d       TEXT,
  correct_answer TEXT,
  marks          NUMERIC(6,2) NOT NULL DEFAULT 1,
  question_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_questions_test ON questions(test_id);

CREATE TABLE IF NOT EXISTS attempts (
  id           BIGSERIAL PRIMARY KEY,
  student_id   BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  test_id      BIGINT NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  status       TEXT NOT NULL DEFAULT 'IN_PROGRESS', -- 'IN_PROGRESS' | 'SUBMITTED' | 'EXPIRED'
  score        NUMERIC(8,2) DEFAULT 0,
  correct_count INTEGER DEFAULT 0,
  total_count   INTEGER DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_student_test UNIQUE (student_id, test_id)
);
CREATE INDEX IF NOT EXISTS idx_attempts_test ON attempts(test_id);
CREATE INDEX IF NOT EXISTS idx_attempts_student ON attempts(student_id);

CREATE TABLE IF NOT EXISTS answers (
  id            BIGSERIAL PRIMARY KEY,
  attempt_id    BIGINT NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  question_id   BIGINT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  student_answer TEXT,
  marks_awarded NUMERIC(6,2) DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_attempt_question UNIQUE (attempt_id, question_id)
);
CREATE INDEX IF NOT EXISTS idx_answers_attempt ON answers(attempt_id);