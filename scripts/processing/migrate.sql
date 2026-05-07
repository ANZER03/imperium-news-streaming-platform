DO $$
BEGIN
    IF to_regclass('public.phase3_cleaned_articles') IS NOT NULL
       AND to_regclass('public.imperium_articles') IS NULL THEN
        ALTER TABLE public.phase3_cleaned_articles RENAME TO imperium_articles;
    END IF;

    IF to_regclass('public.phase3_projection_state') IS NOT NULL
       AND to_regclass('public.imperium_projection_state') IS NULL THEN
        ALTER TABLE public.phase3_projection_state RENAME TO imperium_projection_state;
    END IF;

    IF to_regclass('public.phase3_topic_taxonomy') IS NOT NULL
       AND to_regclass('public.imperium_topic_taxonomy') IS NULL THEN
        ALTER TABLE public.phase3_topic_taxonomy RENAME TO imperium_topic_taxonomy;
    END IF;

    IF to_regclass('public.phase3_topic_embeddings') IS NOT NULL
       AND to_regclass('public.imperium_topic_embeddings') IS NULL THEN
        ALTER TABLE public.phase3_topic_embeddings RENAME TO imperium_topic_embeddings;
    END IF;
END $$;

ALTER TABLE IF EXISTS public.imperium_articles
    DROP COLUMN IF EXISTS is_visible,
    DROP COLUMN IF EXISTS is_deleted;

ALTER TABLE IF EXISTS public.imperium_projection_state
    DROP COLUMN IF EXISTS is_visible,
    DROP COLUMN IF EXISTS is_deleted;

DO $$
DECLARE
    rename_pair record;
BEGIN
    FOR rename_pair IN
        SELECT *
        FROM (VALUES
            ('phase3_dim_links', 'imperium_dim_links'),
            ('phase3_dim_authorities', 'imperium_dim_authorities'),
            ('phase3_dim_seditions', 'imperium_dim_seditions'),
            ('phase3_dim_countries', 'imperium_dim_countries'),
            ('phase3_dim_rubrics', 'imperium_dim_rubrics'),
            ('phase3_dim_languages', 'imperium_dim_languages')
        ) AS pairs(old_name, new_name)
    LOOP
        IF to_regclass('public.' || rename_pair.old_name) IS NOT NULL
           AND to_regclass('public.' || rename_pair.new_name) IS NULL THEN
            EXECUTE format('ALTER TABLE public.%I RENAME TO %I', rename_pair.old_name, rename_pair.new_name);
        END IF;
    END LOOP;
END $$;
