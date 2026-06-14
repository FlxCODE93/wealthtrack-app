-- WealthTrack — Migration PostgreSQL
-- Usage: psql $DATABASE_URL -f server/migration.sql

CREATE TABLE IF NOT EXISTS transactions (
  id             SERIAL PRIMARY KEY,
  profile_id     VARCHAR(50)    NOT NULL DEFAULT 'default',
  date           DATE,
  description    TEXT           NOT NULL,
  amount         DECIMAL(12, 2) NOT NULL,
  category       VARCHAR(50)    NOT NULL,
  confidence     DECIMAL(4, 3),
  user_corrected BOOLEAN        DEFAULT FALSE,
  created_at     TIMESTAMP      DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tx_profile  ON transactions (profile_id);
CREATE INDEX IF NOT EXISTS idx_tx_date     ON transactions (profile_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_tx_category ON transactions (category);

-- Vue utile pour le dashboard
CREATE OR REPLACE VIEW tx_summary AS
  SELECT
    profile_id,
    category,
    COUNT(*)                          AS count,
    SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) AS total_in,
    SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END) AS total_out
  FROM transactions
  GROUP BY profile_id, category;
