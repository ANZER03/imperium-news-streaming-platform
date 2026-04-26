CREATE TABLE IF NOT EXISTS phase3_projection_state
(
    article_id text PRIMARY KEY,
    country_id integer,
    root_topic_id integer,
    published_at timestamp with time zone,
    is_visible boolean NOT NULL,
    is_deleted boolean NOT NULL,
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS phase3_projection_state_country_idx
    ON phase3_projection_state (country_id);

CREATE INDEX IF NOT EXISTS phase3_projection_state_root_topic_idx
    ON phase3_projection_state (root_topic_id);

CREATE INDEX IF NOT EXISTS phase3_projection_state_visibility_idx
    ON phase3_projection_state (is_visible, is_deleted);
