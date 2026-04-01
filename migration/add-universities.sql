-- Migration: add universities table for Database module
-- Safe to run multiple times.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS universities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  abbreviation TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure unique abbreviation (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS idx_universities_abbreviation_unique
  ON universities (abbreviation);

CREATE INDEX IF NOT EXISTS idx_universities_name
  ON universities (name);

ALTER TABLE universities ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'universities'
      AND policyname = 'Service role full access'
  ) THEN
    CREATE POLICY "Service role full access"
      ON universities
      FOR ALL
      USING (true);
  END IF;
END $$;
