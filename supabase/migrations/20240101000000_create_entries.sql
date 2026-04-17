-- Create entries table (idempotent)
CREATE TABLE IF NOT EXISTS entries (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  text       text        NOT NULL,
  chapter    text        NOT NULL DEFAULT 'general',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE entries ENABLE ROW LEVEL SECURITY;

-- Public read policy
DROP POLICY IF EXISTS "public read" ON entries;
CREATE POLICY "public read"
  ON entries FOR SELECT
  USING (true);

-- Public insert policy
DROP POLICY IF EXISTS "public insert" ON entries;
CREATE POLICY "public insert"
  ON entries FOR INSERT
  WITH CHECK (true);

-- Add to realtime publication (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename  = 'entries'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE entries;
  END IF;
END $$;
