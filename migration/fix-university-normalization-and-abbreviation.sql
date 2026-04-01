-- Migration: auto-fill normalized_name and enforce case-insensitive unique abbreviation
-- Applies to both table variants if they exist:
--   - university_references
--   - univeristy_references (legacy typo)

CREATE OR REPLACE FUNCTION public.set_university_normalized_name()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.normalized_name := lower(btrim(NEW.name));
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  target_table text;
  table_exists boolean;
  has_normalized_name boolean;
  has_name boolean;
  has_abbreviation boolean;
  duplicate_key text;
  duplicate_count bigint;
BEGIN
  FOREACH target_table IN ARRAY ARRAY['university_references', 'univeristy_references']
  LOOP
    table_exists := to_regclass(format('public.%I', target_table)) IS NOT NULL;
    IF NOT table_exists THEN
      RAISE NOTICE 'Skipping %. Table not found.', target_table;
      CONTINUE;
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = target_table
        AND column_name = 'normalized_name'
    ) INTO has_normalized_name;

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = target_table
        AND column_name = 'name'
    ) INTO has_name;

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = target_table
        AND column_name = 'abbreviation'
    ) INTO has_abbreviation;

    IF NOT has_normalized_name OR NOT has_name OR NOT has_abbreviation THEN
      RAISE NOTICE 'Skipping %. Required columns are missing.', target_table;
      CONTINUE;
    END IF;

    EXECUTE format(
      'UPDATE public.%I
       SET normalized_name = lower(btrim(name))
       WHERE normalized_name IS DISTINCT FROM lower(btrim(name));',
      target_table
    );

    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_set_normalized_name ON public.%I;',
      target_table
    );

    EXECUTE format(
      'CREATE TRIGGER trg_set_normalized_name
       BEFORE INSERT OR UPDATE OF name
       ON public.%I
       FOR EACH ROW
       EXECUTE FUNCTION public.set_university_normalized_name();',
      target_table
    );

    duplicate_key := NULL;
    duplicate_count := NULL;

    EXECUTE format(
      'SELECT lower(btrim(abbreviation)) AS normalized_key, count(*) AS total
       FROM public.%I
       WHERE abbreviation IS NOT NULL
       GROUP BY lower(btrim(abbreviation))
       HAVING count(*) > 1
       ORDER BY total DESC, normalized_key
       LIMIT 1;',
      target_table
    )
    INTO duplicate_key, duplicate_count;

    IF duplicate_key IS NOT NULL THEN
      RAISE EXCEPTION
        'Cannot enforce case-insensitive unique abbreviation on %. Duplicate key "%" appears % times.',
        target_table,
        duplicate_key,
        duplicate_count;
    END IF;

    EXECUTE format(
      'CREATE UNIQUE INDEX IF NOT EXISTS %I
       ON public.%I ((lower(btrim(abbreviation))));',
      format('idx_%s_abbreviation_normalized_unique', target_table),
      target_table
    );

    RAISE NOTICE 'Updated table %.', target_table;
  END LOOP;
END $$;
